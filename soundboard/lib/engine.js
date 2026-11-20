/**
 * Shared Web Audio graph.
 * Each tap schedules a new buffer source (overlap / retrigger).
 * When the live voice count would pass the cap, the oldest voices fade out
 * instead of being cut, so fast multi-taps do not click or stick.
 */

import { ATTACK_SEC, MAX_VOICES, RELEASE_SEC, selectVoicesToSteal } from './voices.js';

export function createEngine() {
  let ctx = null;
  let master = null;
  let compressor = null;
  const voices = new Set();
  let seq = 1;

  function context() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.85;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 8;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.08;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const c = context();
    if (c.state === 'suspended') {
      const pending = c.resume();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    }
  }

  function finish(voice) {
    if (voice.finished) return;
    voice.finished = true;
    clearTimeout(voice.timer);
    voices.delete(voice);
    try { voice.src.disconnect(); } catch (_) { /* already gone */ }
    try { voice.gain.disconnect(); } catch (_) { /* already gone */ }
    if (typeof voice.onEnd === 'function') voice.onEnd();
  }

  function live() {
    return [...voices].filter((v) => !v.finished && !v.released);
  }

  function release(id) {
    const voice = [...voices].find((v) => v.id === id);
    if (!voice || voice.finished || voice.released) return;
    voice.released = true;
    const c = context();
    const now = c.currentTime;
    const g = voice.gain.gain;
    let current = 0;
    try { current = g.value; } catch (_) { current = 0; }
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(current, now);
      g.linearRampToValueAtTime(0, now + RELEASE_SEC);
    } catch (_) { /* context closed */ }
    try { voice.src.stop(now + RELEASE_SEC + 0.02); } catch (_) { /* already stopped */ }
    clearTimeout(voice.timer);
    voice.timer = setTimeout(() => finish(voice), (RELEASE_SEC + 0.08) * 1000);
  }

  function play(buffer, { when = 0, onEnd } = {}) {
    const c = context();
    unlock();
    const victims = selectVoicesToSteal(
      live().map((v) => ({ id: v.id, startedAt: v.startedAt })),
      MAX_VOICES,
    );
    for (const id of victims) release(id);

    const id = seq++;
    const startAt = Math.max(c.currentTime, when || c.currentTime);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(1, startAt + ATTACK_SEC);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(master);
    src.start(startAt);

    const voice = {
      id,
      startedAt: startAt,
      gain,
      src,
      released: false,
      finished: false,
      onEnd,
      timer: 0,
    };
    const delay = Math.max(0, startAt - c.currentTime);
    voice.timer = setTimeout(() => finish(voice), (delay + buffer.duration + 0.5) * 1000);
    src.onended = () => finish(voice);
    voices.add(voice);
    return id;
  }

  function stopAll() {
    for (const voice of [...voices]) release(voice.id);
  }

  function setVolume(value) {
    const c = context();
    const v = Math.min(1, Math.max(0, Number(value) || 0));
    if (!master) return;
    const now = c.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(v, now, 0.01);
  }

  function decode(arrayBuffer) {
    const c = context();
    const copy = arrayBuffer.slice(0);
    return c.decodeAudioData(copy);
  }

  return {
    get ctx() { return context(); },
    get activeCount() { return live().length; },
    unlock,
    play,
    stopAll,
    setVolume,
    decode,
  };
}
