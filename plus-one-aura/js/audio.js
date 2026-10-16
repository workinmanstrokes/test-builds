// Tiny WebAudio synth. All sounds are generated from the active skin's `sound` spec.
let ctx = null, master = null, enabled = true, skin = null, root = 57;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
export function setSkinAudio(s, stageRoot) { skin = s; root = stageRoot; }
export function setSound(on) { enabled = on; }
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
}
function tone(freq, { wave = 'sine', dur = 0.1, gain = 0.15, detune = 0 } = {}, at = 0) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.value = freq; o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
export function sfx(name, arg = 0) {
  if (!ctx || !enabled || !skin) return;
  const S = skin.sound;
  switch (name) {
    case 'tap': { const sc = S.scale; const step = Math.min(Math.floor(arg / 2), sc.length * 2 - 1); const m = root + sc[step % sc.length] + 12 * Math.floor(step / sc.length); tone(midi(m), { ...S.tap, detune: (Math.random() - 0.5) * S.tap.detune }); break; }
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
