/* Input: floating virtual joystick (appears where the thumb lands) + mouse + keyboard. */
(function(AS){
"use strict";
var JR=44,DEAD=0.12;
var joy={a:false,x:0,y:0,id:null,ox:0,oy:0};
// action state consumed by game.js: dash request (+ optional direction), attack button held / released
var act={dash:0,ddx:0,ddy:0,held:false,up:0};
var tS={t:0,x:0,y:0},lastTap={t:0,x:0,y:0};
var zone=document.getElementById("touch"),jEl=document.getElementById("joy"),jK=document.getElementById("jKnob");
function place(x,y){
  var m=64;x=Math.max(m,Math.min(window.innerWidth-m,x));y=Math.max(m+60,Math.min(window.innerHeight-m,y));
  joy.ox=x;joy.oy=y;jEl.style.left=x+"px";jEl.style.top=y+"px";
}
function rest(){jEl.style.left="";jEl.style.top="";jEl.classList.remove("on");jK.style.transform="translate(0,0)";}
function move(cx,cy){
  var dx=cx-joy.ox,dy=cy-joy.oy,d=Math.hypot(dx,dy);
  if(d>JR){dx=dx/d*JR;dy=dy/d*JR;d=JR;}
  var n=d/JR;
  if(n<DEAD){joy.x=0;joy.y=0;}else{var k=(n-DEAD)/(1-DEAD)/n;joy.x=dx/JR*k;joy.y=dy/JR*k;}
  jK.style.transform="translate("+dx+"px,"+dy+"px)";
}
function start(id,x,y){joy.id=id;joy.a=true;place(x,y);jEl.classList.add("on");move(x,y);}
function end(){joy.a=false;joy.x=0;joy.y=0;joy.id=null;rest();}
zone.addEventListener("touchstart",function(e){
  e.preventDefault();if(joy.a&&joy.id!=="kbd")return;
  var t=e.changedTouches[0],now=performance.now();
  // double-tap = dash
  if(now-lastTap.t<300&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<70){act.dash=1;lastTap.t=0;}
  tS.t=now;tS.x=t.clientX;tS.y=t.clientY;
  start(t.identifier,t.clientX,t.clientY);
},{passive:false});
window.addEventListener("touchmove",function(e){
  e.preventDefault();if(!joy.a||joy.id==="kbd")return;
  var L=e.changedTouches;for(var i=0;i<L.length;i++){if(L[i].identifier===joy.id){move(L[i].clientX,L[i].clientY);break;}}
},{passive:false});
function tEnd(e){if(!joy.a||joy.id==="kbd")return;var L=e.changedTouches;for(var i=0;i<L.length;i++){if(L[i].identifier===joy.id){
  var now=performance.now(),dx=L[i].clientX-tS.x,dy=L[i].clientY-tS.y,d=Math.hypot(dx,dy),dt=now-tS.t;
  if(dt<220&&d>45){act.dash=1;act.ddx=dx/d;act.ddy=dy/d;}           // quick flick = dash in the swipe direction
  else if(dt<220&&d<20){lastTap.t=now;lastTap.x=tS.x;lastTap.y=tS.y;} // short tap (for double-tap)
  end();break;}}}
window.addEventListener("touchend",tEnd,{passive:false});
window.addEventListener("touchcancel",tEnd,{passive:false});
zone.addEventListener("mousedown",function(e){if(joy.a)return;start("m",e.clientX,e.clientY);});
window.addEventListener("mousemove",function(e){if(joy.a&&joy.id==="m")move(e.clientX,e.clientY);});
window.addEventListener("mouseup",function(){if(joy.a&&joy.id==="m")end();});

var keys={};
function keyJoy(){
  if(joy.id!==null&&joy.id!=="kbd")return;
  var kx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
  var ky=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
  if(kx||ky){var l=Math.hypot(kx,ky);joy.x=kx/l;joy.y=ky/l;joy.a=true;joy.id="kbd";jK.style.transform="translate("+(joy.x*JR)+"px,"+(joy.y*JR)+"px)";}
  else if(joy.id==="kbd"){joy.x=0;joy.y=0;joy.a=false;joy.id=null;jK.style.transform="translate(0,0)";}
}
function btn(id,down,up){var el=document.getElementById(id);
  var d=function(e){e.preventDefault();e.stopPropagation();down();el.classList.add("on");},u=function(e){e.preventDefault();e.stopPropagation();if(up)up();el.classList.remove("on");};
  el.addEventListener("touchstart",d,{passive:false});el.addEventListener("touchend",u,{passive:false});el.addEventListener("touchcancel",u,{passive:false});
  el.addEventListener("mousedown",d);el.addEventListener("mouseup",u);el.addEventListener("mouseleave",function(e){if(el.classList.contains("on"))u(e);});
}
btn("dashBtn",function(){act.dash=1;});
btn("atkBtn",function(){act.held=true;},function(){if(act.held){act.held=false;act.up++;}});
window.addEventListener("keydown",function(e){var k=e.key.toLowerCase();if(e.repeat&&(k===" "||k==="shift"||k==="j"||k==="k"))return;
  if(k===" "||k==="shift"){act.dash=1;e.preventDefault();}
  if(k==="j"||k==="k")act.held=true;
  keys[k]=true;keyJoy();if((k==="escape"||k==="p")&&AS.game)AS.game.togglePause();});
window.addEventListener("keyup",function(e){var k=e.key.toLowerCase();if((k==="j"||k==="k")&&act.held){act.held=false;act.up++;}keys[k]=false;keyJoy();});
window.addEventListener("blur",function(){keys={};if(joy.id==="kbd"||joy.id==="m")end();});
document.body.addEventListener("touchmove",function(e){e.preventDefault();},{passive:false});

AS.input={joy:joy,act:act,reset:function(){keys={};end();act.held=false;act.up=0;act.dash=0;},show:function(v){zone.style.display=v?"block":"none";jEl.style.display=v?"block":"none";if(!v)end();}};
})(window.AS);
