/* Rendering: Canvas 2D with pre-rendered sprites (no per-entity shadowBlur at runtime),
   pattern-tiled floor that scrolls with the camera, off-screen culling, cached vignette. */
(function(AS){
"use strict";
var canvas=document.getElementById("c");
var ctx=canvas.getContext("2d",{alpha:false});
var V=AS.view={W:360,H:640,dpr:1};
var vignette=null,floorTile=null,TILE=256;
var spriteDpr=0;

function resize(){
  var dpr=Math.min(window.devicePixelRatio||1,2);
  V.dpr=dpr;V.W=window.innerWidth||360;V.H=window.innerHeight||640;
  canvas.width=Math.floor(V.W*dpr);canvas.height=Math.floor(V.H*dpr);
  canvas.style.width=V.W+"px";canvas.style.height=V.H+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(spriteDpr!==dpr){spriteDpr=dpr;cache={};enemySprites={};buildFloor();}
  buildVignette();
}
function mk(w,h,fn){
  var c=document.createElement("canvas");c.width=Math.max(1,Math.ceil(w*spriteDpr));c.height=Math.max(1,Math.ceil(h*spriteDpr));
  var x=c.getContext("2d");x.scale(spriteDpr,spriteDpr);fn(x);c.lw=w;c.lh=h;return c;
}
function buildVignette(){
  vignette=mk(V.W,V.H,function(x){
    var g=x.createRadialGradient(V.W/2,V.H/2,V.H*0.28,V.W/2,V.H/2,V.H*0.72);
    g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.42)");x.fillStyle=g;x.fillRect(0,0,V.W,V.H);
  });
}
// deterministic RNG for the floor
function rng(seed){var s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function buildFloor(){
  // Pattern canvas is in device pixels; draw at 1:1 device scale, then counter-scale when filling.
  var px=Math.round(TILE*spriteDpr);
  floorTile=document.createElement("canvas");floorTile.width=px;floorTile.height=px;
  var x=floorTile.getContext("2d");x.scale(spriteDpr,spriteDpr);
  var R=rng(1337);
  x.fillStyle="#0c1322";x.fillRect(0,0,TILE,TILE);
  // stone slabs, 4x4 per tile with slight tone variation
  for(var gy=0;gy<4;gy++)for(var gx=0;gx<4;gx++){
    var v=Math.floor(R()*10);x.fillStyle="rgb("+(14+v)+","+(21+v)+","+(36+v)+")";
    x.fillRect(gx*64+1,gy*64+1,62,62);
  }
  x.strokeStyle="rgba(8,12,22,.9)";x.lineWidth=2;
  for(var i=0;i<=4;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64,TILE);x.stroke();x.beginPath();x.moveTo(0,i*64);x.lineTo(TILE,i*64);x.stroke();}
  // cracks
  x.strokeStyle="rgba(5,8,16,.7)";x.lineWidth=1;
  for(var c=0;c<7;c++){var cx=R()*TILE,cy=R()*TILE;x.beginPath();x.moveTo(cx,cy);for(var s=0;s<4;s++){cx+=(R()-0.5)*26;cy+=(R()-0.5)*26;x.lineTo(cx,cy);}x.stroke();}
  // faint aether runes
  for(var r=0;r<5;r++){
    var rx=R()*TILE,ry=R()*TILE,rr=2+R()*3;
    var g=x.createRadialGradient(rx,ry,0,rx,ry,rr*4);g.addColorStop(0,"rgba(90,170,255,.35)");g.addColorStop(1,"rgba(90,170,255,0)");
    x.fillStyle=g;x.fillRect(rx-rr*4,ry-rr*4,rr*8,rr*8);
    x.fillStyle="rgba(150,210,255,.55)";x.fillRect(rx-1,ry-1,2,2);
  }
  // one rune circle
  x.strokeStyle="rgba(80,140,255,.12)";x.lineWidth=1.5;x.beginPath();x.arc(160,96,22,0,Math.PI*2);x.stroke();
  x.beginPath();x.arc(160,96,14,0,Math.PI*2);x.stroke();
}

/* ---------- sprite caches ---------- */
var cache={};
function glow(col,r){
  var k=col+"|"+r;var s=cache[k];if(s)return s;
  var S=r*4+4;
  s=cache[k]=mk(S,S,function(x){
    var g=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
    g.addColorStop(0,"#ffffff");g.addColorStop(0.22,col);g.addColorStop(0.5,hexA(col,0.45));g.addColorStop(1,hexA(col,0));
    x.fillStyle=g;x.fillRect(0,0,S,S);
  });
  return s;
}
function hexA(h,a){var n=parseInt(h.slice(1),16);return "rgba("+(n>>16&255)+","+(n>>8&255)+","+(n&255)+","+a+")";}
var SHARD_COL=["#5ab8ff","#ffd040","#c070ff"],SHARD_R=[4,5.2,6.8];
function shardSprite(t){
  var k="shard"+t;var s=cache[k];if(s)return s;
  var r=SHARD_R[t],S=r*5,col=SHARD_COL[t];
  s=cache[k]=mk(S,S,function(x){
    var c=S/2,g=x.createRadialGradient(c,c,0,c,c,c);g.addColorStop(0,hexA(col,0.55));g.addColorStop(1,hexA(col,0));
    x.fillStyle=g;x.fillRect(0,0,S,S);
    x.fillStyle=col;x.beginPath();x.moveTo(c,c-r*1.3);x.lineTo(c+r,c);x.lineTo(c,c+r*1.3);x.lineTo(c-r,c);x.closePath();x.fill();
    x.fillStyle="rgba(255,255,255,.7)";x.beginPath();x.moveTo(c,c-r*1.1);x.lineTo(c+r*0.4,c-r*0.1);x.lineTo(c-r*0.2,c);x.closePath();x.fill();
  });
  return s;
}
// Enemy body (ported from the original procedural drawEnemy), drawn once into sprites.
function drawShape(x,sx,sy,col,r,shape,flash,legL,legR){
  var bodyC=flash?"#fff":col,skinC=flash?"#eee":"#d0b090";
  x.fillStyle="rgba(0,0,0,.28)";x.beginPath();x.ellipse(sx,sy+r*0.6,r*0.7,Math.max(2,r*0.2),0,0,Math.PI*2);x.fill();
  if(shape===5){ // Swarmer: insect wings
    x.fillStyle=flash?"rgba(255,255,255,.7)":"rgba(255,170,240,.45)";x.beginPath();x.ellipse(sx-8,sy-6,6,3,-0.5,0,Math.PI*2);x.fill();x.beginPath();x.ellipse(sx+8,sy-6,6,3,0.5,0,Math.PI*2);x.fill();}
  x.fillStyle=flash?"#ccc":"#2a2a3a";
  x.fillRect(sx-6+legL*0.25,sy+1.5,4,8);x.fillRect(sx+2+legR*0.25,sy+1.5,4,8);
  x.fillStyle=bodyC;x.shadowBlur=flash?5:2;x.shadowColor=col;
  if(shape===3){x.beginPath();x.ellipse(sx,sy-1,r*0.95,r*0.6,0,0,Math.PI*2);x.fill();}
  else if(shape===4){x.fillRect(sx-8,sy-8,16,13);}
  else if(shape===5){x.beginPath();x.moveTo(sx,sy-9);x.lineTo(sx+6,sy);x.lineTo(sx,sy+7);x.lineTo(sx-6,sy);x.closePath();x.fill();}
  else if(shape===6){x.beginPath();x.moveTo(sx-9,sy-3);x.lineTo(sx-5,sy-7);x.lineTo(sx+5,sy-7);x.lineTo(sx+9,sy-3);x.lineTo(sx+9,sy+4);x.lineTo(sx-9,sy+4);x.closePath();x.fill();x.strokeStyle="rgba(200,255,220,.5)";x.lineWidth=1.5;x.stroke();}
  else if(shape===8){x.beginPath();x.moveTo(sx-7,sy-5);x.lineTo(sx+7,sy-5);x.lineTo(sx+6,sy+4);x.lineTo(sx-6,sy+4);x.closePath();x.fill();
    // Shielder: big tower shield with a glowing rune
    x.shadowBlur=0;x.fillStyle=flash?"#fff":"#1c4a66";x.strokeStyle=flash?"#fff":"#a0f4ff";x.lineWidth=1.8;
    x.beginPath();x.moveTo(sx-12,sy-9);x.lineTo(sx-3,sy-9);x.lineTo(sx-3,sy+3);x.quadraticCurveTo(sx-7.5,sy+9,sx-12,sy+3);x.closePath();x.fill();x.stroke();
    x.fillStyle="#a0f4ff";x.fillRect(sx-8.5,sy-6,2,8);x.fillStyle=bodyC;}
  else if(shape===7){x.beginPath();x.arc(sx,sy-1,7,0,Math.PI*2);x.fill();x.strokeStyle="rgba(10,40,30,.4)";x.lineWidth=1;x.beginPath();x.moveTo(sx-7,sy-1);x.lineTo(sx+7,sy-1);x.moveTo(sx,sy-8);x.lineTo(sx,sy+6);x.stroke();}
  else{x.beginPath();x.moveTo(sx-7,sy-5);x.lineTo(sx+7,sy-5);x.lineTo(sx+6,sy+4);x.lineTo(sx-6,sy+4);x.closePath();x.fill();}
  x.shadowBlur=0;
  x.fillStyle=skinC;
  if(shape===2){
    x.fillRect(sx-10,sy-6,3,7);x.fillRect(sx+7,sy-12,3,10);
    x.shadowBlur=5;x.shadowColor=col;x.fillStyle=col;x.beginPath();x.arc(sx+9,sy-14,4,0,Math.PI*2);x.fill();x.shadowBlur=0;
  }else{x.fillRect(sx-10,sy-3,3,7);x.fillRect(sx+7,sy-3,3,7);}
  x.fillStyle=skinC;x.beginPath();x.arc(sx,sy-10,6,0,Math.PI*2);x.fill();
  x.fillStyle=flash?"#bbb":"#1a1520";
  if(shape===4){x.beginPath();x.moveTo(sx-5,sy-12);x.lineTo(sx,sy-18);x.lineTo(sx+5,sy-12);x.fill();}
  else{x.beginPath();x.arc(sx,sy-12,5.5,Math.PI,0);x.fill();}
  if(shape===3||shape===1){ // Brute horns / Chaser spikes
    x.fillStyle=flash?"#fff":(shape===3?"#e8e0c0":"#ff9a9a");var hl=shape===3?7:5;
    x.beginPath();x.moveTo(sx-5,sy-13);x.lineTo(sx-6-hl*0.6,sy-13-hl);x.lineTo(sx-2,sy-15);x.fill();
    x.beginPath();x.moveTo(sx+5,sy-13);x.lineTo(sx+6+hl*0.6,sy-13-hl);x.lineTo(sx+2,sy-15);x.fill();}
  x.fillStyle="#111";x.beginPath();x.arc(sx-2.4,sy-11,1.3,0,Math.PI*2);x.fill();x.beginPath();x.arc(sx+2.4,sy-11,1.3,0,Math.PI*2);x.fill();
}
var enemySprites={};
// returns [walkA, walkB, flashA, flashB]
function enemySprite(key,col,r,shape,scale,ring,ringC){
  var k=key+"|"+scale+"|"+(ring?1:0)+(ringC||"");var rc=ringC||col;var s=enemySprites[k];if(s)return s;
  // tight bounds: blending cost scales with sprite area, so keep transparent padding minimal
  var br=r/scale,half=ring?br+15:Math.max(18,br+4);
  var S=Math.ceil(half*2*scale);
  s=[];
  for(var i=0;i<4;i++){
    (function(i){
      var flash=i>=2,leg=(i%2===0)?3.2:-3.2;
      s.push(mk(S,S,function(x){
        x.translate(S/2,S/2+2);x.scale(scale,scale);
        if(ring&&!flash){x.shadowBlur=ringC?14:10;x.shadowColor=rc;x.strokeStyle=hexA(rc,ringC?0.85:0.6);x.lineWidth=ringC?3:2;x.beginPath();x.arc(0,0,r/scale+7,0,Math.PI*2);x.stroke();x.shadowBlur=0;}
        drawShape(x,0,0,col,r/scale,shape,flash,leg,-leg);
      }));
    })(i);
  }
  s.size=S;
  enemySprites[k]=s;return s;
}
AS.render={enemySprite:enemySprite};

/* ---------- player (single entity: procedural is fine) ---------- */
function drawPlayer(G,px,py){
  var P=G.P,joy=AS.input.joy,gT=G.gT;
  var invF=P.inv>0&&Math.floor(P.inv*9)%2===0;
  var isForm=P.form===1,isCharge=P.chargeT>0;
  var bob=Math.sin(P.frame*1.1)*1;
  var legL=Math.sin(P.runT)*5,legR=Math.sin(P.runT+Math.PI)*5;
  var armL=Math.sin(P.runT+Math.PI)*4,armR=Math.sin(P.runT)*4;
  var lean=joy.x*2.5;
  var bodyC=invF?"#fff":(isForm?"#ffb020":"#e07030"),skinC=invF?"#fff":"#e8c8a0",hairC=isForm?"#ffe866":"#1a1008",pantsC=isForm?"#3a2a10":"#2a3a6a";
  ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(px,py+14,11,4.5,0,0,Math.PI*2);ctx.fill();
  var tier=P.tier||0,tc=TIER_C[tier];
  var aura=glow(isForm||isCharge?"#ffe040":tc,isForm?16:12+tier*4);
  ctx.globalAlpha=isForm?0.75:(isCharge?0.6:0.45+tier*0.08);ctx.drawImage(aura,px+lean-aura.lw/2,py+bob-aura.lh/2,aura.lw,aura.lh);ctx.globalAlpha=1;
  if(tier>=2){ // rune ring(s) orbiting the player
    ctx.strokeStyle=tc;ctx.globalAlpha=0.55;ctx.lineWidth=1.5;ctx.setLineDash([5,7]);ctx.lineDashOffset=-gT*30;ctx.beginPath();ctx.arc(px,py+2,24,0,Math.PI*2);ctx.stroke();
    if(tier>=3){ctx.lineDashOffset=gT*40;ctx.beginPath();ctx.arc(px,py+2,31,0,Math.PI*2);ctx.stroke();var sp=glow("#ffe080",3);for(var q=0;q<3;q++){var qa=gT*2.2+q*2.094;ctx.globalAlpha=0.9;ctx.drawImage(sp,px+Math.cos(qa)*31-sp.lw/2,py+2+Math.sin(qa)*31-sp.lh/2,sp.lw,sp.lh);}}
    ctx.setLineDash([]);ctx.globalAlpha=1;}
  if(P.chgT>0.2){var cq=Math.min(1,(P.chgT-0.2)/AS.COMBAT.charge.max);ctx.strokeStyle=cq>=1?"#ffffff":"#ffe080";ctx.lineWidth=cq>=1?4:3;ctx.globalAlpha=0.9;
    ctx.beginPath();ctx.arc(px,py,20+cq*8,-Math.PI/2,-Math.PI/2+cq*Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  if(isCharge&&P.chargeT<0.25){ctx.globalAlpha=0.25*(P.chargeT/0.25);ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(px,py,32,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  ctx.fillStyle=pantsC;ctx.fillRect(px-7.5+legL*0.3+lean,py+2+bob,5,10);ctx.fillRect(px+2.5+legR*0.3+lean,py+2+bob,5,10);
  ctx.fillStyle=isForm?"#5a4010":"#1a1a2a";ctx.fillRect(px-8.5+legL*0.3+lean,py+11+bob,6,3);ctx.fillRect(px+2.5+legR*0.3+lean,py+11+bob,6,3);
  var tx=px+lean;
  ctx.fillStyle=bodyC;ctx.beginPath();ctx.moveTo(tx-9,py-5+bob);ctx.lineTo(tx+9,py-5+bob);ctx.lineTo(tx+8,py+4+bob);ctx.lineTo(tx-8,py+4+bob);ctx.closePath();ctx.fill();
  ctx.fillStyle=isForm?"#ffe040":"#d0a030";ctx.fillRect(tx-8.5,py+1+bob,17,2.5);
  ctx.fillStyle=skinC;ctx.fillRect(tx-13,py-3+bob+armL*0.3,4,9);ctx.fillRect(tx+9,py-3+bob+armR*0.3,4,9);
  ctx.beginPath();ctx.arc(tx-11,py+7+bob+armL*0.3,2.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(tx+11,py+7+bob+armR*0.3,2.8,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(tx,py-10+bob,7.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=hairC;
  var spikes=isForm?[[-7,-5],[-4,-13],[-1,-17],[1,-19],[3,-17],[6,-13],[7.5,-5],[2.5,-15],[-2.5,-16]]:[[-6,-2],[-3.5,-7],[0,-9.5],[3.5,-7],[6,-2],[1.5,-10.5],[-1.5,-9.5]];
  for(var i=0;i<spikes.length;i++){var sx=spikes[i][0],sy=spikes[i][1];ctx.beginPath();ctx.moveTo(tx+sx*0.3,py-10+bob+sy*0.2);ctx.lineTo(tx+sx,py-10+bob+sy);ctx.lineTo(tx+sx*0.5+(sx>0?1.8:-1.8),py-10+bob+sy*0.3);ctx.fill();}
  ctx.fillStyle=isForm?"#ff3020":"#111";
  ctx.beginPath();ctx.ellipse(tx-2.9,py-11+bob,1.8,1.2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(tx+2.9,py-11+bob,1.8,1.2,0,0,Math.PI*2);ctx.fill();
  if(P.orbit.on){
    var o=P.orbit,os=glow(isForm?"#ffe040":"#ffcc44",6);
    for(var j=0;j<o.cnt;j++){var a=o.ang+(j/o.cnt)*Math.PI*2;ctx.drawImage(os,px+Math.cos(a)*o.rad-os.lw/2,py+Math.sin(a)*o.rad-os.lh/2,os.lw,os.lh);}
  }
}


/* ---------- M2 sprites: loot, sigil auras, blades, sentries ---------- */
function cached(k,w,h,fn){var s=cache[k];if(s)return s;return (cache[k]=mk(w,h,fn));}
function lootSprite(kind,tier){
  return cached("loot|"+kind+tier,44,44,function(x){
    x.translate(22,24);
    if(kind==="cache"){ // rune-cut crystal cache
      x.shadowBlur=12;x.shadowColor="#7ae0ff";x.fillStyle="#123a5a";x.strokeStyle="#8fe8ff";x.lineWidth=2;
      x.beginPath();for(var k=0;k<6;k++){var a=k/6*Math.PI*2-Math.PI/2;x.lineTo(Math.cos(a)*13,Math.sin(a)*13);}x.closePath();x.fill();x.stroke();x.shadowBlur=0;
      x.fillStyle="#bff4ff";x.font="bold 13px system-ui";x.textAlign="center";x.textBaseline="middle";x.fillText("✧",0,1);
    }else{ // relic chest
      var c=tier?"#d07aff":"#ffc040";
      x.shadowBlur=12;x.shadowColor=c;x.fillStyle=tier?"#3a1a50":"#4a3010";x.strokeStyle=c;x.lineWidth=2;
      x.fillRect(-13,-8,26,17);x.strokeRect(-13,-8,26,17);x.shadowBlur=0;
      x.beginPath();x.moveTo(-13,-8);x.quadraticCurveTo(0,-19,13,-8);x.closePath();x.fillStyle=tier?"#5a2a78":"#6a4618";x.fill();x.stroke();
      x.fillStyle=c;x.fillRect(-3,-4,6,7);
    }
  });
}
function auraSprite(kind,R){
  R=Math.round(R);var S=R*2+8;
  return cached("aura|"+kind+R,S,S,function(x){
    var c=S/2;
    if(kind==="frost"){var g=x.createRadialGradient(c,c,R*0.3,c,c,R);g.addColorStop(0,"rgba(120,210,255,0)");g.addColorStop(0.8,"rgba(120,210,255,.10)");g.addColorStop(1,"rgba(160,230,255,.28)");
      x.fillStyle=g;x.beginPath();x.arc(c,c,R,0,Math.PI*2);x.fill();x.strokeStyle="rgba(180,240,255,.45)";x.lineWidth=1.5;x.setLineDash([6,8]);x.beginPath();x.arc(c,c,R-1,0,Math.PI*2);x.stroke();}
    else{x.shadowBlur=10;x.shadowColor="#ff8a30";x.strokeStyle="rgba(255,150,60,.55)";x.lineWidth=5;x.beginPath();x.arc(c,c,R-4,0,Math.PI*2);x.stroke();
      x.shadowBlur=0;x.strokeStyle="rgba(255,220,140,.6)";x.lineWidth=1.5;x.beginPath();x.arc(c,c,R-4,0,Math.PI*2);x.stroke();}
  });
}
function bladeSprite(){return cached("blade",30,30,function(x){x.translate(15,15);x.shadowBlur=8;x.shadowColor="#ff9080";x.fillStyle="#ffd0c8";
  x.beginPath();for(var k=0;k<4;k++){var a=k/4*Math.PI*2;x.lineTo(Math.cos(a)*13,Math.sin(a)*13);x.lineTo(Math.cos(a+0.4)*4,Math.sin(a+0.4)*4);}x.closePath();x.fill();x.shadowBlur=0;x.fillStyle="#8a3020";x.beginPath();x.arc(0,0,2.5,0,Math.PI*2);x.fill();});}
function sentrySprite(){return cached("sentry",30,30,function(x){x.translate(15,16);x.shadowBlur=8;x.shadowColor="#8ab8ff";x.fillStyle="#24365e";x.strokeStyle="#a0c8ff";x.lineWidth=2;
  x.beginPath();x.moveTo(0,-11);x.lineTo(10,0);x.lineTo(0,11);x.lineTo(-10,0);x.closePath();x.fill();x.stroke();x.shadowBlur=0;x.fillStyle="#d8ecff";x.beginPath();x.arc(0,0,3.5,0,Math.PI*2);x.fill();});}
function bubbleSprite(r){r=Math.max(10,Math.round(r/4)*4);return cached("bub"+r,r*2+6,r*2+6,function(x){var c=r+3;var g=x.createRadialGradient(c,c,r*0.5,c,c,r);g.addColorStop(0,"rgba(120,230,255,0)");g.addColorStop(1,"rgba(120,230,255,.32)");
  x.fillStyle=g;x.beginPath();x.arc(c,c,r,0,Math.PI*2);x.fill();x.strokeStyle="rgba(170,245,255,.8)";x.lineWidth=1.5;x.stroke();});}
var TIER_C=["#3a9fff","#4fe0ff","#b080ff","#ffd040"];
function drawUnder(G,ox,oy){
  var P=G.P,FX=AS.FX,i,sx,sy,spr,px=P.x+ox,py=P.y+oy,ar=P.eff.area||1;
  for(i=0;i<G.haz.length;i++){var H=G.haz[i],hp=1-H.t/H.max;sx=H.x+ox;sy=H.y+oy;
    if(H.k==="l"){ // line telegraph: outline lane + filling core
      ctx.save();ctx.translate(sx,sy);ctx.rotate(H.ang);ctx.globalAlpha=0.3+0.4*hp;ctx.strokeStyle=H.c;ctx.lineWidth=2;ctx.strokeRect(0,-H.w/2,H.len,H.w);
      ctx.globalAlpha=0.2+0.35*hp;ctx.fillStyle=H.c;ctx.fillRect(0,-H.w/2*hp,H.len,H.w*hp);ctx.restore();ctx.globalAlpha=1;continue;}
    ctx.globalAlpha=0.25+0.5*hp;ctx.strokeStyle=H.c||"#ff7a30";ctx.lineWidth=3;ctx.beginPath();ctx.arc(sx,sy,H.R,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=0.15+0.25*hp;ctx.fillStyle=H.c||"#ff5020";ctx.beginPath();ctx.arc(sx,sy,H.R*hp,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  if(P.sig.frost){spr=auraSprite("frost",(80+10*P.sig.frost.r)*ar);ctx.drawImage(spr,px-spr.lw/2,py-spr.lh/2,spr.lw,spr.lh);}
  if(P.sig.halo){spr=auraSprite("halo",(62+8*P.sig.halo.r)*ar*(P.evo.inferno?1.3:1));ctx.globalAlpha=0.75+0.25*Math.sin(G.gT*8);ctx.drawImage(spr,px-spr.lw/2,py-spr.lh/2,spr.lw,spr.lh);ctx.globalAlpha=1;}
  if(FX.embers.length){spr=glow("#ff7a30",9);for(i=0;i<FX.embers.length;i++){var em=FX.embers[i];ctx.globalAlpha=Math.min(1,em.life/em.max*1.5)*0.8;ctx.drawImage(spr,em.x+ox-spr.lw/2,em.y+oy-spr.lh/2,spr.lw,spr.lh);}ctx.globalAlpha=1;}
  for(i=0;i<FX.stars.length;i++){var st=FX.stars[i];if(st.hit)continue;sx=st.x+ox;sy=st.y+oy;var pr=1-st.t/st.max;
    ctx.globalAlpha=0.2+0.5*pr;ctx.strokeStyle="#ffd0ff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy,st.R,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=0.12+0.2*pr;ctx.fillStyle="#ff90ff";ctx.beginPath();ctx.arc(sx,sy,st.R*pr,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  for(i=0;i<G.loot.length;i++){var L=G.loot[i];sx=L.x+ox;sy=L.y+oy+Math.sin(L.t*3)*3;spr=lootSprite(L.kind,L.tier);ctx.drawImage(spr,sx-spr.lw/2,sy-spr.lh/2,spr.lw,spr.lh);}
}
function drawOver(G,ox,oy){
  var FX=AS.FX,i,k,a;
  for(i=0;i<FX.slashes.length;i++){var sl=FX.slashes[i];a=sl.life/sl.max;var sx2=sl.x+ox,sy2=sl.y+oy;
    ctx.globalAlpha=a;ctx.strokeStyle="#7affe0";ctx.lineWidth=10*a+2;ctx.beginPath();ctx.arc(sx2,sy2,sl.r*(0.75+0.25*(1-a)),sl.ang-1.25,sl.ang+1.25);ctx.stroke();
    ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.stroke();}
  ctx.globalAlpha=1;
  for(i=0;i<FX.sentries.length;i++){var tu=FX.sentries[i],ss=sentrySprite();ctx.globalAlpha=tu.life<1?tu.life:1;ctx.drawImage(ss,tu.x+ox-15,tu.y+oy-16,30,30);}
  ctx.globalAlpha=1;
  for(i=0;i<FX.beams.length;i++){var bm=FX.beams[i];a=bm.life/bm.max;ctx.save();ctx.translate(bm.x+ox,bm.y+oy);ctx.rotate(bm.ang);
    ctx.globalAlpha=0.35*a;ctx.fillStyle="#ffcf50";ctx.fillRect(0,-bm.w/2,bm.len,bm.w);ctx.globalAlpha=0.9*a;ctx.fillStyle="#fff6c8";ctx.fillRect(0,-bm.w/6,bm.len,bm.w/3);ctx.restore();}
  ctx.globalAlpha=1;
  if(FX.bolts.length){ctx.lineCap="round";
    for(i=0;i<FX.bolts.length;i++){var bo=FX.bolts[i],pts=bo.pts;a=bo.life/bo.max;ctx.globalAlpha=a;ctx.strokeStyle=bo.c;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(pts[0]+ox,pts[1]+oy);
      for(k=2;k<pts.length;k+=2){var mx=(pts[k-2]+pts[k])/2+(Math.random()-0.5)*14,my=(pts[k-1]+pts[k+1])/2+(Math.random()-0.5)*14;ctx.lineTo(mx+ox,my+oy);ctx.lineTo(pts[k]+ox,pts[k+1]+oy);}
      ctx.stroke();ctx.strokeStyle="#ffffff";ctx.lineWidth=1;ctx.stroke();}
    ctx.globalAlpha=1;}
  for(i=0;i<FX.novas.length;i++){var nv=FX.novas[i];a=nv.life/nv.max;ctx.globalAlpha=a;ctx.strokeStyle=nv.c;ctx.lineWidth=2+(nv.w||5)*a;ctx.beginPath();ctx.arc(nv.x+ox,nv.y+oy,nv.r*(1-a*0.7),0,Math.PI*2);ctx.stroke();}
  for(i=0;i<FX.stars.length;i++){var st=FX.stars[i];if(!st.hit)continue;a=st.life/0.25;ctx.globalAlpha=a*0.7;ctx.fillStyle="#fff0ff";ctx.beginPath();ctx.arc(st.x+ox,st.y+oy,st.R*(1.1-a*0.4),0,Math.PI*2);ctx.fill();
    ctx.fillRect(st.x+ox-2,st.y+oy-240*a,4,240*a);}
  ctx.globalAlpha=1;
}
// off-screen loot: arrow at the screen edge
function drawLootArrows(G,ox,oy){
  var W=V.W,H=V.H,cx=W/2,cy=H/2;
  for(var i=0;i<G.loot.length;i++){var L=G.loot[i],sx=L.x+ox,sy=L.y+oy;if(sx>10&&sx<W-10&&sy>10&&sy<H-10)continue;
    var ang=Math.atan2(sy-cy,sx-cx),m=Math.min((W/2-22)/Math.abs(Math.cos(ang)||1e-6),(H/2-22)/Math.abs(Math.sin(ang)||1e-6)),x=cx+Math.cos(ang)*m,y=cy+Math.sin(ang)*m;
    ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.fillStyle=L.kind==="cache"?"#8fe8ff":(L.tier?"#d07aff":"#ffc040");
    ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-6,-8);ctx.lineTo(-2,0);ctx.lineTo(-6,8);ctx.closePath();ctx.fill();ctx.restore();}
}

/* ---------- frame ---------- */
function draw(G){
  var W=V.W,H=V.H,cam=G.cam;
  var shk=(AS.settings&&!AS.settings.shake)?0:cam.sh;
  var shx=shk?(Math.random()-0.5)*shk*12:0,shy=shk?(Math.random()-0.5)*shk*12:0;
  var ox=-cam.x+W/2+shx,oy=-cam.y+H/2+shy;
  // floor: blit the pre-rendered tile in device pixels (plain opaque copies are much cheaper than a pattern fill)
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  var d=V.dpr,T=floorTile.width,cw=canvas.width,ch=canvas.height;
  var fx=((Math.round(ox*d))%T+T)%T,fy=((Math.round(oy*d))%T+T)%T;
  for(var ty=fy-T;ty<ch;ty+=T)for(var tx=fx-T;tx<cw;tx+=T)ctx.drawImage(floorTile,tx,ty);
  ctx.restore();

  var L=-70,R=W+70,Tp=-70,B=H+70,i,sx,sy,spr;
  if(AS.world)AS.world.drawUnder(ox,oy);
  drawUnder(G,ox,oy);
  // boss telegraphs (under everything)
  for(i=0;i<G.bosses.length;i++){
    var b=G.bosses[i];if(b.dead)continue;sx=b.x+ox;sy=b.y+oy;
    if(b.st===1){
      var prog=1-b.stT/b.teleDur,len=b.dashLen;
      ctx.save();ctx.translate(sx,sy);ctx.rotate(Math.atan2(b.ddy,b.ddx));
      ctx.globalAlpha=0.12+0.28*prog;ctx.fillStyle="#ff3040";ctx.fillRect(0,-b.r,len,b.r*2);
      ctx.globalAlpha=0.5+0.4*prog;ctx.fillStyle="#ff8080";ctx.fillRect(0,-b.r,len*prog,3);ctx.fillRect(0,b.r-3,len*prog,3);
      ctx.restore();ctx.globalAlpha=1;
    }else if(b.st===3){
      var p2=1-b.stT/b.teleDur;
      ctx.globalAlpha=0.25+0.5*p2;ctx.strokeStyle=b.c;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(sx,sy,b.r+8+(1-p2)*70,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
  }
  // shards
  for(i=0;i<G.sCount;i++){
    var s=G.S[i];sx=s.x+ox;sy=s.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    spr=shardSprite(s.tier);ctx.drawImage(spr,sx-spr.lw/2,sy-spr.lh/2,spr.lw,spr.lh);
  }
  // player projectiles (sprite + 2 trail ghosts)
  for(i=0;i<G.pCount;i++){
    var p=G.PR[i];sx=p.x+ox;sy=p.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    if(p.kind===2){var bl=bladeSprite();ctx.save();ctx.translate(sx,sy);ctx.rotate(p.ang);ctx.drawImage(bl,-15,-15,30,30);ctx.restore();continue;}
    spr=glow(p.col,p.r);var hw=spr.lw/2;
    ctx.globalAlpha=0.3;ctx.drawImage(spr,sx-p.vx*0.03-hw*0.7,sy-p.vy*0.03-hw*0.7,spr.lw*0.7,spr.lh*0.7);
    ctx.globalAlpha=1;ctx.drawImage(spr,sx-hw,sy-hw,spr.lw,spr.lh);
  }
  // enemies
  var E=G.E,n=G.eCount;
  for(i=0;i<n;i++){
    var e=E[i];if(e.dead)continue;
    sx=e.x+ox;sy=e.y+oy;
    var sz=e.spr.size,h=sz/2;
    if(sx<-h||sx>W+h||sy<-h||sy>H+h)continue;
    var fr=(Math.sin(e.runT)>0?0:1)+(e.fl>0?2:0);
    ctx.drawImage(e.spr[fr],sx-h,sy-h-2+Math.sin(e.frame)*1,sz,sz);
    if(e.shield>0||e.shields){var bs=bubbleSprite(e.r+8);ctx.globalAlpha=e.shields&&e.shield<=0?0.35:0.9;ctx.drawImage(bs,sx-bs.lw/2,sy-bs.lh/2,bs.lw,bs.lh);ctx.globalAlpha=1;}
    if(e.st===5&&e.lunge){ctx.fillStyle="#ff5050";ctx.fillRect(sx-1.5,sy-e.r-20,3,8);ctx.fillRect(sx-1.5,sy-e.r-10,3,3);}
    if(e.mod){ctx.font="bold 10px system-ui";ctx.textAlign="center";ctx.fillStyle=e.mod.c;ctx.fillText(e.mod.n.toUpperCase(),sx,sy-e.r-14);}
    if((e.el||e.tough)&&e.hp<e.max&&!e.boss){
      var pct=e.hp/e.max,bw=e.el?30:18,yy=sy-e.r-8;
      ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(sx-bw/2,yy,bw,3);
      ctx.fillStyle=pct>0.35?"#44ff88":"#ff4455";ctx.fillRect(sx-bw/2,yy,bw*pct,3);
    }
  }
  drawPlayer(G,G.P.x+ox,G.P.y+oy);
  drawOver(G,ox,oy);
  // enemy projectiles
  for(i=0;i<G.epCount;i++){
    var q=G.EP[i];sx=q.x+ox;sy=q.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    spr=glow(q.col,q.r);ctx.drawImage(spr,sx-spr.lw/2,sy-spr.lh/2,spr.lw,spr.lh);
  }
  // particles (squares, no paths)
  for(i=0;i<G.partCount;i++){
    var pt=G.PT[i];sx=pt.x+ox;sy=pt.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    var a=pt.life/pt.max,z=pt.sz*a*2;ctx.globalAlpha=a;ctx.fillStyle=pt.c;ctx.fillRect(sx-z/2,sy-z/2,z,z);
  }
  ctx.globalAlpha=1;
  // damage numbers
  if(G.ftCount){
    ctx.textAlign="center";var fz=-1,FS=["bold 11px system-ui","900 15px system-ui","900 21px system-ui"];
    for(i=0;i<G.ftCount;i++){var f=G.FT[i];if(f.sz!==fz){fz=f.sz;ctx.font=FS[fz];}ctx.globalAlpha=Math.min(1,f.life*2);
      if(fz){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillText(f.t,f.x+ox+1,f.y+oy+1);}ctx.fillStyle=f.c;ctx.fillText(f.t,f.x+ox,f.y+oy);}
    ctx.globalAlpha=1;
  }
  if(AS.world)AS.world.drawOver(ox,oy);
  ctx.drawImage(vignette,0,0,W,H);
  if(G.loot.length)drawLootArrows(G,ox,oy);
  if(G.P.form===1){ctx.globalAlpha=0.05;ctx.fillStyle="#ffe040";ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  if(G.P.chargeT>0){ctx.globalAlpha=0.08*G.P.chargeT;ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  if(G.hurtFx>0){ctx.globalAlpha=G.hurtFx*0.5;ctx.fillStyle="#ff2030";ctx.fillRect(0,0,W,6);ctx.fillRect(0,H-6,W,6);ctx.fillRect(0,0,6,H);ctx.fillRect(W-6,0,6,H);ctx.globalAlpha=1;}
}
AS.render.draw=draw;
// measurement aid (debug only): force the canvas to finish rasterizing this frame
AS.render.flush=function(){ctx.getImageData(0,0,1,1);};
AS.render.resize=resize;
window.addEventListener("resize",resize);
resize();
})(window.AS);
