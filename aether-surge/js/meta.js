/* Aether Surge — meta progression: gear, chests, characters, currencies, missions, tower + elite boss configs.
   Pure logic (no DOM). Loads in the browser as AS.meta and in Node (unit tests) via require().
   Save: localStorage "as_meta_v1" (separate from the run/altar save "as_save_v3", which stays untouched).
   Everything here is earnable by playing. Real-money purchases are stubbed and switched OFF (IAP.enabled=false). */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var M={};
M.VERSION=1;
M.KEY="as_meta_v1";

/* ---------------- currencies ---------------- */
M.CURRENCY={
  gold:  {n:"Gold",   i:"🪙", d:"Earned every run. Buys gear chests and gear upgrades."},
  gems:  {n:"Gems",   i:"💎", d:"Earned slowly from missions, elite boss fights, tower milestones and Surge clears. Opens Premium Chests."},
  shards:{n:"Shards", i:"🔹", d:"From duplicate gear. Needed for higher gear levels."}
};

/* ---------------- gear ---------------- */
M.SLOTS=["weapon","armor","relic","boots"];
M.SLOT_INFO={weapon:{n:"Weapon",i:"⚔"},armor:{n:"Armor",i:"🛡"},relic:{n:"Core",i:"◈"},boots:{n:"Boots",i:"👢"}};
// m = stat multiplier, max = level cap, dup = shards from a duplicate at this rarity
M.RARITIES=[
  {id:"common",   n:"Common",   c:"#a8b8d0",m:1.0, max:10,dup:5},
  {id:"uncommon", n:"Uncommon", c:"#6ad07a",m:1.35,max:15,dup:10},
  {id:"rare",     n:"Rare",     c:"#5aa8ff",m:1.8, max:20,dup:20},
  {id:"epic",     n:"Epic",     c:"#d07aff",m:2.4, max:25,dup:40},
  {id:"legendary",n:"Legendary",c:"#ffc040",m:3.2, max:30,dup:80}
];
M.LV_GROWTH=0.06; // +6% of the item's rarity value per level above 1
// Stat keys line up with the in-run relic stats in game.js recalc(): dmg, rate (-fire interval), crit, critD, hp, armor,
// regen, abil (sigil dmg), cd (-sigil cooldowns), area, xp, leech, spd, pick. Extra: dash (-dash cooldown), gold (+gold earned).
M.STAT_TXT={dmg:"+{p}% damage",rate:"-{p}% fire interval",crit:"+{p}% crit chance",critD:"+{p}% crit damage",hp:"{s}{n} max HP",
  armor:"-{p}% damage taken",regen:"+{n} HP/s",abil:"+{p}% sigil damage",cd:"-{p}% sigil cooldowns",area:"+{p}% sigil area",
  xp:"+{p}% XP",leech:"+{p}% lifesteal",spd:"{s}{p}% move speed",pick:"+{p}% pickup radius",dash:"-{p}% dash cooldown",gold:"+{p}% gold"};
M.GEAR=[
  {id:"ember_wand",  slot:"weapon",n:"Ember Wand",     i:"🔥",st:{dmg:0.06},starter:true},
  {id:"storm_rod",   slot:"weapon",n:"Storm Rod",      i:"ϟ", st:{rate:0.035,dmg:0.025}},
  {id:"keen_edge",   slot:"weapon",n:"Keen Edge",      i:"✧", st:{crit:0.025,critD:0.08}},
  {id:"rift_cannon", slot:"weapon",n:"Rift Cannon",    i:"✹", st:{dmg:0.075}},
  {id:"sigil_staff", slot:"weapon",n:"Sigil Staff",    i:"✺", st:{abil:0.06,dmg:0.02}},
  {id:"padded_coat", slot:"armor", n:"Padded Coat",    i:"🧥",st:{hp:8},starter:true},
  {id:"warden_plate",slot:"armor", n:"Warden Plate",   i:"⛨", st:{hp:6,armor:0.012}},
  {id:"mender_robe", slot:"armor", n:"Mender's Robe",  i:"✚", st:{regen:0.15,hp:4}},
  {id:"thorn_mail",  slot:"armor", n:"Thornweave Mail",i:"✶", st:{armor:0.018,hp:3}},
  {id:"leech_cloak", slot:"armor", n:"Leech Cloak",    i:"🩸",st:{leech:0.004,hp:4}},
  {id:"dim_prism",   slot:"relic", n:"Dim Prism",      i:"◇", st:{xp:0.04},starter:true},
  {id:"focus_gem",   slot:"relic", n:"Focus Gem",      i:"◆", st:{cd:0.025}},
  {id:"star_shard",  slot:"relic", n:"Star Shard",     i:"☄", st:{area:0.04,abil:0.02}},
  {id:"lucky_coin",  slot:"relic", n:"Lucky Coin",     i:"🪙",st:{gold:0.05}},
  {id:"heartstone",  slot:"relic", n:"Heartstone",     i:"❦", st:{hp:5,regen:0.06}},
  {id:"worn_boots",  slot:"boots", n:"Worn Boots",     i:"👢",st:{spd:0.025},starter:true},
  {id:"windrunners", slot:"boots", n:"Windrunners",    i:"➶", st:{spd:0.03,pick:0.03}},
  {id:"lode_greaves",slot:"boots", n:"Lodestone Greaves",i:"🧲",st:{pick:0.10}},
  {id:"blink_boots", slot:"boots", n:"Blink Boots",    i:"»", st:{dash:0.04,spd:0.012}},
  {id:"ember_steps", slot:"boots", n:"Ember Steps",    i:"♨", st:{dmg:0.02,spd:0.015}}
];
M.gearDef=function(id){for(var k=0;k<M.GEAR.length;k++)if(M.GEAR[k].id===id)return M.GEAR[k];return null;};
M.itemMult=function(r,lv){return M.RARITIES[r].m*(1+M.LV_GROWTH*(Math.max(1,lv)-1));};
M.itemStats=function(id,r,lv){var d=M.gearDef(id),o={};if(!d)return o;var m=M.itemMult(r,lv);for(var s in d.st)o[s]=d.st[s]*m;return o;};
M.statText=function(st){
  var parts=[];
  for(var s in st){var v=st[s],t=M.STAT_TXT[s];if(!t)continue;
    parts.push(t.replace("{s}",v<0?"-":"+").replace("{p}",String(Math.round(Math.abs(v)*1000)/10)).replace("{n}",String(Math.round(Math.abs(v)*10)/10)));}
  return parts.join(", ");
};
// upgrade cost from level lv to lv+1 at rarity r
M.upgradeCost=function(r,lv){return {gold:Math.round(50*Math.pow(1.16,lv-1)*(1+0.25*r)),shards:lv<3?0:Math.ceil((lv-1)/2)*(1+r)};};

/* ---------------- characters (all original to Aether Surge) ---------------- */
// st = permanent stat changes (same keys as gear), ab = ability hook implemented in game.js (charTick / dash / orbs)
M.CHARS=[
  {id:"rift",  n:"Riftwalker",t:"The Surge-born",  ab:"ascend", d:"Balanced all-rounder. Can take Aether Ascension.", st:{},
   pal:{body:"#e07030",pants:"#2a3a6a",hair:"#1a1008",skin:"#e8c8a0",belt:"#d0a030",eye:"#111",aura:"#3a9fff"},acc:"spikes",starter:true},
  {id:"vesper",n:"Vesper",    t:"Stormcaller",     ab:"static", d:"Static Field: every 2.5s lightning chains through 4 nearby foes. -10 max HP.",st:{hp:-10},
   pal:{body:"#3b3fae",pants:"#1d1f4f",hair:"#dff4ff",skin:"#c8b8e8",belt:"#8fe8ff",eye:"#8fe8ff",aura:"#8fd8ff"},acc:"hood"},
  {id:"brakk", n:"Brakk",     t:"Ironclad",        ab:"quake",  d:"Quake Dash: every dash ends in a shockwave. +40 max HP, -10% damage taken, 8% slower.",st:{hp:40,armor:0.10,spd:-0.08},
   pal:{body:"#6a7486",pants:"#3a4250",hair:"#ffb040",skin:"#b0a090",belt:"#ffb040",eye:"#ffb040",aura:"#ffb040"},acc:"helm"},
  {id:"lumen", n:"Lumen",     t:"Starseer",        ab:"radiant",d:"Radiant Orbs: starts with Orbiting Orbs, and orb hits heal you. +0.3 HP/s.",st:{regen:0.3},
   pal:{body:"#f0f0ff",pants:"#5a6ab0",hair:"#ffe9a0",skin:"#f0d8c0",belt:"#ffd040",eye:"#3a6aff",aura:"#ffe9a0"},acc:"halo"}
];
M.charDef=function(id){for(var k=0;k<M.CHARS.length;k++)if(M.CHARS[k].id===id)return M.CHARS[k];return M.CHARS[0];};

/* ---------------- chests (odds are shown in the Store) ---------------- */
// odds = % per item for [common, uncommon, rare, epic, legendary]; the item itself is uniform over all 20 gear pieces
M.CHESTS={
  gear:   {id:"gear",   n:"Gear Chest",   i:"📦",cost:{gold:300}, items:1,odds:[55,28,13,3.5,0.5]},
  grand:  {id:"grand",  n:"Grand Chest",  i:"🧰",cost:{gold:1200},items:4,odds:[55,28,13,3.5,0.5],last:[0,0,78,18,4],
           note:"4 items. The 4th is always Rare or better."},
  free:   {id:"free",   n:"Free Chest",   i:"🎁",cost:{},         items:1,odds:[55,28,13,3.5,0.5],cooldown:4*3600*1000},
  ad:     {id:"ad",     n:"Bonus Chest",  i:"📺",cost:{},         items:1,odds:[40,32,20,7,1],daily:3,note:"Watch an optional ad. Up to 3 a day."},
  premium:{id:"premium",n:"Premium Chest",i:"💠",cost:{gems:150}, items:1}
};
// Premium chest: one reward. odds in %. If every character is unlocked, the character share moves to Legendary gear.
M.PREMIUM={char:12,legendary:23,epic:65,pity:8};
M.premiumOdds=function(save){var locked=M.lockedChars(save).length;
  return locked?{char:M.PREMIUM.char,legendary:M.PREMIUM.legendary,epic:M.PREMIUM.epic}:{char:0,legendary:M.PREMIUM.legendary+M.PREMIUM.char,epic:M.PREMIUM.epic};};

/* ---------------- real money: stubbed, OFF (no Play products exist) ---------------- */
M.IAP={enabled:false,packs:[{id:"gems_300",gems:300,label:"Pouch of Gems"},{id:"gems_1000",gems:1000,label:"Chest of Gems"}]};
M.buyGemPack=function(save,packId){
  if(!M.IAP.enabled)return {ok:false,reason:"disabled"};
  return {ok:false,reason:"not-implemented"}; // wire to Google Play Billing before enabling
};

/* ---------------- save ---------------- */
function num(x){return typeof x==="number"&&isFinite(x)&&x>=0;}
function int(x,d){return num(x)?Math.floor(x):(d||0);}
M.blank=function(){
  var s={v:M.VERSION,gold:0,gems:0,shards:0,inv:{},eq:{},chars:{rift:1},ch:"rift",pity:0,
    freeAt:0,ad:{day:"",n:0},stats:{chests:0,premium:0,upgrades:0,runs:0},
    tower:{best:0,milestones:0},boss:{clears:{},day:"",today:{}},
    ms:{day:"",week:"",daily:[],weekly:[]},welcome:null};
  M.GEAR.forEach(function(g){if(g.starter){s.inv[g.id]={r:0,lv:1};s.eq[g.slot]=g.id;}});
  return s;
};
var store=null;
M.setStorage=function(st){store=st;};
function ls(){if(store)return store;try{return root.localStorage||null;}catch(e){return null;}}
function readKey(k){try{var L=ls();return L?JSON.parse(L.getItem(k)||"null"):null;}catch(e){return null;}}
// Migrate: (a) a missing meta save gets a fresh one, seeded with a welcome gift sized to old progress in as_save_v3/v2/v1;
// (b) an older/partial meta save is sanitised field by field (unknown gear dropped, bad numbers reset, starters restored).
M.migrate=function(raw,legacy){
  var s=M.blank();
  if(!raw||typeof raw!=="object"||!num(raw.v)){
    var w=welcomeFor(legacy);s.gold+=w.gold;s.gems+=w.gems;s.welcome=w.gold||w.gems?w:null;s.migratedFrom=legacy?legacy.v||1:0;
    return s;
  }
  s.gold=int(raw.gold);s.gems=int(raw.gems);s.shards=int(raw.shards);s.pity=Math.min(int(raw.pity),M.PREMIUM.pity);s.freeAt=int(raw.freeAt);
  if(raw.inv&&typeof raw.inv==="object")for(var id in raw.inv){var it=raw.inv[id],d=M.gearDef(id);
    if(!d||!it)continue;var r=Math.min(M.RARITIES.length-1,int(it.r));s.inv[id]={r:r,lv:Math.max(1,Math.min(M.RARITIES[r].max,int(it.lv,1)))};}
  M.SLOTS.forEach(function(sl){var e=raw.eq&&raw.eq[sl],d=M.gearDef(e);if(d&&d.slot===sl&&s.inv[e])s.eq[sl]=e;});
  if(raw.chars&&typeof raw.chars==="object")for(var c in raw.chars)if(raw.chars[c]&&M.charDef(c).id===c)s.chars[c]=1;
  if(typeof raw.ch==="string"&&s.chars[raw.ch])s.ch=raw.ch;
  if(raw.ad&&typeof raw.ad.day==="string")s.ad={day:raw.ad.day,n:int(raw.ad.n)};
  if(raw.stats)for(var k in s.stats)s.stats[k]=int(raw.stats[k]);
  if(raw.tower){s.tower.best=int(raw.tower.best);s.tower.milestones=int(raw.tower.milestones);}
  if(raw.boss){if(raw.boss.clears)for(var b in raw.boss.clears)s.boss.clears[b]=int(raw.boss.clears[b]);
    if(typeof raw.boss.day==="string"){s.boss.day=raw.boss.day;if(raw.boss.today)for(var t in raw.boss.today)s.boss.today[t]=int(raw.boss.today[t]);}}
  if(raw.ms&&typeof raw.ms.day==="string"&&Array.isArray(raw.ms.daily)&&Array.isArray(raw.ms.weekly)){
    var okM=function(a){return a.filter(function(m){return m&&findMission(m.id);}).map(function(m){return {id:m.id,p:int(m.p),c:!!m.c};});};
    s.ms={day:raw.ms.day,week:typeof raw.ms.week==="string"?raw.ms.week:"",daily:okM(raw.ms.daily),weekly:okM(raw.ms.weekly)};}
  return s;
};
// returning players get a head start from what they already earned (motes banked/earned, clears, best time)
function welcomeFor(legacy){
  if(!legacy||!legacy.best)return {gold:0,gems:0};
  var b=legacy.best,earned=int(legacy.earned);
  var gold=Math.min(3000,Math.round(earned*0.5+int(b.wins)*200+int(b.time)*1+(int(b.legacyStage)*100)));
  var gems=Math.min(300,int(b.wins)*30+(int(b.time)>=150?20:0));
  return {gold:gold,gems:gems};
}
M.legacy=function(){
  var v3=readKey("as_save_v3");if(v3&&v3.v===3)return v3;
  var v2=readKey("as_save_v2");if(v2&&v2.v===2)return {v:2,best:v2.best||{},earned:0};
  var v1=readKey("as_best");if(v1&&typeof v1==="object")return {v:1,best:{pl:int(v1.pl),legacyStage:int(v1.stage)},earned:0};
  return null;
};
var data=null;
M.load=function(){var raw=readKey(M.KEY);data=M.migrate(raw,raw?null:M.legacy());M.save();return data;};
M.get=function(){return data||M.load();};
M.set=function(s){data=s;return s;};
M.save=function(){try{var L=ls();if(L&&data){var o={};for(var k in data)if(k!=="migratedFrom")o[k]=data[k];L.setItem(M.KEY,JSON.stringify(o));}}catch(e){}};

/* ---------------- RNG helpers ---------------- */
M.rng=Math.random;
function pickW(w,rng){var t=0,k;for(k=0;k<w.length;k++)t+=w[k];var x=(rng||M.rng)()*t;for(k=0;k<w.length;k++){x-=w[k];if(x<0)return k;}
  for(k=w.length-1;k>=0;k--)if(w[k]>0)return k;return 0;}
M.pickW=pickW;
M.rollRarity=function(odds,rng){return pickW(odds,rng);};
M.rollGear=function(rng){return M.GEAR[Math.floor((rng||M.rng)()*M.GEAR.length)%M.GEAR.length];};

/* ---------------- inventory ---------------- */
M.canAfford=function(s,cost){for(var c in cost)if((s[c]||0)<cost[c])return false;return true;};
function pay(s,cost){for(var c in cost)s[c]-=cost[c];}
// grant one item. duplicate at same/lower rarity -> shards; higher rarity -> item is promoted (level kept, capped)
M.grantItem=function(s,id,r){
  var it=s.inv[id];
  if(!it){s.inv[id]={r:r,lv:1};var d=M.gearDef(id);if(!s.eq[d.slot])s.eq[d.slot]=id;return {kind:"new",id:id,r:r,shards:0};}
  if(r>it.r){var old=it.r;it.r=r;it.lv=Math.min(it.lv,M.RARITIES[r].max);return {kind:"upgrade",id:id,r:r,from:old,shards:0};}
  var sh=M.RARITIES[r].dup;s.shards+=sh;return {kind:"dupe",id:id,r:r,shards:sh};
};
M.equip=function(s,id){var it=s.inv[id],d=M.gearDef(id);if(!it||!d)return false;s.eq[d.slot]=id;return true;};
M.upgrade=function(s,id){
  var it=s.inv[id];if(!it)return {ok:false,reason:"missing"};
  if(it.lv>=M.RARITIES[it.r].max)return {ok:false,reason:"max"};
  var c=M.upgradeCost(it.r,it.lv);if(!M.canAfford(s,c))return {ok:false,reason:"cost",cost:c};
  pay(s,c);it.lv++;s.stats.upgrades++;M.track(s,"upgrade",1);return {ok:true,lv:it.lv,cost:c};
};
// summed permanent stats from equipped gear + selected character (applied to every run in game.js)
M.gearStats=function(s){
  var o={};M.SLOTS.forEach(function(sl){var id=s.eq[sl],it=id&&s.inv[id];if(!it)return;var st=M.itemStats(id,it.r,it.lv);for(var k in st)o[k]=(o[k]||0)+st[k];});
  return o;
};
M.runStats=function(s){var o=M.gearStats(s),c=M.charDef(s.ch);for(var k in c.st)o[k]=(o[k]||0)+c.st[k];return o;};
M.power=function(s){var p=0;M.SLOTS.forEach(function(sl){var id=s.eq[sl],it=id&&s.inv[id];if(it)p+=Math.round(100*M.itemMult(it.r,it.lv));});return p;};

/* ---------------- chests ---------------- */
M.dayKey=function(t){var d=new Date(t);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());};
M.weekKey=function(t){var d=new Date(t);d.setHours(0,0,0,0);var wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return "W"+M.dayKey(d.getTime());};
function pad(n){return n<10?"0"+n:""+n;}
M.freeReady=function(s,now){return now>=s.freeAt;};
M.adLeft=function(s,now){var k=M.dayKey(now);return s.ad.day===k?Math.max(0,M.CHESTS.ad.daily-s.ad.n):M.CHESTS.ad.daily;};
// opens a gear chest; returns {ok, results:[grantItem results]}. For "ad", call only after the rewarded ad completed.
M.openChest=function(s,id,now,rng){
  var C=M.CHESTS[id];if(!C||id==="premium")return {ok:false,reason:"bad"};
  now=now||Date.now();
  if(id==="free"&&!M.freeReady(s,now))return {ok:false,reason:"timer"};
  if(id==="ad"&&M.adLeft(s,now)<=0)return {ok:false,reason:"limit"};
  if(!M.canAfford(s,C.cost))return {ok:false,reason:"cost"};
  pay(s,C.cost);
  if(id==="free")s.freeAt=now+C.cooldown;
  if(id==="ad"){var k=M.dayKey(now);if(s.ad.day!==k)s.ad={day:k,n:0};s.ad.n++;}
  var out=[];
  for(var n=0;n<C.items;n++){var odds=(C.last&&n===C.items-1)?C.last:C.odds;var r=M.rollRarity(odds,rng),g=M.rollGear(rng);out.push(M.grantItem(s,g.id,r));}
  s.stats.chests++;M.track(s,"chest",1,now);
  return {ok:true,results:out};
};
M.lockedChars=function(s){return M.CHARS.filter(function(c){return !s.chars[c.id];});};
M.openPremium=function(s,now,rng){
  var C=M.CHESTS.premium;if(!M.canAfford(s,C.cost))return {ok:false,reason:"cost"};
  pay(s,C.cost);rng=rng||M.rng;
  var locked=M.lockedChars(s),res;
  var od=M.premiumOdds(s),pity=locked.length&&s.pity+1>=M.PREMIUM.pity;
  var k=pity?0:pickW([od.char,od.legendary,od.epic],rng);
  if(k===0&&locked.length){var c=locked[Math.floor(rng()*locked.length)%locked.length];s.chars[c.id]=1;s.pity=0;res={kind:"char",id:c.id,pity:!!pity};}
  else{var r=k===1||k===0?4:3,g=M.rollGear(rng);res=M.grantItem(s,g.id,r);if(locked.length)s.pity++;}
  s.stats.chests++;s.stats.premium++;M.track(s,"chest",1,now);
  return {ok:true,results:[res]};
};
M.selectChar=function(s,id){if(!s.chars[id])return false;s.ch=id;return true;};

/* ---------------- missions (daily + weekly) ---------------- */
// ev = what advances it; max:true = best single value (e.g. survive time), otherwise summed
M.MISSIONS=[
  {id:"d_kills",   sc:"daily", ev:"kills",     goal:400, t:"Defeat {g} enemies",             gold:150,gems:8},
  {id:"d_elites",  sc:"daily", ev:"elites",    goal:5,   t:"Defeat {g} elites",              gold:150,gems:8},
  {id:"d_survive", sc:"daily", ev:"surge_time",goal:180, t:"Survive 3:00 in one Surge run",   gold:200,gems:10,max:true},
  {id:"d_chests",  sc:"daily", ev:"chest",     goal:2,   t:"Open {g} chests",                gold:120,gems:8},
  {id:"d_upgrade", sc:"daily", ev:"upgrade",   goal:2,   t:"Upgrade gear {g} times",         gold:120,gems:8},
  {id:"d_tower",   sc:"daily", ev:"tower_floor",goal:3,  t:"Reach Tower floor {g}",          gold:200,gems:10,max:true},
  {id:"d_boss",    sc:"daily", ev:"boss_clear",goal:1,   t:"Win an Elite Boss Fight",        gold:200,gems:12},
  {id:"w_kills",   sc:"weekly",ev:"kills",     goal:5000,t:"Defeat {g} enemies",             gold:700,gems:50},
  {id:"w_clear",   sc:"weekly",ev:"surge_clear",goal:2,  t:"Clear the Surge {g} times",      gold:800,gems:60},
  {id:"w_tower",   sc:"weekly",ev:"tower_floor",goal:10, t:"Reach Tower floor {g}",          gold:800,gems:60,max:true},
  {id:"w_bosses",  sc:"weekly",ev:"bosses",    goal:12,  t:"Defeat {g} bosses in any mode",  gold:700,gems:50},
  {id:"w_chests",  sc:"weekly",ev:"chest",     goal:10,  t:"Open {g} chests",                gold:600,gems:40},
  {id:"w_runs",    sc:"weekly",ev:"runs",      goal:15,  t:"Play {g} runs",                  gold:600,gems:40}
];
M.DAILY_N=3;M.WEEKLY_N=3;
function findMission(id){for(var k=0;k<M.MISSIONS.length;k++)if(M.MISSIONS[k].id===id)return M.MISSIONS[k];return null;}
M.mission=findMission;
M.missionText=function(m){return m.t.replace("{g}",m.goal.toLocaleString?m.goal.toLocaleString():m.goal);};
function seeded(str){var h=2166136261;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return function(){h+=0x6D2B79F5;var t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function pickN(scope,n,key){var pool=M.MISSIONS.filter(function(m){return m.sc===scope;}),r=seeded(key),out=[];
  while(out.length<n&&pool.length){var k=Math.floor(r()*pool.length);out.push({id:pool[k].id,p:0,c:false});pool.splice(k,1);}return out;}
// rolls new daily/weekly sets when the local day/week changes
M.refreshMissions=function(s,now){
  now=now||Date.now();var dk=M.dayKey(now),wk=M.weekKey(now);
  if(s.ms.day!==dk){s.ms.day=dk;s.ms.daily=pickN("daily",M.DAILY_N,dk);}
  if(s.ms.week!==wk){s.ms.week=wk;s.ms.weekly=pickN("weekly",M.WEEKLY_N,wk);}
  return s.ms;
};
M.track=function(s,ev,amount,now){
  M.refreshMissions(s,now);
  [s.ms.daily,s.ms.weekly].forEach(function(list){list.forEach(function(e){var m=findMission(e.id);if(!m||m.ev!==ev||e.c)return;
    e.p=m.max?Math.max(e.p,amount):e.p+amount;if(e.p>m.goal)e.p=m.goal;});});
};
M.claimable=function(s,now){M.refreshMissions(s,now);var n=0;s.ms.daily.concat(s.ms.weekly).forEach(function(e){var m=findMission(e.id);if(m&&!e.c&&e.p>=m.goal)n++;});return n;};
M.claim=function(s,id,now){
  M.refreshMissions(s,now);var e=null;s.ms.daily.concat(s.ms.weekly).forEach(function(x){if(x.id===id)e=x;});
  var m=findMission(id);if(!e||!m||e.c||e.p<m.goal)return {ok:false};
  e.c=true;s.gold+=m.gold;s.gems+=m.gems;return {ok:true,gold:m.gold,gems:m.gems};
};

/* ---------------- run rewards ---------------- */
// st = {kills,time,elites,minis,bosses,won, maxTime, floor (reached), cleared, bonusGold, bonusGems}; mode = "surge"|"tower"|"boss"
// cont = true when paying the extra progress after a revive (sums are deltas; the run is not counted twice)
M.runGold=function(st,s){var g=st.kills*0.25+st.time*0.5+st.elites*15+(st.minis||0)*40+(st.won?150:0);return Math.floor(g*(1+(M.gearStats(s).gold||0)));};
M.towerGold=function(cleared){var g=0;for(var f=1;f<=cleared;f++)g+=M.towerFloor(f).gold;return g;};
M.recordRun=function(s,st,mode,now,cont){
  var out={gold:M.runGold(st,s),gems:0,notes:[]},mt=st.maxTime||st.time;
  if(mode==="surge"){if(st.won){out.gems+=8;out.notes.push("Surge cleared +8 💎");}M.track(s,"surge_time",mt,now);if(st.won)M.track(s,"surge_clear",1,now);}
  if(mode==="tower"){var c=st.cleared||0,f=Math.max(st.floor||0,c);
    if(!cont){out.gold+=M.towerGold(c)+(st.bonusGold||0);out.gems+=st.bonusGems||0;if(st.bonusGems)out.notes.push("Elite Trials +"+st.bonusGems+" 💎");}
    var ms=Math.floor(c/5);if(ms>s.tower.milestones){var g=(ms-s.tower.milestones)*25;out.gems+=g;out.notes.push("Tower milestone +"+g+" 💎");s.tower.milestones=ms;}
    if(f>s.tower.best){s.tower.best=f;out.newBest=true;}
    M.track(s,"tower_floor",f,now);}
  M.track(s,"kills",st.kills,now);M.track(s,"elites",st.elites,now);if(st.bosses)M.track(s,"bosses",st.bosses,now);
  if(!cont){M.track(s,"runs",1,now);s.stats.runs++;}
  s.gold+=out.gold;s.gems+=out.gems;
  return out;
};

/* ---------------- Tower roguelike ---------------- */
// each floor is a short timed fight; every 5th floor ends with a boss; difficulty climbs per floor
M.TOWER_BOSSES=["warden","tyrant","sentinel"];
M.towerFloor=function(f){
  var boss=f%5===0?M.TOWER_BOSSES[(f/5-1)%3]:null,loop=Math.floor((f-1)/15);
  return {floor:f,len:Math.min(75,40+f*3),schOff:Math.min(230,(f-1)*13),schRate:0.6,
    hpX:1+0.06*Math.max(0,f-12)+0.5*loop,dmgX:1+0.03*Math.max(0,f-12)+0.3*loop,
    boss:boss,bossHpX:boss?(boss==="sentinel"?0.45:0.8)*(1+0.12*(f-5)/5)*(1+0.6*loop):1,
    elite:f>=2,swarm:f>=3,gold:Math.floor(40+8*f)};
};
M.TOWER_ROOMS=[
  {id:"forge",  n:"Forge",          i:"⚒", d:"+15% damage for the rest of the climb"},
  {id:"spring", n:"Healing Spring", i:"⛲",d:"Heal 50% and +10 max HP"},
  {id:"vault",  n:"Vault",          i:"🪙",d:"+{gold} gold banked"},
  {id:"trial",  n:"Elite Trial",    i:"☠", d:"Next floor: +30% enemy HP. Clear it for +5 💎"},
  {id:"sanctum",n:"Sigil Sanctum",  i:"ϟ", d:"Pick a Sigil now"},
  {id:"armory", n:"Armory",         i:"◈", d:"Pick a Relic now"},
  {id:"shrine", n:"Wind Shrine",    i:"💨",d:"+10% move speed, -8% fire interval"}
];
M.rollRooms=function(f,rng){rng=rng||M.rng;var pool=M.TOWER_ROOMS.slice(),out=[];
  while(out.length<3&&pool.length){var k=Math.floor(rng()*pool.length)%pool.length;var r=pool.splice(k,1)[0];
    out.push({id:r.id,n:r.n,i:r.i,d:r.d.replace("{gold}",String(60+f*20))});}return out;};

/* ---------------- Elite Boss Fights ---------------- */
// lv = starting level (you pick those level-ups before the fight); bosses reuse the in-run boss roster
M.BOSS_FIGHTS=[
  {id:"warden",  n:"Grove Warden",  bosses:["warden"],                lv:6, hpX:1.25,gems:8, gold:150},
  {id:"tyrant",  n:"Crystal Tyrant",bosses:["tyrant"],                lv:9, hpX:1.1, gems:12,gold:250},
  {id:"sentinel",n:"Rift Sentinel", bosses:["sentinel"],              lv:14,hpX:0.6, gems:20,gold:400},
  {id:"rush",    n:"Boss Rush",     bosses:["warden","tyrant","sentinel"],lv:7,hpX:0.8,gems:45,gold:700}
];
M.BOSS_MODS=[
  {id:"enraged",  n:"Enraged",  i:"😡",d:"Bosses deal +30% damage"},
  {id:"fortified",n:"Fortified",i:"🛡",d:"Bosses have +50% HP"},
  {id:"horde",    n:"Horde",    i:"👾",d:"Enemies keep pouring in"},
  {id:"fragile",  n:"Fragile",  i:"💔",d:"You have -30% max HP"}
];
M.BOSS_MOD_BONUS=0.25; // +25% rewards per modifier
M.bossFight=function(id){for(var k=0;k<M.BOSS_FIGHTS.length;k++)if(M.BOSS_FIGHTS[k].id===id)return M.BOSS_FIGHTS[k];return null;};
// full rewards on the first win of each fight per day; later wins that day pay 25%. First-ever win doubles gems.
M.bossReward=function(s,id,mods,now){
  var f=M.bossFight(id);if(!f)return {gold:0,gems:0};
  var dk=M.dayKey(now||Date.now()),mult=1+M.BOSS_MOD_BONUS*(mods||[]).length,first=!s.boss.clears[id];
  var today=s.boss.day===dk?(s.boss.today[id]||0):0,rep=today>0?0.25:1;
  return {gold:Math.floor(f.gold*mult*rep),gems:Math.floor(f.gems*mult*rep*(first?2:1)),first:first,repeat:today>0};
};
M.recordBossWin=function(s,id,mods,now){
  now=now||Date.now();var r=M.bossReward(s,id,mods,now),dk=M.dayKey(now);
  if(s.boss.day!==dk){s.boss.day=dk;s.boss.today={};}
  s.boss.today[id]=(s.boss.today[id]||0)+1;s.boss.clears[id]=(s.boss.clears[id]||0)+1;
  s.gold+=r.gold;s.gems+=r.gems;M.track(s,"boss_clear",1,now);return r;
};

AS.meta=M;
if(typeof module!=="undefined"&&module.exports)module.exports=M;
})(typeof window!=="undefined"?window:globalThis);
