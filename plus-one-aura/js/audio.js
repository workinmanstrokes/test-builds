// Tiny WebAudio synth. All sounds are generated from the active skin's `sound` spec.
let ctx = null, master = null, musicBus = null, enabled = true, skin = null, root = 57, stage = 0, sfxVol = 0.8, musicVol = 0.5, musicT = 0, bar = 0;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
export function setSkinAudio(s, stageRoot, si = 0) { skin = s; root = stageRoot; stage = si; }
export function setSound(on) { enabled = on; }
export function setVolumes(sfx, music) { sfxVol = sfx; musicVol = music; if (master) master.gain.value = sfxVol; if (musicBus) musicBus.gain.value = musicVol * 0.5; }
export function suspendAudio(yes) { if (!ctx) return; if (yes) ctx.suspend?.(); else ctx.resume?.(); }
// Ambient music: a slow, original synthesized pad on the current stage's root (no samples, no licensed tracks).
const PROG = [[0, 7, 12, 16], [-3, 4, 9, 12], [5, 9, 12, 17], [2, 7, 11, 14]];
function musicTick() {
  if (!ctx || !musicBus || !enabled || musicVol <= 0 || ctx.state !== 'running') return;
  const chord = PROG[bar++ % PROG.length], t = ctx.currentTime;
  for (const c of chord) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = midi(root - 12 + c);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 4.5);
  }
}
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = sfxVol; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.5; musicBus.connect(ctx.destination);
  musicTick(); musicT = setInterval(musicTick, 4000);
}
function tone(freq, { wave = 'sine', dur = 0.1, gain = 0.15, detune = 0 } = {}, at = 0) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.value = freq; o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
// Filtered noise burst: the building block for clacks, splashes and plinks.
function noise({ dur = 0.05, gain = 0.2, type = 'bandpass', freq = 2000, q = 1, to = null, at = 0 } = {}) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + at, len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = b; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.value = gain; src.connect(f); f.connect(g); g.connect(master); src.start(t);
}
// Pitch-swept tone (water plinks, drops).
function sweep(from, to, { wave = 'sine', dur = 0.12, gain = 0.15, at = 0 } = {}) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
const api = { tone, noise, sweep, midi, get root() { return root; }, get stage() { return stage; } };

// Aurie look tap-sound override (partial tone() opts merged onto skin.sound.tap); null = skin default.
let tapOv = null;
export function setTapSound(o) { tapOv = o || null; }
export function sfx(name, arg = 0) {
  if (!ctx || !enabled || !skin) return;
  const S = skin.sound;
  if (S.play && S.play(name, api, arg) !== false) return;  // skins with fully custom sound design
  switch (name) {
    case 'tap': { const sc = S.scale; const step = Math.min(Math.floor(arg / 2), sc.length * 2 - 1); const m = root + sc[step % sc.length] + 12 * Math.floor(step / sc.length); const T = tapOv ? { ...S.tap, ...tapOv } : S.tap; tone(midi(m), { ...T, detune: (Math.random() - 0.5) * T.detune }); break; }
    case 'golden': [0, 7, 12, 19, 24].forEach((c, i) => tone(midi(root + 12 + c), { wave: 'triangle', dur: 0.22, gain: 0.14 }, i * 0.05)); break;
    case 'burst': tone(midi(root + 24), S.burst); tone(midi(root + 31), S.burst, 0.05); break;
    case 'bank': S.bank.chord.forEach((c, i) => tone(midi(root + 12 + c), S.bank, i * 0.03)); break;
    case 'unlock': S.unlock.arp.forEach((c, i) => tone(midi(root + c), { wave: S.unlock.wave, dur: 0.25, gain: 0.15 }, i * S.unlock.step)); break;
    case 'levelUp': S.levelUp.arp.forEach((c, i) => tone(midi(root + 12 + c), { wave: S.levelUp.wave, dur: 0.2, gain: 0.12 }, i * S.levelUp.step)); break;
    case 'buy': S.buy.arp.forEach((c, i) => tone(midi(root + c), { wave: S.buy.wave, dur: 0.08, gain: 0.07 }, i * S.buy.step)); break;
    case 'overheat': {
      const o = S.overheat, t = ctx.currentTime;
      const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(o.from, t); osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
      g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + o.dur);
      if (o.noise) { const len = ctx.sampleRate * o.dur, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); const n = ctx.createBufferSource(), ng = ctx.createGain(); ng.gain.value = 0.12; n.buffer = b; n.connect(ng); ng.connect(master); n.start(t); }
      break;
    }
  }
}
