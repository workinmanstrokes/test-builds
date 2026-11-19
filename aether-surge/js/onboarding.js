/* Aether Surge — Dark Rift balance update: 30-second first-run onboarding.
 * Four prompts, in order, on a fresh player's FIRST run only (localStorage
 * "as_onboarded_v1"): move -> collect shards -> first 1-of-3 level-up
 * explained in one line -> boss warning. The step machine (OB.next) is pure
 * and Node-testable; only show()/hide() touch the DOM (#onb in index.html).
 * Tapping the prompt skips the tour. The 25s mark forces the boss warning and
 * the 30s mark ends the tour, so the whole thing fits in the first 30 seconds
 * of the run. Later runs never show it. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var OB={KEY:"as_onboarded_v1",BOSS_AT:25,END_AT:30};
OB.STEPS={
  move:{t:"👆 Move — drag the joystick, or WASD / arrow keys",s:"Tap to skip the tour"},
  shards:{t:"✦ Grab the glowing XP shards — they level you up",s:"Tap to skip the tour"},
  levelup:{t:"⬆ Level up! Pick 1 of 3 upgrades — each one shapes your build",s:"Tap to skip the tour"},
  boss:{t:"⚠ A boss arrives at 5:00 — keep moving, watch for the warning",s:"Tap to dismiss"}
};
OB.blank=function(){return {step:null,done:false,pendingBoss:false,started:false};};
/* Pure step machine: next(state, event) -> new state. Events: start, moved,
   shard, levelup (level-up screen opened), picked (an upgrade was chosen),
   bosswarn (25s mark or first boss spawn), end (30s mark), skip (tap). */
OB.next=function(st,ev){
  var s={step:st.step,done:st.done,pendingBoss:st.pendingBoss,started:st.started};
  if(s.done)return s;
  if(ev==="start"){s.started=true;s.step="move";return s;}
  if(ev==="skip"||ev==="end"){s.done=true;s.step=null;return s;}
  if(ev==="moved"&&s.step==="move"){s.step="shards";return s;}
  if(ev==="shard"&&s.step==="shards"){s.step="levelup";return s;}
  if(ev==="levelup"){return s;} // prompt already shows the 1-of-3 explanation
  if(ev==="picked"){if(s.step==="levelup")s.step=s.pendingBoss?"boss":null;return s;}
  if(ev==="bosswarn"){s.pendingBoss=true;s.step="boss";return s;}
  return s;};
function memStore(){var d={};return {getItem:function(k){return k in d?d[k]:null;},setItem:function(k,v){d[k]=String(v);},removeItem:function(k){delete d[k];}};}
var _mem=null,_store=null;
function ambient(){try{if(typeof localStorage!=="undefined"&&localStorage)return localStorage;}catch(e){}if(!_mem)_mem=memStore();return _mem;}
OB.store=function(s){if(s)_store=s;return _store||ambient();};
OB.state=OB.blank();
OB.shouldShow=function(store){try{return OB.store(store).getItem(OB.KEY)!=="1";}catch(e){return true;}};
OB._el=function(){if(typeof document==="undefined")return null;return document.getElementById("onb");};
OB._apply=function(prev){
  var el=OB._el();
  if(OB.state.done){try{OB.store().setItem(OB.KEY,"1");}catch(e){}}
  if(!el)return;
  if(!OB.state.step){el.style.display="none";return;}
  if(OB.state.step!==prev){var d=OB.STEPS[OB.state.step];el.innerHTML=d.t+"<small>"+d.s+"</small>";}
  el.style.display="block";};
OB._go=function(ev){if(OB.state.done&&ev!=="start")return;var prev=OB.state.step;OB.state=OB.next(OB.state,ev);OB._apply(prev);};
OB.begin=function(){if(!OB.shouldShow()){OB.state=OB.blank();OB.state.done=true;return false;}OB.state=OB.blank();OB._go("start");return true;};
OB.onMove=function(){OB._go("moved");};
OB.onShard=function(){OB._go("shard");};
OB.onLevelUp=function(){OB._go("levelup");};
OB.onPicked=function(){OB._go("picked");};
OB.onBossWarn=function(){OB._go("bosswarn");};
OB.tick=function(runT){if(!OB.state.started||OB.state.done)return;
  if(runT>=OB.END_AT)OB._go("end");
  else if(runT>=OB.BOSS_AT&&OB.state.step!=="boss")OB._go("bosswarn");};
OB.attach=function(){var el=OB._el();if(!el)return;
  el.addEventListener("click",function(e){e.stopPropagation();OB._go("skip");});};
AS.onboard=OB;
if(typeof module!=="undefined"&&module.exports){module.exports=OB;}
})(typeof window!=="undefined"?window:globalThis);
