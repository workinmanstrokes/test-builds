/* Aether Surge — M4 world: chunked obstacles + destructibles, evolving arena hazards, pickups (+ Legendary Cores),
   and in-run missions. Loaded after game.js; uses AS.core. Draws onto the same canvas (called from render.js). */
(function(AS){
"use strict";
var TAU=Math.PI*2,C=null,V=AS.view;
var ctx=document.getElementById("c").getContext("2d");
var CH=AS.WORLD.chunk,chunks={},pcx=1e9,pcy=1e9,seed=1;
var W=AS.world={obs:[],des:[],zones:[],pk:[],mission:null,arena:0,tint:null,cores:{}};
function core(){return C||(C=AS.core);}
function hash(x,y,i){var n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(i+seed,1274126177))|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;return (n>>>0)/4294967296;}
function chunk(cx,cy){
  var k=cx+","+cy,c=chunks[k];if(c)return c;
  c=chunks[k]={obs:[],des:[]};
  if(cx===0&&cy===0)return c; // spawn area stays clear
  var x0=cx*CH,y0=cy*CH,np=Math.floor(hash(cx,cy,1)*2.4),nd=Math.floor(hash(cx,cy,2)*2.2),i;
  for(i=0;i<np;i++)c.obs.push({x:x0+50+hash(cx,cy,20+i)*(CH-100),y:y0+50+hash(cx,cy,30+i)*(CH-100),r:Math.round(20+hash(cx,cy,10+i)*16),kind:hash(cx,cy,40+i)<0.6?0:1});
  for(i=0;i<nd;i++){var crate=hash(cx,cy,50+i)<0.4,d={x:x0+30+hash(cx,cy,60+i)*(CH-60),y:y0+30+hash(cx,cy,70+i)*(CH-60),r:crate?16:13,kind:crate?1:0,hp:0,max:0,dead:false,fl:0,init:false},ok=true;
    for(var j=0;j<c.obs.length;j++){var o=c.obs[j];if(Math.hypot(o.x-d.x,o.y-d.y)<o.r+d.r+10)ok=false;}
    if(ok)c.des.push(d);}
  return c;
}
function refresh(){
  var P=C.P,cx=Math.floor(P.x/CH),cy=Math.floor(P.y/CH);if(cx===pcx&&cy===pcy)return;pcx=cx;pcy=cy;
  W.obs=[];W.des=[];
  for(var y=cy-2;y<=cy+2;y++)for(var x=cx-2;x<=cx+2;x++){var c=chunk(x,y);
    for(var i=0;i<c.obs.length;i++)W.obs.push(c.obs[i]);
    for(i=0;i<c.des.length;i++){var d=c.des[i];if(d.dead)continue;if(!d.init){d.init=true;d.max=d.hp=(d.kind?70:32)*Math.max(1,C.G.hpMul);}W.des.push(d);}}
}
// circle-vs-obstacle push-out (player + enemies); slides along the pillar
function pushOut(o,rad){
  var L=W.obs;
  for(var i=0;i<L.length;i++){var b=L[i],dx=o.x-b.x,rr=b.r+rad;if(dx>rr||dx<-rr)continue;var dy=o.y-b.y;if(dy>rr||dy<-rr)continue;
    var d2=dx*dx+dy*dy;if(d2<rr*rr){var d=Math.sqrt(d2)||1,p=(rr-d)/d;o.x+=dx*p;o.y+=dy*p;}}
}
function blockEP(x,y){var L=W.obs;for(var i=0;i<L.length;i++){var b=L[i];if(b.kind)continue;var dx=x-b.x,dy=y-b.y;if(dx*dx+dy*dy<b.r*b.r)return true;}return false;}
function dmgDes(d,dmg){d.hp-=dmg;d.fl=0.08;if(d.hp<=0)breakDes(d);}
function hitDes(x,y,r,dmg){var L=W.des;for(var i=0;i<L.length;i++){var d=L[i];if(d.dead)continue;var dx=x-d.x,dy=y-d.y,rr=d.r+r;if(dx*dx+dy*dy<rr*rr){dmgDes(d,dmg);return true;}}return false;}
function aoeDes(x,y,R,dmg){var L=W.des;for(var i=0;i<L.length;i++){var d=L[i];if(d.dead)continue;var dx=x-d.x,dy=y-d.y,rr=d.r+R;if(dx*dx+dy*dy<rr*rr)dmgDes(d,dmg);}}
function breakDes(d){
  d.dead=true;core().boom(d.x,d.y,d.kind?"#d8a060":"#60e0d0",12);C.G.desBroken++;
  var m=W.mission;if(m&&m.k==="break")m.prog++;
  var role=rollRole(d.kind?1.6:1);if(role)drop(role,d.x,d.y);
  W.des=W.des.filter(function(x){return !x.dead;});
}
/* ---------- pickups ---------- */
function rollRole(luck){
  var R=AS.PICKUPS,tot=0,k,canCore=C.G.coreDrops<AS.MAX_CORES;
  if(Math.random()>0.38*luck)return null; // not every pot drops something
  for(k in R){if(k==="core"&&!canCore)continue;tot+=R[k].w;}
  var x=Math.random()*tot;for(k in R){if(k==="core"&&!canCore)continue;x-=R[k].w;if(x<=0)return k;}return "motes";
}
function drop(role,x,y){if(role==="core")C.G.coreDrops++;if(W.pk.length<30)W.pk.push({role:role,x:x,y:y,t:0});}
function collect(p){
  var G=C.G,P=C.P,R=AS.PICKUPS[p.role];
  if(p.role==="heart"){var h=P.maxHp*0.2;P.hp=Math.min(P.maxHp,P.hp+h);}
  else if(p.role==="magnet")C.vacuum();
  else if(p.role==="bomb"){C.aoe(P.x,P.y,240,160*P.eff.dmg,420,"charge");aoeDes(P.x,P.y,240,999);AS.FX.novas.push({x:P.x,y:P.y,r:240,life:0.5,max:0.5,c:"#ffb040",w:10});C.shake(0.45);}
  else if(p.role==="haste")P.hasteT=12;
  else if(p.role==="motes")G.bonusMotes+=15;
  else if(p.role==="core"){G.queue.push({k:"core"});C.banner("◆ LEGENDARY CORE ◆",false);}
  G.pickups++;C.addFt(P.x,P.y-30,R.i+" "+R.n,R.c,1);AS.sfx.lvl();AS.native.haptic("LIGHT");
}
function updatePickups(dt){
  var P=C.P,mr=70*(P.eff.pick||1);
  for(var i=W.pk.length-1;i>=0;i--){var p=W.pk[i];p.t+=dt;var dx=P.x-p.x,dy=P.y-p.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    if(d<mr){var v=Math.min(d/dt,320);p.x+=dx/d*v*dt;p.y+=dy/d*v*dt;}
    if(d<P.r+14){W.pk.splice(i,1);collect(p);}}
}
/* ---------- Legendary Cores ---------- */
function rollCore(){
  var pool=AS.CORES.filter(function(c){return !W.cores[c.id];}),out=[];
  while(out.length<3&&pool.length){var k=(Math.random()*pool.length)|0;out.push(pool.splice(k,1)[0]);}
  return out.map(function(c){return {icon:c.i,name:c.n,desc:c.d,cls:"evo core",tag:"LEGENDARY",tagColor:"#ffd040",apply:function(){applyCore(c.id);}};});
}
function applyCore(id){
  var P=C.P;W.cores[id]=true;P.pl=Math.floor(P.pl*1.3);
  if(id==="surge"){P.dmgM*=1.4;P.blast.rate*=0.83;}
  else if(id==="prism"){P.blast.cnt+=2;P.blast.pierce+=2;}
  else if(id==="phoenix"){P.baseMaxHp+=30;P.maxHp+=30;P.hp+=30;P.extraLife=true;}
  C.banner("Legendary: "+AS.CORES.filter(function(c){return c.id===id;})[0].n,false);C.shake(0.3);
}
var novaT=0,chronoT=-1;
function coreTick(dt){
  var P=C.P;
  if(W.cores.nova){novaT-=dt;if(novaT<=0){novaT=3.5;var R=170*(P.eff.area||1);C.aoe(P.x,P.y,R,60*P.eff.dmg*(P.eff.abil||1),300,"charge");aoeDes(P.x,P.y,R,200);AS.FX.novas.push({x:P.x,y:P.y,r:R,life:0.45,max:0.45,c:"#ffd040",w:8});}}
  if(chronoT>=0){chronoT-=dt;if(chronoT<0){C.aoe(P.x,P.y,100,50*P.eff.dmg,380,"dash");aoeDes(P.x,P.y,100,200);AS.FX.novas.push({x:P.x,y:P.y,r:100,life:0.3,max:0.3,c:"#9ad0ff",w:6});}}
}
/* ---------- evolving arena ---------- */
var zt=0;
function arena(dt){
  var G=C.G,A=AS.ARENA,i=W.arena;
  while(i+1<A.length&&A[i+1].t<=G.runT)i++;
  if(i!==W.arena){W.arena=i;W.tint=A[i].tint;if(A[i].n)C.banner(A[i].n,true);zt=1.5;}
  var ph=A[i];if(!ph.every)return;
  zt-=dt;if(zt<=0){zt=ph.every*(0.8+Math.random()*0.4);spawnZone(ph.id);}
}
function spawnZone(id){
  var G=C.G,P=C.P,j=AS.input.joy,a=(j.x||j.y)&&Math.random()<0.7?Math.atan2(j.y,j.x)+(Math.random()-0.5)*1.4:Math.random()*TAU,r=70+Math.random()*170;
  var x=P.x+Math.cos(a)*r,y=P.y+Math.sin(a)*r,dm=G.dmgMul;
  if(id==="ember")W.zones.push({k:"ember",x:x,y:y,R:68,warm:1.0,life:3.6,tick:0});
  else if(id==="frost"){W.zones.push({k:"ice",x:x,y:y,R:95,warm:0.6,life:6,tick:0});if(Math.random()<0.6)G.haz.push({x:P.x,y:P.y,R:46,t:0.95,max:0.95,dmg:12*dm,c:"#a8e8ff"});}
  else if(id==="void")W.zones.push({k:"void",x:x,y:y,R:85,warm:0.8,life:5,tick:0});
  else if(id==="collapse"){G.haz.push({x:P.x+j.x*60,y:P.y+j.y*60,R:62,t:1.0,max:1.0,dmg:18*dm,c:"#ff5050"});if(Math.random()<0.5)W.zones.push({k:"ember",x:x,y:y,R:68,warm:1.0,life:3.6,tick:0});}
}
function drain(d){var G=C.G,P=C.P;if(G.god||P.inv>90||d<=0)return;d*=(1-(P.eff.armor||0));P.hp-=d;G.dmgTaken+=d;G.hurtFx=Math.max(G.hurtFx,0.35);onHurt();C.checkDeath();}
function zones(dt){
  var G=C.G,P=C.P,E=C.E,QB=C.QB;P.slowZ=false;
  for(var i=W.zones.length-1;i>=0;i--){var z=W.zones[i];
    if(z.warm>0){z.warm-=dt;if(z.warm<=0&&z.k==="ember"){C.boom(z.x,z.y,"#ff7a30",12);var ex=P.x-z.x,ey=P.y-z.y;if(ex*ex+ey*ey<z.R*z.R)C.hurtPlayer(14*G.dmgMul,null);}continue;}
    z.life-=dt;if(z.life<=0){W.zones.splice(i,1);continue;}
    var dx=P.x-z.x,dy=P.y-z.y,d2=dx*dx+dy*dy,inside=d2<z.R*z.R;z.tick-=dt;
    if(z.k==="ember"){if(inside)drain(9*G.dmgMul*dt);
      if(z.tick<=0){z.tick=0.5;var n=C.gridQuery(z.x,z.y,z.R+20);for(var q=0;q<n;q++){var e=E[QB[q]];if(!e.dead&&(e.x-z.x)*(e.x-z.x)+(e.y-z.y)*(e.y-z.y)<z.R*z.R)C.ignite(e,8);}}}
    else if(z.k==="ice"){if(inside)P.slowZ=true;
      if(z.tick<=0){z.tick=0.3;var n2=C.gridQuery(z.x,z.y,z.R+20);for(var q2=0;q2<n2;q2++){var e2=E[QB[q2]];if(!e2.dead&&(e2.x-z.x)*(e2.x-z.x)+(e2.y-z.y)*(e2.y-z.y)<z.R*z.R){e2.slowT=0.4;e2.slowF=0.45;}}}}
    else if(z.k==="void"){var pr=z.R*1.8;
      if(d2<pr*pr){var d=Math.sqrt(d2)||1;P.x-=dx/d*85*dt;P.y-=dy/d*85*dt;if(d<z.R*0.4)drain(10*G.dmgMul*dt);}
      if(z.tick<=0){z.tick=0.2;var n3=C.gridQuery(z.x,z.y,pr);for(var q3=0;q3<n3;q3++){var e3=E[QB[q3]];if(e3.dead||e3.boss)continue;var fx=z.x-e3.x,fy=z.y-e3.y,fd=Math.sqrt(fx*fx+fy*fy)||1;if(fd<pr&&fd>8){e3.x+=fx/fd*18;e3.y+=fy/fd*18;}if(fd<z.R*0.4)C.dmgE(e3,6,e3.x,e3.y,null,"sigil");}}}
  }
}
/* ---------- missions ---------- */
var MK=["kill","break","elite","zone","combo","nodmg"],lastK=null;
function startMission(){
  var G=C.G,P=C.P,k;do{k=MK[(Math.random()*MK.length)|0];}while(k===lastK);lastK=k;
  var m={k:k,prog:0,n:1,t:40,idx:W.mi};
  if(k==="kill"){m.n=Math.round(50+G.runT*0.45);m.t=35;m.txt="Slay "+m.n+" foes";}
  else if(k==="break"){m.n=4;m.t=45;m.txt="Break 4 urns or crates";}
  else if(k==="elite"){var e=C.spawnElite();if(!e){k="kill";m.k="kill";m.n=60;m.t=35;m.txt="Slay 60 foes";}else{e.marked=true;m.target=e;m.t=45;m.txt="Hunt the marked "+(e.mod?e.mod.n+" ":"")+"Warlord";}}
  else if(k==="zone"){var a=Math.random()*TAU;m.x=P.x+Math.cos(a)*230;m.y=P.y+Math.sin(a)*230;m.R=72;m.n=7;m.t=40;m.txt="Hold the Aether Circle 7s";}
  else if(k==="combo"){m.n=35;m.t=35;m.txt="Reach a x35 combo";}
  else if(k==="nodmg"){m.n=18;m.t=19;m.txt="Take no damage for 18s";}
  W.mission=m;C.banner("🎯 MISSION: "+m.txt,false);AS.sfx.warn();
}
function missionTick(dt){
  var G=C.G,P=C.P,T=AS.MISSION_TIMES;
  if(!W.mission){if(W.mi<T.length&&G.runT>=T[W.mi])startMission();return;}
  var m=W.mission;m.t-=dt;
  if(m.k==="zone"){var dx=P.x-m.x,dy=P.y-m.y;if(dx*dx+dy*dy<m.R*m.R)m.prog+=dt;}
  else if(m.k==="combo")m.prog=Math.max(m.prog,G.combo);
  else if(m.k==="nodmg")m.prog+=dt;
  else if(m.k==="elite"&&m.target&&m.target.dead)m.prog=1;
  if(m.prog>=m.n)finishMission(true);else if(m.t<=0)finishMission(false);
}
function finishMission(ok){
  var G=C.G,P=C.P,m=W.mission;W.mission=null;W.mi++;
  if(m.target)m.target.marked=false;
  if(!ok){C.banner("Mission failed",true);return;}
  G.missionsDone++;G.bonusMotes+=20;
  var x=P.x+40,y=P.y-40;
  if(m.idx===0)AS.game.dropLoot("cache",x,y,0);
  else if(m.idx===1)AS.game.dropLoot("chest",x,y,1);
  else{if(G.coreDrops<AS.MAX_CORES&&Math.random()<0.35)drop("core",x,y);else AS.game.dropLoot("chest",x,y,1);}
  C.banner("✔ Mission complete! Reward dropped",false);AS.sfx.clear();AS.native.haptic("MEDIUM");
}
function onKill(e){
  var m=W.mission;if(m&&m.k==="kill")m.prog++;
  if(e.boss&&!e.boss.final&&C.G.coreDrops<AS.MAX_CORES&&Math.random()<0.2)drop("core",e.x+30,e.y+30);
  else if(e.el&&!e.boss){var r=rollRole(2);if(r&&r!=="core")drop(r,e.x-30,e.y);}
  else if(!e.el&&Math.random()<0.002)drop("heart",e.x,e.y);
}
function onHurt(){var m=W.mission;if(m&&m.k==="nodmg"){m.t=0;m.prog=0;}}
function onDash(){if(W.cores.chrono)chronoT=AS.COMBAT.dash.dur;}
function fmtT(s){s=Math.max(0,Math.ceil(s));return "0:"+(s<10?"0":"")+s;}
var lastHud="";
function hud(){
  var m=W.mission,t="";
  if(m){var pg=m.k==="zone"?Math.floor(m.prog)+"/"+m.n+"s":m.k==="nodmg"?Math.floor(m.prog)+"/"+m.n+"s":m.k==="elite"?"":Math.min(m.prog,m.n)+"/"+m.n;t="🎯 "+m.txt+(pg?" · "+pg:"")+" · "+fmtT(m.t);}
  if(t!==lastHud){lastHud=t;var el=document.getElementById("mission");el.textContent=t;el.style.display=t?"block":"none";}
}
/* ---------- drawing (cached sprites) ---------- */
var cache={},cdpr=0;
function mk(w,h,fn){var d=V.dpr,c=document.createElement("canvas");c.width=Math.ceil(w*d);c.height=Math.ceil(h*d);var x=c.getContext("2d");x.scale(d,d);fn(x);c.lw=w;c.lh=h;return c;}
function spr(k,w,h,fn){if(cdpr!==V.dpr){cdpr=V.dpr;cache={};}return cache[k]||(cache[k]=mk(w,h,fn));}
function obsSprite(kind,r){return spr("o"+kind+r,r*2+12,r*2+20,function(x){var c=r+6,cy=r+12;
  x.fillStyle="rgba(0,0,0,.35)";x.beginPath();x.ellipse(c,cy+r*0.55,r*1.05,r*0.45,0,0,TAU);x.fill();
  if(kind===0){x.fillStyle="#2a3550";x.beginPath();for(var i=0;i<8;i++){var a=i/8*TAU+0.39;x.lineTo(c+Math.cos(a)*r,cy+Math.sin(a)*r*0.9);}x.closePath();x.fill();
    x.fillStyle="#3c4a6c";x.beginPath();for(i=0;i<8;i++){a=i/8*TAU+0.39;x.lineTo(c+Math.cos(a)*r*0.78,cy-6+Math.sin(a)*r*0.62);}x.closePath();x.fill();
    x.strokeStyle="rgba(110,180,255,.55)";x.lineWidth=1.5;x.beginPath();x.arc(c,cy-6,r*0.32,0,TAU);x.stroke();}
  else{var cols=["#6a3aa8","#9a5ae0","#7a48c8"];for(var k=0;k<3;k++){var ox=(k-1)*r*0.5,h=r*(k===1?1.5:1.1);x.fillStyle=cols[k];x.beginPath();x.moveTo(c+ox-r*0.3,cy+r*0.4);x.lineTo(c+ox,cy+r*0.4-h);x.lineTo(c+ox+r*0.3,cy+r*0.4);x.closePath();x.fill();}
    x.fillStyle="rgba(230,200,255,.5)";x.fillRect(c-1,cy-r*0.9,2,r*0.9);}
});}
function desSprite(kind,fl){return spr("d"+kind+(fl?1:0),40,44,function(x){x.translate(20,24);
  x.fillStyle="rgba(0,0,0,.3)";x.beginPath();x.ellipse(0,12,13,4,0,0,TAU);x.fill();
  if(kind===0){x.fillStyle=fl?"#fff":"#1f6a66";x.beginPath();x.ellipse(0,0,11,12,0,0,TAU);x.fill();x.fillRect(-5,-17,10,6);x.fillStyle=fl?"#fff":"#7affe8";x.fillRect(-9,-2,18,3);x.shadowBlur=8;x.shadowColor="#7affe8";x.beginPath();x.arc(0,-17,3,0,TAU);x.fill();}
  else{x.fillStyle=fl?"#fff":"#6a4a2a";x.fillRect(-14,-12,28,24);x.strokeStyle=fl?"#fff":"#c8a060";x.lineWidth=2;x.strokeRect(-14,-12,28,24);x.fillStyle=fl?"#fff":"#9ad8ff";x.fillRect(-14,-2,28,4);x.fillRect(-2,-12,4,24);}
});}
function pkSprite(role){var R=AS.PICKUPS[role];return spr("p"+role,34,34,function(x){var g=x.createRadialGradient(17,17,2,17,17,17);g.addColorStop(0,R.c);g.addColorStop(0.45,"rgba(255,255,255,.18)");g.addColorStop(1,"rgba(0,0,0,0)");
  x.fillStyle=g;x.fillRect(0,0,34,34);x.fillStyle="#fff";x.font=(role==="core"?"bold 18px":"bold 15px")+" system-ui";x.textAlign="center";x.textBaseline="middle";x.shadowBlur=6;x.shadowColor=R.c;x.fillText(R.i,17,18);});}
function zoneSprite(k,R){return spr("z"+k+R,R*2+6,R*2+6,function(x){var c=R+3,g=x.createRadialGradient(c,c,R*0.15,c,c,R);
  var col=k==="ember"?["rgba(255,120,40,.55)","rgba(255,60,20,.12)"]:k==="ice"?["rgba(200,240,255,.35)","rgba(120,200,255,.12)"]:["rgba(40,0,60,.75)","rgba(170,80,255,.15)"];
  g.addColorStop(0,col[0]);g.addColorStop(1,col[1]);x.fillStyle=g;x.beginPath();x.arc(c,c,R,0,TAU);x.fill();
  x.strokeStyle=k==="ember"?"rgba(255,170,80,.7)":k==="ice"?"rgba(220,250,255,.7)":"rgba(200,130,255,.8)";x.lineWidth=2;x.setLineDash(k==="void"?[10,6]:[]);x.beginPath();x.arc(c,c,R-1,0,TAU);x.stroke();});}
function drawUnder(ox,oy){
  var G=C?C.G:AS.G,i,s,sx,sy,Wd=V.W,H=V.H;if(!C)return;
  for(i=0;i<W.zones.length;i++){var z=W.zones[i];sx=z.x+ox;sy=z.y+oy;if(sx<-150||sx>Wd+150||sy<-150||sy>H+150)continue;
    if(z.warm>0){ctx.globalAlpha=0.6;ctx.strokeStyle=z.k==="ember"?"#ff8040":z.k==="ice"?"#bff0ff":"#c080ff";ctx.lineWidth=2;ctx.setLineDash([6,6]);ctx.beginPath();ctx.arc(sx,sy,z.R,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;continue;}
    s=zoneSprite(z.k,z.R);ctx.globalAlpha=Math.min(1,z.life*1.5);if(z.k==="void"){ctx.save();ctx.translate(sx,sy);ctx.rotate(G.gT*1.5);ctx.drawImage(s,-s.lw/2,-s.lh/2,s.lw,s.lh);ctx.restore();}else ctx.drawImage(s,sx-s.lw/2,sy-s.lh/2,s.lw,s.lh);ctx.globalAlpha=1;}
  var m=W.mission;if(m&&m.k==="zone"){sx=m.x+ox;sy=m.y+oy;ctx.strokeStyle="#ffe566";ctx.lineWidth=3;ctx.globalAlpha=0.5+0.3*Math.sin(G.gT*5);ctx.beginPath();ctx.arc(sx,sy,m.R,0,TAU);ctx.stroke();ctx.globalAlpha=1;
    ctx.lineWidth=6;ctx.beginPath();ctx.arc(sx,sy,m.R+6,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,m.prog/m.n));ctx.stroke();}
  for(i=0;i<W.des.length;i++){var d=W.des[i];if(d.dead)continue;sx=d.x+ox;sy=d.y+oy;if(sx<-30||sx>Wd+30||sy<-30||sy>H+30)continue;if(d.fl>0)d.fl-=1/60;s=desSprite(d.kind,d.fl>0);ctx.drawImage(s,sx-20,sy-24,40,44);}
  for(i=0;i<W.obs.length;i++){var o=W.obs[i];sx=o.x+ox;sy=o.y+oy;if(sx<-60||sx>Wd+60||sy<-60||sy>H+60)continue;s=obsSprite(o.kind,o.r);ctx.drawImage(s,sx-s.lw/2,sy-o.r-12,s.lw,s.lh);}
  for(i=0;i<W.pk.length;i++){var p=W.pk[i];sx=p.x+ox;sy=p.y+oy+Math.sin(p.t*4)*3;s=pkSprite(p.role);if(p.role==="core"){ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(p.t*3));}ctx.drawImage(s,sx-17,sy-17,34,34);ctx.globalAlpha=1;}
}
function drawOver(ox,oy){
  if(!C)return;var Wd=V.W,H=V.H,m=W.mission;
  if(W.tint){ctx.fillStyle=W.tint;ctx.fillRect(0,0,Wd,H);}
  var tx=null,ty=null;
  if(m&&m.k==="zone"){tx=m.x;ty=m.y;}else if(m&&m.target&&!m.target.dead){tx=m.target.x;ty=m.target.y;ctx.font="bold 16px system-ui";ctx.textAlign="center";ctx.fillText("🎯",tx+ox,ty+oy-m.target.r-26);}
  else{for(var i=0;i<W.pk.length;i++)if(W.pk[i].role==="core"){tx=W.pk[i].x;ty=W.pk[i].y;}}
  if(tx!==null){var sx=tx+ox,sy=ty+oy;if(sx<10||sx>Wd-10||sy<10||sy>H-10){var cx=Wd/2,cy=H/2,ang=Math.atan2(sy-cy,sx-cx),mm=Math.min((Wd/2-24)/Math.abs(Math.cos(ang)||1e-6),(H/2-24)/Math.abs(Math.sin(ang)||1e-6));
    ctx.save();ctx.translate(cx+Math.cos(ang)*mm,cy+Math.sin(ang)*mm);ctx.rotate(ang);ctx.fillStyle="#ffe566";ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-7,-9);ctx.lineTo(-2,0);ctx.lineTo(-7,9);ctx.closePath();ctx.fill();ctx.restore();}}
}
W.reset=function(){core();chunks={};pcx=pcy=1e9;seed=(Math.random()*1e6)|0;W.obs=[];W.des=[];W.zones=[];W.pk=[];W.mission=null;W.mi=0;W.arena=0;W.tint=null;W.cores={};zt=0;novaT=3.5;chronoT=-1;lastK=null;lastHud="x";refresh();};
W.update=function(dt){core();refresh();arena(dt);zones(dt);updatePickups(dt);missionTick(dt);coreTick(dt);var P=C.P;if(P.hasteT>0)P.hasteT-=dt;};
W.pushOut=pushOut;W.blockEP=blockEP;W.hitDes=hitDes;W.aoeDes=aoeDes;W.rollCore=rollCore;W.onKill=onKill;W.onHurt=onHurt;W.onDash=onDash;W.hud=hud;W.drop=drop;
W.drawUnder=drawUnder;W.drawOver=drawOver;W.startMission=startMission;W.spawnZone=spawnZone;W.applyCore=applyCore;
})(window.AS);
