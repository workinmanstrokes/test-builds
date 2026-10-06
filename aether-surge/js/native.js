/* Native bridge (Capacitor): AdMob, haptics, status bar, splash, app lifecycle; plus save data. */
(function(AS){
"use strict";
var isNative=typeof Capacitor!=="undefined"&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform();
var Plugins=(typeof Capacitor!=="undefined"&&Capacitor.Plugins)||{};
// Google's official TEST ad unit IDs — replace before release (see PUBLISHING.md)
var AD={bannerId:"ca-app-pub-3940256099942544/6300978111",interId:"ca-app-pub-3940256099942544/1033173712",rewardId:"ca-app-pub-3940256099942544/5224354917",interReady:false,rewardReady:false,runCount:0};
var hooks={};
var lastHap=0;
function haptic(style){
  if(!isNative||!Plugins.Haptics)return;
  var now=Date.now();if(style==="LIGHT"||!style){if(now-lastHap<90)return;}lastHap=now;
  try{Plugins.Haptics.impact({style:style||"LIGHT"});}catch(e){}
}
function loadInterstitial(){if(!isNative||!Plugins.AdMob)return;AD.interReady=false;Plugins.AdMob.prepareInterstitial({adId:AD.interId,isTesting:true}).then(function(){AD.interReady=true;}).catch(function(){});}
function loadReward(){if(!isNative||!Plugins.AdMob)return;AD.rewardReady=false;Plugins.AdMob.prepareRewardVideoAd({adId:AD.rewardId,isTesting:true}).then(function(){AD.rewardReady=true;if(hooks.onRewardReady)hooks.onRewardReady();}).catch(function(){});}
function showBanner(){if(!isNative||!Plugins.AdMob)return;try{Plugins.AdMob.showBanner({adId:AD.bannerId,adSize:"ADAPTIVE_BANNER",position:"BOTTOM_CENTER",isTesting:true});}catch(e){}}
function hideBanner(){if(!isNative||!Plugins.AdMob)return;try{Plugins.AdMob.hideBanner();}catch(e){}}
// Interstitial on every 2nd retry/continue (only counted when an ad is ready)
function maybeInterstitial(after){if(isNative&&Plugins.AdMob&&AD.interReady){AD.runCount++;if(AD.runCount%2===0){try{Plugins.AdMob.showInterstitial();}catch(e){}loadInterstitial();}}if(after)after();}
function showReward(){
  if(!isNative||!Plugins.AdMob||!AD.rewardReady)return Promise.reject(new Error("no ad"));
  AD.rewardReady=false;
  return Plugins.AdMob.showRewardVideoAd().then(function(r){loadReward();return r;},function(e){loadReward();throw e;});
}
function init(h){
  hooks=h||{};
  if(!isNative)return;
  try{if(Plugins.StatusBar){Plugins.StatusBar.setBackgroundColor({color:"#06060e"}).catch(function(){});Plugins.StatusBar.setStyle({style:"DARK"}).catch(function(){});}}catch(e){}
  try{if(Plugins.SplashScreen)Plugins.SplashScreen.hide();}catch(e){}
  try{if(Plugins.AdMob)Plugins.AdMob.initialize({initializeForTesting:true}).then(function(){loadInterstitial();loadReward();}).catch(function(){});}catch(e){}
  try{if(Plugins.App){
    Plugins.App.addListener("backButton",function(){if(hooks.onBack)hooks.onBack();});
    Plugins.App.addListener("appStateChange",function(st){if(!st.isActive&&hooks.onBackground)hooks.onBackground();});
  }}catch(e){}
}
function exitApp(){try{if(Plugins.App)Plugins.App.exitApp();}catch(e){}}
AS.native={isNative:isNative,AD:AD,haptic:haptic,showBanner:showBanner,hideBanner:hideBanner,maybeInterstitial:maybeInterstitial,showReward:showReward,loadReward:loadReward,init:init,exitApp:exitApp};

/* ---------- Save data ----------
   v1 (legacy): localStorage "as_best" = {pl, stage}; "as_m" = "1" when muted.
   v2 (M1):     localStorage "as_save_v2" = {v:2, best:{pl,time,wins,lv,kills,legacyStage}}.
   v3 (M2):     localStorage "as_save_v3" = {v:3, best:{...v2, fastWin}, motes, earned, altar:{id:rank}}.
   Older saves are migrated on first load and left in place (so an older build can still read them). */
var KEY="as_save_v3";
function blank(){return {v:3,best:{pl:0,time:0,wins:0,lv:0,kills:0,legacyStage:0,fastWin:0,combo:0},motes:0,earned:0,altar:{}};}
var data=blank();
function num(x){return typeof x==="number"&&isFinite(x)&&x>=0;}
function copyBest(src){if(!src)return;for(var k in data.best){if(num(src[k]))data.best[k]=src[k];}}
function read(k){try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}}
function load(){
  data=blank();
  var raw=read(KEY);
  if(raw&&raw.v===3){
    copyBest(raw.best);
    if(num(raw.motes))data.motes=Math.floor(raw.motes);
    if(num(raw.earned))data.earned=Math.floor(raw.earned);
    if(raw.altar&&typeof raw.altar==="object"){for(var k in raw.altar){if(num(raw.altar[k]))data.altar[k]=Math.floor(raw.altar[k]);}}
    data.migratedFrom=null;
  }else{
    var v2=read("as_save_v2");
    if(v2&&v2.v===2&&v2.best){copyBest(v2.best);data.migratedFrom=2;}
    else{
      var old=read("as_best");
      if(old&&typeof old==="object"){if(num(old.pl))data.best.pl=old.pl;if(num(old.stage))data.best.legacyStage=old.stage;data.migratedFrom=1;}
    }
    write();
  }
  return data;
}
function write(){try{var o={v:3,best:data.best,motes:data.motes,earned:data.earned,altar:data.altar};localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
// run = {pl,time,won,lv,kills}; returns flags of which bests were beaten
function record(run){
  var b=data.best,f={};
  if(run.pl>b.pl){b.pl=run.pl;f.pl=true;}
  if(run.time>b.time){b.time=run.time;f.time=true;}
  if(run.lv>b.lv){b.lv=run.lv;f.lv=true;}
  if(run.kills>b.kills){b.kills=run.kills;f.kills=true;}
  if(run.combo>b.combo){b.combo=run.combo;f.combo=true;}
  if(run.won){b.wins++;f.win=true;if(!b.fastWin||run.time<b.fastWin){b.fastWin=run.time;f.fast=true;}}
  write();return f;
}
function addMotes(n){n=Math.max(0,Math.floor(n));data.motes+=n;data.earned+=n;write();return data.motes;}
function rank(id){return data.altar[id]||0;}
// buy next rank; returns true on success
function buy(a){var r=rank(a.id);if(r>=a.max)return false;var c=AS.altarCost(a,r);if(data.motes<c)return false;data.motes-=c;data.altar[a.id]=r+1;write();return true;}
function spentTotal(){var t=0;(AS.ALTAR||[]).forEach(function(a){for(var r=0;r<rank(a.id);r++)t+=AS.altarCost(a,r);});return t;}
function refundAll(){var t=spentTotal();data.motes+=t;data.altar={};write();return t;}
function getMuted(){try{return localStorage.getItem("as_m")==="1";}catch(e){return false;}}
function setMuted(m){try{localStorage.setItem("as_m",m?"1":"0");}catch(e){}}
AS.save={load:load,record:record,get:function(){return data;},getMuted:getMuted,setMuted:setMuted,KEY:KEY,addMotes:addMotes,rank:rank,buy:buy,refundAll:refundAll,spentTotal:spentTotal};
})(window.AS);
