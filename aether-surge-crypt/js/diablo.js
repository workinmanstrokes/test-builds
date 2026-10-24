/* Aether Surge — "Dark Rift" M1: gothic lighting, rarity loot with beams, Armory (equip + affixes),
   champion / rare monster packs, skill hotbar. Pure item logic is Node-testable (require); the rest runs in the browser.
   M2: gear is kept between runs (rift.js saves it), set items (rarity 4), Stash / Forge / Skills tabs, skill ranks + runes.
   All names and art are original. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var D={};
/* ---------------- data ---------------- */
D.RAR=[
  {id:"common",   n:"Common",   c:"#d8d0c0", w:58, aff:[0,0], beam:0},
  {id:"magic",    n:"Magic",    c:"#6f8fff", w:28, aff:[1,2], beam:1},
  {id:"rare",     n:"Rare",     c:"#ffd84a", w:11, aff:[3,4], beam:2},
  {id:"legendary",n:"Legendary",c:"#ff8a1e", w:3,  aff:[3,3], beam:3},
  {id:"set",      n:"Set",      c:"#3ee07a", w:0,  aff:[2,2], beam:2}  // never rolled directly: rare drops upgrade to Set pieces
];
D.RI={common:0,magic:1,rare:2,legendary:3,set:4};
function RF(){return root.AS&&root.AS.rift;}
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
D.rollRarity=function(r,boost){r=r||Math.random;boost=(boost||0)+(D.boost||0);var w=D.RAR.map(function(x,i){return x.w*(i?1+boost*i:Math.max(0.1,1-boost));}),t=0,k;for(k=0;k<4;k++)t+=w[k];var x=r()*t;for(k=0;k<4;k++){if(x<w[k])return k;x-=w[k];}return 3;};
D.round=function(k,v){var a=D.AFF.filter(function(x){return x.k===k;})[0];return a&&a.flat?Math.round(v*10)/10:Math.round(v*1000)/1000;};
D.rollItem=function(rar,ilvl,r,kind){
  r=r||Math.random;ilvl=Math.max(1,ilvl||1);if(typeof rar==="string")rar=D.RI[rar];if(rar==null)rar=D.rollRarity(r);
  if(rar===4&&RF()){var pc=RF().pickPiece(r,kind);kind=pc.p.kind;var si=D.rollItem(2,ilvl,r,kind);si.rar=4;si.aff=si.aff.slice(0,3);si.set=pc.s.id;si.sp=pc.i;si.name=pc.p.n;return si;}
  if(rar===4)rar=2;
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
D.score=function(it){if(!it)return 0;var W={dmg:100,rate:90,spd:40,crit:110,critD:30,hp:2.2,armor:120,regen:12,leech:600,area:30,cd:50,pick:8},s=0;it.aff.forEach(function(a){s+=(W[a.k]||10)*a.v;});return s+(it.leg?25:0)+(it.set?30:0);};
// sum of equipped gear -> stat bonuses (rs) + behaviour hooks (fx for existing relic hooks, own for Dark Rift hooks)
D.sumStats=function(eq){var rs={},fx={},own={};
  D.SLOTS.forEach(function(s){var it=eq&&eq[s];if(!it)return;it.aff.forEach(function(a){rs[a.k]=(rs[a.k]||0)+a.v;});
    var l=it.leg&&D.legDef(it.leg);if(l){if(l.fx)fx[l.fx]=(fx[l.fx]||0)+l.v;if(l.own)own[l.own]=(own[l.own]||0)+l.v;}});
  if(RF()){var sb=RF().setBonus(eq||{}),k;for(k in sb.rs)rs[k]=(rs[k]||0)+sb.rs[k];for(k in sb.own)own[k]=(own[k]||0)+sb.own[k];}
  return {rs:rs,fx:fx,own:own};};
D.newRunState=function(){return {eq:{},bag:[],ground:[],uid:1,fresh:0,own:{},kills:0,packT:35,packN:0,sk:[0,0,0,0],wardT:0,found:[0,0,0,0,0],twinT:0,thT:0,vigilCd:0};};
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
D.reset=function(){ST=D.st=D.newRunState();if(RF())RF().loadInto(ST);ST.own=D.stats().own;renderHot(true);bagBadge();};
D.ilvl=function(){var G=AS.G,v=1+Math.floor(((G&&G.runT)||0)/50)+(RF()?RF().ilvlAdd():0);if(RF())RF().noteIlvl(v);return v;};
D.stats=function(){return D.sumStats(ST.eq);};
function recalc(){if(AS.game&&AS.game.recalc)AS.game.recalc();ST.own=D.stats().own;if(RF())RF().soon();}
/* ---------- drops ---------- */
D.dropItem=function(x,y,rar,kind){if(ST.ground.length>=30)ST.ground.shift();if(typeof rar==="string")rar=D.RI[rar];if(rar==null)rar=D.rollRarity();
  if(rar===2&&Math.random()<(D.setP||0.05)*2.5)rar=4; // some Rares are Set pieces (more on higher difficulty)
  var it=D.rollItem(rar,D.ilvl(),null,kind);it.uid=ST.uid++;
  var a=Math.random()*TAU,s=40+Math.random()*50,L={it:it,x:x,y:y,tx:x+Math.cos(a)*s,ty:y+Math.sin(a)*s,t:0,land:false};if(RF())RF().clampDrop(L);ST.ground.push(L);return it;};
D.onKill=function(e){var G=AS.G,P=G.P;ST.kills++;
  if(ST.own.reap)P.hp=Math.min(P.maxHp,P.hp+ST.own.reap);
  if(ST.own.oath&&ST.kills%8===0){var c=C();c.aoe(P.x,P.y,150*(P.eff.area||1),ST.own.oath*(P.eff.dmg||1),200,"sigil");AS.FX.novas.push({x:P.x,y:P.y,r:150*(P.eff.area||1),life:0.45,max:0.45,c:"#ff2a3a",w:9});}
  if(e.dAff&&e.dAff.indexOf("volatile")>=0&&!(e.mod&&e.mod.id==="volatile"))G.haz.push({x:e.x,y:e.y,t:0.9,max:0.9,R:95,dmg:e.d*1.3});
  var x=e.x,y=e.y;
  if(e.boss&&RF())RF().onBossKill(e);
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
D.rank=function(id){return RF()?RF().rank(id):1;};
D.cast=function(i){var G=AS.G,P=G.P,c=C(),sk=D.SKILLS[i];if(!sk||G.state!=="playing")return false;
  var rk=D.rank(sk.id);if(rk<=0){if(!(G.gT-(ST.lockMsg||-9)<1.5)){ST.lockMsg=G.gT;c.addFt(P.x,P.y-34,sk.n+" is locked: unlock it in Skills","#e8c890",1);}AS.sfx.equip&&AS.sfx.equip();return false;}
  if(ST.sk[i]>0)return false;
  var rn=RF()?RF().rune(sk.id):null,lv=P.lv||1,dm=(P.eff.dmg||1)*(1+0.06*(lv-1))*(1+0.25*(rk-1)),ar=P.eff.area||1,extra=0;
  if(sk.id==="nova"){var R=150*ar*(rn==="searing"?0.6:1),burn=8*dm*(rn==="searing"?3:1),kb=rn==="gravepull"?-240:260;
    c.aoe(P.x,P.y,R,55*dm,kb,"sigil",false,function(e){c.ignite(e,burn);});AS.FX.novas.push({x:P.x,y:P.y,r:R,life:0.5,max:0.5,c:rn==="gravepull"?"#c050ff":"#ff6a2a",w:10});c.boom(P.x,P.y,"#ff9a40",16);c.shake(0.3);AS.sfx.nova&&AS.sfx.nova();
    if(rn==="twin"){ST.twinT=0.6;ST.twinD=dm;}}
  else if(sk.id==="lance"){var a=Math.atan2(P.fy||0,P.fx||1),t=c.nearest(P.x,P.y,420,false);if(t)a=Math.atan2(t.y-P.y,t.x-P.x);
    if(rn==="requiem"){var big=c.spawnPr(P.x,P.y,a,42*dm*2.5,760,1.0,"#e8d0ff",13,99,0);if(big)big.type="sigil";c.shake(0.2);}
    else{var n=rn==="fan"?2:1,sp=rn==="fan"?0.3:0.16;for(var k=-n;k<=n;k++){var pr=c.spawnPr(P.x,P.y,a+k*sp,42*dm,640,0.9,"#c8a8ff",7,8,0);if(pr)pr.type="sigil";}}
    if(rn==="chain"&&t&&AS.sigils&&AS.sigils.chain)AS.sigils.chain(t,30*dm,4,"#c8a8ff");AS.sfx.lance&&AS.sfx.lance();}
  else if(sk.id==="ward"){ST.wardT=rn==="bulwark"?6:4;ST.wardRn=rn;ST.wardD=dm;c.boom(P.x,P.y,"#e8d8a0",12);AS.sfx.ward&&AS.sfx.ward();}
  else if(sk.id==="draught"){var hf=rn==="deep"?0.6:0.35;if(rn==="deep")extra=8;P.hp=Math.min(P.maxHp,P.hp+P.maxHp*hf);c.addFt(P.x,P.y-28,"+"+Math.round(P.maxHp*hf),"#ff6070",1);
    for(var j=0;j<14;j++){var b=Math.random()*TAU;c.addP(P.x,P.y,Math.cos(b)*60,Math.sin(b)*60-40,0.6,2.5,"#ff3050");}
    if(rn==="rush")P.hasteT=Math.max(P.hasteT||0,6);
    if(rn==="sang"){c.aoe(P.x,P.y,130*ar,60*dm,300,"sigil");AS.FX.novas.push({x:P.x,y:P.y,r:130*ar,life:0.4,max:0.4,c:"#ff2a40",w:8});}
    AS.sfx.draught&&AS.sfx.draught();}
  if(ST.own.pyre){for(var q=0;q<10;q++){var eb=c.spawnPr(P.x,P.y,q/10*TAU+G.gT,18*dm,520,0.7,"#ff7a2a",6,1,0);if(eb)eb.type="sigil";}}
  var cdm=(P.eff.cd||1)*(ST.own.lantern?1-ST.own.lantern:1)*(1-0.08*(rk-1));ST.sk[i]=(sk.cd+extra)*cdm;ST.skMax=ST.skMax||[];ST.skMax[i]=ST.sk[i];
  AS.native&&AS.native.haptic&&AS.native.haptic("LIGHT");renderHot(true);return true;};
D.dmgTaken=function(d){return ST.wardT>0?d*(ST.own.vigil?0.3:0.5):d;};
/* ---------- per-frame ---------- */
D.update=function(dt){var G=AS.G,P=G.P;if(G.state!=="playing")return;
  for(var i=0;i<4;i++)if(ST.sk[i]>0)ST.sk[i]=Math.max(0,ST.sk[i]-dt);
  if(ST.wardT>0){ST.wardT-=dt;var c0=C();
    if(ST.wardRn==="thorn"){ST.thT-=dt;if(ST.thT<=0){ST.thT=0.5;c0.aoe(P.x,P.y,85*(P.eff.area||1),16*(ST.wardD||1),60,"thorns");}}
    else if(ST.wardRn==="sanct")P.hp=Math.min(P.maxHp,P.hp+P.maxHp*0.04*dt);}
  if(ST.twinT>0){ST.twinT-=dt;if(ST.twinT<=0){var cc=C(),R2=150*(P.eff.area||1);cc.aoe(P.x,P.y,R2,55*0.7*(ST.twinD||1),200,"sigil",false,function(e){cc.ignite(e,6*(ST.twinD||1));});AS.FX.novas.push({x:P.x,y:P.y,r:R2,life:0.5,max:0.5,c:"#ffb040",w:8});AS.sfx.nova&&AS.sfx.nova();}}
  if(ST.vigilCd>0)ST.vigilCd-=dt;
  if(ST.own.vigil&&ST.vigilCd<=0&&ST.wardT<=0&&P.hp>0&&P.hp<P.maxHp*0.35){ST.wardT=4;ST.vigilCd=20;C().addFt(P.x,P.y-34,"Gravewarden's Vigil","#3ee07a",1);AS.sfx.ward&&AS.sfx.ward();}
  if(G.mode==="surge"||G.mode==="tower"){ST.packT-=dt;if(ST.packT<=0){ST.packT=38+Math.random()*14;D.spawnPack(ST.packN%3===2);}}
  // molten: drop a delayed fire burst under itself
  var E=G.E;for(i=0;i<G.eCount;i++){var e=E[i];if(e.dead||!e.molT)continue;e.molT-=dt;if(e.molT<=0){e.molT=3.2;G.haz.push({x:e.x,y:e.y,t:1.1,max:1.1,R:60,dmg:e.d*0.9});}}
  // vampiric second affix
  // ground loot
  var pr=36*Math.max(1,Math.sqrt(P.eff.pick||1));
  for(i=ST.ground.length-1;i>=0;i--){var L=ST.ground[i];L.t+=dt;
    if(!L.land){var f=Math.min(1,L.t/0.45);L.cx=L.x+(L.tx-L.x)*f;L.cy=L.y+(L.ty-L.y)*f;L.h=Math.sin(f*Math.PI)*34;if(f>=1){L.land=true;L.cx=L.tx;L.cy=L.ty;L.h=0;AS.sfx.drop&&AS.sfx.drop(L.it.rar===4?2:L.it.rar);if(L.it.rar===3)C().shake(0.25);}continue;}
    var dx=P.x-L.cx,dy=P.y-L.cy;if(dx*dx+dy*dy<pr*pr&&L.t>0.6){var res=D.take(ST,L.it);
      if(res==="full"){if(!L.warned){L.warned=1;C().addFt(L.cx,L.cy-20,"Bag full","#ff8080",1);}continue;}
      ST.ground.splice(i,1);ST.found[L.it.rar]++;var col=D.RAR[L.it.rar].c;C().addFt(P.x,P.y-30,(res==="eq"?"Equipped: ":"")+L.it.name,col,L.it.rar>=2?1:0);
      AS.sfx.pickup&&AS.sfx.pickup(Math.min(3,L.it.rar));C().boom(L.cx,L.cy,col,L.it.rar*4+4);if(res==="eq")recalc();else if(RF())RF().soon();bagBadge();}}
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
  document.body.appendChild(hot);if(AS.controls&&AS.controls.apply)AS.controls.apply();
  bagBtn=document.createElement("button");bagBtn.id="bagBtn";bagBtn.className="rbtn";bagBtn.setAttribute("aria-label","Armory");
  bagBtn.innerHTML='<img alt="" src="'+(function(){return itemIcon("chest",2,64).toDataURL();})()+'"><em id="bagN"></em>';
  bagBtn.addEventListener("click",function(e){e.stopPropagation();D.open();});bagBtn.addEventListener("touchstart",function(e){e.stopPropagation();},{passive:true});
  document.body.appendChild(bagBtn);
  window.addEventListener("keydown",function(e){var n="1234".indexOf(e.key);if(n>=0){D.cast(n);}else if(e.key==="i"||e.key==="I"||e.key==="Tab"){if(e.key==="Tab")e.preventDefault();if(inv&&inv.style.display==="flex")D.close();else if(AS.G&&(AS.G.state==="playing"||AS.G.state==="paused"))D.open();}});
}
D.showHud=function(v){if(!hot)buildHud();hudOn=v;hot.style.display=v?"flex":"none";bagBtn.style.display=v?"flex":"none";renderHot(true);bagBadge();};
var hotCache=[];
function renderHot(force){if(!hot)return;var P=AS.G&&AS.G.P;for(var i=0;i<4;i++){var b=hot.children[i],v=ST.sk[i],mx=(ST.skMax&&ST.skMax[i])||D.SKILLS[i].cd,f=v>0?v/mx:0,key=Math.round(f*60)+"|"+Math.ceil(v);
  var lk=D.rank(D.SKILLS[i].id)<=0;key+=lk?"L":"";
  if(!force&&hotCache[i]===key)continue;hotCache[i]=key;b.classList.toggle("lk",lk);b.style.setProperty("--cd",(f*360)+"deg");b.classList.toggle("rdy",v<=0);b.querySelector(".hkt").textContent=v>0?Math.ceil(v):"";}}
function hotTick(){renderHot(false);}
function bagBadge(){var n=$("bagN");if(n){n.textContent=ST.fresh>0?String(ST.fresh):"";n.style.display=ST.fresh>0?"block":"none";}}
/* ---------- Armory overlay: Gear · Stash · Forge · Skills ---------- */
var inv=null,sel=null,fromPause=false,fromMenu=false,tab="gear",fkind="weapon";
var TABS=[["gear","GEAR"],["stash","STASH"],["forge","FORGE"],["skills","SKILLS"]];
function buildInv(){inv=document.createElement("div");inv.id="armory";inv.className="ov";
  inv.innerHTML='<div class="frame"><h1 class="gt">ARMORY</h1><div class="sub" id="armSub"></div><div id="armTabs">'+TABS.map(function(t){return '<button class="atb" data-tab="'+t[0]+'">'+t[1]+'</button>';}).join("")+'</div>'+
   '<div id="armBody"></div><div id="iDet"></div><button class="btn" id="armClose">BACK</button></div>';
  document.body.appendChild(inv);
  inv.querySelector("#armClose").onclick=function(){D.close();};
  inv.querySelector("#armTabs").onclick=function(e){var b=e.target.closest&&e.target.closest(".atb");if(!b)return;tab=b.getAttribute("data-tab");sel=null;AS.sfx.equip&&AS.sfx.equip();renderInv();inv.scrollTop=0;};
}
function P0(){return RF()?RF().prof:{stash:[],mats:{dust:0,shard:0,ember:0}};}
function itemAt(id){if(!id)return null;var p=id.split(":");if(p[0]==="e")return ST.eq[p[1]];if(p[0]==="b")return ST.bag[+p[1]];if(p[0]==="s")return P0().stash[+p[1]];return null;}
function cell(it,label,id){return '<button class="ic'+(it?" r"+it.rar:" emp")+(sel===id?" sel":"")+'" data-id="'+id+'">'+(it?'<img alt="" src="'+itemIcon(it.kind,it.rar,64).toDataURL()+'">':'<span>'+label+'</span>')+'</button>';}
function matsLine(){var m=P0().mats;return '<div class="mats">'+(RF()?RF().MATS:[]).map(function(x){return '<span style="color:'+x.c+'"><i class="mi m-'+x.id+'"></i>'+x.n+' <b>'+(m[x.id]||0)+'</b></span>';}).join("")+'</div>';}
function costTxt(c){if(!c)return "";var M={dust:"Dust",shard:"Shard",ember:"Ember"},m=P0().mats;return Object.keys(c).map(function(k){return '<span class="'+((m[k]||0)>=c[k]?"ok":"no")+'">'+c[k]+" "+M[k]+'</span>';}).join(" · ");}
function setInfo(it){var S=RF()&&RF().setDef(it.set);if(!S)return "";var n=RF().setCount(ST.eq,S.id),h='<div class="ds">'+esc(S.n)+' ('+n+'/4 worn)</div>';
  h+='<div class="dsb'+(n>=2?" on":"")+'">(2) '+esc(S.b2.t)+'</div><div class="dsb'+(n>=4?" on":"")+'">(4) '+esc(S.b4.t)+'</div>';return h;}
function head(it){var col=D.RAR[it.rar].c,h='<div class="dn" style="color:'+col+'">'+esc(it.name)+'</div><div class="dr">'+D.RAR[it.rar].n+' '+esc(it.base)+' · item level '+it.ilvl+(it.rf?' · reforged':'')+'</div>';
  it.aff.forEach(function(a){h+='<div class="da'+(a.imp?" imp":"")+'">'+D.affText(a)+'</div>';});
  if(it.leg)h+='<div class="dl">✦ '+esc(D.legText(it))+'</div>';if(it.set)h+=setInfo(it);return h;}
function salvTxt(it){var o=RF()?RF().salvage(it):{},M={dust:"Dust",shard:"Shard",ember:"Ember"};return Object.keys(o).filter(function(k){return o[k];}).map(function(k){return "+"+o[k]+" "+M[k];}).join(" ");}
function detail(it,where){
  if(!it){if(tab==="stash")return '<div class="dim">Your stash keeps '+(RF()?RF().STASH:48)+' items safe between runs. Tap an item to move it.</div>';
    if(tab==="forge")return '<div class="dim">Pick a kind and forge new gear, or select an item below to reforge it.</div>';
    return '<div class="dim">Pick up loot to fill your bag. Beams mark Rare, Set and Legendary drops. Your gear is kept between runs.</div>';}
  var h=head(it);
  if(where.bag!=null){var ss=D.slotsFor(it.kind),cur=ST.eq[ss[0]];if(ss.length>1&&(!cur||(ST.eq[ss[1]]&&D.score(ST.eq[ss[1]])<D.score(cur))))cur=ST.eq[ss[1]]||null;
    var d=Math.round(D.score(it)-D.score(cur));h+='<div class="cmp '+(d>=0?"up":"dn2")+'">'+(cur?(d>=0?"▲ +":"▼ ")+d+" vs equipped "+esc(cur.name):"▲ Empty slot")+'</div>';}
  var acts=[];
  if(tab==="forge"){var c=RF().reforgeCost(it);acts.push(['reforge','REFORGE · '+costTxt(c),!RF().canPay(P0().mats,c)]);}
  else if(where.bag!=null){acts.push(['eq','EQUIP']);acts.push(['tostash','STASH',P0().stash.length>=RF().STASH]);acts.push(['salv','SALVAGE']);}
  else if(where.st!=null){acts.push(['frstash','TO BAG',ST.bag.length>=D.BAG]);acts.push(['salv','SALVAGE']);}
  else acts.push(['uneq','UNEQUIP',ST.bag.length>=D.BAG]);
  h+='<div class="row">'+acts.map(function(a,i){return '<button class="btn'+(i?" alt":"")+'" data-act="'+a[0]+'"'+(a[2]?" disabled":"")+'>'+a[1]+'</button>';}).join("")+'</div>';
  if(tab!=="forge"&&(where.bag!=null||where.st!=null))h+='<div class="salv">Salvage gives '+salvTxt(it)+'</div>';
  return h;}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function statsBox(){var s=D.stats().rs,keys=Object.keys(D.TXT).filter(function(k){return s[k];});
  var sets=RF()?RF().setBonus(ST.eq).active:[];
  return '<div class="sh">GEAR BONUSES</div>'+(keys.length?keys.map(function(k){return '<div>'+D.affText({k:k,v:Math.round(s[k]*1000)/1000})+'</div>';}).join(""):'<div class="dim">None yet</div>')+
   (sets.length?'<div class="sh" style="margin-top:6px;color:#3ee07a">SET BONUSES</div>'+sets.map(function(a){var S=RF().setDef(a.slice(0,-1)),n=a.slice(-1);return '<div style="color:#8af0b0">'+esc(S.n)+' ('+n+')</div>';}).join(""):"");}
function bagGrid(){var b="";for(var i=0;i<D.BAG;i++)b+=cell(ST.bag[i],"","b:"+i);return '<div class="bagH">BAG <span>'+ST.bag.length+'/'+D.BAG+'</span></div><div id="bag" class="grid8">'+b+'</div>';}
function gearBody(){var h='<div id="dollW"><div id="doll">';D.SLOTS.forEach(function(s){h+='<div class="gslot"><small>'+D.SLOT_N[s]+'</small>'+cell(ST.eq[s],"—","e:"+s)+'</div>';});
  return h+'</div><div id="dStats">'+statsBox()+'</div></div>'+bagGrid();}
function stashBody(){var p=P0(),N=RF()?RF().STASH:48,h=matsLine()+'<div class="bagH">STASH <span>'+p.stash.length+'/'+N+'</span></div><div id="stash" class="grid8">';
  for(var i=0;i<N;i++)h+=cell(p.stash[i],"","s:"+i);h+='</div>'+bagGrid();
  var junk=ST.bag.filter(function(it){return it.rar<=1;}).length;h+='<button class="btn alt wide" data-act="salvjunk"'+(junk?"":" disabled")+'>SALVAGE '+junk+' COMMON / MAGIC IN BAG</button>';return h;}
function forgeBody(){var R=RF(),h=matsLine()+'<div class="bagH">FORGE A NEW ITEM</div><div id="fKinds">'+D.KINDS.map(function(k){return '<button class="fk'+(k===fkind?" on":"")+'" data-k="'+k+'"><img alt="" src="'+itemIcon(k,2,48).toDataURL()+'"></button>';}).join("")+'</div><div id="fRec">';
  R.RECIPES.filter(function(r){return r.id!=="reforge";}).forEach(function(r){var ok=R.canPay(P0().mats,r.cost)&&ST.bag.length<D.BAG;h+='<button class="rec" data-rec="'+r.id+'"'+(ok?"":" disabled")+'><b>'+r.n+'</b><span>'+costTxt(r.cost)+'</span></button>';});
  h+='</div><div class="bagH">REFORGE · select an item</div><div class="dollF">';D.SLOTS.forEach(function(s){h+=cell(ST.eq[s],"—","e:"+s);});h+='</div>';
  var b="";for(var i=0;i<D.BAG;i++)b+=cell(ST.bag[i],"","b:"+i);return h+'<div id="bag" class="grid8">'+b+'</div>';}
function skillsBody(){var R=RF(),p=R.prof,free=R.free(p),h='<div class="spH"><b>'+free+'</b> skill point'+(free===1?"":"s")+' free · Renown '+Math.floor(p.renown)+' (next point at '+R.nextPointAt(p)+')</div><div class="spN">Earn points from Renown (kills in any mode) and from each act boss slain for the first time on a difficulty.</div>';
  D.SKILLS.forEach(function(sk){var T=R.TREE[sk.id],rk=p.tree[sk.id]||0,rn=p.rune[sk.id];
    h+='<div class="skc'+(rk?"":" lk")+'" style="--kc:'+sk.c+'"><div class="skt"><img alt="" src="'+skIcon(sk.ic,sk.c)+'"><div><b>'+sk.n+'</b><div class="pips">'+[1,2,3].map(function(n){return '<i class="pip'+(rk>=n?" f":"")+'"></i>';}).join("")+'</div><small>'+T.d+(rk>1?' Rank '+rk+': +'+(rk-1)*25+'% power, -'+(rk-1)*8+'% cooldown.':'')+'</small></div>'+
      '<button class="btn sm" data-up="'+sk.id+'"'+(free>0&&rk<R.MAXR?"":" disabled")+'>'+(rk?(rk>=R.MAXR?"MAX":"+ RANK"):"UNLOCK")+'</button></div><div class="runes">';
    T.runes.forEach(function(r){var lockd=rk<r.need;h+='<button class="rune'+(rn===r.id?" on":"")+'" data-sk="'+sk.id+'" data-rune="'+r.id+'"'+(lockd?" disabled":"")+'><b>'+r.n+(lockd?' · rank '+r.need:'')+'</b><span>'+r.t+'</span></button>';});
    h+='</div></div>';});
  return h+'<button class="btn alt wide" data-act="respec">RESET SKILL POINTS</button>';}
function renderInv(){var R=RF();inv.querySelector("#armSub").textContent=tab==="gear"?"Gear is kept between runs · tap an item":tab==="stash"?"Safe storage · salvage turns gear into materials":tab==="forge"?"Spend materials to forge and reforge gear":"Unlock hotbar skills, raise ranks, choose a rune";
  inv.querySelectorAll(".atb").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-tab")===tab);});
  var body=inv.querySelector("#armBody");body.className="t-"+tab;body.innerHTML=tab==="gear"?gearBody():tab==="stash"?stashBody():tab==="forge"?forgeBody():skillsBody();
  var it=itemAt(sel),wh={};if(it){var p=sel.split(":");if(p[0]==="e")wh.slot=p[1];else if(p[0]==="b")wh.bag=+p[1];else wh.st=+p[1];}else sel=null;
  var det=inv.querySelector("#iDet");det.style.display=tab==="skills"?"none":"block";det.innerHTML=tab==="skills"?"":detail(it,wh);
  inv.querySelectorAll(".ic").forEach(function(c){c.onclick=function(){var id=c.getAttribute("data-id");sel=itemAt(id)?id:null;renderInv();};});
  inv.querySelectorAll(".fk").forEach(function(c){c.onclick=function(){fkind=c.getAttribute("data-k");renderInv();};});
  inv.querySelectorAll(".rec").forEach(function(c){c.onclick=function(){var nw=R.craft(R.prof,c.getAttribute("data-rec"),fkind);if(nw){ST.bag.push(nw);sel="b:"+(ST.bag.length-1);AS.sfx.drop&&AS.sfx.drop(Math.min(3,nw.rar===4?2:nw.rar));R.save();}renderInv();};});
  inv.querySelectorAll("[data-up]").forEach(function(c){c.onclick=function(){var id=c.getAttribute("data-up");if(R.rankUp(R.prof,id)){var rk=R.prof.tree[id];if(rk===1&&!R.prof.rune[id]){}AS.sfx.lvl&&AS.sfx.lvl();R.save();renderHot(true);}renderInv();};});
  inv.querySelectorAll(".rune").forEach(function(c){c.onclick=function(){var sk=c.getAttribute("data-sk"),rn=c.getAttribute("data-rune");R.setRune(R.prof,sk,R.prof.rune[sk]===rn?null:rn);AS.sfx.equip&&AS.sfx.equip();R.save();renderInv();};});
  inv.querySelectorAll("[data-act]").forEach(function(btn){btn.onclick=function(){var a=btn.getAttribute("data-act"),cur=itemAt(sel);
    if(a==="eq"){var sl=D.equip(ST,wh.bag);if(sl){sel="e:"+sl;recalc();AS.sfx.equip&&AS.sfx.equip();}}
    else if(a==="uneq"){if(D.unequip(ST,wh.slot)){sel="b:"+(ST.bag.length-1);recalc();}}
    else if(a==="tostash"){if(R.toStash(R.prof,ST.bag,wh.bag)){sel="s:"+(R.prof.stash.length-1);tab=tab==="gear"?tab:tab;}}
    else if(a==="frstash"){if(R.fromStash(R.prof,ST.bag,wh.st,D.BAG))sel="b:"+(ST.bag.length-1);}
    else if(a==="salv"&&cur){R.addMats(R.prof.mats,R.salvage(cur));if(wh.bag!=null)ST.bag.splice(wh.bag,1);else if(wh.st!=null)R.prof.stash.splice(wh.st,1);sel=null;AS.sfx.burst&&AS.sfx.burst();}
    else if(a==="salvjunk"){for(var i=ST.bag.length-1;i>=0;i--)if(ST.bag[i].rar<=1){R.addMats(R.prof.mats,R.salvage(ST.bag[i]));ST.bag.splice(i,1);}sel=null;AS.sfx.burst&&AS.sfx.burst();}
    else if(a==="reforge"&&cur){if(R.reforge(R.prof,cur)){if(wh.slot)recalc();AS.sfx.drop&&AS.sfx.drop(2);}}
    else if(a==="respec"){R.respec(R.prof);renderHot(true);}
    R.save();renderInv();};});
}
D.open=function(t){var G=AS.G;if(!inv)buildInv();fromMenu=false;
  if(G.state==="playing"||G.state==="levelup"){AS.game.pause();fromPause=false;}else if(G.state==="paused")fromPause=$("pause").style.display==="flex";
  else if(G.state==="start"){fromMenu=true;$("start").style.display="none";}else return;
  $("pause").style.display="none";ST.fresh=0;bagBadge();sel=null;if(t)tab=t;renderInv();inv.style.display="flex";inv.scrollTop=0;
  inv.querySelector("#armClose").textContent=fromMenu?"BACK TO MENU":"BACK TO THE FIGHT";};
D.close=function(){if(!inv)return;inv.style.display="none";if(RF())RF().save();
  if(fromMenu){$("start").style.display="flex";if(AS.menu&&AS.menu.refresh)AS.menu.refresh();}else if(fromPause)$("pause").style.display="flex";else AS.game.resume();};
D.isOpen=function(){return !!inv&&inv.style.display==="flex";};
D.summary=function(){var f=ST.found;return f[3]+" legendary · "+(f[4]?f[4]+" set · ":"")+f[2]+" rare · "+f[1]+" magic";};
})(typeof window!=="undefined"?window:globalThis);
