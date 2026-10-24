/* Aether Surge — on-screen control layout (joystick, STRIKE, DASH): position, size, opacity.
   Pure layout logic works in Node (unit tests via require); DOM editor + apply only run in the browser.
   Save: localStorage "as_controls_v1". Positions are fractions of the screen so one layout fits portrait and landscape. */
(function(root){
"use strict";
var AS=root.AS||(root.AS={});
var C={KEY:"as_controls_v1",IDS:["joy","atk","dash"],BASE:{joy:120,atk:64,dash:76},MIN_S:0.6,MAX_S:1.6,MIN_O:0.2,MAX_O:1};
C.DEFAULT={joy:{x:0.2,y:0.87,s:1,o:1},atk:{x:0.67,y:0.89,s:1,o:1},dash:{x:0.86,y:0.91,s:1,o:1}};
function cl(v,a,b,d){v=+v;return isFinite(v)?Math.max(a,Math.min(b,v)):d;}
C.normalize=function(L){
  var out={};L=L&&typeof L==="object"?L:{};
  C.IDS.forEach(function(id){var d=C.DEFAULT[id],c=L[id]||{};
    out[id]={x:cl(c.x,0,1,d.x),y:cl(c.y,0,1,d.y),s:cl(c.s,C.MIN_S,C.MAX_S,d.s),o:cl(c.o,C.MIN_O,C.MAX_O,d.o)};});
  return out;
};
C.defaults=function(){return C.normalize(null);};
C.leftHanded=function(L){L=C.normalize(L||null);C.IDS.forEach(function(id){L[id].x=1-L[id].x;});return L;};
C.load=function(store){try{var s=(store||root.localStorage).getItem(C.KEY);return C.normalize(s?JSON.parse(s):null);}catch(e){return C.defaults();}};
C.save=function(L,store){L=C.normalize(L);try{(store||root.localStorage).setItem(C.KEY,JSON.stringify(L));}catch(e){}return L;};
/* pixel center for a control, clamped so the whole control stays inside the safe area */
C.place=function(c,id,w,h,safe){
  safe=safe||{t:0,r:0,b:0,l:0};var r=C.BASE[id]*c.s/2,m=6;
  var minX=safe.l+r+m,maxX=w-safe.r-r-m,minY=safe.t+r+60,maxY=h-safe.b-r-m;
  var x=c.x*w,y=c.y*h;
  return {x:Math.round(maxX<minX?w/2:Math.max(minX,Math.min(maxX,x))),y:Math.round(maxY<minY?h/2:Math.max(minY,Math.min(maxY,y))),size:Math.round(C.BASE[id]*c.s)};
};
AS.controls=C;
if(typeof module!=="undefined"&&module.exports)module.exports=C;
if(typeof document==="undefined")return;

/* ---------- browser: apply + editor ---------- */
var EL={joy:"joy",atk:"atkBtn",dash:"dashBtn"},cur=C.load();
function safe(){var p=document.getElementById("safeProbe");if(!p){p=document.createElement("div");p.id="safeProbe";
  p.style.cssText="position:fixed;visibility:hidden;pointer-events:none;inset:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";document.body.appendChild(p);}
  var s=getComputedStyle(p);return {t:parseFloat(s.paddingTop)||0,r:parseFloat(s.paddingRight)||0,b:parseFloat(s.paddingBottom)||0,l:parseFloat(s.paddingLeft)||0};}
function style(el,id,c){var w=window.innerWidth,h=window.innerHeight,p=C.place(c,id,w,h,safe());
  el.style.left=p.x+"px";el.style.top=p.y+"px";el.style.right="auto";el.style.bottom="auto";
  el.style.width=p.size+"px";el.style.height=p.size+"px";el.style.margin=(-p.size/2)+"px 0 0 "+(-p.size/2)+"px";
  el.style.setProperty("--co",c.o);return p;}
C.apply=function(L){if(L)cur=C.normalize(L);C.IDS.forEach(function(id){var el=document.getElementById(EL[id]);if(el)style(el,id,cur[id]);});
  if(AS.input&&AS.input.setHome){var p=C.place(cur.joy,"joy",window.innerWidth,window.innerHeight,safe());AS.input.setHome(p.x,p.y,cur.joy.s);}};
C.current=function(){return C.normalize(cur);};
window.addEventListener("resize",function(){C.apply();ed&&ed.style.display==="flex"&&drawEd();});
window.addEventListener("orientationchange",function(){setTimeout(function(){C.apply();},150);});

var ed=null,work=null,sel="joy";
function build(){
  ed=document.createElement("div");ed.id="ctlEd";ed.className="ov";
  ed.innerHTML='<div id="ctlStage"><div class="cg" data-c="joy"><i>MOVE</i></div><div class="cg" data-c="atk"><i>STRIKE</i></div><div class="cg" data-c="dash"><i>DASH</i></div></div>'+
   '<div id="ctlPanel"><h2>CONTROLS LAYOUT</h2><p class="note">Drag a control to move it. Selected: <b id="ctlSel"></b></p>'+
   '<label>Size <input type="range" id="ctlSize" min="'+C.MIN_S*100+'" max="'+C.MAX_S*100+'" step="5"><span id="ctlSizeV"></span></label>'+
   '<label>Opacity <input type="range" id="ctlOp" min="'+C.MIN_O*100+'" max="100" step="5"><span id="ctlOpV"></span></label>'+
   '<div class="row"><button class="btn alt" id="ctlLeft">✋ Left-handed</button><button class="btn alt" id="ctlReset">↺ Reset to default</button></div>'+
   '<div class="row"><button class="btn alt" id="ctlCancel">Cancel</button><button class="btn" id="ctlSave">✔ Save</button></div></div>';
  document.body.appendChild(ed);
  var NM={joy:"Joystick",atk:"Strike",dash:"Dash"};
  ed.querySelectorAll(".cg").forEach(function(g){var id=g.getAttribute("data-c"),drag=null;
    function down(e){e.preventDefault();e.stopPropagation();sel=id;var t=e.touches?e.touches[0]:e;drag={x:t.clientX,y:t.clientY};drawEd();}
    function mv(e){if(!drag)return;e.preventDefault();var t=e.touches?e.touches[0]:e;
      work[id].x=Math.max(0,Math.min(1,t.clientX/window.innerWidth));work[id].y=Math.max(0,Math.min(1,t.clientY/window.innerHeight));drawEd();}
    function up(){if(!drag)return;drag=null;
      // snap stored position to where the clamped control actually sits, so it never drifts off-screen
      var p=C.place(work[id],id,window.innerWidth,window.innerHeight,safe());work[id].x=p.x/window.innerWidth;work[id].y=p.y/window.innerHeight;drawEd();}
    g.addEventListener("touchstart",down,{passive:false});g.addEventListener("mousedown",down);
    window.addEventListener("touchmove",mv,{passive:false});window.addEventListener("mousemove",mv);
    window.addEventListener("touchend",up);window.addEventListener("mouseup",up);
  });
  var sz=ed.querySelector("#ctlSize"),op=ed.querySelector("#ctlOp");
  sz.addEventListener("input",function(){work[sel].s=sz.value/100;drawEd();});
  op.addEventListener("input",function(){work[sel].o=op.value/100;drawEd();});
  ed.querySelector("#ctlReset").onclick=function(){work=C.defaults();drawEd();};
  ed.querySelector("#ctlLeft").onclick=function(){work=C.leftHanded(work);drawEd();};
  ed.querySelector("#ctlCancel").onclick=function(){C.close();};
  ed.querySelector("#ctlSave").onclick=function(){cur=C.save(work);C.apply();C.close();};
  drawEd.NM=NM;
}
function drawEd(){
  ed.querySelectorAll(".cg").forEach(function(g){var id=g.getAttribute("data-c");style(g,id,work[id]);g.classList.toggle("sel",id===sel);});
  ed.querySelector("#ctlSel").textContent=drawEd.NM[sel];
  ed.querySelector("#ctlSize").value=Math.round(work[sel].s*100);ed.querySelector("#ctlSizeV").textContent=Math.round(work[sel].s*100)+"%";
  ed.querySelector("#ctlOp").value=Math.round(work[sel].o*100);ed.querySelector("#ctlOpV").textContent=Math.round(work[sel].o*100)+"%";
}
C.open=function(){if(!ed)build();work=C.normalize(cur);sel="joy";ed.style.display="flex";drawEd();};
C.close=function(){if(ed)ed.style.display="none";};
C.apply();
})(typeof window!=="undefined"?window:globalThis);
