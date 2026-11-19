/* Aether Surge — Dark Rift balance update: per-run playtest telemetry.
 * Logs what the Game Test Lab review (VEX, 5.0/10) asked to be proven with
 * data, not assertions: XP-to-level time, deaths by wave, and boss attempts,
 * plus real-device stress samples (FPS + live enemy count at maximum wave
 * density). Pure logic is Node-testable; storage is localStorage
 * ("as_playtest_v1", last 20 sessions) in the browser, an injected store in
 * tests. Run data only — no PII, no user IDs. Export with PT.download()
 * (also on the ?debug=1 overlay) and read the summary on the results screen. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var PT={KEY:"as_playtest_v1",MAX_SESSIONS:20,MAX_STRESS:600};
function r1(n){return Math.round(n*10)/10;}
function memStore(){var d={};return {getItem:function(k){return k in d?d[k]:null;},setItem:function(k,v){d[k]=String(v);},removeItem:function(k){delete d[k];}};}
var _mem=null,_store=null;
function ambient(){try{if(typeof localStorage!=="undefined"&&localStorage)return localStorage;}catch(e){}if(!_mem)_mem=memStore();return _mem;}
PT.store=function(s){if(s)_store=s;return _store||ambient();};
/* ---- pure helpers (no DOM, no storage) ---- */
/* Schedule-row index (0-based) active at runT; +1 in stored records = wave no. */
PT.waveAt=function(schedule,runT){var w=0;for(var i=0;i<schedule.length;i++)if(schedule[i].t<=runT)w=i;return w;};
/* Published wave table, derived from the live schedule + enemy XP values:
   one row per schedule step: time window, HP x, damage x, spawns/sec and
   mix-weighted average XP per kill. Must equal AS.WAVE_TABLE (data.js). */
PT.waveTable=function(schedule,etypes){
  var rows=[];
  for(var i=0;i<schedule.length;i++){var s=schedule[i],tot=0,xp=0,k;
    for(k in s.mix){tot+=s.mix[k];xp+=s.mix[k]*((etypes[k]||{}).xp||0);}
    rows.push({w:i+1,from:s.t,to:i+1<schedule.length?schedule[i+1].t:300,hp:s.hp,dmg:s.dmg,rate:s.rate,xp:tot?Math.round(xp/tot*10)/10:0});}
  return rows;};
PT.blank=function(){return {v:1,startedAt:0,endedAt:0,mode:"surge",won:false,levels:[],deaths:[],bosses:[],stress:[],shards:0};};
PT.current=null;
PT.begin=function(mode){var s=PT.blank();s.mode=mode||"surge";try{s.startedAt=Date.now();}catch(e){s.startedAt=0;}PT.current=s;return s;};
PT.levelUp=function(lv,runT){if(!PT.current)return;PT.current.levels.push({lv:lv,t:r1(runT)});};
PT.shard=function(){if(PT.current)PT.current.shards++;};
PT.death=function(runT,schedule){if(!PT.current)return;PT.current.deaths.push({t:r1(runT),wave:PT.waveAt(schedule||AS.SCHEDULE||[],runT)+1});};
PT.bossAttempt=function(key,runT){if(!PT.current)return;PT.current.bosses.push({boss:key,t:r1(runT),outcome:"spawned"});};
PT.bossOutcome=function(key,won,runT){if(!PT.current)return;for(var i=PT.current.bosses.length-1;i>=0;i--){var b=PT.current.bosses[i];if(b.boss===key&&b.outcome==="spawned"){b.outcome=won?"slain":"escaped";b.endT=r1(runT);return;}}};
PT.stress=function(fps,enemies,runT){if(!PT.current)return;var s=PT.current.stress;if(s.length>=PT.MAX_STRESS)return;s.push({t:r1(runT),fps:fps,e:enemies});};
PT.summaryText=function(s){s=s||PT.current;if(!s)return "No playtest data yet.";
  var lv=s.levels.map(function(l){return "Lv"+l.lv+" @ "+l.t+"s";}).join(", ")||"no level-ups";
  var de=s.deaths.length?s.deaths.map(function(d){return "wave "+d.wave+" @ "+d.t+"s";}).join(", "):"no deaths";
  var bo=s.bosses.length?s.bosses.map(function(b){return b.boss+" "+b.outcome;}).join(", "):"no boss fights";
  var st="no stress samples";
  if(s.stress.length){var min=s.stress[0].fps,maxE=0;for(var i=0;i<s.stress.length;i++){if(s.stress[i].fps<min)min=s.stress[i].fps;if(s.stress[i].e>maxE)maxE=s.stress[i].e;}
    st="min FPS "+min+" @ "+maxE+" enemies ("+s.stress.length+" samples)";}
  return lv+" • Deaths: "+de+" • Bosses: "+bo+" • Stress: "+st;};
PT.end=function(won,store){if(!PT.current)return null;var s=PT.current;s.won=!!won;try{s.endedAt=Date.now();}catch(e){s.endedAt=0;}
  PT.current=null;var st=PT.store(store),list=PT.load(store);list.unshift(s);if(list.length>PT.MAX_SESSIONS)list.length=PT.MAX_SESSIONS;
  try{st.setItem(PT.KEY,JSON.stringify(list));}catch(e){}
  return s;};
PT.load=function(store){var st=PT.store(store),raw=null;try{raw=st.getItem(PT.KEY);}catch(e){}if(!raw)return [];
  try{var l=JSON.parse(raw);return Array.isArray(l)?l:[];}catch(e){return [];}};
PT.exportJSON=function(store){return JSON.stringify(PT.load(store),null,2);};
PT.download=function(store){if(typeof document==="undefined")return false;
  try{var blob=new Blob([PT.exportJSON(store)],{type:"application/json"}),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="aether-surge-playtest.json";a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},1000);return true;}catch(e){return false;}};
AS.playtest=PT;
if(typeof module!=="undefined"&&module.exports){module.exports=PT;}
})(typeof window!=="undefined"?window:globalThis);
