/* Aether Surge — smooth player locomotion: analog velocity with acceleration / deceleration, obstacle slide,
   smoothed facing with a flip hysteresis. Pure math (no DOM) so it is unit-tested in Node (tests/move.test.js).
   All rates are per second and applied with exp(-rate*dt), so motion is frame-rate independent. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var M={ACC:14,DEC:18,TURN:16,LEAN:10,FLIP:0.2,STOP:4};
function clamp(v,a,b){return v<a?a:v>b?b:v;}
// joystick vector (any length) -> analog input: radial deadzone, rescaled so the edge of the deadzone is 0 and full tilt is 1
M.analog=function(x,y,dead){dead=dead==null?0.12:dead;var n=Math.hypot(x,y);if(n<=dead||!isFinite(n))return {x:0,y:0,m:0};
  var c=Math.min(1,n),m=(c-dead)/(1-dead);return {x:x/n*m,y:y/n*m,m:m};};
// advance velocity toward the stick target; returns the displacement for this frame
M.step=function(P,jx,jy,maxSpd,dt){
  if(!(dt>0))return {dx:0,dy:0};
  var vx=P.vx||0,vy=P.vy||0,jm=Math.hypot(jx,jy);if(jm>1){jx/=jm;jy/=jm;jm=1;}
  var tx=jx*maxSpd,ty=jy*maxSpd,k=1-Math.exp(-(jm>0?M.ACC:M.DEC)*dt);
  vx+=(tx-vx)*k;vy+=(ty-vy)*k;
  var s=Math.hypot(vx,vy),cap=maxSpd*1.02;if(s>cap){vx*=cap/s;vy*=cap/s;}
  if(jm===0&&s<M.STOP){vx=0;vy=0;}
  P.vx=vx;P.vy=vy;P.vMax=maxSpd;return {dx:vx*dt,dy:vy*dt};};
// after an obstacle pushed the player by (px,py): drop the velocity component pointing into it (slide along walls/rocks)
M.slide=function(P,px,py){var l=Math.hypot(px,py);if(!l)return;var nx=px/l,ny=py/l,vn=(P.vx||0)*nx+(P.vy||0)*ny;if(vn<0){P.vx-=nx*vn;P.vy-=ny*vn;}};
// facing: turn smoothly toward the movement direction (360°), sprite flips left/right only past a hysteresis band
M.face=function(P,vx,vy,jx,jy,dt){
  var s=Math.hypot(vx,vy),dirx=vx,diry=vy;
  if(s<10&&(jx||jy)){dirx=jx;diry=jy;s=Math.hypot(jx,jy)*100;}
  if(s>=10){var cur=Math.atan2(P.fy||0,P.fx||1),want=Math.atan2(diry,dirx),d=want-cur;
    while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
    var a=cur+d*(1-Math.exp(-M.TURN*dt));P.fx=Math.cos(a);P.fy=Math.sin(a);}
  var f=P.face||1;if(f>0&&P.fx<-M.FLIP)f=-1;else if(f<0&&P.fx>M.FLIP)f=1;P.face=f;
  var lt=clamp((P.vx||0)/Math.max(1,P.vMax||200),-1,1);P.lean=(P.lean||0)+(lt-(P.lean||0))*(1-Math.exp(-M.LEAN*dt));};
AS.move=M;
if(typeof module!=="undefined"&&module.exports)module.exports=M;
})(typeof window!=="undefined"?window:globalThis);
