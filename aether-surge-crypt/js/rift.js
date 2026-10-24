/* Aether Surge — "Dark Rift" M2: kept gear (stash, salvage, forge), skill tree + runes, set items, difficulty tiers,
   and the Crypt: a dungeon of linked chambers drawn in code, with an original act boss at the end of each depth.
   Pure logic (profile, sets, forge, tree, dungeon layout) is Node-testable; the rest runs in the browser.
   Save: localStorage "as_rift_v1". All names and art are original. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var R={KEY:"as_rift_v1",STASH:48,RENOWN:300,MAXR:3};
function D(){return AS.dia;}
/* ---------------- sets ---------------- */
R.SETS=[
  {id:"vigil",n:"Gravewarden's Vigil",
   pieces:[{kind:"helm",n:"Gravewarden's Visor"},{kind:"chest",n:"Gravewarden's Cuirass"},{kind:"gloves",n:"Gravewarden's Grasp"},{kind:"boots",n:"Gravewarden's Tread"}],
   b2:{rs:{hp:25,armor:0.08},t:"+25 max HP · -8% damage taken"},
   b4:{own:{vigil:1},t:"Iron Ward raises itself below 35% HP (every 20s) and blocks 70%"}},
  {id:"pyre",n:"Pilgrim of the Pyre",
   pieces:[{kind:"weapon",n:"Pyre-Pilgrim's Brand"},{kind:"amulet",n:"Pyre-Pilgrim's Reliquary"},{kind:"ring",n:"Pyre-Pilgrim's Left Band"},{kind:"ring",n:"Pyre-Pilgrim's Right Band"}],
   b2:{rs:{dmg:0.15,area:0.10},t:"+15% damage · +10% area"},
   b4:{own:{pyre:1},t:"Every skill cast looses a ring of 10 ember bolts"}}
];
R.setDef=function(id){for(var i=0;i<R.SETS.length;i++)if(R.SETS[i].id===id)return R.SETS[i];return null;};
R.setCount=function(eq,id){var seen={},n=0;for(var s in eq){var it=eq[s];if(it&&it.set===id&&!seen[it.sp]){seen[it.sp]=1;n++;}}return n;};
R.setBonus=function(eq){var rs={},own={},act=[];
  R.SETS.forEach(function(S){var n=R.setCount(eq||{},S.id);
    [[2,S.b2],[4,S.b4]].forEach(function(p){if(n<p[0])return;act.push(S.id+p[0]);var b=p[1],k;if(b.rs)for(k in b.rs)rs[k]=(rs[k]||0)+b.rs[k];if(b.own)for(k in b.own)own[k]=(own[k]||0)+b.own[k];});});
  return {rs:rs,own:own,active:act};};
// choose a set piece for a kind (or any)
R.pickPiece=function(r,kind){var opts=[];R.SETS.forEach(function(S){S.pieces.forEach(function(p,i){if(!kind||p.kind===kind)opts.push({s:S,i:i,p:p});});});
  if(!opts.length)return R.pickPiece(r,null);return opts[Math.floor(r()*opts.length)%opts.length];};
/* ---------------- materials: salvage + forge ---------------- */
R.MATS=[{id:"dust",n:"Grave Dust",c:"#c8b8a0"},{id:"shard",n:"Umbral Shard",c:"#b08cff"},{id:"ember",n:"Wyrmember",c:"#ff8a1e"}];
R.SALV=[{dust:2},{dust:4},{dust:4,shard:2},{shard:4,ember:1},{shard:3,ember:1}];
R.salvage=function(it){var s=R.SALV[it&&it.rar||0]||{},o={dust:0,shard:0,ember:0};for(var k in s)o[k]=s[k];return o;};
R.addMats=function(m,o){for(var k in o)m[k]=(m[k]||0)+o[k];return m;};
R.RECIPES=[
  {id:"magic",n:"Forge Magic",t:"A Magic item of the chosen kind",cost:{dust:10}},
  {id:"rare", n:"Forge Rare", t:"A Rare item of the chosen kind",cost:{dust:25,shard:3}},
  {id:"leg",  n:"Forge Legendary",t:"A Legendary of the chosen kind",cost:{shard:10,ember:2}},
  {id:"reforge",n:"Reforge",t:"Reroll the selected item's affixes",cost:null}
];
R.reforgeCost=function(it){return it?[{dust:6},{dust:8},{dust:10,shard:2},{shard:5,ember:1},{shard:5,ember:1}][it.rar]:{dust:6};};
R.cost=function(id,it){if(id==="reforge")return R.reforgeCost(it);for(var i=0;i<R.RECIPES.length;i++)if(R.RECIPES[i].id===id)return R.RECIPES[i].cost;return null;};
R.canPay=function(m,c){if(!c)return false;for(var k in c)if((m[k]||0)<c[k])return false;return true;};
R.pay=function(m,c){if(!R.canPay(m,c))return false;for(var k in c)m[k]-=c[k];return true;};
R.craft=function(p,id,kind,r){r=r||Math.random;var c=R.cost(id);if(!R.canPay(p.mats,c))return null;var rar={magic:1,rare:2,leg:3}[id];if(rar==null)return null;
  R.pay(p.mats,c);var it=D().rollItem(rar,Math.max(1,p.ilvlMax||1),r,kind);it.uid=p.uid++;return it;};
R.reforge=function(p,it,r){r=r||Math.random;var c=R.reforgeCost(it);if(!it||!R.canPay(p.mats,c))return false;R.pay(p.mats,c);
  var nw=D().rollItem(it.rar===4?2:it.rar,it.ilvl,r,it.kind),imp=it.aff.filter(function(a){return a.imp;});
  var extra=nw.aff.filter(function(a){return !a.imp;});if(it.rar===4)extra=extra.slice(0,2);if(it.rar===3)extra.forEach(function(a){a.v=D().round(a.k,a.v);});
  it.aff=imp.concat(extra);if(it.rar===1)it.name=nw.name;it.rf=(it.rf||0)+1;return true;};
/* ---------------- skill tree + runes ---------------- */
R.TREE={
  nova:{d:"Fire bursts around you and ignites foes.",runes:[
    {id:"searing",n:"Searing Heart",t:"Half the radius, triple the burn",need:1},
    {id:"gravepull",n:"Grave Pull",t:"Drags foes inward instead of hurling them",need:1},
    {id:"twin",n:"Twin Pyre",t:"A second nova erupts 0.6s later",need:3}]},
  lance:{d:"Three soul lances fly at the nearest foe.",runes:[
    {id:"fan",n:"Wraith Fan",t:"Five lances in a wide fan",need:1},
    {id:"requiem",n:"Requiem Spike",t:"One huge lance that pierces everything, 2.5x damage",need:1},
    {id:"chain",n:"Chain of Souls",t:"Soul lightning also arcs through 4 foes",need:3}]},
  ward:{d:"Halve all damage you take for 4s.",runes:[
    {id:"thorn",n:"Thornmail",t:"Foes near you are cut every half second",need:1},
    {id:"bulwark",n:"Bulwark",t:"Lasts 6s instead of 4s",need:1},
    {id:"sanct",n:"Sanctuary",t:"Heal 4% max HP per second while warded",need:3}]},
  draught:{d:"Drink to restore 35% of your max HP.",runes:[
    {id:"rush",n:"Bloodrush",t:"+30% move speed for 6s",need:1},
    {id:"sang",n:"Sanguine Burst",t:"The heal also blasts nearby foes",need:1},
    {id:"deep",n:"Deep Vial",t:"Heals 60%, but 8s longer cooldown",need:3}]}
};
R.SKILL_IDS=["nova","lance","ward","draught"];
R.points=function(p){return Math.min(R.SKILL_IDS.length*R.MAXR,1+Math.floor((p.renown||0)/R.RENOWN)+Object.keys(p.acts||{}).length);};
R.spent=function(p){var s=0;R.SKILL_IDS.forEach(function(id){s+=p.tree[id]||0;});return s;};
R.free=function(p){return Math.max(0,R.points(p)-R.spent(p));};
R.rankUp=function(p,id){if(R.SKILL_IDS.indexOf(id)<0||R.free(p)<=0||(p.tree[id]||0)>=R.MAXR)return false;p.tree[id]=(p.tree[id]||0)+1;return true;};
R.setRune=function(p,id,rn){var T=R.TREE[id];if(!T)return false;if(rn==null){delete p.rune[id];return true;}var d=T.runes.filter(function(x){return x.id===rn;})[0];
  if(!d||(p.tree[id]||0)<d.need)return false;p.rune[id]=rn;return true;};
R.respec=function(p){R.SKILL_IDS.forEach(function(id){p.tree[id]=0;});p.rune={};p.tree.nova=1;};
R.nextPointAt=function(p){return (Math.floor((p.renown||0)/R.RENOWN)+1)*R.RENOWN;};
/* ---------------- difficulty ---------------- */
R.DIFF=[
  {id:"normal",   n:"Normal",   hp:1,  dmg:1,   boost:0,  ilvl:0, set:0.05,c:"#d8d0c0"},
  {id:"nightmare",n:"Nightmare",hp:1.8,dmg:1.35,boost:0.5,ilvl:4, set:0.09,c:"#ff8a5a"},
  {id:"torment",  n:"Torment",  hp:3,  dmg:1.8, boost:1.1,ilvl:8, set:0.15,c:"#ff3040"}
];
/* ---------------- act bosses ---------------- */
R.ACTS=[
  {key:"abbess", act:"I",  depth:"The Drowned Chapel",n:"Sallowmere, the Rot Abbess",leg:"gloves",
   boss:{n:"Sallowmere, the Rot Abbess",hp:1700,spd:70,r:30,c:"#8ab040",d:20,xp:90,
     phases:[{at:1,moves:["slam","burst","dash"],cd:1.7},{at:0.5,moves:["rain","slam3","burst","dash"],cd:1.3,summon:1}]}},
  {key:"ossuary",act:"II", depth:"The Bone Vaults",n:"Varnek, the Ossuary King",leg:"helm",
   boss:{n:"Varnek, the Ossuary King",hp:3800,spd:76,r:32,c:"#e0d0a8",d:28,xp:130,
     phases:[{at:1,moves:["lances","dash","cross","burst"],cd:1.45},{at:0.5,moves:["volley","cross","slam3","dash"],cd:1.15,summon:1}]}},
  {key:"choir",  act:"III",depth:"The Cinder Nave",n:"The Hollow Choir",leg:"weapon",
   boss:{n:"The Hollow Choir",hp:7500,spd:82,r:34,c:"#ff5a2a",d:34,xp:180,
     phases:[{at:1,moves:["spiral","burst","dash","slam"],cd:1.3},{at:0.6,moves:["volley","spiral","rain","cross"],cd:1.05,summon:1},{at:0.3,moves:["spiral","cross","slam3","volley","rain","dash"],cd:0.9,summon:2}]}}
];
/* ---------------- dungeon layout ---------------- */
// random-walk a tree of rooms on a grid; start room 0, boss room = farthest leaf, plus one treasure and one elite room
R.genDepth=function(n,r){r=r||Math.random;n=Math.max(4,n|0);var rooms=[{gx:0,gy:0,links:[],kind:"start",d:0}],at={"0,0":0},DIRS=[[1,0],[-1,0],[0,1],[0,-1]],guard=0;
  while(rooms.length<n&&guard++<500){var from=Math.floor(r()*rooms.length)%rooms.length,f=rooms[from];if(f.links.length>=3)continue;var dv=DIRS[Math.floor(r()*4)%4],gx=f.gx+dv[0],gy=f.gy+dv[1],k=gx+","+gy;
    if(at[k]!=null)continue;var nb=0;DIRS.forEach(function(q){if(at[(gx+q[0])+","+(gy+q[1])]!=null)nb++;});if(nb>1&&r()<0.7)continue;
    at[k]=rooms.length;rooms.push({gx:gx,gy:gy,links:[from],kind:"fight",d:f.d+1});f.links.push(rooms.length-1);}
  var leaves=rooms.map(function(x,i){return i;}).filter(function(i){return i>0&&rooms[i].links.length===1;});
  var boss=leaves.reduce(function(b,i){return rooms[i].d>rooms[b].d?i:b;},leaves[0]||rooms.length-1);rooms[boss].kind="boss";
  var rest=leaves.filter(function(i){return i!==boss;});var tre=rest.length?rest[Math.floor(r()*rest.length)%rest.length]:-1;if(tre>0)rooms[tre].kind="treasure";
  var fights=rooms.map(function(x,i){return i;}).filter(function(i){return rooms[i].kind==="fight";});if(fights.length>1){rooms[fights[Math.floor(r()*fights.length)%fights.length]].kind="elite";}
  return rooms;};
R.SX=1300;R.SY=1500;R.RW=760;R.RH=920;R.CW=150;R.EXT=44;
R.roomRect=function(rm){return {x:rm.gx*R.SX-R.RW/2,y:rm.gy*R.SY-R.RH/2,w:R.RW,h:R.RH};};
R.corrRect=function(a,b){var ra=R.roomRect(a),rb=R.roomRect(b),E=R.EXT,cw=R.CW;
  if(a.gy===b.gy){var L=a.gx<b.gx?ra:rb,Rr=a.gx<b.gx?rb:ra,cy=a.gy*R.SY;return {x:L.x+L.w-E,y:cy-cw/2,w:Rr.x-(L.x+L.w)+2*E,h:cw,hz:1};}
  var T=a.gy<b.gy?ra:rb,B=a.gy<b.gy?rb:ra,cx=a.gx*R.SX;return {x:cx-cw/2,y:T.y+T.h-E,w:cw,h:B.y-(T.y+T.h)+2*E,hz:0};};
R.inRect=function(x,y,q,rad){return x>=q.x+rad&&x<=q.x+q.w-rad&&y>=q.y+rad&&y<=q.y+q.h-rad;};
R.roomAt=function(rooms,x,y,rad){for(var i=0;i<rooms.length;i++)if(R.inRect(x,y,R.roomRect(rooms[i]),rad||0))return i;return -1;};
// walkable test: inside the current room, or (when its doors are open) inside a corridor or any room the corridors join
R.walkable=function(rooms,open,x,y,rad){for(var i=0;i<rooms.length;i++){if(!open&&!rooms[i].here)continue;if(R.inRect(x,y,R.roomRect(rooms[i]),rad))return true;}
  if(!open)return false;for(i=0;i<rooms.length;i++){var a=rooms[i];for(var j=0;j<a.links.length;j++){var b=rooms[a.links[j]];if(a.links[j]<i)continue;if(R.inRect(x,y,R.corrRect(a,b),rad))return true;}}return false;};
/* ---------------- profile ---------------- */
R.blank=function(){return {v:1,eq:{},bag:[],stash:[],mats:{dust:0,shard:0,ember:0},renown:0,acts:{},tree:{nova:1,lance:0,ward:0,draught:0},rune:{},diff:0,diffMax:0,ilvlMax:1,uid:1000,clears:0};};
R.normalize=function(p){var b=R.blank();if(!p||typeof p!=="object")return b;
  b.eq=p.eq&&typeof p.eq==="object"?p.eq:{};b.bag=Array.isArray(p.bag)?p.bag.slice(0,16):[];b.stash=Array.isArray(p.stash)?p.stash.slice(0,R.STASH):[];
  ["dust","shard","ember"].forEach(function(k){b.mats[k]=Math.max(0,(p.mats&&+p.mats[k])||0);});
  b.renown=Math.max(0,+p.renown||0);b.acts=p.acts&&typeof p.acts==="object"?p.acts:{};b.rune=p.rune&&typeof p.rune==="object"?p.rune:{};
  R.SKILL_IDS.forEach(function(id){var v=p.tree&&+p.tree[id];b.tree[id]=isFinite(v)?Math.max(0,Math.min(R.MAXR,v|0)):b.tree[id];});
  if(R.spent(b)>R.points(b))R.respec(b);
  b.diffMax=Math.max(0,Math.min(2,+p.diffMax||0));b.diff=Math.max(0,Math.min(b.diffMax,+p.diff||0));b.ilvlMax=Math.max(1,+p.ilvlMax||1);b.uid=Math.max(1000,+p.uid||1000);b.clears=+p.clears||0;
  return b;};
R.load=function(store){try{var s=(store||root.localStorage).getItem(R.KEY);return R.normalize(s?JSON.parse(s):null);}catch(e){return R.blank();}};
R.saveTo=function(p,store){try{(store||root.localStorage).setItem(R.KEY,JSON.stringify(p));}catch(e){}};
// stash moves (pure)
R.toStash=function(p,bag,i){if(p.stash.length>=R.STASH||!bag[i])return false;p.stash.push(bag.splice(i,1)[0]);return true;};
R.fromStash=function(p,bag,i,max){if(bag.length>=(max||16)||!p.stash[i])return false;bag.push(p.stash.splice(i,1)[0]);return true;};
AS.rift=R;
if(typeof module!=="undefined"&&module.exports)module.exports=R;
if(typeof document==="undefined")return;

/* ================= browser ================= */
var P0=R.prof=R.load(),TAU=Math.PI*2,saveT=0;
function C(){return AS.core;}
R.save=function(){var st=D()&&D().st;if(st){P0.eq=st.eq;P0.bag=st.bag;P0.uid=Math.max(P0.uid,st.uid);}R.saveTo(P0);};
R.soon=function(){saveT=1.5;};
R.rank=function(id){return P0.tree[id]||0;};R.rune=function(id){return P0.rune[id]||null;};
R.diff=function(){return R.DIFF[P0.diff]||R.DIFF[0];};
R.setDiff=function(i){if(i<0||i>P0.diffMax)return false;P0.diff=i;R.saveTo(P0);return true;};
// called by AS.dia.reset at run start: carry kept gear into the run + apply the difficulty tier
R.loadInto=function(st){if(root.document&&document.body)document.body.classList.remove("crypt");st.eq=P0.eq;st.bag=P0.bag;st.uid=Math.max(st.uid,P0.uid);var G=AS.G,df=R.diff();
  if(G){G.diffHp=df.hp;G.diffDmg=df.dmg;G.riftPaid=0;}D().boost=df.boost;D().setP=df.set;};
R.ilvlAdd=function(){var G=AS.G;return R.diff().ilvl+(G&&G.mode==="dungeon"&&dg?(dg.depth-1)*4:0);};
R.noteIlvl=function(v){if(v>P0.ilvlMax){P0.ilvlMax=v;R.soon();}};
// end of run: renown from kills (once per results screen; a revive only pays the extra), act clears saved
R.endRun=function(won){var G=AS.G,k=Math.max(0,G.kills-(G.riftPaid||0));G.riftPaid=G.kills;var before=R.points(P0);P0.renown+=Math.min(k,800);
  if(won&&G.mode==="dungeon"){P0.clears++;if(P0.diff>=P0.diffMax&&P0.diffMax<2)P0.diffMax++;}
  R.save();return {renown:Math.min(k,800),pts:R.points(P0)-before};};
if(D()&&D().st)R.loadInto(D().st);
document.addEventListener("visibilitychange",function(){if(document.hidden)R.save();});
/* ---------------- act boss art (procedural, original) ---------------- */
function poly(x,p){x.beginPath();x.moveTo(p[0],p[1]);for(var i=2;i<p.length;i+=2)x.lineTo(p[i],p[i+1]);x.closePath();}
var ART={
  abbess:function(x,f){var sw=f?2:-2; // drowned nun: tattered habit, lantern of bile, antlered wimple
    x.fillStyle="#1c2414";poly(x,[-20,24,-26+sw,32,-8,30,0,34,8,30,26-sw,32,20,24,14,-6,-14,-6]);x.fill();
    var g=x.createLinearGradient(0,-20,0,30);g.addColorStop(0,"#4a5a30");g.addColorStop(1,"#1a2010");x.fillStyle=g;poly(x,[-16,-8,-22,26,-6,22,0,28,6,22,22,26,16,-8,0,-14]);x.fill();
    x.strokeStyle="rgba(10,14,6,.8)";x.lineWidth=1.4;for(var i=-2;i<=2;i++){x.beginPath();x.moveTo(i*5,-6);x.lineTo(i*7+sw,24);x.stroke();}
    x.fillStyle="#d8d0b0";x.beginPath();x.ellipse(0,-20,9,10,0,0,TAU);x.fill();x.fillStyle="#2a3018";poly(x,[-11,-22,-12,-8,12,-8,11,-22,0,-31]);x.fill();
    x.strokeStyle="#6a5a3a";x.lineWidth=2.2;x.beginPath();x.moveTo(-8,-28);x.lineTo(-16,-40);x.lineTo(-20,-36);x.moveTo(-14,-37);x.lineTo(-12,-44);x.moveTo(8,-28);x.lineTo(16,-40);x.lineTo(20,-36);x.moveTo(14,-37);x.lineTo(12,-44);x.stroke();
    x.fillStyle="#101408";x.beginPath();x.ellipse(0,-19,6,6.5,0,0,TAU);x.fill();x.fillStyle="#c8ff60";x.shadowColor="#a0ff40";x.shadowBlur=8;x.beginPath();x.arc(-2.4,-20,1.4,0,TAU);x.arc(2.4,-20,1.4,0,TAU);x.fill();
    x.strokeStyle="#3a3020";x.lineWidth=2;x.beginPath();x.moveTo(18,-4);x.lineTo(28,6+sw);x.stroke();x.fillStyle="#b0e040";x.beginPath();x.arc(29,10+sw,5,0,TAU);x.fill();x.shadowBlur=0;
    x.strokeStyle="#2a2a14";x.lineWidth=1;x.strokeRect(25,6+sw,8,8);},
  ossuary:function(x,f){var sw=f?2:-2; // bone king: ribcage throne-armour, crown of fingerbones, two femur maces
    x.fillStyle="#2a2418";poly(x,[-22,30,-14,8,14,8,22,30,8,26,0,32,-8,26]);x.fill();
    var g=x.createLinearGradient(-20,-20,20,20);g.addColorStop(0,"#f0e6c8");g.addColorStop(1,"#8a7c5c");x.fillStyle=g;
    poly(x,[-20,-10,-24,10,-14,20,14,20,24,10,20,-10,10,-18,-10,-18]);x.fill();x.strokeStyle="#3a3020";x.lineWidth=1.6;
    for(var i=0;i<4;i++){x.beginPath();x.moveTo(-15,-8+i*6);x.quadraticCurveTo(0,-4+i*6,15,-8+i*6);x.stroke();}x.beginPath();x.moveTo(0,-16);x.lineTo(0,18);x.stroke();
    x.fillStyle="#e8dcc0";x.beginPath();x.ellipse(0,-26,9,9,0,0,TAU);x.fill();x.fillStyle="#140e08";x.beginPath();x.ellipse(-3.5,-27,2.6,3,0,0,TAU);x.ellipse(3.5,-27,2.6,3,0,0,TAU);x.fill();
    x.fillStyle="#ffd860";x.shadowColor="#ffb020";x.shadowBlur=7;x.beginPath();x.arc(-3.5,-27,1,0,TAU);x.arc(3.5,-27,1,0,TAU);x.fill();x.shadowBlur=0;
    x.fillStyle="#c8b888";for(i=-3;i<=3;i++)poly(x,[i*3-1.4,-33,i*3,-40-(i%2?0:4),i*3+1.4,-33]),x.fill();
    x.strokeStyle="#d8ccaa";x.lineWidth=4;x.lineCap="round";x.beginPath();x.moveTo(-22,-4);x.lineTo(-34,14+sw);x.moveTo(22,-4);x.lineTo(34,14-sw);x.stroke();
    x.fillStyle="#e8dcc0";x.beginPath();x.arc(-35,16+sw,4.5,0,TAU);x.arc(35,16-sw,4.5,0,TAU);x.fill();},
  choir:function(x,f){var sw=f?3:-3; // three fused hooded singers burning from within
    [-14,14,0].forEach(function(cx,j){var cy=j===2?-6:2,s=j===2?1.15:0.9;x.save();x.translate(cx,cy);x.scale(s,s);
      var g=x.createLinearGradient(0,-24,0,28);g.addColorStop(0,"#3a1410");g.addColorStop(1,"#120605");x.fillStyle=g;poly(x,[-11,-12,-15,26,-4,22,0,28,4,22,15,26,11,-12,0,-26]);x.fill();
      x.fillStyle="#0a0303";x.beginPath();x.ellipse(0,-12,6.5,8,0,0,TAU);x.fill();
      x.fillStyle="#ffb040";x.shadowColor="#ff5a1e";x.shadowBlur=10;x.beginPath();x.ellipse(0,-9+(j===2?sw*0.3:0),2.6,3.8,0,0,TAU);x.fill();x.shadowBlur=0;x.restore();});
    x.fillStyle="rgba(255,120,40,.85)";for(var i=0;i<7;i++){var a=-Math.PI*0.9+i/6*Math.PI*0.8;poly(x,[Math.cos(a)*18,-24+Math.sin(a)*8,Math.cos(a)*26,-34+Math.sin(a)*10+sw*(i%2?1:-1),Math.cos(a)*20+3,-26+Math.sin(a)*8]);x.fill();}}
};
function regBosses(){R.ACTS.forEach(function(a){AS.BOSSES[a.key]=a.boss;});var RD=AS.render;if(RD&&RD.BOSS_ART)for(var k in ART)RD.BOSS_ART[k]=ART[k];}
regBosses();
/* ---------------- Crypt runtime ---------------- */
var dg=null;R.dg=function(){return dg;};
function rnd(a,b){return a+Math.random()*(b-a);}
function newDepth(n){var rooms=R.genDepth(4+n+(n>1?1:0));rooms.forEach(function(r){r.cleared=r.kind==="start";r.seen=r.kind==="start";});rooms[0].here=true;
  return {depth:n,rooms:rooms,cur:0,state:"explore",waves:0,spawnQ:[],waveT:0,bossT:0,bossOn:false,portal:null,chest:null,doorT:1,winT:0,torches:torchesFor(rooms),dust:[]};}
function torchesFor(rooms){var T=[];rooms.forEach(function(rm){var q=R.roomRect(rm),hasN=link(rooms,rm,0,-1),hasS=link(rooms,rm,0,1),hasW=link(rooms,rm,-1,0),hasE=link(rooms,rm,1,0);
  [0.22,0.78].forEach(function(f){T.push({x:q.x+q.w*f,y:q.y-6,s:"n"});T.push({x:q.x+q.w*f,y:q.y+q.h+6,s:"s"});});
  [0.25,0.75].forEach(function(f){T.push({x:q.x-6,y:q.y+q.h*f,s:"w"});T.push({x:q.x+q.w+6,y:q.y+q.h*f,s:"e"});});});return T;}
function link(rooms,rm,dx,dy){for(var i=0;i<rm.links.length;i++){var b=rooms[rm.links[i]];if(b.gx-rm.gx===dx&&b.gy-rm.gy===dy)return b;}return null;}
R.startCrypt=function(){var G=AS.G,P=G.P;document.body.classList.add("crypt");dg=newDepth(1);P.x=0;P.y=0;G.cam.x=0;G.cam.y=0;lastX=0;lastY=0;
  var a=R.ACTS[0];C().banner("ACT I — "+a.depth.toUpperCase(),true);};
R.isOn=function(){var G=AS.G;return !!(dg&&G&&G.mode==="dungeon");};
var lastX=0,lastY=0;
function curRect(){return R.roomRect(dg.rooms[dg.cur]);}
function aliveN(){var G=AS.G,n=0;for(var i=0;i<G.eCount;i++)if(!G.E[i].dead)n++;return n;}
function mixKeys(){var row=AS.SCHEDULE[AS.G.schIdx||0],ks=[],k;for(k in row.mix)for(var j=0;j<Math.ceil(row.mix[k]);j++)ks.push(k);return ks.length?ks:["swarmer"];}
function queueWave(n){var q=curRect(),P=AS.G.P,ks=mixKeys();for(var i=0;i<n;i++){var x,y,g=0;do{x=rnd(q.x+50,q.x+q.w-50);y=rnd(q.y+50,q.y+q.h-50);}while(g++<12&&(x-P.x)*(x-P.x)+(y-P.y)*(y-P.y)<230*230);
  dg.spawnQ.push({x:x,y:y,t:0.55+Math.random()*0.5,max:1.05,key:ks[(Math.random()*ks.length)|0]});}AS.sfx.warn&&AS.sfx.warn();}
function waveSize(){return 7+dg.depth*3+(AS.rift.prof.diff*2);}
function enterRoom(i){var rm=dg.rooms[i];dg.rooms.forEach(function(r){r.here=false;});rm.here=true;dg.cur=i;rm.seen=true;rm.links.forEach(function(j){dg.rooms[j].peek=true;});
  if(rm.cleared)return;var c=C();
  if(rm.kind==="treasure"){var q=R.roomRect(rm);dg.chest={x:q.x+q.w/2,y:q.y+q.h/2,open:false,t:0};rm.cleared=true;c.banner("A sealed reliquary",false);return;}
  dg.state="fight";dg.doorT=0;AS.sfx.ward&&AS.sfx.ward();c.shake(0.25);
  if(rm.kind==="boss"){dg.state="boss";dg.bossT=1.6;dg.bossOn=false;var A=R.ACTS[dg.depth-1];c.banner("⚠ "+A.n.toUpperCase(),true);return;}
  dg.waves=rm.kind==="elite"?2:(dg.depth>=2?3:2);dg.elite=rm.kind==="elite";queueWave(waveSize());dg.waves--;c.banner(rm.kind==="elite"?"The chamber seals — a rare pack stirs":"The doors slam shut",true);}
function roomCleared(){var c=C(),G=AS.G,P=G.P,rm=dg.rooms[dg.cur];rm.cleared=true;dg.state="explore";dg.doorT=0;
  P.hp=Math.min(P.maxHp,P.hp+P.maxHp*0.15);c.vacuum();c.addFt(P.x,P.y-36,"+15% HP","#8affc0",1);AS.sfx.lvl&&AS.sfx.lvl();
  if(rm.kind==="boss")c.banner(dg.depth>=3?"The Choir falls silent — step into the light":"A portal tears open — descend",false);else c.banner("The way is open",false);}
function placeNear(e,q){e.x=Math.max(q.x+e.r+20,Math.min(q.x+q.w-e.r-20,e.x));e.y=Math.max(q.y+e.r+20,Math.min(q.y+q.h-e.r-20,e.y));}
function nextDepth(){var G=AS.G,P=G.P,c=C(),st=D().st;
  st.ground.slice().forEach(function(L){var r=D().take(st,L.it);if(r!=="full"){st.ground.splice(st.ground.indexOf(L),1);st.found[L.it.rar]++;}});
  for(var k=0;k<G.eCount;k++)G.E[k].dead=true;G.epCount=0;G.haz=[];
  var n=dg.depth+1;dg=newDepth(n);P.x=0;P.y=0;lastX=lastY=0;G.cam.x=0;G.cam.y=0;G.schOff=40+(n-1)*90;AS.game.recalc();
  c.banner("ACT "+R.ACTS[n-1].act+" — "+R.ACTS[n-1].depth.toUpperCase(),true);c.shake(0.4);AS.sfx.transform&&AS.sfx.transform();R.save();}
R.onBossKill=function(e){if(!R.isOn()||!e.boss)return;var A=R.ACTS[dg.depth-1];if(!A||e.bkey!==A.key)return;
  var dd=D(),key=A.key+"@"+P0.diff,first=!P0.acts[key];dd.dropItem(e.x,e.y,3,A.leg);
  if(Math.random()<(P0.diff>=2?1:0.5))dd.dropItem(e.x,e.y,4);
  if(first){P0.acts[key]=1;C().addFt(AS.G.P.x,AS.G.P.y-64,"✦ Skill point earned","#ffd84a",1);}
  var q=curRect();dg.portal={x:q.x+q.w/2,y:q.y+q.h/2,t:0,last:dg.depth>=3};R.save();};
R.update=function(dt){if(!R.isOn())return;var G=AS.G,P=G.P,c=C();
  if(saveT>0){saveT-=dt;if(saveT<=0)R.save();}
  dg.doorT=Math.min(1,dg.doorT+dt*2.5);
  // movement against walls: keep the hero on walkable stone (slide along walls)
  var open=dg.state==="explore",rr=P.r||14;
  if(!R.walkable(dg.rooms,open,P.x,P.y,rr)){if(R.walkable(dg.rooms,open,P.x,lastY,rr))P.y=lastY;else if(R.walkable(dg.rooms,open,lastX,P.y,rr))P.x=lastX;else{P.x=lastX;P.y=lastY;}
    if(P.dash&&P.dash.t>0)P.dash.t=Math.min(P.dash.t,0.02);}
  lastX=P.x;lastY=P.y;
  var ri=R.roomAt(dg.rooms,P.x,P.y,rr+6);if(ri>=0&&ri!==dg.cur&&open)enterRoom(ri);
  var q=curRect();
  // enemies are bound to the sealed chamber
  if(dg.state!=="explore"||aliveN()){for(var i=0;i<G.eCount;i++){var e=G.E[i];if(!e.dead)placeNear(e,q);}}
  for(i=dg.spawnQ.length-1;i>=0;i--){var s=dg.spawnQ[i];s.t-=dt;if(s.t<=0){var en=AS.game.spawnType(s.key,s.x,s.y);if(en){c.boom(s.x,s.y,"#ff3040",6);}dg.spawnQ.splice(i,1);}}
  if(dg.state==="fight"){
    if(!dg.spawnQ.length&&!aliveN()){if(dg.waves>0){dg.waves--;dg.waveT=0.9;dg.state="wave";}
      else if(dg.elite){dg.elite=false;var before=G.eCount,made=D().spawnPack(true);for(i=before;i<G.eCount;i++){var pe=G.E[i];pe.x+=q.x+q.w/2-P.x+(P.x<q.x+q.w/2?q.w*0.25:-q.w*0.25);pe.y+=q.y+q.h/2-P.y;placeNear(pe,q);}if(!made)roomCleared();}
      else roomCleared();}}
  else if(dg.state==="wave"){dg.waveT-=dt;if(dg.waveT<=0){queueWave(waveSize()+2);dg.state="fight";}}
  if(dg.rooms[dg.cur].kind==="boss"&&!dg.rooms[dg.cur].cleared){
    if(!dg.bossOn){dg.bossT-=dt;if(dg.bossT<=0){var A=R.ACTS[dg.depth-1];if(AS.game.spawnBoss(A.key)){dg.bossOn=true;var b=G.bosses[G.bosses.length-1];b.x=q.x+q.w/2;b.y=P.y<q.y+q.h/2?q.y+q.h*0.72:q.y+q.h*0.28;}}}
    else if(!G.bosses.length&&dg.state==="boss"&&dg.bossOn){dg.rooms[dg.cur].cleared=true;roomCleared();}}
  if(dg.chest&&!dg.chest.open){var dx=P.x-dg.chest.x,dy=P.y-dg.chest.y;if(dx*dx+dy*dy<46*46){dg.chest.open=true;var dd=D();dd.dropItem(dg.chest.x,dg.chest.y,Math.random()<0.12?3:2);dd.dropItem(dg.chest.x,dg.chest.y,1);dd.dropItem(dg.chest.x,dg.chest.y,dd.rollRarity(null,0.5));
    if(Math.random()<0.3)dd.dropItem(dg.chest.x,dg.chest.y,4);c.shake(0.3);AS.sfx.clear&&AS.sfx.clear();}}
  if(dg.chest)dg.chest.t+=dt;
  if(dg.portal){dg.portal.t+=dt;var px=P.x-dg.portal.x,py=P.y-dg.portal.y;
    if(dg.portal.t>1.2&&px*px+py*py<40*40){if(dg.portal.last){if(!dg.winT){dg.winT=1;P.inv=99;c.banner("THE CRYPT IS CLEANSED",false);AS.sfx.clear&&AS.sfx.clear();setTimeout(function(){if(AS.G.state==="playing")AS.game._win();},1300);}}else nextDepth();}}
};
R.clampDrop=function(L){if(!R.isOn())return;var q=curRect();L.tx=Math.max(q.x+24,Math.min(q.x+q.w-24,L.tx));L.ty=Math.max(q.y+30,Math.min(q.y+q.h-24,L.ty));};
R.hudText=function(){if(!dg)return "";var A=R.ACTS[dg.depth-1],n=dg.rooms.length,c=dg.rooms.filter(function(r){return r.cleared;}).length;return "ACT "+A.act+" · "+c+"/"+n;};
R.status=function(){return dg?{depth:dg.depth,cur:dg.cur,state:dg.state,rooms:dg.rooms.map(function(r){return {k:r.kind,c:!!r.cleared,gx:r.gx,gy:r.gy,links:r.links.slice()};}),portal:!!dg.portal,chest:!!dg.chest}:null;};
R._enter=function(i){var q=R.roomRect(dg.rooms[i]),P=AS.G.P;P.x=lastX=q.x+q.w/2;P.y=lastY=q.y+q.h-80;enterRoom(i);};
R._portal=function(){if(dg&&dg.portal){var P=AS.G.P;dg.portal.t=2;P.x=dg.portal.x;P.y=dg.portal.y;}};
/* ---------------- tileset drawn in code ---------------- */
var tiles={},tdpr=0;
function rng(s){return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function mkC(w,h){var c=document.createElement("canvas");c.width=w;c.height=h;return c;}
function flagTile(d,dark){var S=256,c=mkC(Math.round(S*d),Math.round(S*d)),x=c.getContext("2d"),r=rng(dark?77:31);x.scale(d,d);
  x.fillStyle="#0b0808";x.fillRect(0,0,S,S);
  var rows=[0,58,122,186,256];for(var ri=0;ri<4;ri++){var y0=rows[ri],h=rows[ri+1]-y0,xx=-((ri*37)%60);
    while(xx<S){var w=52+Math.floor(r()*60);var v=Math.floor(r()*14),b=dark?24:34;
      var px=xx+2,py=y0+2,pw=w-4,ph=h-4;
      var g=x.createLinearGradient(px,py,px+pw,py+ph);g.addColorStop(0,"rgb("+(b+v+10)+","+(b+v+4)+","+(b+v)+")");g.addColorStop(1,"rgb("+(b+v-8)+","+(b+v-12)+","+(b+v-14)+")");
      x.fillStyle=g;rr(x,px,py,pw,ph,4);x.fill();
      x.strokeStyle="rgba(255,235,210,.07)";x.lineWidth=1.2;x.beginPath();x.moveTo(px+3,py+ph-2);x.lineTo(px+3,py+3);x.lineTo(px+pw-3,py+3);x.stroke();
      x.strokeStyle="rgba(0,0,0,.45)";x.beginPath();x.moveTo(px+pw-2,py+4);x.lineTo(px+pw-2,py+ph-2);x.lineTo(px+4,py+ph-2);x.stroke();
      for(var k=0;k<5;k++){x.fillStyle="rgba(0,0,0,"+(0.08+r()*0.1)+")";x.beginPath();x.arc(px+r()*pw,py+r()*ph,1+r()*2.5,0,TAU);x.fill();}
      if(r()<0.35){x.strokeStyle="rgba(0,0,0,.55)";x.lineWidth=1;x.beginPath();var cx=px+r()*pw,cy=py+r()*ph;x.moveTo(cx,cy);for(var s=0;s<4;s++){cx+=(r()-0.5)*26;cy+=(r()-0.5)*18;x.lineTo(cx,cy);}x.stroke();}
      if(r()<0.18){x.fillStyle="rgba(60,80,40,.22)";x.beginPath();x.ellipse(px+r()*pw,py+ph-4,8+r()*10,3+r()*3,0,0,TAU);x.fill();}
      xx+=w;}}
  for(var bl=0;bl<(dark?2:1);bl++){var bx=r()*S,by=r()*S,g2=x.createRadialGradient(bx,by,0,bx,by,22+r()*18);g2.addColorStop(0,"rgba(70,6,8,.35)");g2.addColorStop(1,"rgba(70,6,8,0)");x.fillStyle=g2;x.fillRect(0,0,S,S);}
  return c;}
function brickTile(d){var S=128,c=mkC(Math.round(S*d),Math.round(S*d)),x=c.getContext("2d"),r=rng(5);x.scale(d,d);x.fillStyle="#080506";x.fillRect(0,0,S,S);
  for(var y=0;y<S;y+=16){var off=(y/16)%2?16:0;for(var xx=-off;xx<S;xx+=32){var v=Math.floor(r()*12);x.fillStyle="rgb("+(38+v)+","+(30+v)+","+(30+v)+")";x.fillRect(xx+1,y+1,30,14);
    x.fillStyle="rgba(255,220,200,.06)";x.fillRect(xx+1,y+1,30,2);x.fillStyle="rgba(0,0,0,.35)";x.fillRect(xx+1,y+13,30,2);}}
  return c;}
function pat(ctx,key,fn){var d=AS.view.dpr||1;if(tdpr!==d){tdpr=d;tiles={};}var t=tiles[key];if(!t){var cv=fn(d);t=tiles[key]={p:ctx.createPattern(cv,"repeat")};try{t.p.setTransform(new DOMMatrix().scale(1/d));}catch(e){}}return t.p;}
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.lineTo(a+w-r,b);x.quadraticCurveTo(a+w,b,a+w,b+r);x.lineTo(a+w,b+h-r);x.quadraticCurveTo(a+w,b+h,a+w-r,b+h);x.lineTo(a+r,b+h);x.quadraticCurveTo(a,b+h,a,b+h-r);x.lineTo(a,b+r);x.quadraticCurveTo(a,b,a+r,b);x.closePath();}
var WT=34;
function vis(q,ox,oy,W,H,m){return q.x+ox<W+m&&q.x+q.w+ox>-m&&q.y+oy<H+m&&q.y+q.h+oy>-m;}
R.drawFloor=function(ctx,ox,oy,G){var W=AS.view.W,H=AS.view.H,gT=G.gT;
  ctx.fillStyle="#040203";ctx.fillRect(0,0,W,H);if(!dg)return;
  var fl=pat(ctx,"f",function(d){return flagTile(d,false);}),fd=pat(ctx,"fd",function(d){return flagTile(d,true);}),br=pat(ctx,"b",brickTile);
  ctx.save();ctx.translate(ox,oy);var rooms=dg.rooms,i,j,q;
  // corridors (floor + side walls)
  for(i=0;i<rooms.length;i++)for(j=0;j<rooms[i].links.length;j++){var bi=rooms[i].links[j];if(bi<i)continue;q=R.corrRect(rooms[i],rooms[bi]);if(!vis(q,ox,oy,W,H,60))continue;
    ctx.fillStyle=br;if(q.hz){ctx.fillRect(q.x,q.y-WT,q.w,WT);ctx.fillRect(q.x,q.y+q.h,q.w,WT);}else{ctx.fillRect(q.x-WT,q.y,WT,q.h);ctx.fillRect(q.x+q.w,q.y,WT,q.h);}
    ctx.fillStyle=fd;ctx.fillRect(q.x,q.y,q.w,q.h);
    var sg=q.hz?ctx.createLinearGradient(0,q.y,0,q.y+q.h):ctx.createLinearGradient(q.x,0,q.x+q.w,0);sg.addColorStop(0,"rgba(0,0,0,.6)");sg.addColorStop(0.25,"rgba(0,0,0,0)");sg.addColorStop(0.75,"rgba(0,0,0,0)");sg.addColorStop(1,"rgba(0,0,0,.6)");ctx.fillStyle=sg;ctx.fillRect(q.x,q.y,q.w,q.h);}
  // rooms
  for(i=0;i<rooms.length;i++){var rm=rooms[i];q=R.roomRect(rm);if(!vis(q,ox,oy,W,H,WT+60))continue;
    ctx.fillStyle=br;ctx.fillRect(q.x-WT,q.y-WT,q.w+WT*2,WT);ctx.fillRect(q.x-WT,q.y+q.h,q.w+WT*2,WT);ctx.fillRect(q.x-WT,q.y,WT,q.h);ctx.fillRect(q.x+q.w,q.y,WT,q.h);
    ctx.fillStyle=fl;ctx.fillRect(q.x,q.y,q.w,q.h);
    if(rm.kind==="boss"){drawSeal(ctx,q.x+q.w/2,q.y+q.h/2,170,gT,R.ACTS[dg.depth-1].boss.c);}
    // carpet runner in the start room, rune circle in elite rooms
    if(rm.kind==="start"){ctx.fillStyle="rgba(90,10,14,.55)";ctx.fillRect(q.x+q.w/2-46,q.y+40,92,q.h-80);ctx.strokeStyle="rgba(200,150,70,.35)";ctx.lineWidth=3;ctx.strokeRect(q.x+q.w/2-40,q.y+46,80,q.h-92);}
    if(rm.kind==="elite")drawSeal(ctx,q.x+q.w/2,q.y+q.h/2,110,gT,"#ffd84a");
    // inner wall shadow + top lip
    var e=26,g1=ctx.createLinearGradient(0,q.y,0,q.y+e);g1.addColorStop(0,"rgba(0,0,0,.75)");g1.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g1;ctx.fillRect(q.x,q.y,q.w,e);
    var g2=ctx.createLinearGradient(0,q.y+q.h,0,q.y+q.h-e);g2.addColorStop(0,"rgba(0,0,0,.6)");g2.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g2;ctx.fillRect(q.x,q.y+q.h-e,q.w,e);
    var g3=ctx.createLinearGradient(q.x,0,q.x+e,0);g3.addColorStop(0,"rgba(0,0,0,.6)");g3.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g3;ctx.fillRect(q.x,q.y,e,q.h);
    var g4=ctx.createLinearGradient(q.x+q.w,0,q.x+q.w-e,0);g4.addColorStop(0,"rgba(0,0,0,.6)");g4.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g4;ctx.fillRect(q.x+q.w-e,q.y,e,q.h);
    ctx.fillStyle="#5a4636";ctx.fillRect(q.x-WT,q.y-WT,q.w+WT*2,3);ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(q.x-WT,q.y+q.h+WT-3,q.w+WT*2,3);
    // corner pillars
    [[q.x,q.y],[q.x+q.w,q.y],[q.x,q.y+q.h],[q.x+q.w,q.y+q.h]].forEach(function(c){pillar(ctx,c[0],c[1]);});
    // doors
    var sealed=(rm.here&&dg.state!=="explore");
    rm.links.forEach(function(li){var b=rooms[li],dx=b.gx-rm.gx,dy=b.gy-rm.gy,cw=R.CW,x0,y0,w,h;
      if(dx){x0=dx>0?q.x+q.w:q.x-WT;y0=q.y+q.h/2-cw/2;w=WT;h=cw;}else{x0=q.x+q.w/2-cw/2;y0=dy>0?q.y+q.h:q.y-WT;w=cw;h=WT;}
      ctx.fillStyle=fd;ctx.fillRect(x0,y0,w,h);
      if(sealed){var a=Math.min(1,dg.doorT*1.4);ctx.fillStyle="rgba(10,4,4,"+(0.8*a)+")";ctx.fillRect(x0,y0,w,h);ctx.strokeStyle="rgba(70,62,58,"+a+")";ctx.lineWidth=5;ctx.beginPath();
        for(var k=1;k<6;k++){if(dx){ctx.moveTo(x0,y0+h*k/6);ctx.lineTo(x0+w,y0+h*k/6);}else{ctx.moveTo(x0+w*k/6,y0);ctx.lineTo(x0+w*k/6,y0+h);}}ctx.stroke();
        ctx.globalCompositeOperation="lighter";ctx.fillStyle="rgba(255,40,40,"+(0.25+0.15*Math.sin(gT*6))*a+")";if(dx)ctx.fillRect(x0+w/2-2,y0,4,h);else ctx.fillRect(x0,y0+h/2-2,w,4);ctx.globalCompositeOperation="source-over";}
      else if(!b.cleared&&b.kind==="boss"){ctx.fillStyle="rgba(255,40,30,"+(0.18+0.1*Math.sin(gT*4))+")";ctx.fillRect(x0,y0,w,h);}});}
  // torches (sconce; the glow is drawn after the darkness)
  for(i=0;i<dg.torches.length;i++){var t=dg.torches[i],sx=t.x+ox,sy=t.y+oy;if(sx<-40||sx>W+40||sy<-60||sy>H+40)continue;ctx.fillStyle="#2a1e16";ctx.fillRect(t.x-4,t.y-6,8,12);ctx.fillStyle="#6a5038";ctx.fillRect(t.x-6,t.y-8,12,3);
    var fl2=Math.sin(gT*13+i*2.1)*1.5;ctx.fillStyle="#ff9a2a";ctx.beginPath();ctx.ellipse(t.x,t.y-13+fl2*0.3,4,7+fl2,0,0,TAU);ctx.fill();ctx.fillStyle="#ffe0a0";ctx.beginPath();ctx.ellipse(t.x,t.y-11,2,3.5,0,0,TAU);ctx.fill();}
  // summoning glyphs
  for(i=0;i<dg.spawnQ.length;i++){var s=dg.spawnQ[i],f=1-s.t/s.max;ctx.globalAlpha=Math.min(1,f*1.5);ctx.strokeStyle="#ff2a3a";ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y,18+f*6,0,TAU);ctx.stroke();
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(gT*2);ctx.beginPath();for(var k=0;k<5;k++){var a2=k*TAU*2/5;ctx[k?"lineTo":"moveTo"](Math.cos(a2)*16,Math.sin(a2)*16);}ctx.closePath();ctx.stroke();ctx.restore();ctx.globalAlpha=1;}
  if(dg.chest)drawChest(ctx,dg.chest,gT);
  if(dg.portal)drawPortal(ctx,dg.portal,gT);
  ctx.restore();};
function pillar(ctx,x,y){var s=50;ctx.fillStyle="#1a1210";ctx.fillRect(x-s/2,y-s/2,s,s);var g=ctx.createLinearGradient(x-s/2,y-s/2,x+s/2,y+s/2);g.addColorStop(0,"#5a4a3e");g.addColorStop(1,"#241a16");ctx.fillStyle=g;ctx.fillRect(x-s/2+5,y-s/2+5,s-10,s-10);
  ctx.strokeStyle="rgba(0,0,0,.6)";ctx.lineWidth=2;ctx.strokeRect(x-s/2+10,y-s/2+10,s-20,s-20);ctx.fillStyle="#7a5a3a";ctx.beginPath();ctx.arc(x,y,4,0,TAU);ctx.fill();}
function drawSeal(ctx,x,y,R0,gT,col){ctx.save();ctx.translate(x,y);ctx.globalAlpha=0.32;ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,R0,0,TAU);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,R0-14,0,TAU);ctx.stroke();
  ctx.rotate(gT*0.15);ctx.beginPath();for(var k=0;k<7;k++){var a=k*TAU*3/7;ctx[k?"lineTo":"moveTo"](Math.cos(a)*(R0-14),Math.sin(a)*(R0-14));}ctx.closePath();ctx.stroke();
  for(k=0;k<12;k++){var b=k/12*TAU;ctx.save();ctx.rotate(b);ctx.fillStyle=col;ctx.fillRect(R0-9,-2,5,4);ctx.restore();}ctx.restore();ctx.globalAlpha=1;}
function drawChest(ctx,c,gT){var x=c.x,y=c.y;ctx.fillStyle="rgba(0,0,0,.5)";ctx.beginPath();ctx.ellipse(x,y+14,30,8,0,0,TAU);ctx.fill();
  if(!c.open){ctx.globalCompositeOperation="lighter";ctx.fillStyle="rgba(255,200,80,"+(0.15+0.08*Math.sin(gT*3))+")";ctx.beginPath();ctx.arc(x,y,48,0,TAU);ctx.fill();ctx.globalCompositeOperation="source-over";}
  ctx.fillStyle="#3a2214";ctx.fillRect(x-26,y-10,52,24);ctx.fillStyle="#5a3420";ctx.fillRect(x-26,y-10,52,5);ctx.fillStyle="#8a7a60";ctx.fillRect(x-20,y-10,5,24);ctx.fillRect(x+15,y-10,5,24);
  var lid=c.open?Math.min(1,c.t*3):0;ctx.save();ctx.translate(x,y-10);ctx.scale(1,1-lid*1.6);ctx.fillStyle="#4a2a18";ctx.beginPath();ctx.moveTo(-26,0);ctx.quadraticCurveTo(0,-20,26,0);ctx.closePath();ctx.fill();ctx.strokeStyle="#8a7a60";ctx.lineWidth=3;ctx.stroke();ctx.restore();
  ctx.fillStyle=c.open?"#ffd060":"#c8a040";ctx.fillRect(x-4,y-6,8,8);}
function drawPortal(ctx,p,gT){var a=Math.min(1,p.t*1.5),x=p.x,y=p.y;ctx.save();ctx.translate(x,y);ctx.globalAlpha=a;
  var g=ctx.createRadialGradient(0,0,4,0,0,56);g.addColorStop(0,"rgba(255,230,255,.95)");g.addColorStop(0.35,"rgba(190,40,90,.85)");g.addColorStop(1,"rgba(40,0,30,0)");ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,44,60,0,0,TAU);ctx.fill();
  ctx.strokeStyle="rgba(255,120,160,.8)";ctx.lineWidth=2.5;for(var k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,30+k*8,44+k*9,gT*(1+k*0.4),0.3,TAU-0.6);ctx.stroke();}
  ctx.restore();ctx.globalAlpha=1;ctx.font="bold 11px Georgia,serif";ctx.textAlign="center";ctx.fillStyle="#ffc8e0";ctx.fillText(p.last?"Step in to claim victory":"Step in to descend",x,y-72);}
var glow=null;
R.drawLight=function(ctx,ox,oy,gT){if(!R.isOn())return;var W=AS.view.W,H=AS.view.H;
  if(!glow){glow=mkC(128,128);var x=glow.getContext("2d"),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,"rgba(255,150,60,.9)");g.addColorStop(0.4,"rgba(255,100,30,.3)");g.addColorStop(1,"rgba(255,80,20,0)");x.fillStyle=g;x.fillRect(0,0,128,128);}
  ctx.globalCompositeOperation="lighter";for(var i=0;i<dg.torches.length;i++){var t=dg.torches[i],sx=t.x+ox,sy=t.y+oy-12;if(sx<-120||sx>W+120||sy<-120||sy>H+120)continue;var f=0.85+0.15*Math.sin(gT*11+i*1.7),r=90*f;ctx.globalAlpha=0.55;ctx.drawImage(glow,sx-r,sy-r,r*2,r*2);}
  if(dg.portal){var r2=120;ctx.globalAlpha=0.6;ctx.drawImage(glow,dg.portal.x+ox-r2,dg.portal.y+oy-r2,r2*2,r2*2);}
  ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";drawMap(ctx);};
function drawMap(ctx){var V=AS.view,top=(V.safeT||0)+66,cs=12,gap=5,rooms=dg.rooms,mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  rooms.forEach(function(r){if(!(r.seen||r.peek))return;mnx=Math.min(mnx,r.gx);mny=Math.min(mny,r.gy);mxx=Math.max(mxx,r.gx);mxy=Math.max(mxy,r.gy);});
  var w=(mxx-mnx+1)*(cs+gap)+gap,h=(mxy-mny+1)*(cs+gap)+gap,x0=10,y0=top;ctx.fillStyle="rgba(8,2,2,.7)";ctx.fillRect(x0,y0,w,h);ctx.strokeStyle="rgba(176,112,64,.7)";ctx.lineWidth=1;ctx.strokeRect(x0+0.5,y0+0.5,w-1,h-1);
  function cx(r){return x0+gap+(r.gx-mnx)*(cs+gap);}function cy(r){return y0+gap+(r.gy-mny)*(cs+gap);}
  ctx.strokeStyle="rgba(200,170,130,.6)";ctx.lineWidth=2;rooms.forEach(function(r,i){if(!r.seen)return;r.links.forEach(function(j){var b=rooms[j];if(!(b.seen||b.peek))return;ctx.beginPath();ctx.moveTo(cx(r)+cs/2,cy(r)+cs/2);ctx.lineTo(cx(b)+cs/2,cy(b)+cs/2);ctx.stroke();});});
  rooms.forEach(function(r,i){if(!(r.seen||r.peek))return;var c=r.kind==="boss"?"#ff3a3a":r.kind==="treasure"?"#ffd84a":r.kind==="elite"?"#d0a828":"#8a7a68";ctx.fillStyle=r.seen?(r.cleared?"#3a2e26":"#5a2020"):"rgba(40,30,26,.8)";ctx.fillRect(cx(r),cy(r),cs,cs);
    ctx.strokeStyle=c;ctx.lineWidth=r.seen?1.5:1;ctx.strokeRect(cx(r)+0.5,cy(r)+0.5,cs-1,cs-1);if(i===dg.cur){ctx.fillStyle="#ffe8b0";ctx.beginPath();ctx.arc(cx(r)+cs/2,cy(r)+cs/2,3,0,TAU);ctx.fill();}});}
})(typeof window!=="undefined"?window:globalThis);
