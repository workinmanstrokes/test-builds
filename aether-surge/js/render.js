/* Rendering: Canvas 2D with pre-rendered sprites (no per-entity shadowBlur at runtime),
   pattern-tiled floor that scrolls with the camera, off-screen culling, cached vignette. */
(function(AS){
"use strict";
var canvas=document.getElementById("c");
var ctx=canvas.getContext("2d",{alpha:false});
var V=AS.view={W:360,H:640,dpr:1};
var vignette=null,floorTile=null,TILE=256;
var spriteDpr=0;
/* ---------- M5: graphics quality (high/low), persisted; auto-drops to low if fps sags ---------- */
var GFX=AS.gfx=(function(){
  var q="high",forced=false,m=/[?&]gfx=(high|low)/.exec(location.search||"");
  try{var s=localStorage.getItem("as_gfx");if(s==="low"||s==="high")q=s;}catch(e){}
  if(m){q=m[1];forced=true;}
  var off={},mo=/[?&]gfxoff=([a-z,]+)/.exec(location.search||"");if(mo)mo[1].split(",").forEach(function(k){off[k]=1;}); // debug: measure passes
  return {q:q,forced:forced,autoLowered:false,acc:0,n:0,warm:0,listeners:[],off:off};
})();
function hi(){return GFX.q==="high";}
GFX.set=function(q,why){
  if(q===GFX.q)return;GFX.q=q;try{localStorage.setItem("as_gfx",q);}catch(e){}
  if(AS.G)AS.G.fxQ=q==="high";
  resize();GFX.listeners.forEach(function(f){f(q,why);});
};
// called once per frame from the main loop: rafMs = frame interval, playing = in an active run
GFX.sample=function(rafMs,playing){
  if(!playing||GFX.forced||GFX.q!=="high"||GFX.autoLowered){GFX.warm=0;GFX.acc=0;GFX.n=0;return;}
  GFX.warm+=rafMs;if(GFX.warm<4000)return;           // ignore the first 4 s (JIT warm-up, spawn-in)
  GFX.acc+=rafMs;GFX.n++;
  if(GFX.acc>=3000){var fps=1000*GFX.n/GFX.acc;GFX.acc=0;GFX.n=0;
    if(fps<46){GFX.autoLowered=true;GFX.set("low","auto");}}
};

function resize(){
  var dpr=Math.min(window.devicePixelRatio||1,hi()?2:1.25);
  V.dpr=dpr;V.W=window.innerWidth||360;V.H=window.innerHeight||640;
  canvas.width=Math.floor(V.W*dpr);canvas.height=Math.floor(V.H*dpr);
  canvas.style.width=V.W+"px";canvas.style.height=V.H+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(spriteDpr!==dpr){spriteDpr=dpr;cache={};enemySprites={};bossSprites={};floorTiles={};decals={};}
  buildVignette();buildGlowLayer();
}
function mk(w,h,fn){
  var c=document.createElement("canvas");c.width=Math.max(1,Math.ceil(w*spriteDpr));c.height=Math.max(1,Math.ceil(h*spriteDpr));
  var x=c.getContext("2d");x.scale(spriteDpr,spriteDpr);fn(x);c.lw=w;c.lh=h;return c;
}
// per arena phase: floor palette, vignette tint, colour grade (multiply), ambient motes, light pools
var PH={
  calm:    {base:"#0c1322",slab:[14,21,36],crack:"rgba(5,8,16,.7)",glow:"90,170,255",rune:"150,210,255",vig:"0,4,16",va:0.46,tint:null,
            grade:null,mote:"#7ab8ff",mote2:"#bfe0ff",drift:[6,-10],light:"#2a5aa0"},
  ember:   {base:"#160c0a",slab:[30,15,11],crack:"rgba(255,110,40,.55)",glow:"255,120,40",rune:"255,190,120",vig:"30,6,0",va:0.52,tint:"rgba(255,90,30,.05)",
            grade:"rgb(255,228,205)",mote:"#ff8a30",mote2:"#ffd080",drift:[8,-34],light:"#a03a10"},
  frost:   {base:"#0d1824",slab:[22,35,52],crack:"rgba(200,240,255,.35)",glow:"140,220,255",rune:"220,250,255",vig:"0,12,28",va:0.48,tint:"rgba(120,200,255,.05)",
            grade:"rgb(215,235,255)",mote:"#dff6ff",mote2:"#a8e0ff",drift:[-14,26],light:"#3a7ab0"},
  void:    {base:"#0d0716",slab:[20,11,32],crack:"rgba(190,100,255,.45)",glow:"170,80,255",rune:"230,170,255",vig:"16,0,26",va:0.56,tint:"rgba(170,80,255,.06)",
            grade:"rgb(232,212,255)",mote:"#c080ff",mote2:"#ff9aff",drift:[0,0],light:"#6a20a8"},
  collapse:{base:"#170a0d",slab:[32,11,15],crack:"rgba(255,60,70,.6)",glow:"255,60,60",rune:"255,170,150",vig:"34,0,6",va:0.58,tint:"rgba(255,40,60,.06)",
            grade:"rgb(255,215,212)",mote:"#ff5040",mote2:"#ffb070",drift:[4,-40],light:"#a01828"}
};
var vignettes={};
function buildVignette(){
  vignettes={};for(var id in PH)vignettes[id]=null;
  vignette=vignetteFor("calm");
}
function vignetteFor(id){
  var v=vignettes[id];if(v)return v;var p=PH[id];
  v=vignettes[id]=mk(V.W,V.H,function(x){
    if(p.tint){x.fillStyle=p.tint;x.fillRect(0,0,V.W,V.H);}
    var g=x.createRadialGradient(V.W/2,V.H/2,V.H*0.26,V.W/2,V.H/2,V.H*0.74);
    g.addColorStop(0,"rgba("+p.vig+",0)");g.addColorStop(0.6,"rgba("+p.vig+","+(p.va*0.35)+")");g.addColorStop(1,"rgba("+p.vig+","+p.va+")");x.fillStyle=g;x.fillRect(0,0,V.W,V.H);
  });
  return v;
}
/* bloom-like glow layer: emissive things are re-drawn at 1/4 resolution and added back, upscaling = free blur */
var glowC=null,gctx=null,GS=0.25;
function buildGlowLayer(){
  if(!glowC){glowC=document.createElement("canvas");gctx=glowC.getContext("2d");}
  glowC.width=Math.ceil(V.W*GS);glowC.height=Math.ceil(V.H*GS);
}
// deterministic RNG for the floor
function rng(seed){var s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
var floorTiles={};
function floorFor(id){
  var t=floorTiles[id];if(t)return t;var p=PH[id];
  // Pattern canvas is in device pixels; drawn at 1:1 device scale.
  var px=Math.round(TILE*spriteDpr);
  t=floorTiles[id]=document.createElement("canvas");t.width=px;t.height=px;
  var x=t.getContext("2d");x.scale(spriteDpr,spriteDpr);
  var R=rng(1337),S=p.slab,k,i;
  x.fillStyle=p.base;x.fillRect(0,0,TILE,TILE);
  // stone slabs, 4x4 per tile with tone variation + bevel
  for(var gy=0;gy<4;gy++)for(var gx=0;gx<4;gx++){
    var v=Math.floor(R()*10);x.fillStyle="rgb("+(S[0]+v)+","+(S[1]+v)+","+(S[2]+v)+")";
    x.fillRect(gx*64+1,gy*64+1,62,62);
    x.fillStyle="rgba(255,255,255,.035)";x.fillRect(gx*64+1,gy*64+1,62,2);x.fillRect(gx*64+1,gy*64+1,2,62);
    x.fillStyle="rgba(0,0,0,.18)";x.fillRect(gx*64+1,gy*64+61,62,2);x.fillRect(gx*64+61,gy*64+1,2,62);
    for(k=0;k<6;k++){x.fillStyle="rgba(0,0,0,"+(0.06+R()*0.08)+")";x.fillRect(gx*64+4+R()*54,gy*64+4+R()*54,2+R()*5,1+R()*3);} // grit
  }
  x.strokeStyle="rgba(4,6,12,.9)";x.lineWidth=2;
  for(i=0;i<=4;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64,TILE);x.stroke();x.beginPath();x.moveTo(0,i*64);x.lineTo(TILE,i*64);x.stroke();}
  // cracks (glowing fissures in hazard phases)
  var glowCr=id!=="calm";
  for(var c=0;c<(glowCr?9:7);c++){var cx=R()*TILE,cy=R()*TILE,pts=[cx,cy];for(var s2=0;s2<5;s2++){cx+=(R()-0.5)*30;cy+=(R()-0.5)*30;pts.push(cx,cy);}
    if(glowCr){x.strokeStyle="rgba("+p.glow+",.18)";x.lineWidth=4;x.beginPath();x.moveTo(pts[0],pts[1]);for(k=2;k<pts.length;k+=2)x.lineTo(pts[k],pts[k+1]);x.stroke();}
    x.strokeStyle=p.crack;x.lineWidth=glowCr?1.3:1;x.beginPath();x.moveTo(pts[0],pts[1]);for(k=2;k<pts.length;k+=2)x.lineTo(pts[k],pts[k+1]);x.stroke();}
  // phase specks: frost rime / void stars / embers
  for(i=0;i<(id==="calm"?0:40);i++){x.fillStyle="rgba("+p.rune+","+(0.15+R()*0.35)+")";var sz=R()<0.15?2:1;x.fillRect(R()*TILE,R()*TILE,sz,sz);}
  // faint runes
  for(var r=0;r<5;r++){
    var rx=R()*TILE,ry=R()*TILE,rr=2+R()*3;
    var g=x.createRadialGradient(rx,ry,0,rx,ry,rr*4);g.addColorStop(0,"rgba("+p.glow+",.35)");g.addColorStop(1,"rgba("+p.glow+",0)");
    x.fillStyle=g;x.fillRect(rx-rr*4,ry-rr*4,rr*8,rr*8);
    x.fillStyle="rgba("+p.rune+",.55)";x.fillRect(rx-1,ry-1,2,2);
  }
  x.strokeStyle="rgba("+p.glow+",.12)";x.lineWidth=1.5;x.beginPath();x.arc(160,96,22,0,Math.PI*2);x.stroke();
  x.beginPath();x.arc(160,96,14,0,Math.PI*2);x.stroke();
  return t;
}
/* ground decals: deterministic per 300px cell, phase-specific art (rune circles, craters, crystals, vents, glyphs) */
var decals={},DC=300;
function hash2(x,y,i){var n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(i,1274126177))|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;return (n>>>0)/4294967296;}
function decalSprite(id,kind){
  var k=id+kind,s=decals[k];if(s)return s;var p=PH[id],TAU=Math.PI*2;
  s=decals[k]=mk(120,120,function(x){x.translate(60,60);var R=rng(kind*97+id.length*13);
    if(kind===0){ // rune circle
      x.strokeStyle="rgba("+p.glow+",.22)";x.lineWidth=2;x.beginPath();x.arc(0,0,46,0,TAU);x.stroke();x.lineWidth=1;x.beginPath();x.arc(0,0,36,0,TAU);x.stroke();
      for(var i=0;i<8;i++){var a=i/8*TAU;x.save();x.rotate(a);x.fillStyle="rgba("+p.rune+",.28)";x.fillRect(38,-2,6,4);x.restore();}
      x.beginPath();for(i=0;i<3;i++){var b=i/3*TAU-Math.PI/2;x.lineTo(Math.cos(b)*34,Math.sin(b)*34);}x.closePath();x.strokeStyle="rgba("+p.glow+",.16)";x.stroke();
    }else if(kind===1){ // crater / scorch
      var g=x.createRadialGradient(0,0,4,0,0,44);g.addColorStop(0,"rgba(0,0,0,.45)");g.addColorStop(0.7,"rgba(0,0,0,.2)");g.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=g;x.beginPath();x.ellipse(0,0,44,34,0,0,TAU);x.fill();
      x.strokeStyle="rgba(255,255,255,.05)";x.lineWidth=2;x.beginPath();x.ellipse(0,-2,30,22,0,Math.PI*1.1,Math.PI*1.9);x.stroke();
      if(id!=="calm"){var g2=x.createRadialGradient(0,0,0,0,0,16);g2.addColorStop(0,"rgba("+p.glow+",.5)");g2.addColorStop(1,"rgba("+p.glow+",0)");x.fillStyle=g2;x.fillRect(-16,-16,32,32);}
    }else{ // crystal / ice shard / ember rock cluster
      for(var c=0;c<4;c++){var ox=(R()-0.5)*40,oy=(R()-0.5)*26,h=10+R()*18,w=4+R()*4;
        x.fillStyle="rgba(0,0,0,.3)";x.beginPath();x.ellipse(ox+3,oy+2,w*1.4,w*0.6,0,0,TAU);x.fill();
        x.fillStyle="rgba("+p.glow+",.55)";x.beginPath();x.moveTo(ox-w,oy);x.lineTo(ox,oy-h);x.lineTo(ox+w,oy);x.lineTo(ox,oy+w*0.6);x.closePath();x.fill();
        x.fillStyle="rgba(255,255,255,.35)";x.beginPath();x.moveTo(ox-w*0.2,oy-h*0.2);x.lineTo(ox,oy-h);x.lineTo(ox+w*0.35,oy-h*0.25);x.closePath();x.fill();}
    }
  });
  return s;
}
function drawDecals(id,ox,oy,alpha){
  var W=V.W,H=V.H,x0=Math.floor((-ox-60)/DC),x1=Math.floor((-ox+W+60)/DC),y0=Math.floor((-oy-60)/DC),y1=Math.floor((-oy+H+60)/DC);
  ctx.globalAlpha=alpha;
  for(var cy=y0;cy<=y1;cy++)for(var cx=x0;cx<=x1;cx++){
    var h=hash2(cx,cy,7);if(h>0.62)continue;
    var kind=h<0.2?0:(h<0.42?1:2),s=decalSprite(id,kind),dx=cx*DC+30+hash2(cx,cy,8)*(DC-60)+ox,dy=cy*DC+30+hash2(cx,cy,9)*(DC-60)+oy;
    ctx.drawImage(s,dx-60,dy-60,120,120);
  }
  ctx.globalAlpha=1;
}
/* parallax: two depth layers of drifting motes (far = slower, near = faster than the ground) + soft light pools */
var MOTES=(function(){var R=rng(4242),a=[];for(var i=0;i<56;i++)a.push({x:R()*900,y:R()*1400,s:R(),l:i<34?0:1,ph:R()*6.3});return a;})();
function drawParallax(id,cam,gT,alpha){
  var p=PH[id],W=V.W,H=V.H,BW=900,BH=1400,i,m,f,sx,sy,spr;
  ctx.globalCompositeOperation="lighter";
  // light pools (parallax 0.8)
  spr=glow(p.light,60);
  for(i=0;i<4;i++){var lx=((i*523+217-cam.x*0.8)%1100+1100)%1100-200,ly=((i*811+90-cam.y*0.8)%1500+1500)%1500-250;
    ctx.globalAlpha=0.16*alpha;ctx.drawImage(spr,lx-130,ly-130,260,260);}
  for(i=0;i<MOTES.length;i++){m=MOTES[i];f=m.l?1.35:0.55;
    sx=((m.x-cam.x*f+p.drift[0]*gT*(m.l?1.4:0.7)+Math.sin(gT*0.7+m.ph)*10)%BW+BW)%BW-(BW-W)/2;
    sy=((m.y-cam.y*f+p.drift[1]*gT*(m.l?1.4:0.7))%BH+BH)%BH-(BH-H)/2;
    if(sx<-10||sx>W+10||sy<-10||sy>H+10)continue;
    spr=glow(m.s<0.5?p.mote:p.mote2,m.l?3:2);
    ctx.globalAlpha=alpha*(m.l?0.75:0.45)*(0.6+0.4*Math.sin(gT*2+m.ph));
    var z=m.l?1.3:0.8;ctx.drawImage(spr,sx-spr.lw*z/2,sy-spr.lh*z/2,spr.lw*z,spr.lh*z);}
  ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
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
// silhouette of a sprite canvas filled with one colour (device-pixel canvas)
function silhouette(src,col){var c=document.createElement("canvas");c.width=src.width;c.height=src.height;var x=c.getContext("2d");x.drawImage(src,0,0);x.globalCompositeOperation="source-in";x.fillStyle=col;x.fillRect(0,0,c.width,c.height);return c;}
// returns [walkA, walkB, flashA, flashB]. High quality: dark outline + coloured rim glow; flash = white silhouette with glow
function enemySprite(key,col,r,shape,scale,ring,ringC){
  var HQ=hi(),k=key+"|"+scale+"|"+(ring?1:0)+(ringC||"")+(HQ?"h":"l");var rc=ringC||col;var s=enemySprites[k];if(s)return s;
  // tight bounds: blending cost scales with sprite area, so keep transparent padding minimal
  var br=r/scale,half=(ring?br+15:Math.max(18,br+4))+(HQ?4:0);
  var S=Math.ceil(half*2*scale);
  s=[];
  for(var i=0;i<4;i++){
    (function(i){
      var flash=i>=2,leg=(i%2===0)?3.2:-3.2;
      var body=mk(S,S,function(x){x.translate(S/2,S/2+2);x.scale(scale,scale);drawShape(x,0,0,col,r/scale,shape,HQ?false:flash,leg,-leg);});
      s.push(mk(S,S,function(x){
        x.save();x.translate(S/2,S/2+2);x.scale(scale,scale);
        if(ring&&!flash){x.shadowBlur=(ringC?14:10)*spriteDpr/2;x.shadowColor=rc;x.strokeStyle=hexA(rc,ringC?0.85:0.6);x.lineWidth=ringC?3:2;x.beginPath();x.arc(0,0,r/scale+7,0,Math.PI*2);x.stroke();x.shadowBlur=0;}
        x.restore();
        if(!HQ){x.drawImage(body,0,0,S,S);return;}
        var dark=silhouette(body,"#04050a"),o=1.1;
        x.shadowColor=flash?"#ffffff":col;x.shadowBlur=(flash?10:6)*spriteDpr;x.drawImage(dark,0,0,S,S);x.shadowBlur=0;
        x.drawImage(dark,-o,0,S,S);x.drawImage(dark,o,0,S,S);x.drawImage(dark,0,-o,S,S);x.drawImage(dark,0,o,S,S);
        x.drawImage(flash?silhouette(body,"#ffffff"):body,0,0,S,S);
      }));
    })(i);
  }
  s.size=S;
  enemySprites[k]=s;return s;
}
/* ---------- M5: bespoke boss art (one-time procedural paint; runtime adds rings, core pulse, phase aura) ---------- */
var bossSprites={},TAU2=Math.PI*2;
function poly(x,pts){x.beginPath();x.moveTo(pts[0],pts[1]);for(var i=2;i<pts.length;i+=2)x.lineTo(pts[i],pts[i+1]);x.closePath();}
function lg(x,y0,y1,a,b){var g=x.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
var BOSS_ART={
  warden:function(x,f){ // Grove Warden: bark colossus with a leaf crown, root legs and a glowing heart-knot
    var sw=f?3:-3;
    x.fillStyle="#2a1c10";poly(x,[-16,14,-24+sw,30,-12+sw,28,-8,16]);x.fill();poly(x,[16,14,24-sw,30,12-sw,28,8,16]);x.fill();       // roots
    x.fillStyle=lg(x,-26,18,"#5a3e22","#2e1e10");poly(x,[-22,-14,-26,4,-18,18,18,18,26,4,22,-14,10,-24,-10,-24]);x.fill();       // trunk
    x.strokeStyle="rgba(20,10,4,.7)";x.lineWidth=1.6;for(var i=-2;i<=2;i++){x.beginPath();x.moveTo(i*7,-20);x.quadraticCurveTo(i*7+(i%2?4:-4),-2,i*6,16);x.stroke();}
    x.fillStyle="#2e7a34";x.beginPath();x.ellipse(-22,-12,10,7,-0.5,0,TAU2);x.fill();x.beginPath();x.ellipse(22,-12,10,7,0.5,0,TAU2);x.fill();   // moss shoulders
    x.fillStyle="#4a2e18";poly(x,[-26,-8,-38,4+sw,-34,10+sw,-22,2]);x.fill();poly(x,[26,-8,38,4-sw,34,10-sw,22,2]);x.fill();          // branch arms
    var cols=["#2f8a3a","#40c060","#6ae08a"];for(i=0;i<9;i++){var a=-Math.PI+i/8*Math.PI,len=14+(i%2)*7;x.fillStyle=cols[i%3];
      poly(x,[Math.cos(a)*10,-22+Math.sin(a)*6,Math.cos(a)*(10+len)-2,-26+Math.sin(a)*(6+len),Math.cos(a)*(10+len)+3,-24+Math.sin(a)*(6+len)]);x.fill();}
    x.fillStyle="#9affb0";x.shadowColor="#40ff80";x.shadowBlur=8*spriteDpr;x.beginPath();x.ellipse(-6,-14,2.6,1.8,0,0,TAU2);x.fill();x.beginPath();x.ellipse(6,-14,2.6,1.8,0,0,TAU2);x.fill();
    x.beginPath();x.arc(0,2,4.5,0,TAU2);x.fill();x.shadowBlur=0;
  },
  tyrant:function(x,f){ // Crystal Tyrant: faceted crystal titan with shoulder spires and a magenta core
    var o=f?1.5:-1.5;
    x.fillStyle="#2a1440";poly(x,[-10,16,-16,30,-6,30,-2,18]);x.fill();poly(x,[10,16,16,30,6,30,2,18]);x.fill();
    var fac=[["#5a2a8a",[-20,-12,0,-22,0,4,-16,14]],["#8a4ad0",[20,-12,0,-22,0,4,16,14]],["#3e1c66",[-16,14,0,4,16,14,0,22]]];
    fac.forEach(function(q){x.fillStyle=q[0];poly(x,q[1]);x.fill();});
    x.strokeStyle="rgba(240,200,255,.55)";x.lineWidth=1.2;poly(x,[-20,-12,0,-22,20,-12,16,14,0,22,-16,14]);x.stroke();x.beginPath();x.moveTo(0,-22);x.lineTo(0,22);x.stroke();
    x.fillStyle="#b070ff";poly(x,[-18,-10,-30+o,-36,-22,-8]);x.fill();poly(x,[18,-10,30-o,-36,22,-8]);x.fill();                  // shoulder spires
    x.fillStyle="#e0b0ff";poly(x,[-26+o,-28,-30+o,-36,-25,-22]);x.fill();poly(x,[26-o,-28,30-o,-36,25,-22]);x.fill();
    x.fillStyle="#7a3ab8";poly(x,[-30,-2,-36,10+o,-26,8]);x.fill();poly(x,[30,-2,36,10-o,26,8]);x.fill();                         // arm shards
    x.fillStyle="#c890ff";poly(x,[-8,-22,-4,-34,0,-26,4,-36,8,-22]);x.fill();                                                    // crown
    x.shadowColor="#ff60ff";x.shadowBlur=10*spriteDpr;x.fillStyle="#ffd0ff";poly(x,[0,-6,5,0,0,6,-5,0]);x.fill();
    x.fillStyle="#ff8aff";x.fillRect(-6,-17,3,2);x.fillRect(3,-17,3,2);x.shadowBlur=0;
  },
  sentinel:function(x,f){ // Rift Sentinel: armoured rift monolith with pylons, horns and a single red eye
    var o=f?2:-2;
    x.fillStyle="#1a1418";poly(x,[-14,18,-20,32,-8,32,-6,20]);x.fill();poly(x,[14,18,20,32,8,32,6,20]);x.fill();
    x.fillStyle="#2a2028";poly(x,[-40,-14+o,-30,-20+o,-26,8+o,-36,14+o]);x.fill();poly(x,[40,-14-o,30,-20-o,26,8-o,36,14-o]);x.fill();  // pylons
    x.strokeStyle="#ff5050";x.lineWidth=1.5;x.beginPath();x.moveTo(-34,-12+o);x.lineTo(-31,8+o);x.moveTo(34,-12-o);x.lineTo(31,8-o);x.stroke();
    x.fillStyle=lg(x,-30,22,"#4a3a46","#1e161c");poly(x,[-12,-30,12,-30,26,-16,26,10,12,24,-12,24,-26,10,-26,-16]);x.fill();       // octagon body
    x.strokeStyle="rgba(255,80,80,.7)";x.lineWidth=2;poly(x,[-12,-30,12,-30,26,-16,26,10,12,24,-12,24,-26,10,-26,-16]);x.stroke();
    x.strokeStyle="rgba(255,120,120,.35)";x.lineWidth=1;poly(x,[-8,-22,8,-22,18,-12,18,6,8,16,-8,16,-18,6,-18,-12]);x.stroke();
    x.fillStyle="#3a2a30";poly(x,[-12,-30,-20,-44,-6,-32]);x.fill();poly(x,[12,-30,20,-44,6,-32]);x.fill();                        // horns
    x.fillStyle="#ff6a5a";poly(x,[-18,-40,-20,-44,-15,-38]);x.fill();poly(x,[18,-40,20,-44,15,-38]);x.fill();
    x.shadowColor="#ff2020";x.shadowBlur=12*spriteDpr;x.fillStyle="#ff3a3a";x.beginPath();x.arc(0,-4,8,0,TAU2);x.fill();
    x.fillStyle="#ffe0d0";x.beginPath();x.arc(0,-4,3.2,0,TAU2);x.fill();x.shadowBlur=0;
  }
};
// returns [a, b, flashA, flashB] like enemy sprites; art authored at r=36 and scaled to the boss radius
function bossSprite(key,r){
  var k=key+"|"+Math.round(r);var s=bossSprites[k];if(s)return s;
  var sc=r/30,S=Math.ceil(116*sc);s=[];
  for(var i=0;i<4;i++)(function(i){
    var body=mk(S,S,function(x){x.translate(S/2,S/2);x.scale(sc,sc);x.fillStyle="rgba(0,0,0,.35)";x.beginPath();x.ellipse(0,30,30,8,0,0,TAU2);x.fill();BOSS_ART[key](x,i%2);});
    s.push(mk(S,S,function(x){
      var dark=silhouette(body,"#05040a");
      x.shadowColor=i>=2?"#ffffff":AS.BOSSES[key].c;x.shadowBlur=(i>=2?16:9)*spriteDpr;x.drawImage(dark,0,0,S,S);x.shadowBlur=0;
      x.drawImage(dark,-1.5,0,S,S);x.drawImage(dark,1.5,0,S,S);x.drawImage(dark,0,-1.5,S,S);x.drawImage(dark,0,1.5,S,S);
      x.drawImage(body,0,0,S,S);
      if(i>=2){x.globalAlpha=0.75;x.drawImage(silhouette(body,"#ffffff"),0,0,S,S);x.globalAlpha=1;}
    }));
  })(i);
  s.size=S;s.boss=true;bossSprites[k]=s;return s;
}
AS.render={enemySprite:enemySprite,bossSprite:bossSprite};

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
var curPh="calm",prevPh=null,fadeT=1,lastGT=0,FADE=2.2;
function drawBossFx(G,e,sx,sy,under){
  var b=e.boss,c=b.c,ph=e.phase||0,gT=G.gT,R=e.r;
  if(under){ // rotating rune rings on the ground + phase aura
    ctx.save();ctx.translate(sx,sy+R*0.55);ctx.scale(1,0.42);
    ctx.strokeStyle=c;ctx.globalAlpha=0.35+0.15*ph;ctx.lineWidth=3;ctx.setLineDash([14,10]);ctx.lineDashOffset=-gT*(40+ph*30);
    ctx.beginPath();ctx.arc(0,0,R*1.9,0,TAU2);ctx.stroke();
    ctx.lineDashOffset=gT*60;ctx.setLineDash([4,12]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,R*2.4,0,TAU2);ctx.stroke();
    ctx.setLineDash([]);ctx.restore();ctx.globalAlpha=1;
    if(hi()){var a=glow(c,Math.round(R*0.9));ctx.globalCompositeOperation="lighter";ctx.globalAlpha=0.22+0.12*ph+0.06*Math.sin(gT*5);
      ctx.drawImage(a,sx-a.lw/2,sy-a.lh/2,a.lw,a.lh);ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";}
    return;
  }
  // over: enraged sparks + shield bubble during phase-change immunity
  if(ph>0&&Math.random()<0.25*ph&&G.partCount<300)AS.core&&AS.core.addP(e.x+(Math.random()-0.5)*R*1.6,e.y+(Math.random()-0.5)*R,0,-60-Math.random()*60,0.5,2.5,c);
  if(e.bInv>0){var bs=bubbleSprite(R+14);ctx.globalAlpha=0.6+0.3*Math.sin(gT*20);ctx.drawImage(bs,sx-bs.lw/2,sy-bs.lh/2,bs.lw,bs.lh);ctx.globalAlpha=1;}
}
function drawGlowPass(G,ox,oy){
  var g=gctx,i,s,sx,sy,W=V.W,H=V.H;
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,glowC.width,glowC.height);
  g.setTransform(GS,0,0,GS,0,0);g.globalCompositeOperation="lighter";
  function put(col,r,x,y,a,z){if(x<-60||x>W+60||y<-60||y>H+60)return;var sp=glow(col,r);g.globalAlpha=a;z=z||1;g.drawImage(sp,x-sp.lw*z/2,y-sp.lh*z/2,sp.lw*z,sp.lh*z);}
  for(i=0;i<G.pCount;i++){var p=G.PR[i];put(p.col,8,p.x+ox,p.y+oy,0.7);}
  for(i=0;i<G.epCount;i++){var q=G.EP[i];put(q.col,9,q.x+ox,q.y+oy,0.9);}
  for(i=0;i<G.partCount;i+=2){var pt=G.PT[i];put(pt.c,6,pt.x+ox,pt.y+oy,pt.life/pt.max*0.8);}
  var B=AS.FX.bursts;for(i=0;i<B.length;i++){var bu=B[i];put(bu.c,16,bu.x+ox,bu.y+oy,bu.life/bu.max,bu.r/40);}
  for(i=0;i<G.eCount;i++){var e=G.E[i];if(e.dead||!(e.el||e.boss))continue;put(e.boss?e.c:(e.mod?e.mod.c:e.c),e.boss?30:16,e.x+ox,e.y+oy,e.boss?0.55+0.15*(e.phase||0):0.45,e.boss?e.r/22:1);}
  for(i=0;i<G.haz.length;i++){var Hz=G.haz[i],hp=1-Hz.t/Hz.max;if(Hz.k==="l"){var ux=Math.cos(Hz.ang),uy=Math.sin(Hz.ang);for(var k=0;k<=6;k++)put(Hz.c||"#ff5020",14,Hz.x+ux*Hz.len*k/6+ox,Hz.y+uy*Hz.len*k/6+oy,0.18+0.3*hp);}
    else put(Hz.c||"#ff5020",20,Hz.x+ox,Hz.y+oy,0.2+0.4*hp,Hz.R/40);}
  var P=G.P;put(P.form===1?"#ffe040":TIER_C[P.tier||0],18,P.x+ox,P.y+oy,0.45);
  if(AS.world){var Z=AS.world.zones;for(i=0;i<Z.length;i++){var z=Z[i];if(z.warm>0)continue;put(z.k==="ember"?"#ff6a20":z.k==="ice"?"#9ad8ff":"#a040ff",24,z.x+ox,z.y+oy,0.35*Math.min(1,z.life),z.R/48);}
    var PK=AS.world.pk;for(i=0;i<PK.length;i++)put(AS.PICKUPS[PK[i].role].c,10,PK[i].x+ox,PK[i].y+oy,0.6);}
  for(i=0;i<G.loot.length;i++)put(G.loot[i].kind==="cache"?"#7ae0ff":"#ffc040",14,G.loot[i].x+ox,G.loot[i].y+oy,0.6);
  for(i=0;i<AS.FX.novas.length;i++){var nv=AS.FX.novas[i];put(nv.c,20,nv.x+ox,nv.y+oy,0.35*nv.life/nv.max,nv.r/50);}
  g.globalAlpha=1;g.globalCompositeOperation="source-over";
  ctx.globalCompositeOperation="lighter";ctx.globalAlpha=0.85;ctx.drawImage(glowC,0,0,W,H);ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
}
// particle as a velocity-stretched additive glow streak (sparks) — one setTransform + drawImage each
function drawParticlesHQ(G,ox,oy,L,R,Tp,B){
  var d=V.dpr,spr=null,lastC=null;ctx.globalCompositeOperation="lighter";
  for(var i=0;i<G.partCount;i++){
    var pt=G.PT[i],sx=pt.x+ox,sy=pt.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    var a=pt.life/pt.max,w=pt.sz*a*3+1.5,v=Math.sqrt(pt.vx*pt.vx+pt.vy*pt.vy),len=w+v*0.045;
    if(pt.c!==lastC){lastC=pt.c;spr=glow(pt.c,4);}
    var cs=v>1?pt.vx/v:1,sn=v>1?pt.vy/v:0;
    ctx.setTransform(cs*len*d,sn*len*d,-sn*w*d,cs*w*d,sx*d,sy*d);ctx.globalAlpha=Math.min(1,a*1.4);ctx.drawImage(spr,-0.5,-0.5,1,1);
  }
  ctx.setTransform(d,0,0,d,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
}
function draw(G){
  var W=V.W,H=V.H,cam=G.cam,HQ=hi();G.fxQ=HQ;
  var shk=(AS.settings&&!AS.settings.shake)?0:cam.sh;
  var shx=shk?(Math.random()-0.5)*shk*12:0,shy=shk?(Math.random()-0.5)*shk*12:0;
  var ox=-cam.x+W/2+shx,oy=-cam.y+H/2+shy;
  var dt=Math.max(0,Math.min(0.1,G.gT-lastGT));lastGT=G.gT;
  var ph=(AS.world&&G.state!=="start"&&AS.ARENA[AS.world.arena])?AS.ARENA[AS.world.arena].id:"calm";
  if(ph!==curPh){prevPh=curPh;curPh=ph;fadeT=0;}
  if(fadeT<FADE)fadeT+=dt;var fa=Math.min(1,fadeT/FADE);
  // floor: blit the pre-rendered phase tile in device pixels; crossfade from the previous phase
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  var d=V.dpr,cw=canvas.width,ch=canvas.height;
  function tiles(t,alpha){var T=t.width,fx=((Math.round(ox*d))%T+T)%T,fy=((Math.round(oy*d))%T+T)%T;ctx.globalAlpha=alpha;
    for(var ty=fy-T;ty<ch;ty+=T)for(var tx=fx-T;tx<cw;tx+=T)ctx.drawImage(t,tx,ty);ctx.globalAlpha=1;}
  if(fa<1&&prevPh)tiles(floorFor(prevPh),1);
  tiles(floorFor(curPh),fa<1&&prevPh?fa:1);
  ctx.restore();
  var OFF=GFX.off;
  if(HQ&&!OFF.decals){if(fa<1&&prevPh)drawDecals(prevPh,ox,oy,1-fa);drawDecals(curPh,ox,oy,fa<1&&prevPh?fa:1);}

  var L=-70,R=W+70,Tp=-70,B=H+70,i,sx,sy,spr;
  if(AS.world)AS.world.drawUnder(ox,oy);
  drawUnder(G,ox,oy);
  // boss telegraphs + ground rings (under everything)
  for(i=0;i<G.bosses.length;i++){
    var b=G.bosses[i];if(b.dead)continue;sx=b.x+ox;sy=b.y+oy;
    drawBossFx(G,b,sx,sy,true);
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
  // player projectiles (sprite + additive trail ghosts)
  if(HQ)ctx.globalCompositeOperation="lighter";
  for(i=0;i<G.pCount;i++){
    var p=G.PR[i];sx=p.x+ox;sy=p.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    if(p.kind===2){ctx.globalCompositeOperation="source-over";var bl=bladeSprite();ctx.save();ctx.translate(sx,sy);ctx.rotate(p.ang);ctx.drawImage(bl,-15,-15,30,30);ctx.restore();if(HQ)ctx.globalCompositeOperation="lighter";continue;}
    spr=glow(p.col,p.r);var hw=spr.lw/2;
    if(HQ){for(var tg=3;tg>=1;tg--){var tz=1-tg*0.2;ctx.globalAlpha=0.38-tg*0.09;ctx.drawImage(spr,sx-p.vx*0.016*tg-hw*tz,sy-p.vy*0.016*tg-hw*tz,spr.lw*tz,spr.lh*tz);}}
    else{ctx.globalAlpha=0.3;ctx.drawImage(spr,sx-p.vx*0.03-hw*0.7,sy-p.vy*0.03-hw*0.7,spr.lw*0.7,spr.lh*0.7);}
    ctx.globalAlpha=1;ctx.drawImage(spr,sx-hw,sy-hw,spr.lw,spr.lh);
  }
  ctx.globalCompositeOperation="source-over";
  // enemies
  var E=G.E,n=G.eCount;
  for(i=0;i<n;i++){
    var e=E[i];if(e.dead)continue;
    sx=e.x+ox;sy=e.y+oy;
    var sz=e.spr.size,h=sz/2;
    if(sx<-h||sx>W+h||sy<-h||sy>H+h)continue;
    var fr=(Math.sin(e.runT)>0?0:1)+(e.fl>0?2:0);
    ctx.drawImage(e.spr[fr],sx-h,sy-h-2+Math.sin(e.frame)*1,sz,sz);
    if(e.boss){drawBossFx(G,e,sx,sy,false);continue;}
    if(e.shield>0||e.shields){var bs=bubbleSprite(e.r+8);ctx.globalAlpha=e.shields&&e.shield<=0?0.35:0.9;ctx.drawImage(bs,sx-bs.lw/2,sy-bs.lh/2,bs.lw,bs.lh);ctx.globalAlpha=1;}
    if(e.st===5&&e.lunge){ctx.fillStyle="#ff5050";ctx.fillRect(sx-1.5,sy-e.r-20,3,8);ctx.fillRect(sx-1.5,sy-e.r-10,3,3);}
    if(e.mod){ctx.font="bold 10px system-ui";ctx.textAlign="center";ctx.fillStyle=e.mod.c;ctx.fillText(e.mod.n.toUpperCase(),sx,sy-e.r-14);}
    if((e.el||e.tough)&&e.hp<e.max){
      var pct=e.hp/e.max,bw=e.el?30:18,yy=sy-e.r-8;
      ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(sx-bw/2,yy,bw,3);
      ctx.fillStyle=pct>0.35?"#44ff88":"#ff4455";ctx.fillRect(sx-bw/2,yy,bw*pct,3);
    }
  }
  drawPlayer(G,G.P.x+ox,G.P.y+oy);
  drawOver(G,ox,oy);
  // enemy projectiles (additive core + short trail on high)
  if(HQ)ctx.globalCompositeOperation="lighter";
  for(i=0;i<G.epCount;i++){
    var q=G.EP[i];sx=q.x+ox;sy=q.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    spr=glow(q.col,q.r);
    if(HQ){ctx.globalAlpha=0.35;ctx.drawImage(spr,sx-q.vx*0.03-spr.lw*0.4,sy-q.vy*0.03-spr.lh*0.4,spr.lw*0.8,spr.lh*0.8);ctx.globalAlpha=1;}
    ctx.drawImage(spr,sx-spr.lw/2,sy-spr.lh/2,spr.lw,spr.lh);
  }
  ctx.globalCompositeOperation="source-over";
  // death bursts: expanding shock ring + flash
  var BU=AS.FX.bursts;
  if(BU.length){ctx.lineWidth=2;
    for(i=0;i<BU.length;i++){var bu=BU[i],ba=bu.life/bu.max;if(!HQ&&bu.r<80)continue;sx=bu.x+ox;sy=bu.y+oy;if(sx<-bu.r||sx>W+bu.r||sy<-bu.r||sy>H+bu.r)continue;
      ctx.globalAlpha=ba*0.9;ctx.strokeStyle=bu.c;ctx.lineWidth=1+ba*(bu.r>80?6:3);ctx.beginPath();ctx.arc(sx,sy,bu.r*(1-ba*ba*0.85),0,TAU2);ctx.stroke();}
    ctx.globalAlpha=1;}
  // particles
  if(HQ&&!OFF.parts)drawParticlesHQ(G,ox,oy,L,R,Tp,B);
  else{for(i=0;i<G.partCount;i++){
    var pt=G.PT[i];sx=pt.x+ox;sy=pt.y+oy;if(sx<L||sx>R||sy<Tp||sy>B)continue;
    var a=pt.life/pt.max,z=pt.sz*a*2;ctx.globalAlpha=a;ctx.fillStyle=pt.c;ctx.fillRect(sx-z/2,sy-z/2,z,z);
  }
  ctx.globalAlpha=1;}
  if(HQ){if(!OFF.para)drawParallax(curPh,cam,G.gT,1);if(!OFF.glow)drawGlowPass(G,ox,oy);}
  // damage numbers
  if(G.ftCount){
    ctx.textAlign="center";var fz=-1,FS=["bold 11px system-ui","900 15px system-ui","900 21px system-ui"];
    for(i=0;i<G.ftCount;i++){var f=G.FT[i];if(f.sz!==fz){fz=f.sz;ctx.font=FS[fz];}ctx.globalAlpha=Math.min(1,f.life*2);
      if(fz){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillText(f.t,f.x+ox+1,f.y+oy+1);}ctx.fillStyle=f.c;ctx.fillText(f.t,f.x+ox,f.y+oy);}
    ctx.globalAlpha=1;
  }
  if(AS.world)AS.world.drawOver(ox,oy);
  // colour grade (multiply) per arena phase, then the phase-tinted vignette; both crossfade
  if(HQ&&!OFF.grade){var gp=PH[curPh].grade,gq=prevPh&&fa<1?PH[prevPh].grade:null;
    ctx.globalCompositeOperation="multiply";
    if(gq){ctx.globalAlpha=1-fa;ctx.fillStyle=gq;ctx.fillRect(0,0,W,H);}
    if(gp){ctx.globalAlpha=gq?fa:(prevPh&&fa<1?fa:1);ctx.fillStyle=gp;ctx.fillRect(0,0,W,H);}
    ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";}
  if(fa<1&&prevPh){ctx.globalAlpha=1-fa;ctx.drawImage(vignetteFor(prevPh),0,0,W,H);ctx.globalAlpha=fa;}
  ctx.drawImage(vignetteFor(curPh),0,0,W,H);ctx.globalAlpha=1;
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
