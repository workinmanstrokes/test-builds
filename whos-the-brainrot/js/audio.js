// All sounds are synthesized in code with WebAudio (no samples, no songs). Original sound bites only.
let ctx = null, master = null, on = true, vol = 0.8;
const level = () => (on ? 0.7 * vol : 0);
export function setSound(v) { on = v; if (master) master.gain.value = level(); }
export function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = level(); }
/** Silence everything while the game is paused / in the background. */
export function suspendAudio(yes) { if (!ctx) return; try { yes ? ctx.suspend() : ctx.resume(); } catch {} }
export function unlockAudio() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
}
const ok = () => on && vol > 0 && ctx && ctx.state === 'running';
function tone(f, t0, dur, { type = 'sine', vol = 0.3, to = null, attack = 0.005, curve = 'exp' } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (to) curve === 'lin' ? o.frequency.linearRampToValueAtTime(to, t0 + dur) : o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02); return o;
}
let noiseBuf = null;
function noise(t0, dur, { vol = 0.3, hp = 800, lp = 9000 } = {}) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), g = ctx.createGain(), h = ctx.createBiquadFilter(), l = ctx.createBiquadFilter();
  s.buffer = noiseBuf; h.type = 'highpass'; h.frequency.value = hp; l.type = 'lowpass'; l.frequency.value = lp;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(h).connect(l).connect(g).connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
}
const now = () => ctx.currentTime + 0.01;
export const sfx = {
  ui() { if (!ok()) return; tone(660, now(), 0.06, { type: 'triangle', vol: 0.2, to: 990 }); },
  back() { if (!ok()) return; tone(520, now(), 0.07, { type: 'triangle', vol: 0.18, to: 330 }); },
  boing() { if (!ok()) return; const t = now(); tone(140, t, 0.35, { type: 'sine', vol: 0.4, to: 620 }); tone(280, t, 0.3, { type: 'triangle', vol: 0.12, to: 1240 }); },
  tick(hi) { if (!ok()) return; tone(hi ? 1400 : 1000, now(), 0.04, { type: 'square', vol: 0.08 }); },
  buzzer() { if (!ok()) return; const t = now(); tone(110, t, 0.7, { type: 'sawtooth', vol: 0.25 }); tone(116, t, 0.7, { type: 'sawtooth', vol: 0.2 }); },
  secret() { if (!ok()) return; const t = now(); [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.25, { type: 'triangle', vol: 0.18 })); noise(t + 0.28, 0.3, { vol: 0.05, hp: 6000 }); },
  brainrot() { // wobbly "bwoowoowomp"
    if (!ok()) return; const t = now(); const o = tone(420, t, 0.9, { type: 'sawtooth', vol: 0.22, to: 70 });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 14; lg.gain.value = 40; lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 0.92);
    tone(60, t + 0.05, 0.6, { type: 'sine', vol: 0.4, to: 35 });
  },
  boom() { if (!ok()) return; const t = now(); tone(95, t, 1.1, { type: 'sine', vol: 0.7, to: 32 }); tone(190, t, 0.25, { type: 'triangle', vol: 0.3, to: 60 }); noise(t, 0.35, { vol: 0.35, hp: 60, lp: 1800 }); },
  drumroll(sec = 2.4) { if (!ok()) return; const t = now(); let x = 0, gap = 0.09; while (x < sec) { noise(t + x, 0.06, { vol: 0.12 + 0.18 * (x / sec), hp: 1500, lp: 7000 }); x += gap; gap = Math.max(0.028, gap * 0.95); } },
  horn() { if (!ok()) return; const t = now(); [0, 0.22, 0.44].forEach((d, i) => { [311, 392, 466].forEach(f => tone(f * (i === 2 ? 1.12 : 1), t + d, i === 2 ? 0.5 : 0.17, { type: 'sawtooth', vol: 0.08, attack: 0.01 })); }); },
  fanfare() { if (!ok()) return; const t = now(); [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, i === 6 ? 0.6 : 0.14, { type: 'square', vol: 0.09 })); },
  sad() { if (!ok()) return; const t = now(); [392, 370, 349, 294].forEach((f, i) => tone(f, t + i * 0.32, i === 3 ? 0.9 : 0.3, { type: 'sawtooth', vol: 0.12, to: i === 3 ? 260 : f * 0.98, curve: 'lin' })); },
  whoosh() { if (!ok()) return; const t = now(); noise(t, 0.35, { vol: 0.15, hp: 400, lp: 3000 }); tone(300, t, 0.3, { type: 'sine', vol: 0.06, to: 900 }); },
  /** Gibberish "voice" saying a character's name: one blip per syllable, pitch from the character. */
  voice(name, pitch = 260) {
    if (!ok()) return; const t = now(); const syl = Math.min(10, Math.max(3, (name.match(/[aeiou]+/gi) || []).length));
    for (let i = 0; i < syl; i++) { const f = pitch * (1 + 0.35 * Math.sin(i * 2.1 + pitch)); tone(f, t + i * 0.09, 0.08, { type: 'square', vol: 0.08, to: f * 1.2 }); tone(f * 2, t + i * 0.09, 0.06, { type: 'sine', vol: 0.04 }); }
  },
};
