/* Optional debug overlay: add ?debug=1 to the URL. FPS / frame-time / entity counts + stress tools. */
(function(AS){
"use strict";
var q=location.search||"";
if(!/[?&]debug=1/.test(q))return;
window.__AS=AS;
var G=AS.G,el=document.getElementById("dbg");el.style.display="block";
var frames=[],cpu=[],lastT=performance.now(),acc=0;
el.innerHTML='<div id="dbgT"></div><button data-a="stress">stress 300</button><button data-a="spawn">+100</button><button data-a="god">god</button><button data-a="skip">+60s</button><button data-a="auto">autopick</button><button data-a="sig">+sigils</button><button data-a="cache">+cache</button><button data-a="relic">+relic</button><button data-a="motes">+500 motes</button>';
var T=document.getElementById("dbgT");
el.addEventListener("click",function(e){
  var a=e.target.getAttribute&&e.target.getAttribute("data-a");if(!a)return;e.stopPropagation();
  if(a==="stress"){G.stress=!G.stress;G.god=G.stress;G.autoPick=G.stress;}
  else if(a==="spawn")AS.game._spawnRegular(100);
  else if(a==="god")G.god=!G.god;
  else if(a==="skip")G.runT+=60;
  else if(a==="auto")G.autoPick=!G.autoPick;
  else if(a==="sig")["arc","nova","gyre","star"].forEach(function(id){for(var k=0;k<3;k++)AS.sigils.grant(id);});
  else if(a==="cache")G.queue.push({k:"cache"});
  else if(a==="relic")G.queue.push({k:"relic",tier:1});
  else if(a==="motes"){AS.save.addMotes(500);}
});
function pct(arr,p){if(!arr.length)return 0;var s=arr.slice().sort(function(a,b){return a-b;});return s[Math.min(s.length-1,Math.floor(s.length*p))];}
function tick(now){
  var dt=now-lastT;lastT=now;frames.push(dt);cpu.push(AS.perf.last||0);
  if(frames.length>120){frames.shift();cpu.shift();}
  acc+=dt;
  if(acc>250){acc=0;
    var avg=frames.reduce(function(a,b){return a+b;},0)/frames.length;
    var cavg=cpu.reduce(function(a,b){return a+b;},0)/cpu.length;
    T.textContent="fps "+(1000/avg).toFixed(0)+" | cpu "+cavg.toFixed(2)+"ms p95 "+pct(cpu,0.95).toFixed(2)+
      " | E "+G.eCount+" P "+G.pCount+" EP "+G.epCount+" S "+G.sCount+" L "+G.loot.length+" | t "+Math.floor(G.runT||0)+"s"+
      (G.stress?" STRESS":"")+(G.god?" GOD":"")+(G.autoPick?" AUTO":"");
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
})(window.AS);
