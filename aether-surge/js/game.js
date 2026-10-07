/* Aether Surge — core simulation: one 5:00 run, wave director, bosses, weapons, sigils, relics, XP, picks, UI flow. */
(function(AS){
"use strict";
var V=AS.view,N=AS.native,S=AS.sfx,IN=AS.input,R=AS.render;
function $(id){return document.getElementById(id);}
function showErr(m){var e=$("err");if(e){e.style.display="block";e.textContent="Error: "+m;}console.error(m);}

var G=AS.G={state:"start",gT:0,runT:0,cam:{x:0,y:0,sh:0},bosses:[],hurtFx:0,loot:[],queue:[],haz:[],evos:{}};
var P=G.P={blast:{},orbit:{},wave:{},eff:{},sig:{},relics:[],rfx:{},evo:{},dash:{t:0,cd:0},melee:{t:0},chgT:0,tier:0};
var TAU=Math.PI*2;
var TIER_C=["#3a9fff","#4fe0ff","#b080ff","#ffd040"];
// sigil/relic visual effects (filled by sigils.js, drawn by render.js); created here so the first frame can draw before sigils.js loads
AS.FX={bolts:[],novas:[],beams:[],stars:[],sentries:[],embers:[],slashes:[],bursts:[]};

/* ---------------- pools ---------------- */
var MAX_E=AS.MAX_E,E=G.E=new Array(MAX_E);
for(var i=0;i<MAX_E;i++)E[i]={id:0,x:0,y:0,kx:0,ky:0,hp:0,max:0,spd:0,r:0,c:"",d:0,xp:0,key:"",rng:false,armor:0,splits:0,el:false,tough:false,boss:null,swarm:false,shT:0,frame:0,runT:0,orbT:0,gyT:0,slowT:0,slowF:0,fl:0,flCd:0,dead:true,spr:null,st:0,stT:0,teleDur:1,ddx:0,ddy:0,dashLen:0,dashV:0,mi:0,p2:false,p3:false,phase:0,bInv:0,spA:0,spAng:0,marked:false,shield:0,shMax:0,hitT:0,burnT:0,burnD:0,burnA:0,mod:null,dashId:0,lunge:false,shields:false};
G.eCount=0;G.normalN=0;
// projectile kinds: 0 = straight, 1 = homing (Seeker Motes), 2 = boomerang (Gyre Blade)
var PR=G.PR=new Array(AS.MAX_PROJ);for(i=0;i<AS.MAX_PROJ;i++)PR[i]={x:0,y:0,vx:0,vy:0,dmg:0,life:0,col:"#7ae0ff",r:4,pierce:0,hits:new Int32Array(8),hn:0,kind:0,tgt:null,tgtId:0,rt:0,trav:0,out:0,ret:false,ang:0,type:"blast",burn:false};
G.pCount=0;
var EP=G.EP=new Array(AS.MAX_EPROJ);for(i=0;i<AS.MAX_EPROJ;i++)EP[i]={x:0,y:0,vx:0,vy:0,dmg:0,life:0,col:"#ff60b0",r:4};
G.epCount=0;
var SH=G.S=new Array(AS.MAX_SHARDS);for(i=0;i<AS.MAX_SHARDS;i++)SH[i]={x:0,y:0,v:0,tier:0,mag:false};
G.sCount=0;
var PT=G.PT=new Array(AS.MAX_PARTS);for(i=0;i<AS.MAX_PARTS;i++)PT[i]={x:0,y:0,vx:0,vy:0,life:0,max:1,sz:2,c:"#fff"};
G.partCount=0;
var FT=G.FT=new Array(AS.MAX_FTXT);for(i=0;i<AS.MAX_FTXT;i++)FT[i]={x:0,y:0,t:"",life:0,c:"#fff",sz:0};
G.ftCount=0;G.ftFrame=0;

function addP(x,y,vx,vy,life,sz,c){if(G.partCount>=AS.MAX_PARTS)return;var p=PT[G.partCount++];p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.life=p.max=life;p.sz=sz;p.c=c;}
function boom(x,y,c,n){if(G.partCount>260)n=Math.min(n,2);for(var k=0;k<n;k++){var a=Math.random()*TAU,s=60+Math.random()*180;addP(x,y,Math.cos(a)*s,Math.sin(a)*s,0.25+Math.random()*0.25,1.8+Math.random()*2.2,c);}}
function addFt(x,y,t,c,sz){if(G.ftFrame>=AS.FTXT_PER_FRAME+(sz?3:0)||G.ftCount>=AS.MAX_FTXT)return;G.ftFrame++;var f=FT[G.ftCount++];f.x=x+(Math.random()-0.5)*10;f.y=y;f.t=t;f.life=sz?0.6:0.45;f.c=c;f.sz=sz||0;}
// damage-number style per attack type: colour + size tier (0 small, 1 medium, 2 large)
var FTS={blast:["#ffee66",0],orb:["#ffcc44",0],wave:["#ffb040",0],sigil:["#a8d8ff",0],burn:["#ff8a40",0],melee:["#7affe0",1],dash:["#9ad0ff",1],charge:["#ffffff",2],thorns:["#c8a0ff",0]};
function shake(v){if(G.cam.sh<v)G.cam.sh=v;}
function spawnPr(x,y,a,dmg,spd,life,col,r,pierce,kind){
  if(G.pCount>=AS.MAX_PROJ)return null;var p=PR[G.pCount++];
  p.x=x;p.y=y;p.vx=Math.cos(a)*spd;p.vy=Math.sin(a)*spd;p.dmg=dmg;p.life=life;p.col=col;p.r=r;p.pierce=pierce||0;p.hn=0;
  p.kind=kind||0;p.tgt=null;p.tgtId=0;p.rt=0;p.trav=0;p.out=0;p.ret=false;p.ang=a;p.type=p.kind?"sigil":"blast";p.burn=false;return p;
}
function spawnEP(x,y,vx,vy,dmg,life,col,r){if(G.epCount>=AS.MAX_EPROJ)return;var p=EP[G.epCount++];p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.dmg=dmg*G.dmgMul;p.life=life;p.col=col;p.r=r;}
function tierOf(v){return v>=40?2:(v>=8?1:0);}
function addShard(x,y,v){
  if(G.sCount>=AS.MAX_SHARDS){ // pool full: merge into the nearest existing shard
    var best=0,bd=1e18;for(var k=0;k<G.sCount;k++){var s=SH[k],dx=s.x-x,dy=s.y-y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=k;}}
    var m=SH[best];m.v+=v;m.tier=tierOf(m.v);return;
  }
  var s2=SH[G.sCount++];s2.x=x;s2.y=y;s2.v=v;s2.tier=tierOf(v);s2.mag=false;
}

/* ---------------- spatial grid (uniform, centred on player) ---------------- */
var CELL=64,GC=44,GR=44,gx0=0,gy0=0;
var cellHead=new Int32Array(GC*GR),nextE=new Int32Array(MAX_E),QB=new Int32Array(MAX_E),qn=0,gridN=0;
function gridBuild(){
  gx0=P.x-GC*CELL/2;gy0=P.y-GR*CELL/2;cellHead.fill(-1);gridN=G.eCount;
  for(var k=0;k<gridN;k++){
    var e=E[k];if(e.dead)continue;
    var cx=((e.x-gx0)/CELL)|0,cy=((e.y-gy0)/CELL)|0;
    if(cx<0||cy<0||cx>=GC||cy>=GR||e.x<gx0||e.y<gy0)continue;
    var idx=cy*GC+cx;nextE[k]=cellHead[idx];cellHead[idx]=k;
  }
}
function gridQuery(x,y,r){
  qn=0;
  var c0=Math.floor((x-r-gx0)/CELL),c1=Math.floor((x+r-gx0)/CELL),r0=Math.floor((y-r-gy0)/CELL),r1=Math.floor((y+r-gy0)/CELL);
  if(c0<0)c0=0;if(r0<0)r0=0;if(c1>=GC)c1=GC-1;if(r1>=GR)r1=GR-1;
  for(var cy=r0;cy<=r1;cy++)for(var cx=c0;cx<=c1;cx++){var j=cellHead[cy*GC+cx];while(j!==-1){QB[qn++]=j;j=nextE[j];}}
  return qn;
}
// nearest enemy in range; with focus=true, every other call prefers an elite/boss in range
function nearest(x,y,rng,focus){
  var n=gridQuery(x,y,rng),best=null,bd=rng*rng,big=null,bbd=rng*rng;
  for(var k=0;k<n;k++){var e=E[QB[k]];if(e.dead)continue;var dx=e.x-x,dy=e.y-y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=e;}if(e.el&&d<bbd){bbd=d;big=e;}}
  if(!focus)return best;
  G.focus=!G.focus;
  return (big&&G.focus)?big:best;
}
// AoE helper: damage every enemy within radius (once)
function aoe(x,y,rad,dmg,kbF,type,fcrit,onHit){
  var n=gridQuery(x,y,rad+40),hit=0;
  for(var k=0;k<n;k++){var e=E[QB[k]];if(e.dead)continue;var dx=e.x-x,dy=e.y-y,rr=rad+e.r;if(dx*dx+dy*dy<rr*rr){var d=Math.sqrt(dx*dx+dy*dy)||1;if(onHit)onHit(e);dmgE(e,dmg,e.x,e.y,kbF?{x:dx/d*kbF,y:dy/d*kbF}:null,type,fcrit);hit++;}}
  AS.world.aoeDes(x,y,rad,dmg);
  return hit;
}

/* ---------------- spawning ---------------- */
var uid=1;
function ringR(){return Math.sqrt(V.W*V.W/4+V.H*V.H/4)+40;}
var rp={x:0,y:0};
function ringPos(ahead){
  var a,j=IN.joy;
  if(ahead&&(j.x||j.y)&&Math.random()<0.6)a=Math.atan2(j.y,j.x)+(Math.random()-0.5)*2.1;else a=Math.random()*TAU;
  var r=ringR();rp.x=P.x+Math.cos(a)*r;rp.y=P.y+Math.sin(a)*r;return rp;
}
// t = type def; o: {scale,hpX,xpX,dmgX,el,swarm,noSplit,isBoss}
function spawnE(t,key,x,y,o){
  o=o||{};
  if(G.eCount>=MAX_E-(o.isBoss?0:6))return null;
  var e=E[G.eCount++],sc=o.scale||1,vs=sc*(t.sc||1);
  e.id=uid++;e.x=x;e.y=y;e.kx=0;e.ky=0;
  e.hp=e.max=t.hp*(o.isBoss?1:G.hpMul)*(o.hpX||1);
  e.spd=t.spd*(o.isBoss?1:(0.94+Math.random()*0.12)*G.spdMul);
  e.r=t.r*sc;e.c=t.c;e.d=t.d*(o.dmgX||1)*(o.isBoss?1:G.dmgMul);
  e.xp=Math.max(1,Math.round(t.xp*(o.xpX||1)*(o.isBoss?1:(1+(G.hpMul-1)*0.3))));
  e.key=key;e.rng=!!t.rng;e.armor=t.armor||0;e.splits=o.noSplit?0:(t.splits||0);
  e.el=!!o.el;e.tough=t.hp>=75;e.boss=null;e.swarm=!!o.swarm;
  e.shT=1.3+Math.random();e.frame=Math.random()*6;e.runT=Math.random()*6;e.orbT=0;e.gyT=0;e.slowT=0;e.slowF=0;e.fl=0;e.flCd=0;e.dead=false;
  e.st=0;e.stT=0;e.p2=false;e.p3=false;e.phase=0;e.bInv=0;e.marked=false;e.mi=0;e.shield=0;e.shMax=0;e.hitT=0;e.burnT=0;e.burnD=0;e.burnA=0;e.mod=null;e.dashId=0;e.vol=0;e.bkey=null;e.lunge=!!t.lunge;e.shields=!!t.shields;
  e.spr=R.enemySprite(key,t.c,e.r,t.shape,o.isBoss?sc:vs,e.el||o.isBoss,o.ringC);
  if(!o.isBoss)G.normalN++;
  return e;
}
var mixCache={idx:-1,keys:[],cum:[],tot:0};
function pickMix(row,idx){
  if(mixCache.idx!==idx){mixCache.idx=idx;mixCache.keys=[];mixCache.cum=[];var tot=0;for(var k in row.mix){tot+=row.mix[k];mixCache.keys.push(k);mixCache.cum.push(tot);}mixCache.tot=tot;}
  var r=Math.random()*mixCache.tot;for(var j=0;j<mixCache.cum.length;j++)if(r<mixCache.cum[j])return mixCache.keys[j];
  return mixCache.keys[0];
}
function spawnRegular(row,idx){var k=pickMix(row,idx),p=ringPos(true);spawnE(AS.ETYPES[k],k,p.x,p.y);}
function director(dt){
  var sch=AS.SCHEDULE,i=G.schIdx,t=G.runT;
  while(i+1<sch.length&&sch[i+1].t<=t)i++;
  G.schIdx=i;
  var a=sch[i],b=sch[i+1]||a,f=b===a?0:(t-a.t)/(b.t-a.t);
  var rate=a.rate+(b.rate-a.rate)*f;G.hpMul=a.hp+(b.hp-a.hp)*f;G.spdMul=a.spd+(b.spd-a.spd)*f;G.dmgMul=a.dmg+(b.dmg-a.dmg)*f;
  if(G.stress){var k=0;while(G.normalN<AS.CAP&&k<30){spawnRegular(a,i);k++;}}
  else{
    G.spawnAcc+=rate*dt;
    while(G.spawnAcc>=1){G.spawnAcc-=1;if(G.normalN>=AS.CAP){G.spawnAcc=0;break;}spawnRegular(a,i);}
  }
  var EV=AS.EVENTS;
  while(G.evIdx<EV.length&&EV[G.evIdx].t<=t){if(fireEvent(EV[G.evIdx])===false)break;G.evIdx++;}
  if(G.spiral>0){
    G.spiral-=dt;G.spiralAcc+=dt;
    while(G.spiralAcc>=0.06){G.spiralAcc-=0.06;G.spiralAng+=0.33;var r=ringR(),sw=AS.ETYPES.swarmer;
      spawnE(sw,"swarmer",P.x+Math.cos(G.spiralAng)*r,P.y+Math.sin(G.spiralAng)*r,{swarm:true});}
  }
}
function spawnElite(){
  var w=AS.ETYPES.warlord,p=ringPos(true),el=AS.ELITE,mod=AS.ELITE_MODS[(Math.random()*AS.ELITE_MODS.length)|0];
  var e=spawnE(w,"warlord",p.x,p.y,{el:true,scale:el.scale,hpX:el.hpX,xpX:el.xpX,dmgX:el.dmgX,noSplit:true,ringC:mod.c});
  if(e){e.mod=mod;if(mod.id==="swift")e.spd*=1.6;else if(mod.id==="armored")e.armor=0.4;else if(mod.id==="warded"){e.shMax=e.max*0.4;e.shield=e.shMax;e.shT=6;}}
  return e;
}
function fireEvent(ev){
  if(ev.kind==="swarm"){
    banner("⚠ SWARM SURGE",true);S.warn();N.haptic("MEDIUM");
    if(ev.pattern==="ring"){var n=Math.round(36+G.runT/300*24),r=Math.max(V.W,V.H)*0.5+40,sw=AS.ETYPES.swarmer,off=Math.random()*TAU;
      for(var k=0;k<n;k++){var a=off+k/n*TAU;spawnE(sw,"swarmer",P.x+Math.cos(a)*r,P.y+Math.sin(a)*r,{swarm:true});}}
    else{G.spiral=3.4;G.spiralAcc=0;G.spiralAng=Math.random()*TAU;}
  }else if(ev.kind==="elite"){
    var c=ev.count||1;for(var j=0;j<c;j++)spawnElite();
    banner(c>1?"Elite Warlords approach!":"Elite Warlord approaches!",false);N.haptic("MEDIUM");
  }else if(ev.kind==="cache"){
    var a2=Math.random()*TAU;dropLoot("cache",P.x+Math.cos(a2)*150,P.y+Math.sin(a2)*150,0);
    banner("A Sigil Cache shimmers nearby",false);
  }else if(ev.kind==="boss"){return spawnBoss(ev.boss);} // false (pool full) = retry next frame
  return true;
}
function spawnBoss(key){
  var b=AS.BOSSES[key],p=ringPos(false),sc=b.r/18;
  var def={hp:b.hp,spd:b.spd,r:18,c:b.c,d:b.d,xp:b.xp,shape:4};
  var e=spawnE(def,"boss_"+key,p.x,p.y,{isBoss:true,scale:sc});
  if(!e)return false;
  e.boss=b;e.bkey=key;e.st=0;e.stT=1.6;e.el=true;e.phase=0;e.bInv=0;e.spA=0;e.spAng=0;e.dd2=false;if(R.bossSprite)e.spr=R.bossSprite(key,e.r);
  G.bosses.push(e);G.bossFocus=e;
  if(b.final){G.finalSpawned=true;banner("⚠ THE "+b.n.toUpperCase()+" AWAKENS",true);}
  else banner("⚠ "+b.n.toUpperCase(),true);
  S.warn();N.haptic("HEAVY");G.cam.sh=0.4;
  return true;
}

/* ---------------- loot: Sigil Caches + Relic Chests ---------------- */
function dropLoot(kind,x,y,tier){if(G.loot.length>=24)return;G.loot.push({kind:kind,x:x,y:y,tier:tier||0,t:0});}
function updateLoot(dt){
  for(var k=G.loot.length-1;k>=0;k--){
    var L=G.loot[k];L.t+=dt;var dx=P.x-L.x,dy=P.y-L.y;
    if(dx*dx+dy*dy<30*30){
      G.loot.splice(k,1);
      if(L.kind==="cache"){G.queue.push({k:"cache"});G.cachesOpened++;}
      else G.queue.push({k:"relic",tier:L.tier});
      S.lvl();N.haptic("MEDIUM");boom(L.x,L.y,L.kind==="cache"?"#8fd8ff":"#ffd040",14);
    }
  }
}

/* ---------------- bosses: telegraphed patterns ----------------
   st 0 chase -> 1 dash telegraph (lane shown) -> 2 dash
               -> 3 burst telegraph (ring shown) -> radial shard volley (-> 4 second volley when enraged) */
function burst(e,n,off){var spd=e.p2?218:185;for(var k=0;k<n;k++){var a=off+k/n*TAU;spawnEP(e.x,e.y,Math.cos(a)*spd,Math.sin(a)*spd,e.d*0.6/G.dmgMul,3,e.c,6);}S.burst();G.cam.sh=Math.max(G.cam.sh,0.2);}
function tele(o){G.haz.push(o);}
// phase change: brief immunity, shockwave, projectile clear, summons
function bossPhase(e){
  var b=e.boss,ph=b.phases;
  while(e.phase+1<ph.length&&e.hp<e.max*ph[e.phase+1].at){
    e.phase++;var p=ph[e.phase];e.p2=true;e.spd*=1.12;e.bInv=0.9;e.st=0;e.stT=1.0;G.epCount=0;if(AS.FX.bursts)AS.FX.bursts.push({x:e.x,y:e.y,c:e.c,r:260,life:0.7,max:0.7});
    banner(b.n+" — PHASE "+AS.ROMAN[e.phase+1],true);S.warn();N.haptic("HEAVY");shake(0.5);boom(e.x,e.y,e.c,20);
    var dx=P.x-e.x,dy=P.y-e.y,d=Math.hypot(dx,dy)||1;if(d<220){P.x+=dx/d*(220-d)*0.6;P.y+=dy/d*(220-d)*0.6;}
    AS.FX.novas.push({x:e.x,y:e.y,r:240,life:0.5,max:0.5,c:e.c,w:8});
    for(var k=0;k<(p.summon||0);k++)spawnElite();
  }
}
function startMove(e,mv,dx,dy,dist){
  var j=IN.joy,k;S.tele();
  if(mv==="dash"){e.st=1;e.teleDur=e.stT=e.phase?0.52:0.72;e.ddx=dx/dist;e.ddy=dy/dist;e.dashLen=Math.min(600,dist+170);e.dd2=false;}
  else if(mv==="burst"){e.st=3;e.teleDur=e.stT=e.phase?0.48:0.66;}
  else if(mv==="slam"||mv==="slam3"){ // ground slams telegraphed at (and ahead of) the player
    var n=mv==="slam3"?(e.phase>=2?4:3):1;
    for(k=0;k<n;k++){var lead=k*80,T=0.8+k*0.24;tele({x:P.x+j.x*lead+(k?(Math.random()-0.5)*70:0),y:P.y+j.y*lead+(k?(Math.random()-0.5)*70:0),R:k?74:90,t:T,max:T,dmg:e.d*1.15,c:e.c});}
    e.st=7;e.stT=0.5;
  }else if(mv==="lances"||mv==="volley"){ // line telegraphs fanning at the player (volley: a second, re-aimed fan)
    var a0=Math.atan2(dy,dx),nl=e.phase?2:1;for(k=-nl;k<=nl;k++)tele({k:"l",x:e.x,y:e.y,ang:a0+k*0.34,len:600,w:34,t:0.74,max:0.74,dmg:e.d,c:e.c});
    if(mv==="volley"){e.vol=0.5;}
    e.st=7;e.stT=mv==="volley"?1.0:0.75;
  }else if(mv==="cross"){ // lanes crossing at the player's position
    var ca=Math.random()*Math.PI,nc=e.phase>=2?3:2;for(k=0;k<nc;k++){var aa=ca+k*Math.PI/nc;tele({k:"l",x:P.x-Math.cos(aa)*320,y:P.y-Math.sin(aa)*320,ang:aa,len:640,w:38,t:0.8,max:0.8,dmg:e.d*1.1,c:e.c});}
    e.st=7;e.stT=0.6;
  }else if(mv==="rain"){ // scattered slams around the player, staggered
    var nr=e.boss.final?(e.phase>=2?7:6):(e.phase?5:4);for(k=0;k<nr;k++){var ra=Math.random()*TAU,rd=k===0?0:60+Math.random()*170,RT=0.75+k*0.11;tele({x:P.x+j.x*40+Math.cos(ra)*rd,y:P.y+j.y*40+Math.sin(ra)*rd,R:58,t:RT,max:RT,dmg:e.d*0.9,c:e.c});}
    e.st=7;e.stT=0.7;
  }else if(mv==="spiral"){e.st=8;e.stT=e.phase>=2?2.6:2.2;e.spA=0;e.spAng=Math.random()*TAU;}
}
function bossAI(e,dt,dx,dy,dist){
  var b=e.boss;e.stT-=dt;if(e.bInv>0)e.bInv-=dt;
  bossPhase(e);
  var ph=b.phases[e.phase],cd=ph.cd;
  if(e.st===0){
    var sp=e.spd*(dist>650?2.6:1)*(e.slowT>0?1-e.slowF*0.5:1);
    e.x+=dx/dist*sp*dt;e.y+=dy/dist*sp*dt;
    if(e.stT<=0&&dist<700)startMove(e,ph.moves[e.mi++%ph.moves.length],dx,dy,dist);
  }else if(e.st===1){
    if(e.stT<=0){e.st=2;e.stT=0.42;e.dashV=e.dashLen/0.42;}
  }else if(e.st===2){
    e.x+=e.ddx*e.dashV*dt;e.y+=e.ddy*e.dashV*dt;
    if(Math.random()<0.6)addP(e.x,e.y,0,0,0.3,4,e.c);
    if(e.stT<=0){
      if(e.phase&&!e.dd2){e.dd2=true;var d2x=P.x-e.x,d2y=P.y-e.y,d2d=Math.hypot(d2x,d2y)||1;e.st=1;e.teleDur=e.stT=0.46;e.ddx=d2x/d2d;e.ddy=d2y/d2d;e.dashLen=Math.min(600,d2d+170);S.tele();}
      else{e.st=0;e.stT=cd;}
      if(e.phase&&b.final)burst(e,14,Math.random());}
  }else if(e.st===3){
    if(e.stT<=0){
      burst(e,e.phase?22:16,Math.random()*TAU);
      if(b.final&&e.phase){var sw=AS.ETYPES.swarmer;for(var k=0;k<8;k++){var a=k/8*TAU;spawnE(sw,"swarmer",e.x+Math.cos(a)*60,e.y+Math.sin(a)*60,{swarm:true});}}
      if(e.phase){e.st=4;e.stT=0.35;}else{e.st=0;e.stT=cd;}
    }
  }else if(e.st===4){
    if(e.stT<=0){burst(e,22,Math.PI/22);e.st=0;e.stT=cd;}
  }else if(e.st===7){
    if(e.vol>0){e.vol-=dt;if(e.vol<=0){var va=Math.atan2(dy,dx);for(var vk=-1;vk<=1;vk++)tele({k:"l",x:e.x,y:e.y,ang:va+vk*0.3+0.17,len:600,w:34,t:0.7,max:0.7,dmg:e.d,c:e.c});S.tele();}}
    if(e.stT<=0&&!(e.vol>0)){e.st=0;e.stT=cd;}}
  else if(e.st===8){ // rotating twin bullet spiral (boss holds still)
    var arms=e.phase>=2?3:2;e.spA+=dt;while(e.spA>=0.085){e.spA-=0.085;e.spAng+=0.42;for(var q=0;q<arms;q++){var aa=e.spAng+q*TAU/arms;spawnEP(e.x,e.y,Math.cos(aa)*185,Math.sin(aa)*185,e.d*0.5/G.dmgMul,3.2,e.c,6);}}
    if(e.stT<=0){e.st=0;e.stT=cd;}
  }
}

/* ---------------- stats: base (upgrades + altar) x relics -> P.eff ---------------- */
function recalc(){
  var rs={dmg:0,rate:0,spd:0,pick:0,xp:0,crit:0,critD:0,hp:0,armor:0,regen:0,abil:0,cd:0,area:0,leech:0},fx={storm:0,echo:0,ember:0,thorns:0};
  for(var k=0;k<P.relics.length;k++){var it=P.relics[k];if(!it)continue;var def=it.def,m=AS.RARITY[it.rar].m;
    if(def.st)for(var s in def.st)rs[s]+=def.st[s]*m;
    if(def.fx)fx[def.fx]+=def.v*m;}
  var e=P.eff;
  e.dmg=P.dmgM*(1+rs.dmg);e.rate=Math.max(0.35,1-rs.rate)*(P.hasteT>0?0.75:1);e.spd=P.spdM*(1+rs.spd);e.pick=P.pick*(1+rs.pick);
  e.xp=P.xpM*(1+rs.xp);e.crit=Math.min(0.85,P.critChance+rs.crit);e.critMult=P.critMult+rs.critD;
  e.armor=Math.min(0.5,rs.armor);e.regen=rs.regen;e.abil=1+rs.abil;e.cd=Math.max(0.5,1-rs.cd);e.area=1+rs.area;e.leech=P.lifesteal+rs.leech;
  var mh=P.baseMaxHp+Math.round(rs.hp);if(mh!==P.maxHp){var d=mh-P.maxHp;P.maxHp=mh;P.hp=Math.max(1,Math.min(mh,P.hp+Math.max(0,d)));}
  P.rfx=fx;
}

/* ---------------- damage ---------------- */
function ignite(e,d){if(e.dead)return;e.burnT=3;if(d>e.burnD)e.burnD=d;}
function dmgE(e,dmg,hx,hy,kb,type,fcrit){
  if(e.dead||e.bInv>0)return;
  type=type||"blast";
  if(e.armor)dmg*=(1-e.armor);
  var crit=false,ef=P.eff;
  if(fcrit||(ef.crit&&Math.random()<ef.crit)){dmg*=ef.critMult;crit=true;}
  if(e.shield>0){var ab=Math.min(e.shield,dmg);e.shield-=ab;dmg-=ab;if(e.shield<=0)boom(e.x,e.y,"#80e8ff",4);if(dmg<=0){if(e.flCd<=0){e.fl=0.05;e.flCd=0.22;}return;}}
  e.hp-=dmg;G.dmgDealt+=dmg;if(e.flCd<=0){e.fl=0.07;e.flCd=0.22;}S.hit(); // flash at most ~4x/s so sustained fire doesn't paint enemies white
  if(!e.boss)e.hitT=(type==="melee"||type==="charge"||type==="dash")?0.3:Math.max(e.hitT,0.06); // hit reaction: brief stagger
  if(ef.leech&&G.lsBudget>0){var h=Math.min(G.lsBudget,dmg*ef.leech);G.lsBudget-=h;P.hp=Math.min(P.maxHp,P.hp+h);}
  if(kb&&!e.boss){var kf=e.el?0.35:1;e.kx+=kb.x*kf;e.ky+=kb.y*kf;}
  var st=FTS[type]||FTS.blast,sz=st[1];
  if(crit){ // crits: star-burst sparks, bigger pink number
    sz=Math.min(2,sz+1);
    if(G.partCount<240)for(var k=0;k<4;k++){var a=k*Math.PI/2+0.4;addP(hx,hy,Math.cos(a)*220,Math.sin(a)*220,0.22,2.6,k%2?"#ffffff":"#ff6ae0");}
  }else if(G.partCount<220)addP(hx,hy,0,0,0.15,2,st[0]);
  if(dmg>=80&&type!=="burn")shake(Math.min(0.35,0.1+dmg/1200));
  addFt(e.x,e.y-14,Math.floor(dmg)+(crit?"!":""),crit?"#ff6ae0":st[0],sz);
  if(e.hp<=0)killE(e);
}
function killE(e){
  e.dead=true;G.kills++;AS.world.onKill(e);G.combo++;G.comboT=2;if(G.combo>G.bestCombo)G.bestCombo=G.combo;
  if(e.mod&&e.mod.id==="volatile"){G.haz.push({x:e.x,y:e.y,t:0.9,max:0.9,R:95,dmg:e.d*1.3});S.tele();}
  S.death();boom(e.x,e.y,e.c,e.el?12:5);if(AS.FX.bursts&&(e.el||G.fxQ))AS.FX.bursts.push({x:e.x,y:e.y,c:e.c,r:e.boss?220:(e.el?90:e.r*2.6),life:e.boss?0.8:0.32,max:e.boss?0.8:0.32});
  if(e.boss){
    var b=e.boss,n=6;for(var k=0;k<n;k++)addShard(e.x+(Math.random()-0.5)*50,e.y+(Math.random()-0.5)*50,Math.ceil(b.xp/n)+1);
    G.bossKills++;boom(e.x,e.y,"#ffe040",24);G.cam.sh=0.7;N.haptic("HEAVY");
    var bi=G.bosses.indexOf(e);if(bi>=0)G.bosses.splice(bi,1);
    if(G.bossFocus===e)G.bossFocus=G.bosses.length?G.bosses[G.bosses.length-1]:null;
    if(b.final){P.pl=Math.floor(P.pl*1.3)+1000;G.winT=1.6;P.inv=99;banner(b.n+" destroyed!",false);S.clear();}
    else{G.miniKills++;P.pl=Math.floor(P.pl*1.15)+300;P.hp=Math.min(P.maxHp,P.hp+P.maxHp*AS.HEAL.mini);vacuum();dropLoot("chest",e.x,e.y,1);banner(b.n+" defeated! A Relic Chest drops",false);}
    return;
  }
  addShard(e.x,e.y,e.xp);
  if(e.el){
    G.eliteKills++;P.pl=Math.floor(P.pl*1.05)+100;P.hp=Math.min(P.maxHp,P.hp+P.maxHp*AS.HEAL.elite);addFt(P.x,P.y-24,"+HP","#8affc0");vacuum();N.haptic("MEDIUM");
    dropLoot("cache",e.x,e.y,0);
    if(Math.random()<AS.ELITE_CHEST_CHANCE)dropLoot("chest",e.x+30,e.y,0);
  }else if(G.coffers<2&&Math.random()<AS.COFFER_CHANCE){G.coffers++;dropLoot("chest",e.x,e.y,0);}
  if(e.splits>0){
    var t=AS.ETYPES[e.key];
    for(var s=0;s<e.splits;s++){var a=Math.random()*TAU;var c=spawnE(t,e.key,e.x+Math.cos(a)*14,e.y+Math.sin(a)*14,{scale:0.65,hpX:0.42,xpX:0.5,dmgX:0.6,noSplit:true});if(c)c.spd*=1.15;}
  }
  G.cam.sh=Math.min(0.3,G.cam.sh+0.04);
}
function vacuum(){for(var k=0;k<G.sCount;k++)SH[k].mag=true;}
function hurtPlayer(d,src){
  if(G.god||P.inv>0)return;
  d*=(1-P.eff.armor);
  P.hp-=d;G.dmgTaken+=d;AS.world.onHurt();
  if(src&&src.mod&&src.mod.id==="vampiric")src.hp=Math.min(src.max,src.hp+src.max*0.12);P.inv=0.5;S.hurt();G.cam.sh=Math.max(G.cam.sh,0.25);G.hurtFx=1;boom(P.x,P.y,"#ff4060",4);
  if(P.rfx.echo&&G.echoCd<=0){G.echoCd=1.2;aoe(P.x,P.y,120*P.eff.area,P.rfx.echo*P.eff.abil,220,"sigil");AS.FX.novas.push({x:P.x,y:P.y,r:120*P.eff.area,life:0.35,max:0.35,c:"#c0a8ff"});}
  if(src&&P.rfx.thorns&&!src.dead)dmgE(src,P.rfx.thorns*P.eff.dmg,src.x,src.y,null,"thorns");
  checkDeath();
}
function checkDeath(){
  if(P.hp>0)return;
  if(P.extraLife){P.extraLife=false;P.hp=Math.floor(P.maxHp*AS.HEAL.secondWind);P.inv=1.5;N.haptic("HEAVY");boom(P.x,P.y,"#8affc0",16);G.cam.sh=0.4;banner("Second Wind!",false);}
  else{P.hp=0;gameOver();}
}

/* ---------------- ascension ---------------- */
function startAsc(){if(P.form===1){P.formT=P.formMax;P.pl=Math.floor(P.pl*1.2);G.cam.sh=0.4;S.transform();return;}P.chargeT=1.0;P.inv=1.2;G.cam.sh=0.3;S.transform();}
function finishAsc(){N.haptic("HEAVY");P.form=1;P.formT=P.formMax;P.dmgM*=1.45;P.spdM*=1.2;P.pl=Math.floor(P.pl*1.7);P.inv=0.7;G.cam.sh=0.55;for(var k=0;k<30;k++){var a=Math.random()*TAU,s=90+Math.random()*300;addP(P.x,P.y,Math.cos(a)*s,Math.sin(a)*s,0.5+Math.random()*0.4,2.5+Math.random()*3,k%2?"#fff":"#ffe040");}}

/* ---------------- active combat: dash, energy melee, charged attack ---------------- */
var CB=AS.COMBAT;
function tryDash(dx,dy){
  var ds=P.dash;if(ds.cd>0||ds.t>0||G.state!=="playing")return false;
  if(!dx&&!dy){var j=IN.joy;if(j.x||j.y){dx=j.x;dy=j.y;}else{dx=P.fx;dy=P.fy;}}
  var l=Math.hypot(dx,dy)||1;ds.dx=dx/l;ds.dy=dy/l;ds.t=CB.dash.dur;ds.cd=CB.dash.cd*(AS.world.cores.chrono?0.4:1);ds.id++;AS.world.onDash();
  P.inv=Math.max(P.inv,CB.dash.dur+0.12);S.dash();N.haptic("LIGHT");G.dashes++;
  return true;
}
function meleeDmg(){return CB.melee.dmg*(1+0.05*(P.lv-1))*P.eff.dmg;}
function doMelee(){
  var tg=nearest(P.x,P.y,CB.melee.rng+40,false),ang=tg?Math.atan2(tg.y-P.y,tg.x-P.x):Math.atan2(P.fy,P.fx);
  var rng=CB.melee.rng*(1+(P.tier||0)*0.08),n=gridQuery(P.x,P.y,rng+30),dmg=meleeDmg(),hit=0,ux=Math.cos(ang),uy=Math.sin(ang);
  for(var k=0;k<n;k++){var e=E[QB[k]];if(e.dead)continue;var dx=e.x-P.x,dy=e.y-P.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    if(d>rng+e.r)continue;if((dx*ux+dy*uy)/d<0.25&&d>e.r+P.r)continue; // ~150 degree arc in front
    dmgE(e,dmg,e.x,e.y,{x:dx/d*CB.melee.kb,y:dy/d*CB.melee.kb},"melee");hit++;}
  AS.world.aoeDes(P.x+ux*rng*0.5,P.y+uy*rng*0.5,rng*0.6,dmg);
  AS.FX.slashes.push({x:P.x,y:P.y,ang:ang,r:rng,life:0.16,max:0.16});
  P.melee.t=CB.melee.cd;S.slash();if(hit)N.haptic("LIGHT");
}
function doCharge(c){
  var q=Math.min(1,(c-CB.charge.min)/(CB.charge.max-CB.charge.min));if(q<0)q=0;
  var R2=(CB.charge.r+(CB.charge.rMax-CB.charge.r)*q)*(1+(P.tier||0)*0.05),dmg=(CB.charge.dmg+(CB.charge.dmgMax-CB.charge.dmg)*q)*(1+0.04*(P.lv-1))*P.eff.dmg,full=q>=0.999;
  aoe(P.x,P.y,R2,dmg,CB.charge.kb*(0.5+q*0.5),"charge",full);
  AS.FX.novas.push({x:P.x,y:P.y,r:R2,life:0.45,max:0.45,c:full?"#ffffff":"#ffe080",w:full?10:6});
  boom(P.x,P.y,full?"#ffffff":"#ffe080",full?22:12);shake(0.2+0.35*q);S.burst();N.haptic(full?"HEAVY":"MEDIUM");
  P.melee.t=Math.max(P.melee.t,0.3);G.charges++;
}
function combat(dt){
  var A=IN.act,ds=P.dash;
  if(ds.cd>0)ds.cd-=dt;
  if(A.dash){A.dash=0;tryDash(A.ddx,A.ddy);A.ddx=A.ddy=0;}
  if(A.held)P.chgT+=dt;
  if(A.up){A.up=0;var c=P.chgT-0.2;P.chgT=0;if(c>=CB.charge.min)doCharge(c);else if(P.melee.t<=0.35)doMelee();}
  P.melee.t-=dt;
  if(P.melee.t<=0&&!A.held&&nearest(P.x,P.y,CB.melee.rng+6,false))doMelee(); // auto melee when foes are close
}
function tierOfLv(lv){var T=AS.LV_TIERS,t=0;for(var k=0;k<T.length;k++)if(lv>=T[k])t=k;return t;}

/* ---------------- update ---------------- */
function update(dt){
  G.gT+=dt;G.ftFrame=0;
  if(G.state!=="playing")return;
  G.runT+=dt;
  recalc();
  var ef=P.eff;
  G.lsBudget=Math.min(AS.HEAL.lsPerSec,G.lsBudget+AS.HEAL.lsPerSec*dt);
  if(G.echoCd>0)G.echoCd-=dt;
  if(ef.regen&&P.hp<P.maxHp)P.hp=Math.min(P.maxHp,P.hp+ef.regen*dt);
  if(G.hurtFx>0)G.hurtFx=Math.max(0,G.hurtFx-dt*3);
  if(G.winT>0){G.winT-=dt;if(G.winT<=0){winRun();return;}}
  if(P.chargeT>0){P.chargeT-=dt;if(Math.random()<0.5)addP(P.x+(Math.random()-0.5)*14,P.y+6,(Math.random()-0.5)*60,-150-Math.random()*180,0.4,2,"#ffe080");if(P.chargeT<=0)finishAsc();}
  if(P.form===1){P.formT-=dt;if(P.formT<=0){P.form=0;P.dmgM/=1.45;P.spdM/=1.2;}}

  director(dt);

  // player movement
  var j=IN.joy,jx=j.x,jy=j.y;
  if(G.stress){var sa=G.gT*0.6;jx=Math.cos(sa);jy=Math.sin(sa);}
  var spd=P.spd*ef.spd*(IN.act.held&&P.chgT>0.2?0.6:1);
  combat(dt);
  if(G.state!=="playing")return;
  var dsh=P.dash;
  if(dsh.t>0){
    dsh.t-=dt;P.x+=dsh.dx*CB.dash.spd*dt;P.y+=dsh.dy*CB.dash.spd*dt;
    addP(P.x,P.y,0,0,0.25,5,P.tier>=2?"#c8a0ff":"#7ae0ff");
    var dn=gridQuery(P.x,P.y,P.r+30);
    for(var di=0;di<dn;di++){var de=E[QB[di]];if(de.dead||de.dashId===dsh.id)continue;var ddx=de.x-P.x,ddy=de.y-P.y,drr=P.r+de.r+6;
      if(ddx*ddx+ddy*ddy<drr*drr){de.dashId=dsh.id;dmgE(de,CB.dash.dmg*ef.dmg*(1+0.04*(P.lv-1)),de.x,de.y,{x:dsh.dx*300,y:dsh.dy*300},"dash");}}
  }else{var zs=(P.slowZ?0.6:1)*(P.hasteT>0?1.3:1);P.x+=jx*spd*zs*dt;P.y+=jy*spd*zs*dt;}
  AS.world.pushOut(P,P.r);
  P.moving=!!(jx||jy)||dsh.t>0;
  if(jx||jy){P.fx=jx;P.fy=jy;}
  if(G.comboT>0){G.comboT-=dt;if(G.comboT<=0)G.combo=0;}
  // player evolution trail (grows with level tier)
  if(P.tier>0&&P.moving){G.trailT-=dt;if(G.trailT<=0){G.trailT=0.07-0.012*P.tier;addP(P.x+(Math.random()-0.5)*8,P.y+8,(Math.random()-0.5)*20,-10,0.3+0.12*P.tier,1.6+P.tier*0.8,TIER_C[P.tier]);}}
  // volatile elite blasts
  for(var hz=G.haz.length-1;hz>=0;hz--){var H=G.haz[hz];H.t-=dt;if(H.t<=0){G.haz.splice(hz,1);shake(0.25);var hit;
    if(H.k==="l"){var ux=Math.cos(H.ang),uy=Math.sin(H.ang),qx=P.x-H.x,qy=P.y-H.y,tt=qx*ux+qy*uy,px2=qx-ux*tt,py2=qy-uy*tt,lim=H.w/2+P.r;hit=tt>0&&tt<H.len&&px2*px2+py2*py2<lim*lim;
      for(var bk=0;bk<5;bk++)boom(H.x+ux*H.len*bk/5,H.y+uy*H.len*bk/5,H.c||"#ff9a30",3);}
    else{var hdx=P.x-H.x,hdy=P.y-H.y;hit=hdx*hdx+hdy*hdy<H.R*H.R;boom(H.x,H.y,H.c||"#ff9a30",14);}
    if(hit)hurtPlayer(H.dmg,null);if(G.state!=="playing")return;}}
  if(P.moving){P.runT+=dt*11;}else P.runT*=0.9;
  P.frame+=dt*7.5;
  if(P.inv>0&&P.inv<90)P.inv-=dt;
  var cam=G.cam;cam.x+=(P.x-cam.x)*Math.min(1,6.5*dt);cam.y+=(P.y-cam.y)*Math.min(1,6.5*dt);
  if(cam.sh>0)cam.sh=Math.max(0,cam.sh-dt*6.5);

  gridBuild();

  // enemies: AI, movement, separation, contact
  var recyc=ringR()+420,recyc2=recyc*recyc,n=G.eCount,pr=P.r;
  for(var i=0;i<n;i++){
    var e=E[i];if(e.dead)continue;
    var dx=P.x-e.x,dy=P.y-e.y,d2=dx*dx+dy*dy,dist=Math.sqrt(d2)||1;
    e.frame+=dt*5;e.runT+=dt*7;if(e.fl>0)e.fl-=dt;if(e.flCd>0)e.flCd-=dt;if(e.orbT>0)e.orbT-=dt;if(e.gyT>0)e.gyT-=dt;if(e.slowT>0)e.slowT-=dt;if(e.hitT>0)e.hitT-=dt;
    if(e.burnT>0){e.burnT-=dt;e.burnA+=dt;if(e.burnA>=0.5){e.burnA=0;if(G.partCount<200)addP(e.x,e.y-6,0,-40,0.3,2.5,"#ff8a40");dmgE(e,e.burnD,e.x,e.y,null,"burn");if(e.dead)continue;}if(e.burnT<=0)e.burnD=0;}
    if(e.shields){e.shT-=dt;if(e.shT<=0){e.shT=3.5;var sn=gridQuery(e.x,e.y,125);for(var si=0;si<sn;si++){var al=E[QB[si]];if(al.dead||al.boss)continue;var sv=al.max*0.35;if(al.shield<sv){al.shield=sv;al.shMax=sv;}}}}
    if(e.mod){if(e.mod.id==="warded"){e.shT-=dt;if(e.shT<=0){e.shT=6;e.shield=e.shMax;}}else if(e.mod.id==="frenzied"&&!e.p2&&e.hp<e.max*0.5){e.p2=true;e.spd*=1.7;boom(e.x,e.y,"#ff50ff",10);}}
    if(e.boss){bossAI(e,dt,dx,dy,dist);}
    else{
      if(d2>recyc2&&!e.el){var p=ringPos(true);e.x=p.x;e.y=p.y;e.kx=e.ky=0;continue;}
      var sp=e.spd*(e.el&&dist>600?2:1)*(e.slowT>0?1-e.slowF:1)*(e.hitT>0?0.25:1);
      if(e.lunge){ // Chaser: winds up, then lunges at the player
        e.stT-=dt;
        if(e.st===0&&dist<190&&e.stT<=0){e.st=5;e.stT=0.3;}
        else if(e.st===5){sp*=0.2;if(e.stT<=0){e.st=6;e.stT=0.4;e.ddx=dx/dist;e.ddy=dy/dist;}}
        else if(e.st===6){e.x+=e.ddx*sp*2.6*dt;e.y+=e.ddy*sp*2.6*dt;sp=0;if(e.stT<=0){e.st=0;e.stT=2.2+Math.random();}}
      }
      if(e.rng&&dist<260){
        e.shT-=dt;
        if(e.shT<=0){e.shT=1.35+Math.random()*0.35;spawnEP(e.x,e.y,dx/dist*235,dy/dist*235,7,1.4,"#ff60b0",4);}
        var k=dist<150?-0.45:0.28;e.x+=dx/dist*sp*k*dt;e.y+=dy/dist*sp*k*dt;
      }else{e.x+=dx/dist*sp*dt;e.y+=dy/dist*sp*dt;}
      if(e.kx||e.ky){e.x+=e.kx*dt;e.y+=e.ky*dt;var damp=Math.pow(0.0005,dt);e.kx*=damp;e.ky*=damp;if(e.kx*e.kx+e.ky*e.ky<4){e.kx=e.ky=0;}}
      // soft separation using the grid (3x3 neighbourhood, capped)
      var cx=((e.x-gx0)/CELL)|0,cy=((e.y-gy0)/CELL)|0;
      if(cx>0&&cy>0&&cx<GC-1&&cy<GR-1){
        var cnt=0;
        for(var yy=cy-1;yy<=cy+1&&cnt<8;yy++)for(var xx=cx-1;xx<=cx+1&&cnt<8;xx++){
          var q=cellHead[yy*GC+xx];
          while(q!==-1&&cnt<8){
            if(q!==i){var o=E[q];if(!o.dead){var sx=e.x-o.x,sy=e.y-o.y,rr=(e.r+o.r)*0.8,dd=sx*sx+sy*sy;
              if(dd<rr*rr&&dd>0.01){var dl=Math.sqrt(dd),push=(rr-dl)/dl*(o.boss?0.6:0.3);e.x+=sx*push;e.y+=sy*push;cnt++;}}}
            q=nextE[q];
          }
        }
      }
    }
    if(!e.boss)AS.world.pushOut(e,e.r*0.8);
    var cr=pr+e.r-1;
    if(P.inv<=0&&d2<cr*cr){
      hurtPlayer(e.d*(e.st===2?1.5:1),e);
      if(!e.boss){e.x-=dx/dist*22;e.y-=dy/dist*22;}
    }
    if(G.state!=="playing")return;
  }

  // main weapons
  var col=P.form===1?"#ffe040":"#7ae0ff",dm=ef.dmg;
  var b=P.blast;b.t-=dt;
  if(b.t<=0){
    var tg=nearest(P.x,P.y,b.rng,true);
    if(tg){
      var base=Math.atan2(tg.y-P.y,tg.x-P.x),cn=b.cnt,spr=Math.min(0.34,0.09*(cn-1));
      for(var c=0;c<cn;c++){var bp=spawnPr(P.x,P.y,base+(c-(cn-1)/2)*(cn>1?spr*2/(cn-1):0),b.dmg*dm,b.spd,b.rng/b.spd+0.1+(P.evo.phantom?0.3:0),col,4,b.pierce,P.evo.phantom?1:0);if(bp){bp.type="blast";if(P.evo.phantom)bp.rt=0.08;}}
      S.shoot();b.t=b.rate*ef.rate;
      if(P.evo.tempest&&Math.random()<0.3)AS.sigils.chain(tg,16*dm*ef.abil,4,"#c8f0ff");
      if(P.rfx.storm){G.shotN++;if(G.shotN%6===0){aoe(tg.x,tg.y,48,P.rfx.storm*dm,120);AS.FX.bolts.push({pts:[tg.x,tg.y-260,tg.x+(Math.random()-0.5)*30,tg.y-130,tg.x,tg.y],life:0.2,max:0.2,c:"#fff4a0"});}}
    }else b.t=0.05;
  }
  if(P.orbit.on){
    var ob=P.orbit;ob.ang+=ob.spd*dt;
    for(var oi=0;oi<ob.cnt;oi++){
      var oa=ob.ang+(oi/ob.cnt)*TAU,ox=P.x+Math.cos(oa)*ob.rad,oy=P.y+Math.sin(oa)*ob.rad;
      var m=gridQuery(ox,oy,48);
      for(var qi=0;qi<m;qi++){var oe=E[QB[qi]];if(oe.dead||oe.orbT>0)continue;var ex=oe.x-ox,ey=oe.y-oy,rr2=oe.r+7;
        if(ex*ex+ey*ey<rr2*rr2){oe.orbT=0.4;dmgE(oe,ob.dmg*dm,ox,oy,{x:ex*4,y:ey*4},"orb",!!P.evo.starstorm);}}
    }
  }
  if(P.wave.on){
    var wv=P.wave;wv.t-=dt;
    if(wv.t<=0){wv.t=wv.rate;var wc=P.form===1?"#ffcc30":"#ffb040";for(var w=0;w<12;w++){var wp=spawnPr(P.x,P.y,w/12*TAU,wv.dmg*dm,330,0.42,wc,5,2);if(wp){wp.type="wave";wp.burn=!!P.evo.inferno;}}boom(P.x,P.y,wc,6);G.cam.sh=Math.max(G.cam.sh,0.12);}
  }
  // sigils (extra abilities) + relic behaviours
  AS.sigils.update(dt);
  AS.world.update(dt);if(G.state!=="playing")return;

  // player projectiles
  for(i=G.pCount-1;i>=0;i--){
    var pj=PR[i];
    if(pj.kind===1){ // homing
      pj.rt-=dt;
      if((!pj.tgt||pj.tgt.dead||pj.tgt.id!==pj.tgtId)&&pj.rt<=0){pj.rt=0.15;pj.tgt=nearest(pj.x,pj.y,420,false);pj.tgtId=pj.tgt?pj.tgt.id:0;}
      if(pj.tgt&&!pj.tgt.dead&&pj.tgt.id===pj.tgtId){
        var want=Math.atan2(pj.tgt.y-pj.y,pj.tgt.x-pj.x),cur=Math.atan2(pj.vy,pj.vx),dA=want-cur;
        while(dA>Math.PI)dA-=TAU;while(dA<-Math.PI)dA+=TAU;
        var turn=7*dt;cur+=Math.max(-turn,Math.min(turn,dA));var ps=Math.sqrt(pj.vx*pj.vx+pj.vy*pj.vy);pj.vx=Math.cos(cur)*ps;pj.vy=Math.sin(cur)*ps;
      }
    }else if(pj.kind===2){ // boomerang: out, then back to the player
      pj.ang+=dt*14;
      if(!pj.ret){pj.trav+=Math.sqrt(pj.vx*pj.vx+pj.vy*pj.vy)*dt;if(pj.trav>=pj.out)pj.ret=true;}
      else{var rx=P.x-pj.x,ry=P.y-pj.y,rd=Math.sqrt(rx*rx+ry*ry)||1;pj.vx=rx/rd*480;pj.vy=ry/rd*480;if(rd<18)pj.life=0;}
    }
    pj.x+=pj.vx*dt;pj.y+=pj.vy*dt;pj.life-=dt;
    var dead=pj.life<=0;
    if(!dead&&pj.kind!==2&&AS.world.hitDes(pj.x,pj.y,pj.r,pj.dmg)){if(pj.pierce>0)pj.pierce--;else dead=true;}
    if(!dead){
      var qn2=gridQuery(pj.x,pj.y,pj.r+40);
      for(var h=0;h<qn2;h++){
        var te=E[QB[h]];if(te.dead)continue;
        var hx=te.x-pj.x,hy=te.y-pj.y,hr=te.r+pj.r;
        if(hx*hx+hy*hy<hr*hr){
          if(pj.kind===2){if(te.gyT>0)continue;te.gyT=0.35;dmgE(te,pj.dmg,pj.x,pj.y,{x:hx*3,y:hy*3},"sigil");if(P.evo.bloodgyre&&G.lsBudget>0){var hh2=Math.min(G.lsBudget,1.5);G.lsBudget-=hh2;P.hp=Math.min(P.maxHp,P.hp+hh2);}continue;}
          var seen=false;for(var hh=0;hh<pj.hn;hh++)if(pj.hits[hh]===te.id){seen=true;break;}
          if(seen)continue;
          var sp2=Math.sqrt(pj.vx*pj.vx+pj.vy*pj.vy)||1;
          if(pj.burn)ignite(te,pj.dmg*0.35);
          dmgE(te,pj.dmg,pj.x,pj.y,{x:pj.vx/sp2*90,y:pj.vy/sp2*90},pj.type);
          if(pj.pierce>0){pj.pierce--;if(pj.hn<8)pj.hits[pj.hn++]=te.id;}else{dead=true;break;}
        }
      }
    }
    if(dead){G.pCount--;if(i<G.pCount){var tp=PR[i];PR[i]=PR[G.pCount];PR[G.pCount]=tp;}}
  }
  // enemy projectiles
  for(i=G.epCount-1;i>=0;i--){
    var q2=EP[i];q2.x+=q2.vx*dt;q2.y+=q2.vy*dt;q2.life-=dt;
    var dd2=q2.life<=0||AS.world.blockEP(q2.x,q2.y);
    if(!dd2){var px=P.x-q2.x,py=P.y-q2.y,rr3=P.r+q2.r-2;if(px*px+py*py<rr3*rr3&&P.inv<=0){hurtPlayer(q2.dmg,null);dd2=true;}}
    if(dd2){G.epCount--;if(i<G.epCount){var t2=EP[i];EP[i]=EP[G.epCount];EP[G.epCount]=t2;}}
    if(G.state!=="playing")return;
  }
  // shards
  var pickR=55*ef.pick,pickR2=pickR*pickR,colR=P.r+8,colR2=colR*colR;
  for(i=G.sCount-1;i>=0;i--){
    var s=SH[i],sx2=P.x-s.x,sy2=P.y-s.y,sd=sx2*sx2+sy2*sy2;
    if(!s.mag&&sd<pickR2)s.mag=true;
    if(s.mag){var sdl=Math.sqrt(sd)||1,v=Math.min(sdl/dt,560+G.runT*0.4);s.x+=sx2/sdl*v*dt;s.y+=sy2/sdl*v*dt;sd=(P.x-s.x)*(P.x-s.x)+(P.y-s.y)*(P.y-s.y);}
    if(sd<colR2){gainXp(s.v);G.sCount--;if(i<G.sCount){var ts=SH[i];SH[i]=SH[G.sCount];SH[G.sCount]=ts;}}
  }
  updateLoot(dt);
  // particles & damage numbers
  for(i=G.partCount-1;i>=0;i--){var pt=PT[i];pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;var dmp=Math.pow(0.006,dt);pt.vx*=dmp;pt.vy*=dmp;pt.life-=dt;
    if(pt.life<=0){G.partCount--;if(i<G.partCount){var tpp=PT[i];PT[i]=PT[G.partCount];PT[G.partCount]=tpp;}}}
  var BU=AS.FX.bursts;if(BU.length>40)BU.splice(0,BU.length-40);for(i=BU.length-1;i>=0;i--){BU[i].life-=dt;if(BU[i].life<=0)BU.splice(i,1);}
  for(i=G.ftCount-1;i>=0;i--){var f=FT[i];f.life-=dt;f.y-=28*dt;if(f.life<=0){G.ftCount--;if(i<G.ftCount){var tf=FT[i];FT[i]=FT[G.ftCount];FT[G.ftCount]=tf;}}}

  compact();
}
function compact(){
  var n=G.eCount,bn=0;
  for(var i=n-1;i>=0;i--){if(E[i].dead){n--;if(i<n){var t=E[i];E[i]=E[n];E[n]=t;}}}
  G.eCount=n;
  for(var k=0;k<G.bosses.length;k++)if(!G.bosses[k].dead)bn++;
  G.normalN=n-bn;
}
function gainXp(v){
  v*=P.eff.xp;P.xp+=v;G.xpTotal+=v;
  while(P.xp>=P.xpN){P.xp-=P.xpN;P.lv++;P.xpN=AS.xpNeed(P.lv);G.queue.push({k:"lvl"});P.pl=Math.floor(P.pl*1.04+40);
    var nt=tierOfLv(P.lv);if(nt>P.tier){P.tier=nt;banner("Resonance "+AS.ROMAN[nt+1]+" — your aura grows",false);for(var k=0;k<20;k++){var a=k/20*TAU;addP(P.x,P.y,Math.cos(a)*260,Math.sin(a)*260,0.5,3,TIER_C[nt]);}shake(0.2);}}
}

/* ---------------- picks: level-ups, Sigil Caches, Relic Chests (one queue) ---------------- */
var offers=[],curPick=null;
function weightedPick(pool,w,n){
  var out=[];
  while(out.length<n&&pool.length){
    var tot=0,k;for(k=0;k<w.length;k++)tot+=w[k];var x=Math.random()*tot;
    for(k=0;k<w.length;k++){x-=w[k];if(x<=0)break;}if(k>=w.length)k=w.length-1;
    out.push(pool[k]);pool.splice(k,1);w.splice(k,1);
  }
  return out;
}
function rankOf(id){return G.ranks[id]||(P.sig[id]?P.sig[id].r:0);}
function nameOf(id){var x=null;AS.UPGRADES.forEach(function(u){if(u.id===id)x=u.n;});AS.SIGILS.forEach(function(s){if(s.id===id)x=s.n;});return x||id;}
function comboFor(id){for(var k=0;k<AS.EVOS.length;k++){var ev=AS.EVOS[k];if(G.evos[ev.id])continue;if(ev.a===id||ev.b===id){var o=ev.a===id?ev.b:ev.a;return {txt:"Combines with "+nameOf(o)+" → "+ev.n,ready:rankOf(o)>=1};}}return null;}
function evoReady(){for(var k=0;k<AS.EVOS.length;k++){var ev=AS.EVOS[k];if(!G.evos[ev.id]&&rankOf(ev.a)>=AS.EVO_RANK&&rankOf(ev.b)>=AS.EVO_RANK)return ev;}return null;}
function applyEvo(ev){
  G.evos[ev.id]=true;P.evo[ev.id]=true;P.pl=Math.floor(P.pl*1.25);
  if(ev.id==="starstorm"){P.orbit.on=true;P.orbit.cnt+=2;P.orbit.rad=66;}
  banner("EVOLUTION: "+ev.n+"!",false);S.transform();shake(0.35);N.haptic("HEAVY");
  for(var k=0;k<26;k++){var a=k/26*TAU;addP(P.x,P.y,Math.cos(a)*300,Math.sin(a)*300,0.6,3,k%2?"#fff":"#ffd040");}
}
function evoOffer(ev){return {icon:ev.i,name:ev.n,desc:ev.d+" ("+nameOf(ev.a)+" + "+nameOf(ev.b)+")",cls:"evo",tag:"EVOLUTION",tagColor:"#ffd040",tg:[ev.tg],apply:function(){applyEvo(ev);}};}
function upgradeOffer(u){var r=G.ranks[u.id]||0;return {icon:u.i,name:u.n,desc:u.d(r),rank:r,max:u.max,tg:u.tg,combo:comboFor(u.id),apply:function(){var nr=(G.ranks[u.id]||0)+1;G.ranks[u.id]=nr;u.f(P,nr);P.pl=Math.floor(P.pl*u.pl);}};}
function sigilOffer(s){var r=P.sig[s.id]?P.sig[s.id].r:0;return {icon:s.i,name:s.n,desc:s.d(r),rank:r,max:5,cls:"sig",tag:"SIGIL",tg:s.tg,combo:comboFor(s.id),apply:function(){AS.sigils.grant(s.id);P.pl=Math.floor(P.pl*1.1);}};}
function fillerOffers(out){var fi=0;while(out.length<3){var f=AS.FILLERS[fi++%AS.FILLERS.length];out.push({icon:f.i,name:f.n,desc:f.d(),filler:f.id,apply:(function(id){return function(){if(id==="mend")P.hp=Math.min(P.maxHp,P.hp+P.maxHp*0.28);else P.pl=Math.floor(P.pl*1.08);};})(f.id)});}return out;}
function rollLevel(){
  var pool=[],w=[];
  AS.UPGRADES.forEach(function(u){var r=G.ranks[u.id]||0;if(r>=u.max)return;pool.push(upgradeOffer(u));w.push(u.weapon&&r===0&&P.lv<=8?3:1);});
  AS.SIGILS.forEach(function(s){var o=P.sig[s.id];if(!o||o.r>=5)return;pool.push(sigilOffer(s));w.push(1.6);});
  var picks=weightedPick(pool,w,3);
  if(P.lv>=AS.ASC_MIN_LV&&P.lv-G.lastAscOffer>=AS.ASC_GAP&&Math.random()<AS.ASC_CHANCE){
    G.lastAscOffer=P.lv;var A=AS.ASCENSION,asc={icon:A.i,name:A.n,desc:A.d(),cls:"asc",apply:startAsc};
    if(picks.length>=3)picks[2]=asc;else picks.push(asc);
  }
  var ev=evoReady();if(ev){picks.unshift(evoOffer(ev));if(picks.length>3)picks.length=3;}
  return fillerOffers(picks);
}
function rollCache(){
  var owned=Object.keys(P.sig).length,pool=[],w=[];
  AS.SIGILS.forEach(function(s){var o=P.sig[s.id];
    if(!o){if(owned<AS.SIG_SLOTS){pool.push(sigilOffer(s));w.push(3);}}
    else if(o.r<5){pool.push(sigilOffer(s));w.push(owned<AS.SIG_SLOTS?0.6:1);}
  });
  return fillerOffers(weightedPick(pool,w,3));
}
function rollRarity(tier){var o=AS.RELIC_ODDS[tier],t=o[0]+o[1]+o[2],x=Math.random()*t;return x<o[0]?0:(x<o[0]+o[1]?1:2);}
function relicStatText(def,rar){
  var m=AS.RARITY[rar].m;
  if(def.fx)return def.t.replace("{v}",Math.round(def.v*m));
  var parts=[];for(var s in def.st){var v=def.st[s]*m,txt=AS.STAT_TXT[s];parts.push(txt.replace("{p}",Math.round(v*100)).replace("{n}",(Math.round(v*10)/10)));}
  return parts.join(", ");
}
// slot index an item would go into (bands: free one first, else the weaker band)
function slotFor(def){
  var idx=[];for(var k=0;k<AS.RELIC_SLOTS.length;k++)if(AS.RELIC_SLOTS[k]===def.slot)idx.push(k);
  for(k=0;k<idx.length;k++)if(!P.relics[idx[k]])return idx[k];
  if(idx.length===1)return idx[0];
  var a=P.relics[idx[0]],b=P.relics[idx[1]];return (b.rar<a.rar)?idx[1]:idx[0];
}
function rollRelic(tier){
  var have={};P.relics.forEach(function(it){if(it)have[it.def.id]=1;});
  var pool=AS.RELICS.filter(function(d){return !have[d.id];}).slice(),out=[],slotsUsed={};
  // prefer distinct slots
  for(var tries=0;tries<40&&out.length<3&&pool.length;tries++){
    var k=Math.floor(Math.random()*pool.length),d=pool[k];
    if(slotsUsed[d.slot]&&tries<25)continue;
    pool.splice(k,1);slotsUsed[d.slot]=1;out.push(d);
  }
  return fillerOffers(out.map(function(def){
    var rar=rollRarity(tier),si=slotFor(def),old=P.relics[si],rd=AS.RARITY[rar];
    return {icon:def.i,name:def.n,desc:relicStatText(def,rar)+(old?" (replaces "+old.def.n+")":""),cls:"relic",tag:rd.n.toUpperCase()+" "+AS.SLOT_NAMES[def.slot].toUpperCase(),tagColor:rd.c,
      apply:function(){P.relics[slotFor(def)]={def:def,rar:rar};G.relicsFound++;recalc();renderSigRow();}};
  }));
}
var TITLES={lvl:"POWER UP",cache:"SIGIL CACHE",relic:"RELIC CHEST",core:"LEGENDARY CORE"};
function rollFor(item){return item.k==="lvl"?rollLevel():item.k==="cache"?rollCache():item.k==="core"?fillerOffers(AS.world.rollCore()):rollRelic(item.tier||0);}
function renderOffers(){
  var g=$("ug");g.innerHTML="";
  $("lvlTitle").textContent=TITLES[curPick.k];$("lvlUp").className="ov pick-"+curPick.k;
  offers.forEach(function(o,idx){
    var c=document.createElement("div");c.className="uc"+(o.cls?" "+o.cls:"");if(o.tagColor&&o.cls==="relic")c.style.borderColor=o.tagColor;
    var badge="",pips="";
    if(o.tag)badge+='<span class="rk tag" style="'+(o.tagColor?"color:"+o.tagColor:"")+'">'+o.tag+'</span>';
    if(o.max){badge+=o.rank===0?'<span class="rk new">NEW</span>':'<span class="rk">RANK '+AS.ROMAN[o.rank]+' → '+AS.ROMAN[o.rank+1]+'</span>';
      if(o.max>1){pips='<div class="pips">';for(var k=0;k<o.max;k++)pips+='<div class="pip'+(k<o.rank?" f":"")+'"></div>';pips+="</div>";}}
    var extra="";
    if(o.tg)extra+='<div class="tags">'+o.tg.map(function(t){return '<span class="tagc">'+(AS.TAG_INFO[t]?AS.TAG_INFO[t].i+" ":"")+t+'</span>';}).join("")+'</div>';
    if(o.combo)extra+='<div class="combo'+(o.combo.ready?" rdy":"")+'">⚭ '+o.combo.txt+'</div>';
    c.innerHTML='<div class="ui">'+o.icon+'</div><div class="uf"><h3>'+o.name+badge+'</h3><p>'+o.desc+'</p>'+extra+pips+'</div>';
    c.onclick=function(){choose(idx);};
    g.appendChild(c);
  });
  var rb=$("reroll");rb.textContent="↻ REROLL ("+G.rerolls+" free)";rb.disabled=G.rerolls<=0;
  var more=G.queue.length;
  $("lvlSub").textContent=(curPick.k==="lvl"?"Level "+P.lv:curPick.k==="cache"?"Sigils "+Object.keys(P.sig).length+"/"+AS.SIG_SLOTS:curPick.k==="core"?"A run-defining power — choose one":"Equip one relic (lost when the run ends)")+(more>0?" • "+more+" more queued":"");
}
function openPick(){
  curPick=G.queue.shift();G.state="levelup";
  offers=rollFor(curPick);
  if(G.autoPick){choose(0);return;}
  S.lvl();N.haptic("MEDIUM");renderOffers();$("lvlUp").style.display="flex";
}
function choose(idx){
  var o=offers[idx];if(!o||G.state!=="levelup")return;
  o.apply();
  $("lvlUp").style.display="none";G.state="playing";hud(true);renderSigRow();
  if(G.queue.length)openPick();
}
$("reroll").addEventListener("click",function(){if(G.state!=="levelup"||G.rerolls<=0)return;G.rerolls--;offers=rollFor(curPick);renderOffers();});

/* ---------------- HUD (DOM writes only on change, ~10 Hz) ---------------- */
var hc={},hudAcc=0;
function setT(id,v){if(hc[id]!==v){hc[id]=v;$(id).textContent=v;}}
function setW(id,v){v=Math.round(v*10)/10;if(hc[id]!==v){hc[id]=v;$(id).style.width=v+"%";}}
function fmt(s){s=Math.max(0,Math.floor(s));var m=Math.floor(s/60),x=s%60;return m+":"+(x<10?"0":"")+x;}
function hud(){
  setW("hpF",Math.max(0,P.hp/P.maxHp*100));setW("hpG",Math.max(0,P.hp/P.maxHp*100));setT("hpT",String(Math.ceil(Math.max(0,P.hp))));
  setW("xpF",Math.min(100,P.xp/P.xpN*100));setT("xpT","LV "+P.lv);
  setT("pl","PL "+P.pl.toLocaleString()+(P.form===1?" ★":""));
  setT("kc",G.kills+" kills");
  var left=AS.RUN_LEN-G.runT;
  setT("tm",left>0?fmt(left):"BOSS");
  var isB=left<=0;if(hc.tmB!==isB){hc.tmB=isB;$("tm").classList.toggle("boss",isB);}
  var bf=G.bossFocus&&!G.bossFocus.dead?G.bossFocus:null;
  var bv=!!bf;if(hc.bossV!==bv){hc.bossV=bv;$("bossBar").style.display=bv?"block":"none";$("st").style.display=bv?"none":"block";}
  if(bf){setT("bossName",bf.boss.n.toUpperCase()+" — PHASE "+AS.ROMAN[(bf.phase||0)+1]+(bf.bInv>0?" (SHIELDED)":""));setW("bossF",Math.max(0,bf.hp/bf.max*100));setW("bossG",Math.max(0,bf.hp/bf.max*100));}
}
function buildInfo(){
  var w={},add=function(t,v){if(!t||t==="Utility")return;w[t]=(w[t]||0)+v;};
  AS.UPGRADES.forEach(function(u){var r=G.ranks[u.id]||0;if(r)add(u.tg[0],r*((u.tg[0]==="Speed"||u.tg[0]==="Guard")?0.5:1));});
  AS.SIGILS.forEach(function(s){var o=P.sig[s.id];if(o)add(s.tg[0],o.r*1.5);});
  P.relics.forEach(function(it){if(it&&AS.RELIC_TAGS[it.def.id])add(AS.RELIC_TAGS[it.def.id],1+it.rar*0.5);});
  AS.EVOS.forEach(function(ev){if(G.evos[ev.id])add(ev.tg,4);});
  var top=null,bv=0;for(var t in w)if(w[t]>bv){bv=w[t];top=t;}
  if(!top||bv<2)return {tag:null,label:"Training Rift"};
  var I=AS.TAG_INFO[top]||{i:"",n:top};return {tag:top,label:I.i+" "+I.n+" build"};
}
function renderSigRow(){
  G.build=buildInfo();setT("st",G.build.label);
  var h="";AS.SIGILS.forEach(function(s){var o=P.sig[s.id];if(o)h+='<span class="sg" style="border-color:'+s.c+'">'+s.i+'<b>'+AS.ROMAN[o.r]+'</b></span>';});
  var nr=0;P.relics.forEach(function(it){if(it)nr++;});
  if(nr)h+='<span class="sg rl">◈<b>'+nr+'</b></span>';
  if(hc.sig!==h){hc.sig=h;$("sigs").innerHTML=h;}
}
function tickHud(dt){
  hudAcc+=dt;if(hudAcc>=0.1){hudAcc=0;hud();
    setT("combo",G.combo>=10?"x"+G.combo+" COMBO":"");AS.world.hud();
    var dc=P.dash.cd>0?P.dash.cd/CB.dash.cd*100:0;dc=Math.round(dc);if(hc.dcd!==dc){hc.dcd=dc;$("dashCd").style.height=dc+"%";}
    var ch=P.chgT>0.2?Math.min(100,Math.round((P.chgT-0.2)/CB.charge.max*100)):0;if(hc.chg!==ch){hc.chg=ch;$("atkCd").style.height=ch+"%";$("atkBtn").classList.toggle("full",ch>=100);}
  }
  if(G.bannerT>0){G.bannerT-=dt;if(G.bannerT<=0)$("banner").style.opacity="0";}
}
function banner(t,warn){var b=$("banner");b.textContent=t;b.className=warn?"warn":"";void b.offsetWidth;b.className=(warn?"warn ":"")+"pop";b.style.opacity="1";G.bannerT=2.4;}

/* ---------------- run flow ---------------- */
function altarV(id){var a=null;AS.ALTAR.forEach(function(x){if(x.id===id)a=x;});return a?a.v*AS.save.rank(id):0;}
function resetP(){
  P.x=0;P.y=0;P.r=14;P.spd=195;P.xp=0;P.lv=1;P.xpN=AS.xpNeed(1);P.pl=1200;P.inv=0;
  P.form=0;P.formT=0;P.formMax=20;P.chargeT=0;P.frame=0;P.runT=0;P.lifesteal=0;P.critChance=0;P.critMult=2;P.extraLife=false;
  // permanent Resonance Altar bonuses
  P.baseMaxHp=100+altarV("vigor");P.maxHp=P.baseMaxHp;P.hp=P.maxHp;
  P.dmgM=1+altarV("potency");P.spdM=1+altarV("celerity");P.pick=1+altarV("attract");P.xpM=1+altarV("insight");
  P.blast={dmg:14,rate:0.38*(1-altarV("haste")),t:0,cnt:1,rng:300,spd:520,pierce:1};
  P.orbit={on:false,dmg:10,cnt:2,rad:52,ang:0,spd:2.6};
  P.wave={on:false,dmg:18,rate:1.8,t:0};
  P.sig={};P.relics=[null,null,null,null,null,null,null];P.rfx={};P.eff={};P.evo={};
  P.dash={t:0,cd:0,dx:1,dy:0,id:0};P.melee={t:0.5};P.chgT=0;P.fx=1;P.fy=0;P.tier=0;
  recalc();
}
function showHud(v){
  ["pl","kc","tm","st","sigs"].forEach(function(id){$(id).style.display=v?(id==="sigs"?"flex":"block"):"none";});
  $("hud").style.display=v?"flex":"none";$("mute").style.display=v?"flex":"none";$("pauseBtn").style.display=v?"flex":"none";
  $("dashBtn").style.display=v?"flex":"none";$("atkBtn").style.display=v?"flex":"none";$("combo").style.display=v?"block":"none";if(!v)$("mission").style.display="none";
  if(!v){$("bossBar").style.display="none";$("banner").style.opacity="0";}
  IN.show(v);hc={};
}
function startGame(){
  S.ensure();S.resume().then(function(){S.startMusic();}).catch(function(){});S.startMusic();
  resetP();
  for(var k=0;k<G.eCount;k++)E[k].dead=true;
  G.eCount=0;G.normalN=0;G.pCount=0;G.epCount=0;G.sCount=0;G.partCount=0;G.ftCount=0;
  G.bosses=[];G.bossFocus=null;G.kills=0;G.eliteKills=0;G.bossKills=0;G.miniKills=0;G.runT=0;G.spawnAcc=0;G.schIdx=0;G.evIdx=0;G.hpMul=1;G.spdMul=1;G.dmgMul=1;
  G.spiral=0;G.spiralAcc=0;G.spiralAng=0;G.finalSpawned=false;G.winT=0;G.queue=[];G.ranks={};G.rerolls=AS.FREE_REROLLS+altarV("resolve");G.lastAscOffer=-99;
  G.revived=false;G.doubled=false;G.motesAwarded=0;G.lsBudget=15;G.hurtFx=0;G.bannerT=0;G.loot=[];G.coffers=0;G.cachesOpened=0;G.relicsFound=0;G.shotN=0;G.echoCd=0;
  G.evos={};G.haz=[];G.bonusMotes=0;G.desBroken=0;G.missionsDone=0;G.coreDrops=0;G.pickups=0;P.hasteT=0;P.slowZ=false;AS.world.reset();G.combo=0;G.comboT=0;G.bestCombo=0;G.dmgDealt=0;G.dmgTaken=0;G.xpTotal=0;G.dashes=0;G.charges=0;G.trailT=0;G.build={tag:null,label:"Training Rift"};IN.act.dash=IN.act.up=0;IN.act.held=false;
  AS.sigils.reset();
  G.cam.x=0;G.cam.y=0;G.cam.sh=0;
  ["start","end","lvlUp","pause","altar"].forEach(function(id){$(id).style.display="none";});
  $("mute").textContent=S.isMuted()?"🔇":"🔊";
  showHud(true);IN.reset();N.hideBanner();renderSigRow();
  G.state="playing";hud(true);
  banner("Survive 5:00. Then destroy the Rift Sentinel.",false);
}
function runStats(won){return {pl:P.pl,time:Math.floor(G.runT),won:!!won,lv:P.lv,kills:G.kills,elites:G.eliteKills,minis:G.miniKills,combo:G.bestCombo};}
function showResults(won){
  var st=runStats(won),f=AS.save.record(st);
  // Aether Motes: award only what this run earned beyond what an earlier results screen (before a revive) already paid
  var total=Math.floor(AS.motesFor(st)*(1+altarV("fortune")))+G.bonusMotes,delta=Math.max(0,total-G.motesAwarded);
  G.motesAwarded=total;AS.save.addMotes(delta);
  var nb=function(x){return x?'<span class="nb">★ BEST</span>':"";};
  $("endT").textContent=won?"SURGE CLEARED":"DEFEATED";
  var evn=AS.EVOS.filter(function(ev){return G.evos[ev.id];}).map(function(ev){return ev.n;});
  var rec=f.pl||f.time||f.kills||f.lv||f.fast||f.combo;
  $("endRec").style.display=rec?"block":"none";
  var nf=function(n){return Math.round(n).toLocaleString();};
  $("endS").innerHTML=
    "<span>Time</span><b>"+fmt(st.time)+(won?nb(f.fast):nb(f.time))+"</b>"+
    "<span>Kills</span><b>"+nf(st.kills)+nb(f.kills)+"</b>"+
    "<span>Elites slain</span><b>"+G.eliteKills+"</b>"+
    "<span>Bosses slain</span><b>"+G.bossKills+" / 3</b>"+
    "<span>Level / XP</span><b>"+st.lv+nb(f.lv)+" • "+nf(G.xpTotal)+" XP</b>"+
    "<span>Damage dealt</span><b>"+nf(G.dmgDealt)+"</b>"+
    "<span>Damage taken</span><b>"+nf(G.dmgTaken)+"</b>"+
    "<span>Best combo</span><b>x"+G.bestCombo+nb(f.combo)+"</b>"+
    "<span>Build</span><b>"+(G.build&&G.build.tag?G.build.label:"—")+(evn.length?"<br><i class='evn'>"+evn.join(", ")+"</i>":"")+"</b>"+
    "<span>Power Level</span><b>"+nf(st.pl)+nb(f.pl)+"</b>"+
    "<span>Sigils / Relics</span><b>"+Object.keys(P.sig).length+" / "+G.relicsFound+"</b>"+
    "<span>Missions</span><b>"+G.missionsDone+" / "+AS.MISSION_TIMES.length+"</b>"+
    "<span>Objects broken</span><b>"+G.desBroken+"</b>"+
    "<span>Legendary</span><b>"+(AS.CORES.filter(function(c){return AS.world.cores[c.id];}).map(function(c){return c.n;}).join(", ")||"—")+"</b>";
  renderMotes();
  updateAdBtns();
  $("end").style.display="flex";showHud(false);N.showBanner();
}
function renderMotes(){$("endM").innerHTML='<span class="mote">✦</span> +'+G.motesAwarded.toLocaleString()+' Aether Motes'+(G.doubled?' <b>(doubled)</b>':'')+' • bank '+AS.save.get().motes.toLocaleString();}
function updateAdBtns(){
  var ready=N.AD.rewardReady,over=G.state==="dead"||G.state==="won";
  $("reviveBtn").style.display=(G.state==="dead"&&!G.revived&&!G.doubled&&ready)?"block":"none";
  $("doubleBtn").style.display=(over&&!G.doubled&&G.motesAwarded>0&&ready)?"block":"none";
}
function gameOver(){G.state="dead";S.stopMusic();N.haptic("HEAVY");showResults(false);}
function winRun(){G.state="won";S.stopMusic();N.haptic("HEAVY");showResults(true);}
function revivePlayer(){
  G.revived=true;
  P.hp=Math.max(1,Math.floor(P.maxHp*0.5));P.inv=2.5;G.epCount=0;
  for(var k=0;k<G.eCount;k++){var e=E[k],dx=e.x-P.x,dy=e.y-P.y,d=Math.hypot(dx,dy)||1;if(d<170&&!e.boss){e.x+=dx/d*(180-d);e.y+=dy/d*(180-d);}}
  boom(P.x,P.y,"#8affc0",18);G.cam.sh=0.4;
  $("end").style.display="none";N.hideBanner();showHud(true);renderSigRow();
  G.state="playing";if(!S.isMuted())S.startMusic();hud(true);
}
function doubleMotes(){G.doubled=true;AS.save.addMotes(G.motesAwarded);G.motesAwarded*=2;renderMotes();updateAdBtns();N.haptic("MEDIUM");}
function renderInventory(){
  var h='<div class="inv-h">SIGILS '+Object.keys(P.sig).length+'/'+AS.SIG_SLOTS+'</div>';
  var any=false;AS.SIGILS.forEach(function(s){var o=P.sig[s.id];if(o){any=true;h+='<div class="inv-r"><span class="inv-i" style="color:'+s.c+'">'+s.i+'</span>'+s.n+' <b>'+AS.ROMAN[o.r]+'</b></div>';}});
  if(!any)h+='<div class="inv-r dim">None yet — Elites drop Sigil Caches</div>';
  h+='<div class="inv-h">RELICS</div>';
  AS.RELIC_SLOTS.forEach(function(sl,k){var it=P.relics[k];
    h+='<div class="inv-r"><span class="inv-s">'+AS.SLOT_NAMES[sl]+'</span>'+(it?'<span style="color:'+AS.RARITY[it.rar].c+'">'+it.def.i+' '+it.def.n+'</span> <i>'+relicStatText(it.def,it.rar)+'</i>':'<span class="dim">—</span>')+'</div>';});
  $("pauseInv").innerHTML=h;
}
function pauseGame(){if(G.state!=="playing"&&G.state!=="levelup")return;G.prevState=G.state;G.state="paused";S.stopMusic();IN.reset();renderInventory();$("pause").style.display="flex";}
function resumeGame(){if(G.state!=="paused")return;G.state=G.prevState||"playing";if(!S.isMuted())S.startMusic();$("pause").style.display="none";}
function togglePause(){if(G.state==="paused")resumeGame();else pauseGame();}
function backToStart(){
  S.stopMusic();G.state="start";
  ["pause","end","lvlUp","altar"].forEach(function(id){$(id).style.display="none";});
  showHud(false);renderBest();$("start").style.display="flex";N.showBanner();
}
function renderBest(){
  var sv=AS.save.get(),b=sv.best,parts=[];
  if(b.pl>0)parts.push("PL "+b.pl.toLocaleString());
  if(b.fastWin>0)parts.push("Fastest clear "+fmt(b.fastWin));
  else if(b.time>0)parts.push("Survived "+fmt(b.time));
  else if(b.legacyStage>0)parts.push("Stage "+b.legacyStage+" (classic)");
  if(b.wins>0)parts.push(b.wins+(b.wins===1?" clear":" clears"));
  $("bestP").textContent=parts.length?"Best: "+parts.join(" • "):"";
  $("motesP").innerHTML='<span class="mote">✦</span> '+sv.motes.toLocaleString()+' Aether Motes';
}

/* ---------------- Resonance Altar (permanent, refundable) ---------------- */
function renderAltar(){
  var sv=AS.save.get(),h="";
  AS.ALTAR.forEach(function(a,idx){
    var r=AS.save.rank(a.id),maxed=r>=a.max,cost=maxed?0:AS.altarCost(a,r),can=!maxed&&sv.motes>=cost,pips="";
    for(var k=0;k<a.max;k++)pips+='<div class="pip'+(k<r?" f":"")+'"></div>';
    h+='<div class="ar"><div class="ui">'+a.i+'</div><div class="uf"><h3>'+a.n+' <span class="rk">'+(r?AS.ROMAN[r]:"—")+'</span></h3><p>'+a.d+' per rank</p><div class="pips">'+pips+'</div></div>'+
      '<button class="abtn" data-i="'+idx+'"'+(can?"":" disabled")+'>'+(maxed?"MAX":'✦ '+cost)+'</button></div>';
  });
  $("altarList").innerHTML=h;
  var spent=AS.save.spentTotal();
  $("altarMotes").innerHTML='<span class="mote">✦</span> '+sv.motes.toLocaleString()+' Aether Motes';
  $("refundBtn").disabled=spent<=0;$("refundBtn").textContent="REFUND ALL ("+spent.toLocaleString()+")";
}
$("altarList").addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".abtn");if(!b||b.disabled)return;var a=AS.ALTAR[+b.getAttribute("data-i")];if(AS.save.buy(a)){S.lvl();N.haptic("LIGHT");}renderAltar();});
$("altarBtn").addEventListener("click",function(){$("start").style.display="none";renderAltar();$("altar").style.display="flex";});
$("altarBack").addEventListener("click",function(){$("altar").style.display="none";renderBest();$("start").style.display="flex";});
$("refundBtn").addEventListener("click",function(){AS.save.refundAll();renderAltar();});

AS.settings={shake:(function(){try{return localStorage.getItem("as_shake")!=="0";}catch(e){return true;}})()};
function renderShake(){var t="📳 Screen shake: "+(AS.settings.shake?"ON":"OFF");$("shakeBtn").textContent=t;$("shakeBtn2").textContent=t;}
function toggleShake(){AS.settings.shake=!AS.settings.shake;try{localStorage.setItem("as_shake",AS.settings.shake?"1":"0");}catch(e){}renderShake();}
$("shakeBtn").addEventListener("click",toggleShake);$("shakeBtn2").addEventListener("click",toggleShake);renderShake();
// M5: graphics quality (HIGH = glow, outlines, parallax, bloom, grading; LOW = lean renderer at lower resolution)
var GF=AS.gfx;
function renderGfx(){var t="✨ Graphics: "+(GF.q==="high"?"HIGH":"LOW");$("gfxBtn").textContent=t;$("gfxBtn2").textContent=t;}
function toggleGfx(){GF.autoLowered=false;GF.set(GF.q==="high"?"low":"high","user");renderGfx();}
$("gfxBtn").addEventListener("click",toggleGfx);$("gfxBtn2").addEventListener("click",toggleGfx);renderGfx();
GF.listeners.push(function(q,why){renderGfx();if(why==="auto")banner("Graphics set to LOW to keep it smooth",false);});
$("go").addEventListener("click",startGame);
$("nx").addEventListener("click",function(){N.maybeInterstitial(startGame);});
$("menuBtn").addEventListener("click",backToStart);
$("pauseBtn").addEventListener("click",function(e){e.stopPropagation();pauseGame();});
$("resumeBtn").addEventListener("click",resumeGame);
$("quitBtn").addEventListener("click",backToStart);
$("mute").addEventListener("click",function(e){e.stopPropagation();var m=S.toggleMute();$("mute").textContent=m?"🔇":"🔊";if(!m&&G.state==="playing")S.startMusic();});
$("reviveBtn").addEventListener("click",function(){
  if(G.revived||G.doubled||G.state!=="dead")return;
  N.showReward().then(function(){if(G.state==="dead"&&!G.revived)revivePlayer();}).catch(function(){updateAdBtns();});
});
$("doubleBtn").addEventListener("click",function(){
  if(G.doubled||(G.state!=="dead"&&G.state!=="won"))return;
  N.showReward().then(function(){if(!G.doubled)doubleMotes();}).catch(function(){updateAdBtns();});
});

/* ---------------- main loop ---------------- */
var perf=AS.perf={on:false,cpu:[],raf:[],ents:[],max:6000,last:0};
var last=performance.now();
function loop(now){
  var dt=Math.min(0.05,Math.max(0,(now-last)/1000));
  var rafDt=now-last;last=now;
  var t0=performance.now();
  try{
    update(dt);
    if(G.state==="playing"&&G.queue.length)openPick();
    if(G.state!=="start")tickHud(dt);
    R.draw(G);
    if(perf.flush)R.flush();
  }catch(err){showErr((err&&err.message)||String(err));}
  var t1=performance.now();perf.last=t1-t0;
  if(perf.on&&perf.cpu.length<perf.max){perf.cpu.push(t1-t0);perf.raf.push(rafDt);perf.ents.push(G.eCount);}
  AS.gfx.sample(rafDt,G.state==="playing");
  requestAnimationFrame(loop);
}

AS.core={G:G,P:P,E:E,QB:QB,gridQuery:gridQuery,nearest:nearest,dmgE:dmgE,aoe:aoe,spawnPr:spawnPr,addP:addP,boom:boom,ignite:ignite,
  banner:banner,hurtPlayer:hurtPlayer,checkDeath:checkDeath,vacuum:vacuum,spawnElite:spawnElite,shake:shake,addFt:addFt};
AS.save.load();renderBest();
N.init({
  onBack:function(){
    if(G.state==="playing"||G.state==="levelup")pauseGame();
    else if(G.state==="paused")resumeGame();
    else if(G.state==="dead"||G.state==="won")backToStart();
    else if($("altar").style.display==="flex"){$("altar").style.display="none";renderBest();$("start").style.display="flex";}
    else if(G.state==="start")N.exitApp();
  },
  onBackground:function(){pauseGame();},
  onRewardReady:updateAdBtns
});
N.showBanner();
$("start").style.display="flex";
requestAnimationFrame(loop);

AS.game={G:G,dropLoot:dropLoot,start:startGame,step:function(dt){update(dt);if(G.state==="playing"&&G.queue.length)openPick();},togglePause:togglePause,pause:pauseGame,resume:resumeGame,choose:choose,spawnBoss:spawnBoss,fireEvent:fireEvent,
  update:update,hud:hud,recalc:recalc,dropLoot:dropLoot,offers:function(){return offers;},dash:tryDash,melee:doMelee,charge:doCharge,applyEvo:applyEvo,buildInfo:buildInfo,spawnElite:spawnElite,spawnType:function(key,x,y){return spawnE(AS.ETYPES[key],key,x,y);},
  _spawnRegular:function(n){var row=AS.SCHEDULE[G.schIdx||0];for(var k=0;k<n;k++)spawnRegular(row,G.schIdx||0);},
  _gameOver:gameOver,_revive:revivePlayer,_win:winRun,_backToStart:backToStart};
})(window.AS);
