/* Aether Surge — main menu: Play (mode select), Gear, Store, Heroes. UI only; rules live in meta.js. */
(function(AS){
"use strict";
var MT=AS.meta,N=AS.native,S=AS.sfx;
function $(id){return document.getElementById(id);}
function fmt(n){return Math.floor(n).toLocaleString();}
function save(){MT.save();}
var st={tab:"Play",mode:"surge",slot:"weapon",item:null,fight:"warden",mods:[]};
try{var sm=localStorage.getItem("as_mode");if(sm==="surge"||sm==="tower"||sm==="boss")st.mode=sm;var sb=JSON.parse(localStorage.getItem("as_bosscfg")||"null");
  if(sb&&MT.bossFight(sb.fight)){st.fight=sb.fight;st.mods=(sb.mods||[]).filter(function(m){return MT.BOSS_MODS.some(function(x){return x.id===m;});});}}catch(e){}
function remember(){try{localStorage.setItem("as_mode",st.mode);localStorage.setItem("as_bosscfg",JSON.stringify({fight:st.fight,mods:st.mods}));}catch(e){}}
function rar(r){return MT.RARITIES[r];}
function tap(){if(S&&S.lvl)try{S.ensure();}catch(e){}N.haptic("LIGHT");}

/* ---------- top bar + badges ---------- */
function renderTop(){
  var s=MT.get();
  $("cGold").textContent="🪙 "+fmt(s.gold);$("cGems").textContent="💎 "+fmt(s.gems);$("cShards").textContent="🔹 "+fmt(s.shards);
  var mc=MT.claimable(s,Date.now()),mb=$("missBadge");mb.textContent=mc;mb.classList.toggle("on",mc>0);
  var now=Date.now(),sbn=(MT.freeReady(s,now)?1:0),sb=$("storeBadge");sb.textContent=sbn?"!":"";sb.classList.toggle("on",!!sbn);
}

/* ---------- tabs ---------- */
function setTab(t){
  st.tab=t;["Play","Gear","Store","Chars"].forEach(function(k){$("tab"+k).classList.toggle("on",k===t);});
  Array.prototype.forEach.call(document.querySelectorAll("#mTabs .tb"),function(b){b.classList.toggle("on",b.getAttribute("data-t")===t);});
  render();
}
$("mTabs").addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".tb");if(!b)return;tap();setTab(b.getAttribute("data-t"));});
function render(){
  renderTop();
  if(st.tab==="Play")renderPlay();else if(st.tab==="Gear")renderGear();else if(st.tab==="Store")renderStore();else renderChars();
}

/* ---------- Play ---------- */
var MODE_DESC={
  surge:"Classic: survive 5:00 in the Rift, then destroy the Rift Sentinel.",
  tower:"Roguelike climb: short floors, pick a path between them, a boss every 5th floor. How high can you go?",
  boss:"Elite Boss Fights: build up, then take on bosses with modifiers for gems."
};
function renderPlay(){
  var s=MT.get(),c=MT.charDef(s.ch);
  Array.prototype.forEach.call(document.querySelectorAll("#modeRow .mode"),function(b){b.classList.toggle("sel",b.getAttribute("data-m")===st.mode);});
  $("towerBest").textContent=s.tower.best?"Best floor "+s.tower.best:"Best —";
  var f=MT.bossFight(st.fight);$("bossInfo").textContent=f?f.n.split(" ").pop():"Elite fights";
  MT.refreshMissions(s,Date.now());var done=s.ms.daily.concat(s.ms.weekly).filter(function(e){return e.c;}).length;
  $("missInfo").textContent=done+"/"+(s.ms.daily.length+s.ms.weekly.length)+" done";
  var d=MODE_DESC[st.mode];if(st.mode==="boss")d="Elite Boss Fight: "+f.n+(st.mods.length?" + "+st.mods.map(function(m){return m.charAt(0).toUpperCase()+m.slice(1);}).join(", "):"")+". Tap Bosses to change.";
  $("modeDesc").textContent=d;
  $("heroTag").textContent=c.n+" · "+c.t+" · Gear power "+MT.power(s);
  $("go").textContent=st.mode==="tower"?"▶ CLIMB":st.mode==="boss"?"▶ FIGHT":"▶ PLAY";
}
$("modeRow").addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest(".mode");if(!b)return;tap();var m=b.getAttribute("data-m");
  if(m==="missions"){openMissions();return;}
  if(m==="boss"){openBossSel();return;}
  st.mode=m;remember();renderPlay();
});
function selected(){
  if(st.mode==="tower")return {mode:"tower"};
  if(st.mode==="boss")return {mode:"boss",fight:st.fight,mods:st.mods.slice()};
  return {mode:"surge"};
}

/* ---------- Elite Boss Fights picker ---------- */
function openBossSel(){renderBossSel();$("start").style.display="none";$("bossSel").style.display="flex";}
function closeBossSel(){$("bossSel").style.display="none";$("start").style.display="flex";render();}
function bossIcon(f){var A=AS.art,k=A&&f.bosses.length===1&&A.bossArt[f.bosses[0]];return k&&A.has(k)?'<img class="ai boss" alt="" src="'+A.spriteURL(k)+'">':(f.id==="rush"?"⚔":"☠");}
function renderBossSel(){
  var s=MT.get(),h="";
  MT.BOSS_FIGHTS.forEach(function(f){var cl=s.boss.clears[f.id]||0;
    h+='<div class="uc fight'+(f.id===st.fight?" sel":"")+'" data-f="'+f.id+'"><div class="ui">'+bossIcon(f)+'</div><div class="uf"><h3>'+f.n+(cl?' <span class="rk">✔ '+cl+'</span>':' <span class="rk new">NEW</span>')+'</h3><p>'+
      (f.bosses.length>1?"All 3 bosses back to back":"Start at level "+f.lv+" • one elite boss")+' • 💎 '+f.gems+' 🪙 '+f.gold+'</p></div></div>';});
  $("fightList").innerHTML=h;
  h="";MT.BOSS_MODS.forEach(function(m){h+='<button class="modb'+(st.mods.indexOf(m.id)>=0?" on":"")+'" data-m="'+m.id+'"><b>'+m.i+" "+m.n+'</b>'+m.d+'</button>';});
  $("modList").innerHTML=h;
  var r=MT.bossReward(s,st.fight,st.mods,Date.now());
  $("fightReward").textContent="Win: 🪙 "+fmt(r.gold)+" • 💎 "+r.gems+(r.first?" (first win: 2x gems)":r.repeat?" (already won today: 25%)":"");
}
$("fightList").addEventListener("click",function(e){var c=e.target.closest&&e.target.closest(".fight");if(!c)return;tap();st.fight=c.getAttribute("data-f");remember();renderBossSel();});
$("modList").addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".modb");if(!b)return;tap();var m=b.getAttribute("data-m"),i=st.mods.indexOf(m);if(i>=0)st.mods.splice(i,1);else st.mods.push(m);remember();renderBossSel();});
$("fightGo").addEventListener("click",function(){st.mode="boss";remember();$("bossSel").style.display="none";AS.game.start(selected());});
$("fightBack").addEventListener("click",function(){st.mode="boss";remember();closeBossSel();});

/* ---------- sheet (missions, odds, chest results, settings) ---------- */
var sheetKind=null;
function openSheet(html,kind){
  restoreSettings();sheetKind=kind||"info";$("sheetBody").innerHTML=html;$("sheet").style.display="flex";
}
function closeSheet(){restoreSettings();$("sheet").style.display="none";sheetKind=null;render();}
$("sheetClose").addEventListener("click",function(){tap();closeSheet();});
function restoreSettings(){var b=$("settingsBox");if(b.parentNode!==document.body){b.style.display="none";document.body.appendChild(b);}}
$("setBtn").addEventListener("click",function(){tap();openSheet("","settings");var b=$("settingsBox");b.style.display="flex";$("sheetBody").appendChild(b);renderMute();});
function renderMute(){$("muteBtn2").textContent=S.isMuted()?"🔇 Sound: OFF":"🔊 Sound: ON";}
$("muteBtn2").addEventListener("click",function(){var m=S.toggleMute();$("mute").textContent=m?"🔇":"🔊";renderMute();});

function untilTxt(ms){ms=Math.max(0,ms);var h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return h?h+"h "+m+"m":m+"m "+(s<10?"0":"")+s+"s";}
function openMissions(){
  var s=MT.get(),now=Date.now();MT.refreshMissions(s,now);
  var tomorrow=new Date(now);tomorrow.setHours(24,0,0,0);
  var wk=new Date(now);wk.setHours(0,0,0,0);wk.setDate(wk.getDate()+((8-wk.getDay())%7||7));
  var row=function(e){var m=MT.mission(e.id),pct=Math.min(100,e.p/m.goal*100),ready=!e.c&&e.p>=m.goal;
    return '<div class="ms"><div class="mf"><b>'+MT.missionText(m)+'</b><br><small>'+fmt(Math.min(e.p,m.goal))+" / "+fmt(m.goal)+' • 🪙 '+m.gold+' 💎 '+m.gems+'</small><div class="mbar"><i style="width:'+pct+'%"></i></div></div>'+
      (e.c?'<span class="rk">✔ DONE</span>':'<button class="sbtn claim" data-id="'+e.id+'"'+(ready?"":" disabled")+'>CLAIM</button>')+'</div>';};
  var h='<h2>🎯 MISSIONS</h2><div class="shead">DAILY • resets in '+untilTxt(tomorrow-now)+'</div>'+s.ms.daily.map(row).join("")+
    '<div class="shead">WEEKLY • resets in '+untilTxt(wk-now)+'</div>'+s.ms.weekly.map(row).join("")+
    '<p class="note">Progress counts in every mode. Gems also come from Elite Boss Fights, Tower milestones (every 5 floors) and Surge clears.</p>';
  openSheet(h,"missions");
}
$("sheetBody").addEventListener("click",function(e){
  var c=e.target.closest&&e.target.closest(".claim");if(c&&!c.disabled){var r=MT.claim(MT.get(),c.getAttribute("data-id"),Date.now());if(r.ok){save();S.clear();N.haptic("MEDIUM");}openMissions();renderTop();return;}
});

/* ---------- Gear ---------- */
function renderGear(){
  var s=MT.get(),h="";$("gPower").textContent="• power "+MT.power(s);
  MT.SLOTS.forEach(function(sl){var id=s.eq[sl],it=s.inv[id],d=MT.gearDef(id),R=it?rar(it.r):rar(0);
    h+='<button class="slot'+(sl===st.slot?" sel":"")+'" data-s="'+sl+'" style="border-color:'+R.c+'"><b>'+(d?d.i:MT.SLOT_INFO[sl].i)+'</b>'+MT.SLOT_INFO[sl].n+'<small>'+(it?"Lv "+it.lv:"—")+'</small></button>';});
  $("slotRow").innerHTML=h;
  var cur=st.item&&s.inv[st.item]&&MT.gearDef(st.item).slot===st.slot?st.item:s.eq[st.slot];st.item=cur;
  renderDetail(cur);
  var owned=MT.GEAR.filter(function(g){return g.slot===st.slot;}).sort(function(a,b){var A=s.inv[a.id],B=s.inv[b.id];return (B?B.r*100+B.lv:-1)-(A?A.r*100+A.lv:-1);});
  h="";owned.forEach(function(g){var it=s.inv[g.id];
    if(!it){h+='<div class="gi lock"><div class="ui">?</div><div class="uf"><h3>'+g.n+'</h3><p>Not found yet • drops from chests</p></div></div>';return;}
    var R=rar(it.r);h+='<div class="gi'+(s.eq[st.slot]===g.id?" eq":"")+'" data-g="'+g.id+'" style="border-color:'+R.c+'"><div class="ui">'+g.i+'</div><div class="uf"><h3>'+g.n+' <span class="rk" style="color:'+R.c+'">'+R.n.toUpperCase()+'</span> <span class="rk">Lv '+it.lv+'</span></h3><p>'+MT.statText(MT.itemStats(g.id,it.r,it.lv))+'</p></div>'+(s.eq[st.slot]===g.id?'<span class="rk">EQUIPPED</span>':'')+'</div>';});
  $("gearList").innerHTML=h;
}
function renderDetail(id){
  var s=MT.get(),it=s.inv[id],d=MT.gearDef(id),el=$("gearDetail");
  if(!it||!d){el.innerHTML="<p>Nothing equipped</p>";return;}
  var R=rar(it.r),max=it.lv>=R.max,c=MT.upgradeCost(it.r,it.lv),can=!max&&MT.canAfford(s,c),eq=s.eq[d.slot]===id;
  el.style.borderColor=R.c;
  el.innerHTML='<h3>'+d.i+' '+d.n+' <span class="rk" style="color:'+R.c+'">'+R.n.toUpperCase()+'</span></h3>'+
    '<p>Level '+it.lv+' / '+R.max+'</p><p><b>'+MT.statText(MT.itemStats(id,it.r,it.lv))+'</b></p>'+
    (max?'<p>Max level for '+R.n+'. Find a higher-rarity copy in chests to promote it.</p>':'<p>Next: '+MT.statText(MT.itemStats(id,it.r,it.lv+1))+'</p>')+
    '<div class="row">'+(eq?'<button class="btn alt" disabled>EQUIPPED</button>':'<button class="btn alt" id="eqBtn">EQUIP</button>')+
    '<button class="btn" id="upBtn"'+(can?"":" disabled")+'>'+(max?"MAX":"UPGRADE 🪙 "+fmt(c.gold)+(c.shards?" 🔹 "+c.shards:""))+'</button></div>';
  var eb=$("eqBtn");if(eb)eb.onclick=function(){tap();MT.equip(s,id);save();render();};
  $("upBtn").onclick=function(){var r=MT.upgrade(s,id);if(r.ok){save();S.lvl();N.haptic("MEDIUM");}render();};
}
$("slotRow").addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".slot");if(!b)return;tap();st.slot=b.getAttribute("data-s");st.item=null;renderGear();});
$("gearList").addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".gi");if(!b||!b.getAttribute("data-g"))return;tap();st.item=b.getAttribute("data-g");renderGear();});

/* ---------- Store ---------- */
function costTxt(c){var p=[];if(c.gold)p.push("🪙 "+fmt(c.gold));if(c.gems)p.push("💎 "+fmt(c.gems));return p.join(" ")||"FREE";}
function renderStore(){
  var s=MT.get(),now=Date.now(),C=MT.CHESTS,h="",adOK=N.isNative&&N.AD.rewardReady,adLeft=MT.adLeft(s,now);
  var chest=function(c,btn,desc,cls){return '<div class="chest'+(cls?" "+cls:"")+'"><div class="ci">'+c.i+'</div><div class="uf"><h3>'+c.n+'</h3><p>'+desc+'</p></div><div class="cb">'+btn+'<button class="sbtn odds" data-odds="'+c.id+'">Odds</button></div></div>';};
  h+='<div class="shead">GEAR CHESTS • bought with gold from runs</div>';
  var fr=MT.freeReady(s,now);
  h+=chest(C.free,'<button class="sbtn buy" data-c="free"'+(fr?"":" disabled")+'>'+(fr?"OPEN":untilTxt(s.freeAt-now))+'</button>',"A free gear chest every 4 hours.");
  h+=chest(C.ad,'<button class="sbtn buy" data-c="ad"'+(adOK&&adLeft>0?"":" disabled")+'>'+(adLeft<=0?"TOMORROW":"▶ WATCH")+'</button>',
    (N.isNative?(adOK?"Watch an optional ad for a chest with better odds.":"Loading ad…"):"Optional ad chest (Android app only).")+" "+adLeft+"/"+C.ad.daily+" left today.");
  h+=chest(C.gear,'<button class="sbtn buy" data-c="gear"'+(MT.canAfford(s,C.gear.cost)?"":" disabled")+'>'+costTxt(C.gear.cost)+'</button>',"1 random gear piece.");
  h+=chest(C.grand,'<button class="sbtn buy" data-c="grand"'+(MT.canAfford(s,C.grand.cost)?"":" disabled")+'>'+costTxt(C.grand.cost)+'</button>',C.grand.note);
  var locked=MT.lockedChars(s).length,left=MT.PREMIUM.pity-s.pity;
  h+='<div class="shead">PREMIUM • bought with gems (earned by playing)</div>';
  h+=chest(C.premium,'<button class="sbtn buy" data-c="premium"'+(MT.canAfford(s,C.premium.cost)?"":" disabled")+'>'+costTxt(C.premium.cost)+'</button>',
    locked?"Chance at a new hero, or Epic/Legendary gear. A new hero is guaranteed within "+left+" more chest"+(left===1?"":"s")+".":"All heroes unlocked: Epic or Legendary gear.","prem");
  h+='<div class="shead">GEM PACKS</div><div class="chest"><div class="ci">💎</div><div class="uf"><h3>Gem packs</h3><p>Not available. Every gem can be earned by playing.</p></div><div class="cb"><button class="sbtn" disabled>SOON</button></div></div>';
  h+='<p class="note" style="font-size:11px;color:#7a90b8;margin-top:6px">Duplicates turn into 🔹 shards for upgrades. A copy of an item at a higher rarity promotes the one you own.</p>';
  $("storeList").innerHTML=h;
}
$("storeList").addEventListener("click",function(e){
  var o=e.target.closest&&e.target.closest(".odds");if(o){tap();showOdds(o.getAttribute("data-odds"));return;}
  var b=e.target.closest&&e.target.closest(".buy");if(!b||b.disabled)return;var id=b.getAttribute("data-c"),s=MT.get();
  if(id==="ad"){b.disabled=true;N.showReward().then(function(){reveal(MT.openChest(s,"ad",Date.now()),"ad");}).catch(function(){render();});return;}
  reveal(id==="premium"?MT.openPremium(s,Date.now()):MT.openChest(s,id,Date.now()),id);
});
function oddsRows(od){return MT.RARITIES.map(function(R,i){return od[i]?'<tr><td style="color:'+R.c+'">'+R.n+'</td><td>'+od[i]+'%</td></tr>':"";}).join("");}
function showOdds(id){
  var C=MT.CHESTS[id],s=MT.get(),h='<h2>'+C.i+' '+C.n+' — drop odds</h2>';
  if(id==="premium"){var od=MT.premiumOdds(s);
    h+='<table><tr><td>New hero (random locked hero)</td><td>'+od.char+'%</td></tr><tr><td style="color:#ffc040">Legendary gear</td><td>'+od.legendary+'%</td></tr><tr><td style="color:#d07aff">Epic gear</td><td>'+od.epic+'%</td></tr></table>'+
      '<p class="note">Pity: if you open '+MT.PREMIUM.pity+' Premium Chests without a hero, the '+MT.PREMIUM.pity+'th is a guaranteed hero (counter: '+s.pity+'/'+MT.PREMIUM.pity+'). The counter resets when you get a hero.</p>'+
      '<p class="note">Gear piece: equal chance for each of the '+MT.GEAR.length+' gear items.</p>';}
  else{h+='<p class="note">Each item rolls its rarity independently:</p><table>'+oddsRows(C.odds)+'</table>';
    if(C.last)h+='<p class="note">4th item (Rare or better):</p><table>'+oddsRows(C.last)+'</table>';
    h+='<p class="note">Gear piece: equal chance ('+(Math.round(10000/MT.GEAR.length)/100)+'%) for each of the '+MT.GEAR.length+' gear items. Duplicates at the same or lower rarity become shards (Common 5, Uncommon 10, Rare 20, Epic 40, Legendary 80).</p>';}
  h+='<p class="note">Chests are bought only with in-game currency earned by playing. No real-money purchases.</p>';
  openSheet(h,"odds");
}
function reveal(res,id){
  if(!res||!res.ok){render();return;}
  save();S.clear();N.haptic("HEAVY");
  var h='<h2>'+MT.CHESTS[id].i+' '+MT.CHESTS[id].n+'</h2><div class="reveal">',chars=[];
  res.results.forEach(function(r){
    if(r.kind==="char"){var c=MT.charDef(r.id);chars.push(c);h+='<div class="gi" style="border-color:#ffe566"><canvas class="rvc" width="96" height="96" style="width:48px;height:48px"></canvas><div class="uf"><h3>NEW HERO: '+c.n+' <span class="rk">'+c.t+'</span></h3><p>'+c.d+(r.pity?" (pity guarantee)":"")+'</p></div></div>';return;}
    var d=MT.gearDef(r.id),R=rar(r.r),tag=r.kind==="new"?'<span class="rk new">NEW</span>':r.kind==="upgrade"?'<span class="rk new">PROMOTED</span>':'<span class="rk">+'+r.shards+' 🔹</span>';
    h+='<div class="gi" style="border-color:'+R.c+'"><div class="ui">'+d.i+'</div><div class="uf"><h3>'+d.n+' <span class="rk" style="color:'+R.c+'">'+R.n.toUpperCase()+'</span> '+tag+'</h3><p>'+MT.SLOT_INFO[d.slot].n+' • '+MT.statText(MT.itemStats(d.id,r.r,1))+'</p></div></div>';});
  h+='</div>';openSheet(h,"reveal");
  var cvs=document.querySelectorAll(".rvc");chars.forEach(function(c,i){if(cvs[i]&&AS.render.portrait)AS.render.portrait(cvs[i],c,1);});
  renderTop();
}

/* ---------- Heroes ---------- */
var portraitT=0;
function renderChars(){
  var s=MT.get(),h="";
  MT.CHARS.forEach(function(c){var own=!!s.chars[c.id],sel=s.ch===c.id;
    h+='<div class="cc'+(sel?" sel":"")+(own?"":" lock")+'"><canvas width="144" height="144" data-c="'+c.id+'"></canvas><div class="uf"><h3>'+c.n+' <i>'+c.t+'</i></h3><p>'+c.d+'</p>'+
      (own?(sel?'<span class="rk">SELECTED</span>':'<button class="sbtn pick" data-c="'+c.id+'">SELECT</button>'):'<span class="rk tag">🔒 Premium Chest</span>')+'</div></div>';});
  $("charList").innerHTML=h;drawPortraits();
}
function drawPortraits(){if(!AS.render.portrait)return;Array.prototype.forEach.call(document.querySelectorAll("#charList canvas"),function(cv){AS.render.portrait(cv,MT.charDef(cv.getAttribute("data-c")),portraitT);});}
$("charList").addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".pick");if(!b)return;tap();if(MT.selectChar(MT.get(),b.getAttribute("data-c"))){save();if(AS.game.menuInit)AS.game.menuInit();}render();});

/* ---------- lifecycle ---------- */
function visible(){return $("start").style.display==="flex";}
setInterval(function(){
  if(!visible())return;renderTop();
  if(st.tab==="Store"&&$("sheet").style.display!=="flex")renderStore();
},1000);
setInterval(function(){if(visible()&&st.tab==="Chars"){portraitT+=0.12;drawPortraits();}},120);
function show(){if(st.tab!=="Play")setTab("Play");else render();}
function back(){
  if($("sheet").style.display==="flex"){closeSheet();return true;}
  if($("bossSel").style.display==="flex"){closeBossSel();return true;}
  if(st.tab!=="Play"){setTab("Play");return true;}
  return false;
}
AS.menu={show:show,selected:selected,back:back,setTab:setTab,render:render,openMissions:openMissions,showOdds:showOdds,state:st};
var w=MT.get().welcome;
render();
if(w&&!MT.get().welcomeShown){MT.get().welcomeShown=true;MT.get().welcome=null;save();
  setTimeout(function(){openSheet('<h2>✨ NEW: Gear, Store, Heroes & Modes</h2><p>Thanks for playing! For your progress so far you get a welcome gift:</p><p style="font-size:18px;font-weight:900;text-align:center;margin:10px 0">🪙 '+fmt(w.gold)+(w.gems?' • 💎 '+w.gems:'')+'</p><p class="note">Your Aether Motes, Resonance Altar and records are all kept.</p>',"welcome");},300);}
})(window.AS);
