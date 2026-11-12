/* WebAudio synth music + layered procedural SFX.
   Mix: every SFX voice -> sfx bus -> glue compressor -> mix <- music bus (dips under big moments) -> brick-wall limiter -> master.
   Each sound is 2-4 short layers (noise transient + tonal body + sub thump) with small pitch variation so repeats don't drone.
   Per-sound throttling plus a global voice cap keep big hordes from stacking hundreds of oscillators (and from clipping). */
(function(AS){
"use strict";
var actx=null,master=null,mix=null,limiter=null,musicG=null,musicDip=null,sfxG=null,glue=null,noiseBuf=null,
    muted=AS.save.getMuted(),musicOn=false,bassOsc=null,arpOsc=null,arpInt=null;
var lastT={},voices=0,MAX_VOICES=30,ducked=false,MASTER=0.62;
function build(ac){
  actx=ac;master=actx.createGain();master.gain.value=muted?0:MASTER;master.connect(actx.destination);
  limiter=actx.createDynamicsCompressor();limiter.threshold.value=-2;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=0.001;limiter.release.value=0.1;limiter.connect(master);
  mix=actx.createGain();mix.gain.value=1;mix.connect(limiter);
  musicG=actx.createGain();musicG.gain.value=0.14;musicDip=actx.createGain();musicDip.gain.value=1;musicG.connect(musicDip);musicDip.connect(mix);
  glue=actx.createDynamicsCompressor();glue.threshold.value=-16;glue.knee.value=8;glue.ratio.value=4;glue.attack.value=0.003;glue.release.value=0.15;glue.connect(mix);
  sfxG=actx.createGain();sfxG.gain.value=0.5;sfxG.connect(glue);
  var n=Math.floor(actx.sampleRate*0.5);noiseBuf=actx.createBuffer(1,n,actx.sampleRate);var d=noiseBuf.getChannelData(0),s=0x2f6e2b1;
  for(var i=0;i<n;i++){s^=s<<13;s^=s>>>17;s^=s<<5;d[i]=((s>>>0)/4294967295)*2-1;}
  return true;}
function ensure(){if(actx)return true;try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;return build(new AC());}catch(e){return false;}}
function gate(key,ms){var now=performance.now();if(lastT[key]&&now-lastT[key]<ms)return false;lastT[key]=now;return true;}
function live(){return actx&&!muted&&!ducked;}
function vary(f,p){return f*(1+(Math.random()*2-1)*(p||0.06));}
function done(src,t){voices++;src.onended=function(){voices--;};}
// tonal layer: o = {type, slide (Hz), at (attack s), d (delay s), q:{f,type} optional filter}
function osc(f,dur,vol,o){if(!live())return;o=o||{};try{var t=actx.currentTime+(o.d||0),v=actx.createOscillator(),g=actx.createGain(),at=o.at||0.004,out=g;
  v.type=o.type||"sine";v.frequency.setValueAtTime(f,t);if(o.slide)v.frequency.exponentialRampToValueAtTime(Math.max(30,f+o.slide),t+dur);if(o.det)v.detune.value=o.det;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+at);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  v.connect(g);if(o.q){var fl=actx.createBiquadFilter();fl.type=o.q.type||"lowpass";fl.frequency.value=o.q.f;fl.Q.value=o.q.Q||0.7;g.connect(fl);out=fl;}
  out.connect(sfxG);v.start(t);v.stop(t+dur+0.02);done(v);}catch(e){}}
// noise layer through a filter, optional frequency sweep: o = {type:"bandpass"|"lowpass"|"highpass", f, to, Q, d, at}
function noise(dur,vol,o){if(!live())return;o=o||{};try{var t=actx.currentTime+(o.d||0),src=actx.createBufferSource(),fl=actx.createBiquadFilter(),g=actx.createGain(),at=o.at||0.002;
  src.buffer=noiseBuf;src.loop=true;src.playbackRate.value=o.rate||1;fl.type=o.type||"bandpass";fl.frequency.setValueAtTime(o.f||2000,t);if(o.to)fl.frequency.exponentialRampToValueAtTime(o.to,t+dur);fl.Q.value=o.Q||0.9;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+at);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  src.connect(fl);fl.connect(g);g.connect(sfxG);src.start(t,Math.random()*0.4);src.stop(t+dur+0.02);done(src);}catch(e){}}
// room for a sound? low-priority sounds give way when many voices are already playing
function room(pri){return voices<(pri?MAX_VOICES+12:MAX_VOICES);}
// music steps back for a moment under big hits, level-ups and STRIKE so they cut through without raising the overall level
function dip(depth,len){if(!actx)return;try{var t=actx.currentTime,g=musicDip.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(1-depth,t+0.03);g.setTargetAtTime(1,t+0.03+len*0.4,len*0.5);}catch(e){}}
var gemN=0,gemT=0,PENTA=[0,2,4,7,9,12,14,16,19,21,24];
var S={
  ensure:ensure,
  isMuted:function(){return muted;},
  // silence everything while a video ad plays (doesn't touch the saved mute setting)
  duck:function(on){ducked=!!on;if(master)master.gain.value=(muted||ducked)?0:MASTER;},
  toggleMute:function(){muted=!muted;AS.save.setMuted(muted);if(master)master.gain.value=muted?0:MASTER;if(muted)S.stopMusic();return muted;},
  shoot:function(){if(!room()||!gate("shoot",70))return;osc(vary(700,0.05),0.05,0.05,{type:"square",slide:-260});noise(0.03,0.035,{type:"highpass",f:4500});},
  // hit: transient click + tonal body; heavy hits (melee, STRIKE, crits) add a sub thump
  hit:function(heavy){if(heavy){if(!gate("hitH",55))return;noise(0.05,0.2,{type:"bandpass",f:vary(1600),to:500,Q:1.2});osc(vary(150),0.12,0.32,{type:"sine",slide:-100});osc(vary(320),0.06,0.1,{type:"square",slide:-180,q:{f:1400}});return;}
    if(!room()||!gate("hit",42))return;noise(0.028,0.11,{type:"bandpass",f:vary(2600,0.15),Q:1.4});osc(vary(210,0.1),0.06,0.11,{type:"triangle",slide:-110});},
  death:function(){if(!room()||!gate("death",55))return;noise(0.16,0.13,{type:"lowpass",f:1800,to:220});osc(vary(130),0.15,0.13,{type:"square",slide:-80,q:{f:900}});},
  hurt:function(){if(gate("hurt",120)){osc(78,0.16,0.3,{type:"sawtooth",slide:-30,q:{f:600}});noise(0.09,0.16,{type:"lowpass",f:1200,to:300});osc(55,0.2,0.3,{type:"sine",slide:-15});AS.native.haptic("LIGHT");}},
  // small reward chime (chests, caches, shrines)
  lvl:function(){if(!gate("lvl",90))return;[523,784,1047].forEach(function(f,i){osc(f,0.16,0.12,{type:"triangle",d:i*0.05});});noise(0.12,0.04,{type:"highpass",f:6000,d:0.05});},
  // real level-up: sub swell + rising major stack + sparkle tail
  levelUp:function(){if(!gate("lvlup",200))return;dip(0.55,0.6);osc(65,0.5,0.34,{type:"sine",slide:-22,at:0.01});
    [392,494,587,784,988].forEach(function(f,i){osc(f,0.32+i*0.03,0.1,{type:"triangle",d:i*0.055,at:0.006});osc(f*2,0.16,0.035,{type:"sine",d:i*0.055+0.01});});
    noise(0.55,0.06,{type:"highpass",f:4000,to:9000,d:0.1,at:0.05});osc(1568,0.5,0.05,{type:"sine",d:0.3,at:0.02});},
  clear:function(){dip(0.5,0.9);[523,659,784,1046].forEach(function(f,i){osc(f,0.22,0.13,{type:"square",d:i*0.11,q:{f:3000}});osc(f/2,0.25,0.08,{type:"triangle",d:i*0.11});});osc(55,0.7,0.3,{type:"sine",d:0.33});},
  transform:function(){dip(0.6,1);osc(160,0.42,0.26,{type:"sawtooth",slide:450,q:{f:2200}});osc(500,0.3,0.2,{type:"square",d:0.2,q:{f:2600}});osc(800,0.38,0.2,{type:"square",d:0.4,q:{f:3200}});osc(48,0.9,0.35,{type:"sine",d:0.4});noise(0.6,0.07,{type:"highpass",f:3000,to:8000,d:0.35});},
  warn:function(){dip(0.35,0.6);osc(220,0.25,0.15,{type:"sawtooth",slide:-60,q:{f:1200}});osc(220,0.25,0.15,{type:"sawtooth",slide:-60,d:0.3,q:{f:1200}});osc(58,0.55,0.26,{type:"sine",slide:-12});},
  // low-HP heartbeat (polish pass 4): two quiet low thumps, lub-dub
  heart:function(){if(!gate("heart",700))return;osc(52,0.14,0.3,{type:"sine",slide:-8});osc(48,0.12,0.22,{type:"sine",slide:-6,d:0.18});},
  // combo milestone chime (polish pass 4): two bright rising notes
  combo:function(){if(!gate("comboS",150))return;osc(880,0.12,0.1,{type:"triangle"});osc(1318,0.16,0.1,{type:"triangle",d:0.07});},
  tele:function(){if(gate("tele",200))osc(300,0.3,0.12,{type:"triangle",slide:300});},
  dash:function(){if(!gate("dash",120))return;noise(0.16,0.13,{type:"bandpass",f:500,to:2800,Q:0.8});osc(260,0.13,0.1,{type:"triangle",slide:500});},
  // quick melee swing; a connecting swing adds a meaty thud
  slash:function(hit){if(!gate("slash",90))return;noise(0.08,0.12,{type:"bandpass",f:1800,to:5200,Q:1.1});osc(vary(900),0.06,0.05,{type:"sawtooth",slide:-600,q:{f:3000}});
    if(hit){osc(vary(170),0.09,0.24,{type:"sine",slide:-100});noise(0.04,0.12,{type:"lowpass",f:1500});}},
  // STRIKE (hold-and-release): whoosh -> impact boom -> crunch; a full charge adds a ringing metal tail
  strike:function(q,full){if(!gate("strike",120))return;q=Math.max(0,Math.min(1,q||0));dip(0.45+0.25*q,0.35+0.35*q);
    noise(0.14,0.16,{type:"bandpass",f:380,to:3200,Q:0.9});
    osc(130,0.32+0.15*q,0.36+0.14*q,{type:"sine",slide:-95,d:0.03});
    noise(0.22+0.1*q,0.2,{type:"lowpass",f:2400,to:160,d:0.03});
    osc(200,0.16,0.12,{type:"sawtooth",slide:-130,d:0.03,q:{f:1100}});
    if(full){osc(1320,0.5,0.05,{type:"square",d:0.05,q:{f:5000}});osc(1987,0.42,0.04,{type:"square",d:0.05,det:7,q:{f:6000}});osc(660,0.6,0.06,{type:"triangle",d:0.05});}},
  zap:function(){if(gate("zap",110)){osc(1200,0.06,0.06,{type:"sawtooth",slide:-700,q:{f:4000}});noise(0.05,0.05,{type:"highpass",f:3500});}},
  burst:function(){if(gate("burst",120)){osc(520,0.12,0.1,{type:"square",slide:-300,q:{f:2400}});noise(0.1,0.08,{type:"bandpass",f:900,to:300});}},
  // XP motes: a soft blip that climbs a pentatonic scale while you vacuum a streak
  gem:function(){if(!room()||!gate("gem",38))return;var now=performance.now();gemN=now-gemT<450?Math.min(PENTA.length-1,gemN+1):0;gemT=now;
    var f=880*Math.pow(2,PENTA[gemN]/12);osc(f,0.07,0.045,{type:"sine"});osc(f*2,0.04,0.015,{type:"sine",d:0.01});},
  // Dark Rift: loot drops get a voice per rarity so a Legendary is heard before it is seen
  drop:function(r){if(!gate("drop"+r,90))return;if(r===3){dip(0.5,0.9);osc(98,0.9,0.3,{type:"sine",slide:-20});osc(392,0.6,0.15,{type:"triangle",d:0.06});osc(587,0.7,0.13,{type:"triangle",d:0.18});osc(784,0.9,0.11,{type:"sine",d:0.32});noise(0.8,0.05,{type:"highpass",f:5000,d:0.2,at:0.1});}
    else if(r===2){osc(660,0.25,0.14,{type:"triangle"});osc(990,0.35,0.11,{type:"triangle",d:0.09});noise(0.2,0.03,{type:"highpass",f:6000,d:0.05});}else if(r===1){osc(520,0.18,0.1,{type:"triangle",slide:120});}else osc(240,0.05,0.06,{type:"square",slide:-60,q:{f:1500}});},
  // loot pickup: bright two-note sparkle, richer the rarer the item
  pickup:function(r){if(!gate("pick",60))return;r=r||0;var b=660+r*110;osc(b,0.08,0.13,{type:"triangle",slide:180});osc(b*1.5,0.12,0.09,{type:"sine",d:0.045});noise(0.05,0.04+r*0.01,{type:"highpass",f:6500});
    if(r>=2){osc(b*2,0.22,0.07,{type:"sine",d:0.09});osc(b*3,0.25,0.03,{type:"sine",d:0.13});}if(r>=3)osc(82,0.4,0.22,{type:"sine",slide:-20});},
  equip:function(){osc(180,0.06,0.12,{type:"square",slide:-40,q:{f:1600}});osc(140,0.1,0.1,{type:"sawtooth",slide:-30,d:0.05,q:{f:1200}});noise(0.04,0.06,{type:"bandpass",f:3200,Q:2});},
  nova:function(){dip(0.4,0.5);osc(110,0.4,0.22,{type:"sawtooth",slide:-60,q:{f:900}});osc(300,0.3,0.12,{type:"triangle",slide:500});osc(55,0.45,0.3,{type:"sine",slide:-15});noise(0.35,0.12,{type:"lowpass",f:3000,to:200});},
  lance:function(){osc(900,0.18,0.1,{type:"sawtooth",slide:-600,q:{f:3500}});noise(0.14,0.09,{type:"bandpass",f:3000,to:900});},
  ward:function(){osc(200,0.4,0.16,{type:"triangle",slide:80});osc(300,0.3,0.1,{type:"triangle",d:0.08});osc(600,0.5,0.04,{type:"sine",d:0.08});},
  draught:function(){[330,392,494].forEach(function(f,i){osc(f,0.18,0.12,{type:"sine",d:i*0.07});});noise(0.25,0.04,{type:"bandpass",f:1200,to:2400,Q:3});},
  startMusic:function(){if(!ensure()||musicOn||muted)return;try{if(actx.state==="suspended"&&actx.resume)actx.resume().catch(function(){});var t0=actx.currentTime+0.05;bassOsc=actx.createOscillator();bassOsc.type="sawtooth";bassOsc.frequency.value=55;var bg=actx.createGain();bg.gain.value=0.22;var bf=actx.createBiquadFilter();bf.type="lowpass";bf.frequency.value=130;bassOsc.connect(bf);bf.connect(bg);bg.connect(musicG);bassOsc.start(t0);var notes=[220,277,330,370,440,370,330,277],step=0;arpOsc=actx.createOscillator();arpOsc.type="square";var ag=actx.createGain();ag.gain.value=0.055;arpOsc.connect(ag);ag.connect(musicG);arpOsc.frequency.value=notes[0];arpOsc.start(t0);arpInt=setInterval(function(){if(!actx||muted)return;step=(step+1)%notes.length;try{arpOsc.frequency.setValueAtTime(notes[step],actx.currentTime);}catch(e){}},145);musicOn=true;}catch(e){}},
  stopMusic:function(){try{if(bassOsc)bassOsc.stop();if(arpOsc)arpOsc.stop();if(arpInt)clearInterval(arpInt);}catch(e){}bassOsc=arpOsc=arpInt=null;musicOn=false;},
  resume:function(){if(actx&&actx.state==="suspended"){return actx.resume();}return Promise.resolve();},
  // test hook: render into an OfflineAudioContext to measure the mix (peaks, voice count)
  _attach:function(ac){actx=null;lastT={};voices=0;return build(ac);},_voices:function(){return voices;}
};
AS.sfx=S;
})(window.AS);
