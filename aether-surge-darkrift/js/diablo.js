/* Aether Surge — "Dark Rift" M1: gothic lighting, rarity loot with beams, Armory (equip + affixes),
   champion / rare monster packs, skill hotbar. Pure item logic is Node-testable (require); the rest runs in the browser.
   Gear lasts for the current run. All names and art are original. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var D={};
/* ---------------- data ---------------- */
D.RAR=[
  {id:"common",   n:"Common",   c:"#d8d0c0", w:58, aff:[0,0], beam:0},
  {id:"magic",    n:"Magic",    c:"#6f8fff", w:28, aff:[1,2], beam:1},
  {id:"rare",     n:"Rare",     c:"#ffd84a", w:11, aff:[3,4], beam:2},
  {id:"legendary",n:"Legendary",c:"#ff8a1e", w:3,  aff:[3,3], beam:3}
];
D.RI={common:0,magic:1,rare:2,legendary:3};
D.SLOTS=["weapon","helm","chest","gloves","boots","amulet","ring1","ring2"];
D.SLOT_N={weapon:"Weapon",helm:"Helm",chest:"Chest",gloves:"Gloves",boots:"Boots",amulet:"Amulet",ring1:"Ring",ring2:"Ring"};
D.KIND={weapon:"weapon",helm:"helm",chest:"chest",gloves:"gloves",boots:"boots",amulet:"amulet",ring1:"ring",ring2:"ring"};
D.KINDS=["weapon","helm","chest","gloves","boots","amulet","ring"];
D.BASES={
  weapon:["Notched Cleaver","Grave Sabre","Ashen Glaive","Rusted Falchion"],
  helm:["Iron Coif","Horned Helm","Pale Visage","Barbute"],
  chest:["Ringmail","Blackplate","Shroud Hauberk","Scale Vest"],
  gloves:["Leather Grips","Spiked Gauntlets","Chain Mitts"],
  boots:["Worn Boots","Ironshod Greaves","Bog Treads"],
  amulet:["Bone Charm","Ember Locket","Tallow Pendant"],
  ring:["Copper Band","Obsidian Signet","Bone Loop"]
};
// implicit stat every base of a kind carries (scales with item level)
D.IMPL={weapon:{k:"dmg",v:0.06},helm:{k:"hp",v:6},chest:{k:"armor",v:0.03},gloves:{k:"rate",v:0.03},boots:{k:"spd",v:0.04},amulet:{k:"crit",v:0.02},ring:{k:"critD",v:0.08}};
D.AFF=[
  {k:"dmg",  pre:"Cruel",     lo:0.04,hi:0.10},
  {k:"rate", suf:"of Haste",  lo:0.03,hi:0.07},
  {k:"spd",  suf:"of the Wind",lo:0.03,hi:0.07},
  {k:"crit", pre:"Keen",      lo:0.02,hi:0.05},
  {k:"critD",pre:"Vicious",   lo:0.10,hi:0.25},
  {k:"hp",   pre:"Stalwart",  lo:6,   hi:16, flat:1},
  {k:"armor",suf:"of Iron",   lo:0.02,hi:0.05},
  {k:"regen",suf:"of Mending",lo:0.3, hi:0.9, flat:1},
  {k:"leech",pre:"Leeching",  lo:0.005,hi:0.015},
  {k:"area", pre:"Sweeping",  lo:0.05,hi:0.12},
  {k:"cd",   suf:"of Focus",  lo:0.04,hi:0.09},
  {k:"pick", pre:"Grasping",  lo:0.08,hi:0.20}
];
D.TXT={dmg:"+{p}% damage",rate:"+{p}% attack speed",spd:"+{p}% move speed",crit:"+{p}% crit chance",critD:"+{p}% crit damage",
  hp:"+{n} max HP",armor:"-{p}% damage taken",regen:"+{n} HP/s",leech:"+{p}% life steal",area:"+{p}% area",cd:"-{p}% cooldowns",pick:"+{p}% pickup radius"};
D.LEG=[
  {id:"cinder", kind:"boots",  n:"Cinderstride",        fx:"ember", v:14, t:"Leave burning embers as you walk"},
  {id:"thunder",kind:"helm",   n:"Crown of the Gale",   fx:"storm", v:40, t:"Every 6th shot calls lightning"},
  {id:"wail",   kind:"chest",  n:"Shroud of Wailing",   fx:"echo",  v:36, t:"When struck, release a soul nova"},
  {id:"briar",  kind:"ring",   n:"Briarheart Signet",   fx:"thorns",v:35, t:"Foes that touch you take damage"},
  {id:"reap",   kind:"gloves", n:"Gravebloom Grips",    own:"reap", v:2,  t:"Each kill restores {v} HP"},
  {id:"oath",   kind:"weapon", n:"Oathsunder",          own:"oath", v:70, t:"Every 8th kill bursts a blood nova ({v} dmg)"},
  {id:"lantern",kind:"amulet", n:"Lantern of the Drowned",own:"lantern",v:0.3,t:"Skills recharge 30% faster, torchlight widens"}
];
D.PACK_AFF=[
  {id:"swift",   n:"Swift",    c:"#7affff"},
  {id:"armored", n:"Armored",  c:"#c0c8d8"},
  {id:"vampiric",n:"Vampiric", c:"#ff4060"},
  {id:"volatile",n:"Volatile", c:"#ff9a30"},
  {id:"frenzied",n:"Frenzied", c:"#ff50ff"},
  {id:"warded",  n:"Warded",   c:"#60b0ff"},
  {id:"molten",  n:"Molten",   c:"#ff5a1e"}
];
var SYL1=["Gor","Mal","Vex","Thul","Ska","Bran","Ort","Kael","Dru","Zan","Hesk","Morr"],SYL2=["vath","gul","rek","dris","mok","thar","nix","bane","grim","sul"];
var EPI=["the Blighted","the Hollow","Ashmaw","the Unburied","Gravecaller","the Flayed","of the Pit","Bonegnaw"];
D.RARE_W1=["Grim","Dread","Hollow","Blood","Ashen","Bone","Raven","Gloom","Wrath","Pale"],D.RARE_W2=["Vow","Bite","Song","Shroud","Fang","Ward","Crest","Heart","Coil","Mark"];
D.BAG=16;
/* ---------------- pure item logic ---------------- */
function pick(a,r){return a[Math.floor(r()*a.length)%a.length];}
D.rollRarity=function(r,boost){r=r||Math.random;boost=boost||0;var w=D.RAR.map(function(x,i){return x.w*(i?1+boost*i:Math.max(0.1,1-boost));}),t=0,k;for(k=0;k<4;k++)t+=w[k];var x=r()*t;for(k=0;k<4;k++){if(x<w[k])return k;x-=w[k];}return 3;};
D.round=function(k,v){var a=D.AFF.filter(function(x){return x.k===k;})[0];return a&&a.flat?Math.round(v*10)/10:Math.round(v*1000)/1000;};
D.rollItem=function(rar,ilvl,r,kind){
  r=r||Math.random;ilvl=Math.max(1,ilvl||1);if(typeof rar==="string")rar=D.RI[rar];if(rar==null)rar=D.rollRarity(r);
  var leg=null;if(rar===3){leg=kind?D.LEG.filter(function(l){return l.kind===kind;})[0]:pick(D.LEG,r);if(!leg)leg=pick(D.LEG,r);kind=leg.kind;}
  kind=kind||pick(D.KINDS,r);
  var sc=1+(ilvl-1)*0.12,base=pick(D.BASES[kind],r),im=D.IMPL[kind],it={uid:0,kind:kind,rar:rar,base:base,ilvl:ilvl,aff:[],leg:leg?leg.id:null};
  it.aff.push({k:im.k,v:D.round(im.k,im.v*sc),imp:1});
  var RA=D.RAR[rar],n=RA.aff[0]+Math.floor(r()*(RA.aff[1]-RA.aff[0]+1)),pool=D.AFF.slice(),pre=null,suf=null;
  for(var i=0;i<n&&pool.length;i++){var a=pool.splice(Math.floor(r()*pool.length)%pool.length,1)[0],v=(a.lo+(a.hi-a.lo)*r())*sc*(rar===3?1.25:1);
    it.aff.push({k:a.k,v:D.round(a.k,v)});if(a.pre&&!pre)pre=a.pre;if(a.suf&&!suf)suf=a.suf;}
  if(leg)it.name=leg.n;
  else if(rar===2)it.name=pick(D.RARE_W1,r)+" "+pick(D.RARE_W2,r);
  else if(rar===1)it.name=(pre?pre+" ":"")+base+(suf?" "+suf:"");
  else it.name=base;
  return it;
};
D.slotsFor=function(kind){return kind==="ring"?["ring1","ring2"]:[kind];};
D.affText=function(a){var t=D.TXT[a.k]||a.k;return t.replace("{p}",String(Math.round(a.v*1000)/10)).replace("{n}",String(a.v));};
D.legDef=function(id){for(var i=0;i<D.LEG.length;i++)if(D.LEG[i].id===id)return D.LEG[i];return null;};
D.legText=function(it){var l=D.legDef(it.leg);return l?l.t.replace("{v}",l.v):"";};
D.score=function(it){if(!it)return 0;var W={dmg:100,rate:90,spd:40,crit:110,critD:30,hp:2.2,armor:120,regen:12,leech:600,area:30,cd:50,pick:8},s=0;it.aff.forEach(function(a){s+=(W[a.k]||10)*a.v;});return s+(it.leg?25:0);};
// sum of equipped gear -> stat bonuses (rs) + behaviour hooks (fx for existing relic hooks, own for Dark Rift hooks)
D.sumStats=function(eq){var rs={},fx={},own={};
  D.SLOTS.forEach(function(s){var it=eq&&eq[s];if(!it)return;it.aff.forEach(function(a){rs[a.k]=(rs[a.k]||0)+a.v;});
    var l=it.leg&&D.legDef(it.leg);if(l){if(l.fx)fx[l.fx]=(fx[l.fx]||0)+l.v;if(l.own)own[l.own]=(own[l.own]||0)+l.v;}});
  return {rs:rs,fx:fx,own:own};};
D.newRunState=function(){return {eq:{},bag:[],ground:[],uid:1,fresh:0,own:{},kills:0,packT:35,packN:0,sk:[0,0,0,0],wardT:0,found:[0,0,0,0]};};
D.equip=function(st,bagIdx,slot){var it=st.bag[bagIdx];if(!it)return false;var ss=D.slotsFor(it.kind);
  if(!slot||ss.indexOf(slot)<0){slot=ss[0];if(ss.length>1&&st.eq[ss[0]]&&!st.eq[ss[1]])slot=ss[1];else if(ss.length>1&&st.eq[ss[0]]&&st.eq[ss[1]]&&D.score(st.eq[ss[1]])<D.score(st.eq[ss[0]]))slot=ss[1];}
  var old=st.eq[slot];st.eq[slot]=it;st.bag.splice(bagIdx,1);if(old)st.bag.splice(bagIdx,0,old);return slot;};
D.unequip=function(st,slot){var it=st.eq[slot];if(!it||st.bag.length>=D.BAG)return false;delete st.eq[slot];st.bag.push(it);return true;};
// picking up: an empty matching slot auto-equips, otherwise into the bag; returns "eq" | "bag" | "full"
D.take=function(st,it){var ss=D.slotsFor(it.kind);for(var i=0;i<ss.length;i++)if(!st.eq[ss[i]]){st.eq[ss[i]]=it;return "eq";}
  if(st.bag.length>=D.BAG)return "full";st.bag.push(it);st.fresh++;return "bag";};
AS.dia=D;
if(typeof module!=="undefined"&&module.exports)module.exports=D;
if(typeof document==="undefined")return;

/* ================= browser ================= */
var ST=D.st=D.newRunState(),TAU=Math.PI*2;
function C(){return AS.core;}
function $(id){return document.getElementById(id);}
D.reset=function(){ST=D.st=D.newRunState();renderHot(true);bagBadge();};
D.ilvl=function(){var G=AS.G;return 1+Math.floor(((G&&G.runT)||0)/50);};
D.stats=function(){return D.sumStats(ST.eq);};
function recalc(){if(AS.game&&AS.game.recalc)AS.game.recalc();ST.own=D.stats().own;}
/* ---------- drops ---------- */
D.dropItem=function(x,y,rar,kind){if(ST.ground.length>=30)ST.ground.shift();var it=D.rollItem(rar==null?null:rar,D.ilvl(),null,kind);it.uid=ST.uid++;
  var a=Math.random()*TAU,s=40+Math.random()*50;ST.ground.push({it:it,x:x,y:y,tx:x+Math.cos(a)*s,ty:y+Math.sin(a)*s,t:0,land:false});return it;};
D.onKill=function(e){var G=AS.G,P=G.P;ST.kills++;
  if(ST.own.reap)P.hp=Math.min(P.maxHp,P.hp+ST.own.reap);
  if(ST.own.oath&&ST.kills%8===0){var c=C();c.aoe(P.x,P.y,150*(P.eff.area||1),ST.own.oath*(P.eff.dmg||1),200,"sigil");AS.FX.novas.push({x:P.x,y:P.y,r:150*(P.eff.area||1),life:0.45,max:0.45,c:"#ff2a3a",w:9});}
  if(e.dAff&&e.dAff.indexOf("volatile")>=0&&!(e.mod&&e.mod.id==="volatile"))G.haz.push({x:e.x,y:e.y,t:0.9,max:0.9,R:95,dmg:e.d*1.3});
  var x=e.x,y=e.y;
  if(e.boss){D.dropItem(x,y,3);D.dropItem(x,y,2);D.dropItem(x,y,Math.random()<0.5?2:1);return;}
  if(e.dPack===2){D.dropItem(x,y,Math.random()<0.25?3:2);D.dropItem(x,y,D.rollRarity(null,0.6));return;}
  if(e.dPack===1){if(Math.random()<0.3)D.dropItem(x,y,D.rollRarity(null,0.4));return;}
  if(e.el){D.dropItem(x,y,Math.max(1,D.rollRarity(null,0.3)));return;}
  if(Math.random()<0.012)D.dropItem(x,y,D.rollRarity());
};
/* ---------- champion / rare packs ---------- */
function applyAff(e,id){if(id==="swift")e.spd*=1.45;else if(id==="armored")e.armor=Math.max(e.armor,0.4);else if(id==="warded"){e.shMax=e.max*0.4;e.shield=e.shMax;e.shT=6;}else if(id==="molten")e.molT=2+Math.random();}
function modOf(id){for(var i=0;i<D.PACK_AFF.length;i++)if(D.PACK_AFF[i].id===id)return D.PACK_AFF[i];return null;}
D.spawnPack=function(rare){
  var G=AS.G,P=G.P,g=AS.game;if(!g||!g.spawnType)return 0;
  var row=AS.SCHEDULE[G.schIdx||0],keys=Object.keys(row.mix).filter(function(k){return k!=="swarmer";});if(!keys.length)keys=Object.keys(row.mix);
  var key=keys[(Math.random()*keys.length)|0],a=Math.random()*TAU,R=Math.max(AS.view.W,AS.view.H)*0.55+30,cx=P.x+Math.cos(a)*R,cy=P.y+Math.sin(a)*R;
  var pool=D.PACK_AFF.slice(),affs=[];for(var i=0;i<(rare?2:1);i++)affs.push(pool.splice((Math.random()*pool.length)|0,1)[0].id);
  var n=rare?4:3+((Math.random()*2)|0),made=0,col=rare?"#ffd84a":"#6f8fff";
  var name=rare?(SYL1[(Math.random()*SYL1.length)|0]+SYL2[(Math.random()*SYL2.length)|0]+" "+EPI[(Math.random()*EPI.length)|0]):"Champion";
  for(var k=0;k<=n;k++){var lead=rare&&k===0;if(!rare&&k===n)break;var ang=k/(n+1)*TAU,rr=lead?0:34;
    var e=g.spawnType(key,cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr);if(!e)continue;made++;
    var hx=lead?7:(rare?1.6:3.2);e.hp=e.max=e.max*hx;e.d*=lead?1.5:1.25;e.xp=Math.round(e.xp*(lead?8:3));e.splits=0;e.tough=true;
    e.dPack=lead?2:1;e.dName=lead?name:(rare?"":"Champion");e.dCol=lead||!rare?col:"#b8a060";e.dAff=lead||!rare?affs:[];
    var sc=lead?1.45:1.18;e.r*=sc;e.spr=AS.render.enemySprite(key,e.c,e.r,AS.ETYPES[key].shape,sc*(AS.ETYPES[key].sc||1),true,lead?"#ffd84a":(rare?"#9a8040":"#6f8fff"));
    var m=e.dAff.length?modOf(e.dAff[0]):null;if(m&&m.id!=="molten"){e.mod={id:m.id,n:m.n,c:m.c};}
    e.dAff.forEach(function(id){applyAff(e,id);});}
  if(made){if(C())C().banner(rare?name+" and minions emerge!":"A Champion pack hunts you",!!rare);AS.sfx.warn&&AS.sfx.warn();}
  ST.packN++;return made;
};
/* ---------- skills ---------- */
D.SKILLS=[
  {id:"nova", n:"Ember Nova",   key:"1", cd:8,  c:"#ff6a2a", ic:"nova"},
  {id:"lance",n:"Soul Lance",   key:"2", cd:5,  c:"#b090ff", ic:"lance"},
  {id:"ward", n:"Iron Ward",    key:"3", cd:14, c:"#c8b890", ic:"ward"},
  {id:"draught",n:"Crimson Draught",key:"4",cd:22,c:"#ff2a40",ic:"flask"}
];
D.cast=function(i){var G=AS.G,P=G.P,c=C(),sk=D.SKILLS[i];if(!sk||G.state!=="playing"||ST.sk[i]>0)return false;
  var lv=P.lv||1,dm=(P.eff.dmg||1)*(1+0.06*(lv-1)),ar=P.eff.area||1;
  if(sk.id==="nova"){var R=150*ar;c.aoe(P.x,P.y,R,55*dm,260,"sigil",false,function(e){c.ignite(e,8*dm);});AS.FX.novas.push({x:P.x,y:P.y,r:R,life:0.5,max:0.5,c:"#ff6a2a",w:10});c.boom(P.x,P.y,"#ff9a40",16);c.shake(0.3);AS.sfx.nova&&AS.sfx.nova();}
  else if(sk.id==="lance"){var a=Math.atan2(P.fy||0,P.fx||1),t=c.nearest(P.x,P.y,420,false);if(t)a=Math.atan2(t.y-P.y,t.x-P.x);
    for(var k=-1;k<=1;k++){var pr=c.spawnPr(P.x,P.y,a+k*0.16,42*dm,640,0.9,"#c8a8ff",7,8,0);if(pr)pr.type="sigil";}AS.sfx.lance&&AS.sfx.lance();}
  else if(sk.id==="ward"){ST.wardT=4;c.boom(P.x,P.y,"#e8d8a0",12);AS.sfx.ward&&AS.sfx.ward();}
  else if(sk.id==="draught"){P.hp=Math.min(P.maxHp,P.hp+P.maxHp*0.35);c.addFt(P.x,P.y-28,"+"+Math.round(P.maxHp*0.35),"#ff6070",1);for(var j=0;j<14;j++){var b=Math.random()*TAU;c.addP(P.x,P.y,Math.cos(b)*60,Math.sin(b)*60-40,0.6,2.5,"#ff3050");}AS.sfx.draught&&AS.sfx.draught();}
  var cdm=(P.eff.cd||1)*(ST.own.lantern?1-ST.own.lantern:1);ST.sk[i]=sk.cd*cdm;ST.skMax=ST.skMax||[];ST.skMax[i]=ST.sk[i];
  AS.native&&AS.native.haptic&&AS.native.haptic("LIGHT");renderHot(true);return true;};
D.dmgTaken=function(d){return ST.wardT>0?d*0.5:d;};
/* ---------- per-frame ---------- */
D.update=function(dt){var G=AS.G,P=G.P;if(G.state!=="playing")return;
  for(var i=0;i<4;i++)if(ST.sk[i]>0)ST.sk[i]=Math.max(0,ST.sk[i]-dt);if(ST.wardT>0)ST.wardT-=dt;
  if(G.mode==="surge"||G.mode==="tower"){ST.packT-=dt;if(ST.packT<=0){ST.packT=38+Math.random()*14;D.spawnPack(ST.packN%3===2);}}
  // molten: drop a delayed fire burst under itself
  var E=G.E;for(i=0;i<G.eCount;i++){var e=E[i];if(e.dead||!e.molT)continue;e.molT-=dt;if(e.molT<=0){e.molT=3.2;G.haz.push({x:e.x,y:e.y,t:1.1,max:1.1,R:60,dmg:e.d*0.9});}}
  // vampiric second affix
  // ground loot
  var pr=36*Math.max(1,Math.sqrt(P.eff.pick||1));
  for(i=ST.ground.length-1;i>=0;i--){var L=ST.ground[i];L.t+=dt;
    if(!L.land){var f=Math.min(1,L.t/0.45);L.cx=L.x+(L.tx-L.x)*f;L.cy=L.y+(L.ty-L.y)*f;L.h=Math.sin(f*Math.PI)*34;if(f>=1){L.land=true;L.cx=L.tx;L.cy=L.ty;L.h=0;AS.sfx.drop&&AS.sfx.drop(L.it.rar);if(L.it.rar===3)C().shake(0.25);}continue;}
    var dx=P.x-L.cx,dy=P.y-L.cy;if(dx*dx+dy*dy<pr*pr&&L.t>0.6){var res=D.take(ST,L.it);
      if(res==="full"){if(!L.warned){L.warned=1;C().addFt(L.cx,L.cy-20,"Bag full","#ff8080",1);}continue;}
      ST.ground.splice(i,1);ST.found[L.it.rar]++;var col=D.RAR[L.it.rar].c;C().addFt(P.x,P.y-30,(res==="eq"?"Equipped: ":"")+L.it.name,col,L.it.rar>=2?1:0);
      AS.sfx.pickup&&AS.sfx.pickup(L.it.rar);C().boom(L.cx,L.cy,col,L.it.rar*4+4);if(res==="eq")recalc();bagBadge();}}
  hotTick();
};
/* ---------- rendering ---------- */
var beamC={},torch=null,torchKey="";
function beamSprite(rar){var k=rar;if(beamC[k])return beamC[k];var c=document.createElement("canvas"),w=28,h=180;c.width=w;c.height=h;var x=c.getContext("2d"),col=D.RAR[rar].c;
  var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(0.55,hexA(col,0.35));g.addColorStop(1,hexA(col,0.9));
  var gh=x.createLinearGradient(0,0,w,0);gh.addColorStop(0,"rgba(0,0,0,1)");gh.addColorStop(0.5,"rgba(0,0,0,0)");gh.addColorStop(1,"rgba(0,0,0,1)");
  x.fillStyle=g;x.fillRect(0,0,w,h);x.globalCompositeOperation="destination-out";x.fillStyle=gh;x.fillRect(0,0,w,h);
  x.globalCompositeOperation="lighter";var g2=x.createLinearGradient(0,0,0,h);g2.addColorStop(0.2,"rgba(255,255,255,0)");g2.addColorStop(1,"rgba(255,255,255,.55)");x.fillStyle=g2;x.fillRect(w/2-1.5,0,3,h);
  return (beamC[k]=c);}
function hexA(h,a){var n=parseInt(h.slice(1),16);return "rgba("+(n>>16&255)+","+(n>>8&255)+","+(n&255)+","+a+")";}
var iconC={};
// procedural item icon (canvas), cached per kind+rarity
function itemIcon(kind,rar,sz){var k=kind+rar+"_"+sz;if(iconC[k])return iconC[k];var c=document.createElement("canvas");c.width=c.height=sz;var x=c.getContext("2d"),s=sz/32,col=D.RAR[rar].c;
  x.scale(s,s);x.lineJoin="round";x.lineCap="round";var metal=x.createLinearGradient(0,0,32,32);metal.addColorStop(0,"#e8e0d0");metal.addColorStop(1,"#6a6058");
  x.shadowColor=col;x.shadowBlur=rar?5:0;x.strokeStyle="#140808";x.lineWidth=1.6;x.fillStyle=metal;
  function P(pts){x.beginPath();x.moveTo(pts[0],pts[1]);for(var i=2;i<pts.length;i+=2)x.lineTo(pts[i],pts[i+1]);x.closePath();x.fill();x.stroke();}
  if(kind==="weapon"){P([24,3,29,3,29,8,12,24,8,20]);x.fillStyle="#5a3018";P([6,19,13,26,11,28,4,21]);x.fillStyle=col;P([3,25,7,29,5,31,1,27]);}
  else if(kind==="helm"){x.beginPath();x.moveTo(6,20);x.quadraticCurveTo(6,5,16,5);x.quadraticCurveTo(26,5,26,20);x.lineTo(26,27);x.lineTo(19,27);x.lineTo(19,17);x.lineTo(13,17);x.lineTo(13,27);x.lineTo(6,27);x.closePath();x.fill();x.stroke();x.fillStyle=col;P([5,10,1,2,8,8]);P([27,10,31,2,24,8]);}
  else if(kind==="chest"){P([9,4,13,6,19,6,23,4,29,9,26,14,24,13,24,29,8,29,8,13,6,14,3,9]);x.strokeStyle=col;x.beginPath();x.moveTo(16,8);x.lineTo(16,27);x.moveTo(10,16);x.lineTo(22,16);x.stroke();}
  else if(kind==="gloves"){P([9,30,9,14,8,6,11,6,12,13,13,4,16,4,16,13,17,5,20,5,20,14,22,8,25,9,23,20,23,30]);x.fillStyle=col;x.fillRect(9,25,14,3);}
  else if(kind==="boots"){P([10,3,19,3,19,20,28,23,28,29,8,29,8,22]);x.fillStyle=col;x.fillRect(8,26,20,3);}
  else if(kind==="amulet"){x.strokeStyle="#c8b080";x.beginPath();x.arc(16,10,9,Math.PI*0.1,Math.PI*0.9,true);x.stroke();x.fillStyle=metal;x.strokeStyle="#140808";P([16,14,23,21,16,30,9,21]);x.fillStyle=col;P([16,17,20,21,16,26,12,21]);}
  else{x.lineWidth=4;x.strokeStyle=metal;x.beginPath();x.arc(16,19,8,0,TAU);x.stroke();x.lineWidth=1.6;x.fillStyle=col;P([16,4,21,10,16,14,11,10]);}
  return (iconC[k]=c);}
D.icon=itemIcon;
function buildTorch(W,H,big){var c=document.createElement("canvas"),w=Math.ceil(W*2),h=Math.ceil(H*2);c.width=w;c.height=h;var x=c.getContext("2d");
  x.fillStyle="rgba(10,3,4,0.72)";x.fillRect(0,0,w,h);x.globalCompositeOperation="destination-out";
  var r=Math.min(W,H)*(big?0.78:0.62),g=x.createRadialGradient(w/2,h/2,r*0.18,w/2,h/2,r);g.addColorStop(0,"rgba(0,0,0,1)");g.addColorStop(0.45,"rgba(0,0,0,.85)");g.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=g;x.fillRect(0,0,w,h);
  return c;}
var warm=null;
D.drawGround=function(ctx,ox,oy,gT){ // under enemies: shadows + item glints + beams
  var G=AS.G;if(!ST.ground.length)return;var W=AS.view.W,H=AS.view.H;
  for(var i=0;i<ST.ground.length;i++){var L=ST.ground[i],sx=(L.cx==null?L.x:L.cx)+ox,sy=(L.cy==null?L.y:L.cy)+oy;if(sx<-40||sx>W+40||sy<-200||sy>H+40)continue;
    var it=L.it,col=D.RAR[it.rar].c,h=L.h||0,bm=D.RAR[it.rar].beam;
    if(L.land&&bm){var bs=beamSprite(it.rar),pulse=0.75+0.25*Math.sin(gT*3+i),bh=60+bm*40,bw=10+bm*5;ctx.globalCompositeOperation="lighter";ctx.globalAlpha=pulse*(0.55+bm*0.15);ctx.drawImage(bs,sx-bw/2,sy-bh+4,bw,bh);ctx.globalCompositeOperation="source-over";}
    ctx.globalAlpha=L.land?0.9:0.5;ctx.fillStyle="rgba(0,0,0,.55)";ctx.beginPath();ctx.ellipse(sx,sy+3,9,3.5,0,0,TAU);ctx.fill();
    if(it.rar){ctx.globalCompositeOperation="lighter";ctx.globalAlpha=0.5+0.2*Math.sin(gT*5+i);ctx.fillStyle=hexA(col,0.5);ctx.beginPath();ctx.ellipse(sx,sy+2,14,5,0,0,TAU);ctx.fill();ctx.globalCompositeOperation="source-over";}
    ctx.globalAlpha=1;var ic=itemIcon(it.kind,it.rar,40);ctx.save();ctx.translate(sx,sy-8-h);if(!L.land)ctx.rotate(L.t*14);ctx.drawImage(ic,-10,-10,20,20);ctx.restore();
    if(L.land&&it.rar>=1){ctx.font=(it.rar>=2?"bold ":"")+"10px Georgia,serif";ctx.textAlign="center";var tw=ctx.measureText(it.name).width+8,ly=sy-24;
      ctx.fillStyle="rgba(8,2,2,.78)";ctx.fillRect(sx-tw/2,ly-10,tw,13);ctx.strokeStyle=hexA(col,0.6);ctx.lineWidth=1;ctx.strokeRect(sx-tw/2+0.5,ly-9.5,tw-1,12);ctx.fillStyle=col;ctx.fillText(it.name,sx,ly);}
  }
  ctx.globalAlpha=1;};
D.drawOver=function(ctx,ox,oy,gT){ // pack nameplates + ward bubble
  var G=AS.G,E=G.E,W=AS.view.W,H=AS.view.H;ctx.textAlign="center";
  for(var i=0;i<G.eCount;i++){var e=E[i];if(e.dead||!e.dPack||!e.dName)continue;var sx=e.x+ox,sy=e.y+oy;if(sx<-60||sx>W+60||sy<-60||sy>H+60)continue;
    var ty=sy-e.r-22;ctx.font=(e.dPack===2?"bold 11px":"bold 10px")+" Georgia,serif";ctx.fillStyle="rgba(0,0,0,.65)";ctx.fillText(e.dName,sx+1,ty+1);ctx.fillStyle=e.dCol;ctx.fillText(e.dName,sx,ty);
    if(e.dAff.length){var t=e.dAff.map(function(id){var m=modOf(id);return m?m.n:id;}).join(" · ");ctx.font="9px system-ui";ctx.fillStyle="#d8c8b0";ctx.fillText(t,sx,ty+10);}}
  if(ST.wardT>0&&G.state!=="start"){var P=G.P,a=Math.min(1,ST.wardT);ctx.globalAlpha=0.35*a+0.1*Math.sin(gT*10);ctx.strokeStyle="#e8d8a0";ctx.lineWidth=3;ctx.beginPath();ctx.arc(P.x+ox,P.y+oy-10,26,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
};
D.drawLight=function(ctx,ox,oy,gT,hq){ // torchlight + warm grade (after the vignette)
  var G=AS.G,W=AS.view.W,H=AS.view.H,P=G.P,big=!!ST.own.lantern,k=W+"x"+H+(big?"b":"");if(k!==torchKey){torch=buildTorch(W,H,big);torchKey=k;}
  if(hq){ctx.globalCompositeOperation="multiply";ctx.fillStyle="#f0d4bc";ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation="source-over";}
  var px=P.x+ox,py=P.y+oy-8,f=1+0.025*Math.sin(gT*9.3)+0.015*Math.sin(gT*23.1),tw=torch.width*f*0.5,th=torch.height*f*0.5;
  ctx.drawImage(torch,px-tw,py-th,tw*2,th*2);
  if(hq){ctx.globalCompositeOperation="lighter";ctx.globalAlpha=0.07+0.02*Math.sin(gT*7);if(!warm){warm=document.createElement("canvas");warm.width=warm.height=128;var x=warm.getContext("2d"),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,"rgba(255,150,60,1)");g.addColorStop(1,"rgba(255,90,20,0)");x.fillStyle=g;x.fillRect(0,0,128,128);}
    var R=Math.min(W,H)*0.55;ctx.drawImage(warm,px-R,py-R,R*2,R*2);ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";}
  // loot beams cut through the dark
  ctx.globalCompositeOperation="lighter";for(var i=0;i<ST.ground.length;i++){var L=ST.ground[i];if(!L.land||L.it.rar<2)continue;var sx=L.cx+ox,sy=L.cy+oy;if(sx<-30||sx>W+30||sy<-30||sy>H+180)continue;
    var bs=beamSprite(L.it.rar),bh=100+L.it.rar*30;ctx.globalAlpha=0.35;ctx.drawImage(bs,sx-8,sy-bh+4,16,bh);}
  ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
};
/* ---------- HUD: hotbar + bag button ---------- */
var hot=null,bagBtn=null,hudOn=false;
function skIcon(id,col){var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d");x.translate(32,32);x.strokeStyle=col;x.fillStyle=col;x.lineWidth=3;x.shadowColor=col;x.shadowBlur=8;x.lineCap="round";
  if(id==="nova"){for(var i=0;i<8;i++){var a=i/8*TAU;x.beginPath();x.moveTo(Math.cos(a)*7,Math.sin(a)*7);x.lineTo(Math.cos(a)*20,Math.sin(a)*20);x.stroke();}x.beginPath();x.arc(0,0,6,0,TAU);x.fill();}
  else if(id==="lance"){x.rotate(-0.7);x.beginPath();x.moveTo(-20,0);x.lineTo(14,0);x.stroke();x.beginPath();x.moveTo(22,0);x.lineTo(12,-6);x.lineTo(12,6);x.closePath();x.fill();x.globalAlpha=0.5;x.beginPath();x.moveTo(-20,-6);x.lineTo(4,-6);x.moveTo(-20,6);x.lineTo(4,6);x.stroke();}
  else if(id==="ward"){x.beginPath();x.moveTo(0,-20);x.lineTo(17,-12);x.lineTo(14,8);x.lineTo(0,20);x.lineTo(-14,8);x.lineTo(-17,-12);x.closePath();x.stroke();x.globalAlpha=0.35;x.fill();}
  else{x.beginPath();x.moveTo(-5,-20);x.lineTo(5,-20);x.lineTo(5,-10);x.lineTo(14,4);x.quadraticCurveTo(16,20,0,20);x.quadraticCurveTo(-16,20,-14,4);x.lineTo(-5,-10);x.closePath();x.stroke();x.globalAlpha=0.6;x.beginPath();x.moveTo(-13,6);x.lineTo(13,6);x.quadraticCurveTo(14,18,0,18);x.quadraticCurveTo(-14,18,-13,6);x.fill();}
  return c.toDataURL();}
function buildHud(){
  hot=document.createElement("div");hot.id="hotbar";
  D.SKILLS.forEach(function(s,i){var b=document.createElement("button");b.className="hk";b.setAttribute("aria-label",s.n);b.style.setProperty("--kc",s.c);
    b.innerHTML='<img alt="" src="'+skIcon(s.ic,s.c)+'"><i class="hcd"></i><b class="hkt"></b><u>'+s.key+'</u>';
    function go(e){e.preventDefault();e.stopPropagation();D.cast(i);}
    b.addEventListener("touchstart",go,{passive:false});b.addEventListener("mousedown",go);hot.appendChild(b);});
  document.body.appendChild(hot);
  bagBtn=document.createElement("button");bagBtn.id="bagBtn";bagBtn.className="rbtn";bagBtn.setAttribute("aria-label","Armory");
  bagBtn.innerHTML='<img alt="" src="'+(function(){return itemIcon("chest",2,64).toDataURL();})()+'"><em id="bagN"></em>';
  bagBtn.addEventListener("click",function(e){e.stopPropagation();D.open();});bagBtn.addEventListener("touchstart",function(e){e.stopPropagation();},{passive:true});
  document.body.appendChild(bagBtn);
  window.addEventListener("keydown",function(e){var n="1234".indexOf(e.key);if(n>=0){D.cast(n);}else if(e.key==="i"||e.key==="I"||e.key==="Tab"){if(e.key==="Tab")e.preventDefault();if(inv&&inv.style.display==="flex")D.close();else if(AS.G&&(AS.G.state==="playing"||AS.G.state==="paused"))D.open();}});
}
D.showHud=function(v){if(!hot)buildHud();hudOn=v;hot.style.display=v?"flex":"none";bagBtn.style.display=v?"flex":"none";renderHot(true);bagBadge();};
var hotCache=[];
function renderHot(force){if(!hot)return;var P=AS.G&&AS.G.P;for(var i=0;i<4;i++){var b=hot.children[i],v=ST.sk[i],mx=(ST.skMax&&ST.skMax[i])||D.SKILLS[i].cd,f=v>0?v/mx:0,key=Math.round(f*60)+"|"+Math.ceil(v);
  if(!force&&hotCache[i]===key)continue;hotCache[i]=key;b.style.setProperty("--cd",(f*360)+"deg");b.classList.toggle("rdy",v<=0);b.querySelector(".hkt").textContent=v>0?Math.ceil(v):"";}}
function hotTick(){renderHot(false);}
function bagBadge(){var n=$("bagN");if(n){n.textContent=ST.fresh>0?String(ST.fresh):"";n.style.display=ST.fresh>0?"block":"none";}}
/* ---------- Armory overlay ---------- */
var inv=null,sel=null,fromPause=false;
function buildInv(){inv=document.createElement("div");inv.id="armory";inv.className="ov";
  inv.innerHTML='<div class="frame"><h1 class="gt">ARMORY</h1><div class="sub">Gear lasts for this run · tap an item</div>'+
   '<div id="dollW"><div id="doll"></div><div id="dStats"></div></div><div class="bagH">BAG <span id="bagC"></span></div><div id="bag"></div><div id="iDet"></div>'+
   '<button class="btn" id="armClose">BACK TO THE FIGHT</button></div>';
  document.body.appendChild(inv);
  inv.querySelector("#armClose").onclick=function(){D.close();};
}
function cell(it,label,id){return '<button class="ic'+(it?" r"+it.rar:" emp")+(sel===id?" sel":"")+'" data-id="'+id+'">'+(it?'<img alt="" src="'+itemIcon(it.kind,it.rar,64).toDataURL()+'">':'<span>'+label+'</span>')+'</button>';}
function detail(it,where){if(!it)return '<div class="dim">Pick up loot to fill your bag. Beams mark Rare and Legendary drops.</div>';
  var col=D.RAR[it.rar].c,h='<div class="dn" style="color:'+col+'">'+esc(it.name)+'</div><div class="dr">'+D.RAR[it.rar].n+' '+esc(it.base)+' · item level '+it.ilvl+'</div>';
  it.aff.forEach(function(a){h+='<div class="da'+(a.imp?" imp":"")+'">'+D.affText(a)+'</div>';});
  if(it.leg)h+='<div class="dl">✦ '+esc(D.legText(it))+'</div>';
  if(where.bag!=null){var ss=D.slotsFor(it.kind),cur=ST.eq[ss[0]];if(ss.length>1&&(!cur||(ST.eq[ss[1]]&&D.score(ST.eq[ss[1]])<D.score(cur))))cur=ST.eq[ss[1]]||null;
    var d=Math.round(D.score(it)-D.score(cur));h+='<div class="cmp '+(d>=0?"up":"dn2")+'">'+(cur?(d>=0?"▲ +":"▼ ")+d+" vs equipped "+esc(cur.name):"▲ Empty slot")+'</div>';
    h+='<div class="row"><button class="btn" data-act="eq">EQUIP</button><button class="btn alt" data-act="drop">DISCARD</button></div>';}
  else h+='<div class="row"><button class="btn alt" data-act="uneq"'+(ST.bag.length>=D.BAG?" disabled":"")+'>UNEQUIP</button></div>';
  return h;}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function statsBox(){var s=D.stats().rs,keys=Object.keys(D.TXT).filter(function(k){return s[k];});
  return '<div class="sh">GEAR BONUSES</div>'+(keys.length?keys.map(function(k){return '<div>'+D.affText({k:k,v:Math.round(s[k]*1000)/1000})+'</div>';}).join(""):'<div class="dim">None yet</div>');}
function renderInv(){var h="";D.SLOTS.forEach(function(s){h+='<div class="gslot"><small>'+D.SLOT_N[s]+'</small>'+cell(ST.eq[s],"—","e:"+s)+'</div>';});inv.querySelector("#doll").innerHTML=h;
  inv.querySelector("#dStats").innerHTML=statsBox();
  var b="";for(var i=0;i<D.BAG;i++)b+=cell(ST.bag[i],"","b:"+i);inv.querySelector("#bag").innerHTML=b;inv.querySelector("#bagC").textContent=ST.bag.length+"/"+D.BAG;
  var it=null,wh={};if(sel){var p=sel.split(":");if(p[0]==="e"){it=ST.eq[p[1]];wh.slot=p[1];}else{it=ST.bag[+p[1]];wh.bag=+p[1];}}if(!it)sel=null;
  inv.querySelector("#iDet").innerHTML=detail(it,wh);
  inv.querySelectorAll(".ic").forEach(function(c){c.onclick=function(){var id=c.getAttribute("data-id"),p=id.split(":"),has=p[0]==="e"?ST.eq[p[1]]:ST.bag[+p[1]];sel=has?id:null;renderInv();};});
  inv.querySelectorAll("[data-act]").forEach(function(btn){btn.onclick=function(){var a=btn.getAttribute("data-act");
    if(a==="eq"){var sl=D.equip(ST,wh.bag);if(sl){sel="e:"+sl;recalc();AS.sfx.equip&&AS.sfx.equip();}}
    else if(a==="drop"){ST.bag.splice(wh.bag,1);sel=null;}
    else if(a==="uneq"){if(D.unequip(ST,wh.slot)){sel="b:"+(ST.bag.length-1);recalc();}}
    renderInv();};});
}
D.open=function(){var G=AS.G;if(!inv)buildInv();if(G.state==="playing"||G.state==="levelup"){AS.game.pause();fromPause=false;}else if(G.state==="paused")fromPause=$("pause").style.display==="flex";else return;
  $("pause").style.display="none";ST.fresh=0;bagBadge();sel=null;renderInv();inv.style.display="flex";};
D.close=function(){if(!inv)return;inv.style.display="none";if(fromPause)$("pause").style.display="flex";else AS.game.resume();};
D.isOpen=function(){return !!inv&&inv.style.display==="flex";};
D.summary=function(){var f=ST.found;return f[3]+" legendary · "+f[2]+" rare · "+f[1]+" magic";};
})(typeof window!=="undefined"?window:globalThis);
