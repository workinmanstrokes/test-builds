/* CrazyGames SDK v3 adapter for Final Cast. Plain script, exposes window.FC_PORTAL.
   Active only in the CrazyGames build (window.PORTAL_BUILD='crazygames', set by tools/build-crazygames.mjs),
   with ?portal=crazygames for testing, or on a crazygames.com domain. Everywhere else every call is a no-op.
   Rewarded ads only (opt-in "double your away haul"); never midgame/interstitial ads.
   If the SDK is blocked the game runs normally and no rewarded offer is shown. */
(function(root){
'use strict';
var SDK_URL='https://sdk.crazygames.com/crazygames-sdk-v3.js';
function detect(){
  try{if(new URLSearchParams(root.location.search).get('portal')==='crazygames')return true}catch(e){}
  if(root.PORTAL_BUILD==='crazygames')return true;
  return /(^|\.)crazygames\.(com|io)$/.test((root.location&&root.location.hostname)||'');
}
var active=detect(),sdk=null,ready=null,playing=false,loaded=false,adOpen=false,log=[];
function call(n,f){log.push(n);if(sdk)try{f(sdk)}catch(e){console.warn('portal',n,e)}}
function timeout(p,ms){return Promise.race([p,new Promise(function(r){setTimeout(r,ms)})])}
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
function init(){
  if(!active)return Promise.resolve();
  if(ready)return ready;
  ready=(async function(){
    try{
      if(!(root.CrazyGames&&root.CrazyGames.SDK))await timeout(loadScript(SDK_URL),3000);
      var S=root.CrazyGames&&root.CrazyGames.SDK;
      if(S){await timeout(S.init(),3000);sdk=S;call('loadingStart',function(s){s.game.loadingStart()})}
    }catch(e){console.warn('CrazyGames SDK unavailable',e)}
    root.addEventListener('keydown',function(ev){if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight',' '].indexOf(ev.key)>=0&&ev.target===document.body)ev.preventDefault()});
  })();
  return ready;
}
function loadingFinished(){if(!active||loaded)return;loaded=true;var send=function(){call('loadingStop',function(s){s.game.loadingStop()})};if(sdk)send();else init().then(send)}
function gameplay(on){
  on=!!on;if(!active||adOpen||on===playing)return;playing=on;
  var send=function(){if(playing===on)call(on?'gameplayStart':'gameplayStop',function(s){on?s.game.gameplayStart():s.game.gameplayStop()})};
  if(sdk)send();else init().then(send); // synchronous once the SDK is up, so gameplayStop always precedes an ad request
}
/** Opt-in rewarded video. Resolves true only when the ad finished. */
function rewarded(){
  if(!sdk||adOpen)return Promise.resolve(false);
  var was=playing;gameplay(false);adOpen=true;log.push('rewarded');
  return new Promise(function(res){
    try{sdk.ad.requestAd('rewarded',{adStarted:function(){},adFinished:function(){res(true)},adError:function(){res(false)}})}catch(e){res(false)}
  }).then(function(ok){adOpen=false;if(was)gameplay(true);return ok});
}
root.FC_PORTAL={active:active,log:log,init:init,loadingFinished:loadingFinished,gameplay:gameplay,rewarded:rewarded,available:function(){return !!sdk&&!adOpen}};
if(active)init();
})(window);
