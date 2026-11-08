/* Aether Surge — polish pass 4 (combat feel + run flow): pure rules, no DOM, so it is
   unit-tested in Node (tests/polish.test.js). Wired in by game.js / render.js / audio.js.
   - Low HP: at or below 30% max HP the game shows a pulsing danger vignette and a
     heartbeat thump about once a second until the player heals above 30% or dies.
   - Combo milestones: x25 / x50 / x100 combo, once per run each, pays a small mote
     bonus and fires a banner + chime.
   - Quit confirm: the pause menu's QUIT RUN is two-tap — first tap arms it for 3 s,
     second tap quits; arming expires on its own so an accidental first tap is harmless. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var LOW_HP=0.30,HEARTBEAT=0.9;
var MILESTONES=[{at:25,motes:5},{at:50,motes:10},{at:100,motes:25}];
function lowHp(hp,maxHp){return hp>0&&maxHp>0&&hp/maxHp<=LOW_HP;}
// combo = current kill combo; hit = map of milestone values already paid this run (mutated).
// Returns the milestones newly reached, in order.
function milestones(combo,hit){var out=[];
  for(var i=0;i<MILESTONES.length;i++){var m=MILESTONES[i];
    if(combo>=m.at&&!hit[m.at]){hit[m.at]=1;out.push(m);}}
  return out;}
// Two-tap confirm state machine. st = {armed:0} holding the arm time in seconds;
// now = current time in seconds. Returns {label, fired}.
function confirmStep(st,now){
  if(st.armed&&now-st.armed<=3){st.armed=0;return {label:"QUIT RUN",fired:true};}
  st.armed=now;return {label:"TAP AGAIN TO QUIT",fired:false};}
// Call on a tick: clears an expired arm. Returns true if it cleared one.
function confirmTick(st,now){if(st.armed&&now-st.armed>3){st.armed=0;return true;}return false;}
var P={LOW_HP:LOW_HP,HEARTBEAT:HEARTBEAT,MILESTONES:MILESTONES,
  lowHp:lowHp,milestones:milestones,confirmStep:confirmStep,confirmTick:confirmTick};
AS.polish=P;
if(typeof module!=="undefined"&&module.exports)module.exports=P;
})(typeof window!=="undefined"?window:globalThis);
