/* WebAudio synth music + SFX, with per-sound throttling so big hordes don't spawn hundreds of oscillators. */
(function(AS){
"use strict";
var actx=null,master=null,musicG=null,sfxG=null,muted=AS.save.getMuted(),musicOn=false,bassOsc=null,arpOsc=null,arpInt=null;
var lastT={};
function ensure(){if(actx)return true;try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;actx=new AC();master=actx.createGain();master.gain.value=muted?0:0.6;master.connect(actx.destination);musicG=actx.createGain();musicG.gain.value=0.14;musicG.connect(master);sfxG=actx.createGain();sfxG.gain.value=0.38;sfxG.connect(master);return true;}catch(e){return false;}}
function gate(key,ms){var now=performance.now();if(lastT[key]&&now-lastT[key]<ms)return false;lastT[key]=now;return true;}
var ducked=false;
function tone(f,type,dur,vol,slide){if(!actx||muted||ducked)return;try{var t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();o.type=type||"square";o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),t+dur);g.gain.setValueAtTime(vol||0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);o.connect(g);g.connect(sfxG);o.start(t);o.stop(t+dur+0.03);}catch(e){}}
function later(fn,ms){setTimeout(fn,ms);}
var S={
  ensure:ensure,
  isMuted:function(){return muted;},
  // silence everything while a video ad plays (doesn't touch the saved mute setting)
  duck:function(on){ducked=!!on;if(master)master.gain.value=(muted||ducked)?0:0.6;},
  toggleMute:function(){muted=!muted;AS.save.setMuted(muted);if(master)master.gain.value=muted?0:0.6;if(muted)S.stopMusic();return muted;},
  shoot:function(){if(gate("shoot",70))tone(680,"square",0.05,0.07,-200);},
  hit:function(){if(gate("hit",45))tone(170,"sawtooth",0.07,0.12,-50);},
  death:function(){if(gate("death",55))tone(90,"sawtooth",0.16,0.15,-60);},
  hurt:function(){if(gate("hurt",120)){tone(70,"sawtooth",0.14,0.22,-25);AS.native.haptic("LIGHT");}},
  lvl:function(){tone(440,"square",0.09,0.14);later(function(){tone(660,"square",0.09,0.14);},50);later(function(){tone(880,"square",0.14,0.16);},100);},
  clear:function(){[523,659,784,1046].forEach(function(f,i){later(function(){tone(f,"square",0.2,0.14);},i*110);});},
  transform:function(){tone(160,"sawtooth",0.4,0.28,450);later(function(){tone(500,"square",0.3,0.22);},200);later(function(){tone(800,"square",0.35,0.25);},400);},
  warn:function(){tone(220,"sawtooth",0.25,0.16,-60);later(function(){tone(220,"sawtooth",0.25,0.16,-60);},300);},
  tele:function(){if(gate("tele",200))tone(300,"triangle",0.3,0.12,300);},
  dash:function(){if(gate("dash",120))tone(260,"triangle",0.14,0.14,500);},
  slash:function(){if(gate("slash",90))tone(900,"sawtooth",0.07,0.07,-600);},
  zap:function(){if(gate("zap",110))tone(1200,"sawtooth",0.06,0.06,-700);},
  burst:function(){if(gate("burst",120))tone(520,"square",0.12,0.1,-300);},
  // Dark Rift: loot drops get a voice per rarity so a Legendary is heard before it is seen
  drop:function(r){if(!gate("drop"+r,90))return;if(r===3){tone(98,"sine",0.9,0.3,-20);later(function(){tone(392,"triangle",0.6,0.16);},60);later(function(){tone(587,"triangle",0.7,0.14);},180);later(function(){tone(784,"sine",0.9,0.12);},320);}
    else if(r===2){tone(660,"triangle",0.25,0.15);later(function(){tone(990,"triangle",0.35,0.12);},90);}else if(r===1){tone(520,"triangle",0.18,0.11,120);}else tone(240,"square",0.05,0.06,-60);},
  pickup:function(r){if(!gate("pick",60))return;tone(300+r*140,"triangle",0.08,0.12,200);if(r>=2)later(function(){tone(700+r*120,"sine",0.18,0.1);},60);},
  equip:function(){tone(180,"square",0.06,0.12,-40);later(function(){tone(140,"sawtooth",0.1,0.1,-30);},50);},
  nova:function(){tone(110,"sawtooth",0.4,0.22,-60);tone(300,"triangle",0.3,0.12,500);},
  lance:function(){tone(900,"sawtooth",0.18,0.1,-600);},
  ward:function(){tone(200,"triangle",0.4,0.16,80);later(function(){tone(300,"triangle",0.3,0.1);},80);},
  draught:function(){[330,392,494].forEach(function(f,i){later(function(){tone(f,"sine",0.18,0.12);},i*70);});},
  startMusic:function(){if(!ensure()||musicOn||muted)return;try{if(actx.state==="suspended")actx.resume();var t0=actx.currentTime+0.05;bassOsc=actx.createOscillator();bassOsc.type="sawtooth";bassOsc.frequency.value=55;var bg=actx.createGain();bg.gain.value=0.22;var bf=actx.createBiquadFilter();bf.type="lowpass";bf.frequency.value=130;bassOsc.connect(bf);bf.connect(bg);bg.connect(musicG);bassOsc.start(t0);var notes=[220,277,330,370,440,370,330,277],step=0;arpOsc=actx.createOscillator();arpOsc.type="square";var ag=actx.createGain();ag.gain.value=0.055;arpOsc.connect(ag);ag.connect(musicG);arpOsc.frequency.value=notes[0];arpOsc.start(t0);arpInt=setInterval(function(){if(!actx||muted)return;step=(step+1)%notes.length;try{arpOsc.frequency.setValueAtTime(notes[step],actx.currentTime);}catch(e){}},145);musicOn=true;}catch(e){}},
  stopMusic:function(){try{if(bassOsc)bassOsc.stop();if(arpOsc)arpOsc.stop();if(arpInt)clearInterval(arpInt);}catch(e){}bassOsc=arpOsc=arpInt=null;musicOn=false;},
  resume:function(){if(actx&&actx.state==="suspended"){return actx.resume();}return Promise.resolve();}
};
AS.sfx=S;
})(window.AS);
