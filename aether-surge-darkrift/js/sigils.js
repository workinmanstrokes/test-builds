/* Aether Surge — Sigils (extra abilities from Sigil Caches) + relic behaviour hooks (embers).
   Each owned sigil: P.sig[id] = {r: rank 1-5, t: cooldown timer, ...}. Visual effects live in AS.FX (drawn by render.js). */
(function(AS){
"use strict";
var TAU=Math.PI*2;
var FX=AS.FX;
var C=null;
function core(){return C||(C=AS.core);}
function rk(s){return 1+0.25*(s.r-1);}
function pow(){var P=C.P;return P.eff.dmg*P.eff.abil;}
function cdm(){return C.P.eff.cd;}
function area(){return C.P.eff.area;}
function swapRemove(a,k){var l=a.length-1;if(k<l)a[k]=a[l];a.pop();}

// chain lightning from a first target (Arc Lattice and the Tempest Lattice evolution)
function chain(first,dmg,chains,col){
    core();var P=C.P,pts=[P.x,P.y],hit=[],cur=first,rng=150*Math.sqrt(area());
    for(var k=0;k<=chains&&cur;k++){
      pts.push(cur.x,cur.y);hit.push(cur.id);C.dmgE(cur,dmg,cur.x,cur.y,null,"sigil");
      var n=C.gridQuery(cur.x,cur.y,rng),best=null,bd=rng*rng;
      for(var q=0;q<n;q++){var e=C.E[C.QB[q]];if(e.dead||hit.indexOf(e.id)>=0)continue;var dx=e.x-cur.x,dy=e.y-cur.y,d2=dx*dx+dy*dy;if(d2<bd){bd=d2;best=e;}}
      cur=best;
    }
    if(FX.bolts.length<16)FX.bolts.push({pts:pts,life:0.18,max:0.18,c:col||"#8fd8ff"});
    AS.sfx.zap&&AS.sfx.zap();
}
function freeze(e){e.slowT=2;e.slowF=0.7;}
var ABIL={
  arc:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P,first=C.nearest(P.x,P.y,320,false);
    if(!first){s.t=0.2;return;}
    s.t=(1.5-0.06*(s.r-1))*cdm();
    chain(first,16*rk(s)*pow(),3+s.r);
  },
  motes:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P;
    if(!C.nearest(P.x,P.y,380,false)){s.t=0.2;return;}
    s.t=1.3*cdm();
    var n=1+Math.ceil(s.r/2),dmg=12*rk(s)*pow(),a0=Math.random()*TAU;
    for(var k=0;k<n;k++){var p=C.spawnPr(P.x,P.y,a0+k/n*TAU,dmg,340,2.4,"#9affd0",5,0,1);if(p){p.rt=0;p.type="sigil";}}
  },
  nova:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P;
    s.t=(3.2-0.15*(s.r-1))*cdm();
    var gl=P.evo.glacial,R=(95+12*s.r)*area()*(gl?1.25:1);
    C.aoe(P.x,P.y,R,22*rk(s)*pow(),260,"sigil",false,gl?freeze:null);
    FX.novas.push({x:P.x,y:P.y,r:R,life:0.35,max:0.35,c:gl?"#bff0ff":"#b08aff"});
    C.G.cam.sh=Math.max(C.G.cam.sh,0.1);
  },
  lance:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P,tg=C.nearest(P.x,P.y,400,true);
    if(!tg){s.t=0.2;return;}
    s.t=(2.4-0.08*(s.r-1))*cdm();
    var sun=P.evo.sunlance,len=380*area(),w=(16+2*s.r)*Math.sqrt(area())*(sun?1.5:1),a0=Math.atan2(tg.y-P.y,tg.x-P.x),dmg=34*rk(s)*pow();
    var angs=sun?[a0-0.3,a0,a0+0.3]:[a0];
    for(var ai=0;ai<angs.length;ai++){var ang=angs[ai],ux=Math.cos(ang),uy=Math.sin(ang);
    var mx=P.x+ux*len/2,my=P.y+uy*len/2,n=C.gridQuery(mx,my,len/2+w+40);
    for(var q=0;q<n;q++){var e=C.E[C.QB[q]];if(e.dead)continue;var ex=e.x-P.x,ey=e.y-P.y,t=ex*ux+ey*uy;if(t<0||t>len)continue;
      var px=ex-ux*t,py=ey-uy*t,lim=w/2+e.r;if(px*px+py*py<lim*lim)C.dmgE(e,dmg,e.x,e.y,{x:ux*80,y:uy*80},"sigil");}
    FX.beams.push({x:P.x,y:P.y,ang:ang,len:len,w:w,life:0.22,max:0.22});}
  },
  frost:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P;s.t=0.5;
    var R=(80+10*s.r)*area(),slow=0.3+0.03*s.r,dmg=5*rk(s)*pow(),n=C.gridQuery(P.x,P.y,R+40);
    for(var q=0;q<n;q++){var e=C.E[C.QB[q]];if(e.dead)continue;var dx=e.x-P.x,dy=e.y-P.y,rr=R+e.r;if(dx*dx+dy*dy<rr*rr){if(e.slowT<0.7){e.slowT=0.7;e.slowF=slow;}C.dmgE(e,dmg,e.x,e.y,null,"sigil");}}
  },
  gyre:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P,tg=C.nearest(P.x,P.y,300,false);
    if(!tg){s.t=0.2;return;}
    s.t=1.9*cdm();
    var n=1+(s.r>=3?1:0)+(s.r>=5?1:0)+(P.evo.bloodgyre?1:0),a0=Math.atan2(tg.y-P.y,tg.x-P.x),dmg=20*rk(s)*pow();
    for(var k=0;k<n;k++){var p=C.spawnPr(P.x,P.y,a0+k/n*TAU,dmg,440,3,"#ffb0a0",11,0,2);if(p)p.out=230*area();}
  },
  sentry:function(s,dt){
    var P=C.P,max=Math.ceil(s.r/2),k;
    s.t-=dt;
    if(s.t<=0){s.t=7*cdm();
      var mine=FX.sentries;if(mine.length>=max){var o=0;for(k=1;k<mine.length;k++)if(mine[k].life<mine[o].life)o=k;swapRemove(mine,o);}
      mine.push({x:P.x,y:P.y,life:6+0.6*s.r,t:0.2,ang:0});
    }
    var dmg=10*rk(s)*pow();
    for(k=FX.sentries.length-1;k>=0;k--){var tu=FX.sentries[k];tu.life-=dt;if(tu.life<=0){swapRemove(FX.sentries,k);continue;}
      tu.t-=dt;if(tu.t<=0){var tg=C.nearest(tu.x,tu.y,260,false);if(tg){tu.ang=Math.atan2(tg.y-tu.y,tg.x-tu.x);var sp=C.spawnPr(tu.x,tu.y,tu.ang,dmg,560,0.55,"#a0c8ff",4,0,0);if(sp)sp.type="sigil";tu.t=0.4;}else tu.t=0.15;}}
  },
  halo:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P;s.t=0.35;
    var inf=P.evo.inferno,R=(62+8*s.r)*area()*(inf?1.3:1),dmg=6*rk(s)*pow()*(inf?1.6:1),n=C.gridQuery(P.x,P.y,R+40);
    for(var q=0;q<n;q++){var e=C.E[C.QB[q]];if(e.dead)continue;var dx=e.x-P.x,dy=e.y-P.y,rr=R+e.r;if(dx*dx+dy*dy<rr*rr)C.dmgE(e,dmg,e.x,e.y,null,"burn");}
  },
  star:function(s,dt){
    s.t-=dt;if(s.t>0)return;var P=C.P,n=C.gridQuery(P.x,P.y,360);
    if(!n){s.t=0.2;return;}
    s.t=2.0*cdm();
    var met=P.evo.meteor,cnt=1+Math.floor(s.r/2)+(met?2:0),dmg=40*rk(s)*pow()*(met?1.4:1),R=55*area()*(met?1.3:1);
    for(var k=0;k<cnt;k++){var e=null;for(var tr=0;tr<6&&!e;tr++){var c=C.E[C.QB[(Math.random()*n)|0]];if(!c.dead)e=c;}
      if(e&&FX.stars.length<24)FX.stars.push({x:e.x,y:e.y,t:0.45,max:0.45,R:R,dmg:dmg,hit:false,life:0.25});}
  }
};

function updateFx(dt){
  var k,a;
  a=FX.bolts;for(k=a.length-1;k>=0;k--){a[k].life-=dt;if(a[k].life<=0)swapRemove(a,k);}
  a=FX.novas;for(k=a.length-1;k>=0;k--){a[k].life-=dt;if(a[k].life<=0)swapRemove(a,k);}
  a=FX.beams;for(k=a.length-1;k>=0;k--){a[k].life-=dt;if(a[k].life<=0)swapRemove(a,k);}
  a=FX.slashes;for(k=a.length-1;k>=0;k--){a[k].life-=dt;if(a[k].life<=0)swapRemove(a,k);}
  a=FX.stars;for(k=a.length-1;k>=0;k--){var st=a[k];
    if(!st.hit){st.t-=dt;if(st.t<=0){st.hit=true;C.aoe(st.x,st.y,st.R,st.dmg,160,"sigil");C.boom(st.x,st.y,"#ffd0ff",8);C.G.cam.sh=Math.max(C.G.cam.sh,0.12);}}
    else{st.life-=dt;if(st.life<=0)swapRemove(a,k);}}
}
var emberDrop=0,emberTick=0;
function embers(dt){
  var P=C.P,v=P.rfx.ember,a=FX.embers,k;
  for(k=a.length-1;k>=0;k--){a[k].life-=dt;if(a[k].life<=0)swapRemove(a,k);}
  if(!v)return;
  emberDrop-=dt;if(P.moving&&emberDrop<=0&&a.length<14){emberDrop=0.22;a.push({x:P.x,y:P.y,life:2,max:2});}
  emberTick-=dt;if(emberTick<=0){emberTick=0.5;var dmg=v*P.eff.dmg;for(k=0;k<a.length;k++)C.aoe(a[k].x,a[k].y,22,dmg,0,"burn");}
}

AS.sigils={
  reset:function(){core();var P=C.P;P.sig={};for(var k in FX)FX[k].length=0;emberDrop=emberTick=0;},
  grant:function(id){core();var P=C.P,o=P.sig[id];if(o){if(o.r<5)o.r++;}else{P.sig[id]={r:1,t:0.4};}},
  update:function(dt){
    core();var P=C.P;
    for(var id in P.sig){var f=ABIL[id];if(f)f(P.sig[id],dt);}
    updateFx(dt);embers(dt);
  },
  ABIL:ABIL,chain:chain
};
})(window.AS);
