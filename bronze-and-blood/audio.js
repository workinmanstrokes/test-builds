'use strict';

/* Synthesised sound: no audio files. Everything is built from oscillators and noise. */
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  const lastPlayed = {};

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(type, f0, f1, dur, vol, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, q = 1, delay = 0) {
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  const sounds = {
    tap:     () => tone('triangle', 520, 420, 0.06, 0.12),
    select:  () => { tone('triangle', 440, 660, 0.08, 0.14); },
    order:   () => { tone('sine', 330, 250, 0.09, 0.14); },
    deny:    () => { tone('square', 160, 110, 0.14, 0.08); },
    train:   () => { tone('triangle', 392, 392, 0.09, 0.14); tone('triangle', 587, 587, 0.14, 0.14, 0.08); },
    hit:     () => { noise(0.07, 0.22, 900, 0.8); tone('square', 150, 70, 0.07, 0.07); },
    arrow:   () => { noise(0.09, 0.1, 3200, 2.5); },
    death:   () => { tone('sawtooth', 190, 55, 0.28, 0.1); noise(0.14, 0.12, 400, 0.7); },
    gather:  () => { tone('sine', 880, 1175, 0.07, 0.035); },
    bronze:  () => { tone('triangle', 660, 660, 0.3, 0.16); tone('triangle', 990, 990, 0.4, 0.1, 0.05); noise(0.05, 0.2, 5000, 3); },
    tech:    () => { [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, f, 0.3, 0.13, i * 0.08)); },
    city:    () => { tone('sine', 90, 40, 0.3, 0.4); noise(0.2, 0.25, 180, 0.6); },
    repair:  () => { noise(0.05, 0.2, 2200, 4); noise(0.05, 0.2, 2200, 4, 0.12); },
    horn:    () => { tone('sawtooth', 110, 147, 0.9, 0.16); tone('sawtooth', 165, 220, 0.9, 0.08, 0.02); },
    clear:   () => { [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.26, 0.13, i * 0.1)); },
    boss:    () => { tone('sawtooth', 73, 55, 1.4, 0.22); tone('sawtooth', 110, 82, 1.4, 0.12, 0.05); noise(0.6, 0.14, 140, 0.5); },
    victory: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.5, 0.15, i * 0.13)); },
    defeat:  () => { [330, 262, 196, 131].forEach((f, i) => tone('sawtooth', f, f * 0.94, 0.6, 0.1, i * 0.22)); }
  };
  // Minimum gap per sound so a big melee does not turn into a wall of noise
  const gaps = { hit: 0.07, arrow: 0.08, death: 0.1, gather: 0.5, city: 0.25 };

  return {
    unlock() { if (ensure() && ac.state === 'suspended') ac.resume(); },
    play(name) {
      if (muted || !ensure() || ac.state !== 'running' || !sounds[name]) return;
      const now = ac.currentTime, gap = gaps[name] || 0.02;
      if (lastPlayed[name] && now - lastPlayed[name] < gap) return;
      lastPlayed[name] = now;
      sounds[name]();
    },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; }
  };
})();
