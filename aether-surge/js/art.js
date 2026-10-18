/* Sprite art (ported from the aether-surge-app flat-vector sprite PR): image registry, game-unit metadata,
   async preload with shape fallback, HTML icon helpers. Rendering of the images lives in render.js. */
(function(AS){
"use strict";
var BASE="assets/";
var IMG={};                                  // key -> loaded HTMLImageElement (absent = not loaded / failed -> shape fallback)
// [viewX, viewY, w, h, footY] in game units (images are 2x). Characters anchor bottom-centre at footY.
var META={
  player:[-16,-30,32,46,14],player_ascended:[-16,-30,32,46,14],
  hero_vesper:[-16,-30,32,46,14],hero_brakk:[-16,-30,32,46,14],hero_lumen:[-16,-30,32,46,14],
  scout:[-11.36,-20.45,26.36,31.36,9.545],raider:[-12.5,-22.5,29,34.5,10.5],caster:[-12.5,-22.5,29,34.5,10.5],
  brute:[-18.18,-32.73,42.18,50.18,15.273],warlord:[-20.45,-36.82,47.45,56.45,17.182],swarmer:[-7.96,-14.32,18.45,21.95,6.682],
  bulwark:[-21.59,-38.86,50.09,59.59,18.136],splitter:[-13.64,-24.55,31.64,37.64,11.455],shielder:[-15,-27,32,40,13],
  rift_sentinel:[-33.43,-42.71,63.14,70.57,26],grove_warden:[-36,-58,72,88,28],crystal_tyrant:[-38.57,-57.86,77.14,90,30],
  void_herald:[-41.14,-54.86,82.29,89.14,32],frost_sovereign:[-43.71,-65.57,87.43,102,34],throne_bearer:[-57,-89.57,114,130.29,38],
  shot_player:[-12,-6,20,12,0],shot_gold:[-12,-6,20,12,0],shot_shock:[-9,-9,18,18,0],shot_caster:[-8,-8,16,16,0],
  orb_orbit:[-10,-10,20,20,0],xp_small:[-7.5,-7.5,15,15,0],xp_medium:[-8.5,-8.5,17,17,0],xp_large:[-9.5,-9.5,19,19,0],fx_crit_star:[-7,-7,14,14,0]
};
// FX strips: [frames, size in game units]
var FX_META={fx_hit_spark_4f:[4,16],fx_death_poof_5f:[5,24],fx_levelup_ring_4f:[4,48],fx_crit_star:[1,14]};
var BOSS_ART={warden:"grove_warden",tyrant:"crystal_tyrant",sentinel:"rift_sentinel",herald:"void_herald",frost:"frost_sovereign",throne:"throne_bearer"};
var HERO_ART={rift:"player",vesper:"hero_vesper",brakk:"hero_brakk",lumen:"hero_lumen"};
var SHOT_ART={"#7ae0ff":"shot_player","#ffe040":"shot_gold","#ffb040":"shot_shock","#ffcc30":"shot_shock","#ff60b0":"shot_caster"};
// preloaded up front (small); stage skies/far rows are loaded on demand (a 1080x1920 sky decodes to ~8 MB)
var SPRITES=["player","player_ascended","hero_vesper","hero_brakk","hero_lumen","scout","raider","caster","brute","warlord","swarmer","bulwark","splitter","shielder",
  "rift_sentinel","grove_warden","crystal_tyrant"];
var FXS=["shot_player","shot_gold","shot_shock","shot_caster","orb_orbit","xp_small","xp_medium","xp_large","fx_hit_spark_4f","fx_death_poof_5f","fx_levelup_ring_4f","fx_crit_star"];
var GROUNDS=["s1_ground","s2_ground","s3_ground","s4_ground","s5_ground","s6_ground"];
var A=AS.art={img:IMG,meta:META,fxMeta:FX_META,bossArt:BOSS_ART,heroArt:HERO_ART,shotArt:SHOT_ART,gen:0,loaded:0,failed:0,total:0,ready:false,listeners:[],
  off:/[?&]art=0/.test(location.search||"")};  // ?art=0 forces the original shape renderer (debug / comparison)
function load(key,path,cb){
  if(A.off){if(cb)cb(false);return;}
  var im=new Image();im.decoding="async";
  im.onload=function(){IMG[key]=im;A.loaded++;A.gen++;if(cb)cb(true);};
  im.onerror=function(){A.failed++;if(cb)cb(false);};
  im.src=BASE+path;
}
var pending=0;
function done(){if(--pending<=0&&!A.ready){A.ready=true;A.listeners.forEach(function(f){try{f();}catch(e){}});}}
function preload(){
  var list=[];SPRITES.forEach(function(k){list.push([k,"sprites/"+k+".png"]);});FXS.forEach(function(k){list.push([k,"fx/"+k+".png"]);});
  GROUNDS.forEach(function(k){list.push([k,"bg/"+k+".png"]);});
  A.total=pending=list.length;A.list=list.map(function(it){return it[0];});
  list.forEach(function(it){load(it[0],it[1],done);});
  setTimeout(function(){if(!A.ready){A.ready=true;A.listeners.forEach(function(f){try{f();}catch(e){}});}},10000); // never block on slow art
}
A.onReady=function(f){if(A.ready)f();else A.listeners.push(f);};
A.has=function(k){return !!IMG[k];};
var asked={};
// on-demand stage art (menu backdrop): sky + far row for theme 1..6
A.want=function(th){var k="s"+th;if(asked[k])return;asked[k]=1;load(k+"_sky","bg/"+k+"_sky.png");load(k+"_far","bg/"+k+"_far.png");};
// HTML for an upgrade icon: art image when the upgrade has one (shipped with the build), else the emoji glyph
var ICONS={"aether_amplify":1,"rapid_surge":1,"split_blast":1,"swift_step":1,"core_harden":1,"orbiting_orbs":1,"shock_wave":1,"extended_reach":1,
  "magnet_pull":1,"piercing_rounds":1,"vampiric_core":1,"critical_focus":1,"second_wind":1,"aether_ascension":1};
A.iconKey=function(name){var k=String(name||"").toLowerCase().replace(/ /g,"_");return ICONS[k]&&!A.off?k:null;};
A.iconHTML=function(name,fallback){var k=A.iconKey(name);if(!k)return fallback;
  return '<img class="ai" alt="" src="'+BASE+'icons/icon_'+k+'_76.png" srcset="'+BASE+'icons/icon_'+k+'_76.png 1x, '+BASE+'icons/icon_'+k+'_114.png 2x">';};
A.spriteURL=function(k){return BASE+"sprites/"+k+".png";};
// HUD buttons: pause / sound on / sound off
A.setBtn=function(el,key,fb){if(!el)return;if(A.off){el.classList.remove("art");el.textContent=fb;return;}
  el.innerHTML='<img alt="" src="'+BASE+'icons/ui_btn_'+key+'_76.png" srcset="'+BASE+'icons/ui_btn_'+key+'_76.png 1x, '+BASE+'icons/ui_btn_'+key+'_114.png 2x">';el.classList.add("art");};
preload();
})(window.AS);
