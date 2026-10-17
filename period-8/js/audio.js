// All sound is synthesized with WebAudio at runtime (no audio files): fluorescent hum, room tone, distant school
// noises, clock ticks, footsteps, the school bell, the jump-scare sting. A generated impulse response gives the
// hallway its echo.
let A = null, master, verb, ambBus, droneGain, amb = [], muted = false, nextDistant = 0, buzzNode = null, waterNode = null;
const now = () => A.currentTime;

export function unlockAudio() {
  if (A) { if (A.state === 'suspended') A.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  A = new AC(); master = A.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(A.destination);
  verb = A.createConvolver(); verb.buffer = impulse(2.4, 2.6); const vg = A.createGain(); vg.gain.value = 0.35; verb.connect(vg).connect(master);
  ambBus = A.createGain(); ambBus.gain.value = 0.0; ambBus.connect(master); ambBus.connect(verb);
  droneGain = A.createGain(); droneGain.gain.value = 0; droneGain.connect(master);
  for (const [f, d] of [[55, -6], [55.4, 5], [82.6, 0]]) { const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; o.connect(lp).connect(droneGain); o.start(); }
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.05); }
export const audioReady = () => !!A;

function impulse(sec, decay) { const len = A.sampleRate * sec, b = A.createBuffer(2, len, A.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
let noiseBuf = null;
function noise() { if (noiseBuf) return noiseBuf; const len = A.sampleRate * 2, b = A.createBuffer(1, len, A.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = i % 2 ? w : last * 3.5; } return (noiseBuf = b); }
function noiseSrc(loop = false) { const s = A.createBufferSource(); s.buffer = noise(); s.loop = loop; return s; }
function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function burst({ t = now(), type = 'lowpass', freq = 800, q = 1, a = 0.003, peak = 0.3, d = 0.15, wet = false, pan = 0 } = {}) {
  const s = noiseSrc(), f = A.createBiquadFilter(), g = A.createGain(), p = A.createStereoPanner ? A.createStereoPanner() : null;
  f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f).connect(g); let out = g; if (p) { p.pan.value = pan; g.connect(p); out = p; }
  out.connect(master); if (wet) out.connect(verb); env(g, t, a, peak, d); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
}
function tone({ t = now(), f = 440, type = 'sine', a = 0.01, peak = 0.2, d = 0.4, f2 = null, wet = true }) {
  const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  o.connect(g).connect(master); if (wet) g.connect(verb); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05);
}

/** Start the looping ambience for a scene ('hall' | 'class' | 'menu'). */
export function ambience(scene) {
  if (!A) return; amb.forEach(n => { try { n.stop(now() + 0.3); } catch {} }); amb = [];
  ambBus.gain.setTargetAtTime(scene === 'menu' ? 0.35 : 0.8, now(), 0.4);
  const hum = scene === 'hall' ? 0.022 : 0.012;
  for (const [f, g] of [[60, hum], [120, hum * 0.6], [180, hum * 0.25]]) { const o = A.createOscillator(); o.frequency.value = f; const gg = A.createGain(); gg.gain.value = g; o.connect(gg).connect(ambBus); o.start(); amb.push(o); }
  const n = noiseSrc(true), lp = A.createBiquadFilter(), ng = A.createGain(); lp.type = 'lowpass'; lp.frequency.value = scene === 'class' ? 520 : 340; ng.gain.value = 0.05; n.connect(lp).connect(ng).connect(ambBus); n.start(); amb.push(n);
  nextDistant = now() + 4;
}
/** Called every frame: schedules distant school noises now and then. */
export function ambientTick(scene, dread = 0) {
  if (!A || muted || scene === 'menu') return;
  if (droneGain) droneGain.gain.setTargetAtTime(0.012 + dread * 0.05, now(), 1.5);
  if (now() < nextDistant) return; nextDistant = now() + 6 + Math.random() * 12;
  const r = Math.random(), pan = Math.random() * 1.6 - 0.8;
  if (r < 0.3) { for (let i = 0; i < 5; i++) burst({ t: now() + i * 0.55, freq: 260, peak: 0.05, d: 0.09, wet: true, pan }); }       // distant footsteps
  else if (r < 0.5) burst({ freq: 180, q: 0.7, peak: 0.12, d: 0.5, wet: true, pan });                                                    // far locker slam
  else if (r < 0.7) tone({ f: 1800 + Math.random() * 600, peak: 0.02, d: 0.08, type: 'triangle' });                                      // drip
  else if (r < 0.85) tone({ f: 70, f2: 50, peak: 0.05, d: 1.6, type: 'sine' });                                                          // building settles
  else burst({ type: 'bandpass', freq: 900, q: 6, peak: 0.03, d: 0.8, wet: true, pan });                                                  // a far-off voice-ish whoosh
}
export function tick(reverse = false) { if (!A || muted) return; burst({ type: 'highpass', freq: reverse ? 2500 : 3500, peak: 0.07, d: 0.025 }); if (reverse) tone({ f: 900, peak: 0.02, d: 0.04, wet: false }); }
export function step(i = 0) { if (!A) return; burst({ freq: 300 + (i % 2) * 60, peak: 0.22, d: 0.11, wet: true, pan: i % 2 ? 0.15 : -0.15 }); }
export function turn() { if (!A) return; burst({ type: 'bandpass', freq: 600, q: 0.8, a: 0.12, peak: 0.12, d: 0.35, wet: true }); }
export function ui() { if (!A) return; tone({ f: 660, type: 'triangle', peak: 0.05, d: 0.06, wet: false }); }
export function inspect() { if (!A) return; tone({ f: 1320, type: 'sine', peak: 0.03, d: 0.12 }); }
export function correct(streak) { if (!A) return; const base = 392 * Math.pow(2, Math.min(streak, 8) / 12); tone({ f: base, peak: 0.08, d: 0.5 }); tone({ t: now() + 0.12, f: base * 1.5, peak: 0.06, d: 0.6 }); }
export function falseAlarm() { if (!A) return; tone({ f: 110, f2: 70, type: 'sawtooth', peak: 0.12, d: 0.7 }); burst({ freq: 120, peak: 0.25, d: 0.6, wet: true }); }
export function pickup() { if (!A) return; [880, 1175, 1568, 2093].forEach((f, i) => tone({ t: now() + i * 0.07, f, type: 'triangle', peak: 0.07, d: 0.4 })); }
export function bell(dur = 2.6) { // electric school bell: metallic partials, hammered at ~22 Hz
  if (!A) return; const t = now(), g = A.createGain(), am = A.createOscillator(), amg = A.createGain();
  am.frequency.value = 22; amg.gain.value = 0.5; am.connect(amg).connect(g.gain); g.gain.setValueAtTime(0.5, t); g.gain.setTargetAtTime(0, t + dur, 0.15);
  g.connect(master); g.connect(verb);
  for (const [f, v] of [[1180, 0.08], [2720, 0.04], [3990, 0.025], [590, 0.03]]) { const o = A.createOscillator(), og = A.createGain(); o.type = 'square'; o.frequency.value = f; og.gain.value = v; o.connect(og).connect(g); o.start(t); o.stop(t + dur + 1); }
  am.start(t); am.stop(t + dur + 1);
}
export function scare(soft = false) {
  if (!A) return; const t = now(), k = soft ? 0.35 : 1;
  burst({ freq: 3000, q: 0.5, a: 0.005, peak: 0.6 * k, d: 0.7, wet: true });
  for (const f of [233, 247, 349, 370]) tone({ t, f: f * 2, f2: f, type: 'sawtooth', a: 0.01, peak: 0.08 * k, d: 0.9 });
  tone({ t, f: 60, f2: 30, type: 'sine', a: 0.005, peak: 0.5 * k, d: 0.6, wet: false });
}
export function buzz(on) { // flickering-light buzz
  if (!A) return;
  if (on && !buzzNode) { const o = A.createOscillator(), g = A.createGain(), f = A.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 120; f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2; g.gain.value = 0.03; o.connect(f).connect(g).connect(master); o.start(); buzzNode = { o, g }; }
  if (!on && buzzNode) { buzzNode.o.stop(); buzzNode = null; }
}
export function buzzLevel(v) { if (buzzNode) buzzNode.g.gain.setTargetAtTime(v * 0.04, now(), 0.01); }
export function water(on) {
  if (!A) return;
  if (on && !waterNode) { const s = noiseSrc(true), f = A.createBiquadFilter(), g = A.createGain(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.9; g.gain.value = 0.035; s.connect(f).connect(g).connect(master); s.start(); waterNode = s; }
  if (!on && waterNode) { waterNode.stop(); waterNode = null; }
}
export function stopLoops() { buzz(false); water(false); }
