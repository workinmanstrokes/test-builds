/* Web portal adapter (Poki / CrazyGames). Inert unless the portal build sets window.AS_PORTAL = "poki" | "crazygames".
   Maps the game's ad + analytics hooks (AS.native.*) onto the portal SDK:
   loading finished, gameplay start/stop, commercial break before play, rewarded ads -> the same rewards as the app.
   If the SDK is missing (ad blocker, offline, local file) the game still runs: no ads, rewarded buttons stay hidden. */
(function(AS){
"use strict";
var kind=window.AS_PORTAL,N=AS.native;
if(!N||(kind!=="poki"&&kind!=="crazygames"))return;
var P={kind:kind,ready:false,inGameplay:false,log:[],lastMidgame:0,adOpen:false};
N.portal=P;N.AD.bannerId=N.AD.rewardId="";   // no AdMob on the web build
function ev(n){P.log.push(n);}
function sdk(){return kind==="poki"?window.PokiSDK:(window.CrazyGames&&window.CrazyGames.SDK);}
// pause sound + keyboard while an ad is on screen
function adStart(){if(P.adOpen)return;P.adOpen=true;AS.adActive=true;if(AS.sfx)AS.sfx.duck(true);if(AS.input)AS.input.reset();ev("adStart");}
function adEnd(){if(!P.adOpen)return;P.adOpen=false;AS.adActive=false;if(AS.sfx)AS.sfx.duck(false);ev("adEnd");}
var initP=new Promise(function(res){
  var S=sdk();if(!S){ev("noSdk");res(false);return;}
  try{
    if(kind==="poki")S.init().then(function(){res(true);},function(){res(true);}); // Poki: "load your game anyway" on failure
    else S.init().then(function(){try{S.game.loadingStart();ev("loadingStart");}catch(e){}res(true);},function(){res(false);});
  }catch(e){res(false);}
}).then(function(ok){P.ready=ok;N.AD.rewardReady=ok;ev(ok?"init":"initFail");return ok;});
P.whenReady=initP;
var loaded=false;
N.loadingDone=function(){initP.then(function(ok){if(!ok||loaded)return;loaded=true;var S=sdk();
  try{if(kind==="poki")S.gameLoadingFinished();else S.game.loadingStop();ev("loadingFinished");}catch(e){}});};
N.gameplay=function(on){on=!!on;if(on===P.inGameplay)return;P.inGameplay=on;initP.then(function(ok){if(!ok)return;var S=sdk();
  try{if(kind==="poki")(on?S.gameplayStart:S.gameplayStop).call(S);else (on?S.game.gameplayStart:S.game.gameplayStop).call(S.game);ev(on?"gameplayStart":"gameplayStop");}catch(e){}});};
N.rewardAvailable=function(){return P.ready&&!P.adOpen;};
// rewarded: resolves only when the portal says the video completed; any failure rejects (no reward)
N.showReward=function(){
  if(!P.ready||P.adOpen)return Promise.reject(new Error("no ad"));
  var S=sdk();ev("rewardedRequest");
  return new Promise(function(res,rej){
    try{
      if(kind==="poki"){adStart();S.rewardedBreak(function(){adStart();}).then(function(ok){adEnd();ev(ok?"rewardedDone":"rewardedFail");ok?res({}):rej(new Error("not watched"));},function(e){adEnd();ev("rewardedFail");rej(e||new Error("ad error"));});}
      else S.ad.requestAd("rewarded",{adStarted:adStart,adFinished:function(){adEnd();ev("rewardedDone");res({});},adError:function(e){adEnd();ev("rewardedFail");rej(e||new Error("ad error"));}});
    }catch(e){adEnd();rej(e);}
  });
};
// commercial break at natural pauses (before a run starts / retry). Poki decides itself whether to show one;
// CrazyGames midgames are additionally spaced >= 3 min apart on our side.
function commercial(after){
  var done=false,fin=function(){if(done)return;done=true;adEnd();if(after)after();};
  if(!P.ready){fin();return;}
  var S=sdk();ev("commercialBreak");
  try{
    if(kind==="poki"){S.commercialBreak(function(){adStart();}).then(fin,fin);}
    else{var now=Date.now();if(now-P.lastMidgame<180000){fin();return;}P.lastMidgame=now;S.ad.requestAd("midgame",{adStarted:adStart,adFinished:fin,adError:fin});}
  }catch(e){fin();}
  setTimeout(fin,45000); // never strand the player if the SDK never calls back
}
N.breakBeforePlay=commercial;
N.maybeInterstitial=commercial;
N.showBanner=N.hideBanner=function(){};
N.privacyRequired=function(){return false;};
})(window.AS);
