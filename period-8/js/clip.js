// "Spot the anomaly in 3 seconds" clip mode: vertical 9:16, quick-fire rounds, built to be screen-recorded for
// Shorts / TikTok / Reels. Top panel = normal, bottom panel = the same spot with one anomaly. Tap it before time runs out.
import { renderBase, drawDynamic, PW, PH } from './scenes.js';
import { COMMON } from './anomalies.js';
import { stateFor, inRegion } from './game.js';
import { grain } from './sketch.js';
import * as sfx from './audio.js';
export const ROUNDS = 10, SECONDS = 3;

export class Clip {
  constructor(root, { onExit, onSave, save }) {
    this.root = root; this.onExit = onExit; this.onSave = onSave; this.save = save;
    this.cv = root.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    this.pool = COMMON.filter(a => a.region[2] <= 560 && a.region[3] <= 480);
    this.cv.addEventListener('pointerdown', e => this.tap(e));
  }
  start() {
    this.root.hidden = false; this.score = 0; this.round = 0; this.times = []; this.results = [];
    const bag = [...this.pool].sort(() => Math.random() - 0.5); this.queue = bag.slice(0, ROUNDS);
    this.running = true; this.resize(); this.next(); const loop = () => { if (!this.running) return; this.draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  stop() { this.running = false; this.root.hidden = true; }
  resize() { const d = Math.min(2, devicePixelRatio || 1); const r = this.cv.getBoundingClientRect(); this.W = r.width; this.H = r.height; this.cv.width = r.width * d; this.cv.height = r.height * d; this.d = d; }
  next() {
    if (this.round >= ROUNDS) return this.finish();
    const a = this.queue[this.round++]; const [rx, ry, rw, rh] = a.region;
    const cw = 600, ch = cw * 8 / 9; // each panel is 9:8 so two stacked panels fill 9:16
    const sx = rx + rw / 2 - cw / 2 + (Math.random() - 0.5) * Math.max(0, cw - rw - 80), sy = Math.max(0, Math.min(PH - ch, ry + rh / 2 - ch / 2 + (Math.random() - 0.5) * Math.max(0, ch - rh - 80)));
    const N = stateFor({ scene: a.scene, anomaly: null }), S = stateFor({ scene: a.scene, anomaly: a.id });
    const snap = st => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; c.getContext('2d').drawImage(renderBase(st, 1), 0, 0); return c; };
    this.cur = { a, sx, sy, cw, ch, N, S, normal: snap(N), odd: snap(S), phase: 'count', t0: performance.now(), tap: null };
    sfx.ui();
  }
  get t() { return (performance.now() - this.cur.t0) / 1000; }
  tap(e) {
    const c = this.cur; if (!c) return;
    if (this.phase === 'done') return;
    if (c.phase !== 'play') return;
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, L = this.layout();
    if (y < L.by || y > L.by + L.ph) return;
    const wx = c.sx + (x - L.px) / L.pw * c.cw, wy = c.sy + (y - L.by) / L.ph * c.ch;
    this.resolve(inRegion(c.a.region, wx, wy, 40), [wx, wy]);
  }
  resolve(hit, at = null) {
    const c = this.cur; c.phase = 'reveal'; c.hit = hit; c.tap = at; c.rt = this.t - 1.2; c.t1 = performance.now();
    if (hit) { this.score++; this.times.push(c.rt); sfx.correct(this.score); } else sfx.falseAlarm();
    this.results.push({ id: c.a.id, hit, rt: hit ? c.rt : null });
    setTimeout(() => this.next(), 1700);
  }
  finish() {
    this.cur = null; this.phase = 'done'; const best = Math.max(this.save.clipBest || 0, this.score); this.save.clipBest = best; this.onSaveData?.();
    const avg = this.times.length ? (this.times.reduce((a, b) => a + b, 0) / this.times.length).toFixed(2) : '–';
    const card = this.root.querySelector('.clip-result'); card.hidden = false;
    card.querySelector('.res-score').textContent = `${this.score}/${ROUNDS}`; card.querySelector('.res-sub').textContent = `avg ${avg}s · best ${best}/${ROUNDS}`;
    this.finalScore = this.score;
  }
  again() { this.root.querySelector('.clip-result').hidden = true; this.phase = null; this.start(); }
  layout() { const W = this.W, H = this.H, fw = Math.min(W, H * 9 / 16), fx = (W - fw) / 2, top = H * 0.125, ph = (H * 0.74 - 10) / 2; const pw = Math.min(fw, ph * 9 / 8); const px = (W - pw) / 2; return { fw, fx, top, ph: pw * 8 / 9, pw, px, ay: top, by: top + pw * 8 / 9 + 10 }; }
  draw() {
    const c = this.ctx, d = this.d, W = this.W, H = this.H, L = this.layout(); c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#0a090c'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#141018'; c.fillRect(L.fx, 0, L.fw, H);
    c.textAlign = 'center'; c.fillStyle = '#f2c94c'; c.font = `900 ${Math.round(L.fw * 0.065)}px system-ui, sans-serif`; c.fillText('SPOT THE ANOMALY', W / 2, H * 0.055);
    c.fillStyle = '#fff'; c.font = `800 ${Math.round(L.fw * 0.05)}px system-ui, sans-serif`; c.fillText('IN 3 SECONDS', W / 2, H * 0.095);
    const cur = this.cur;
    if (cur) {
      const t = this.t, panel = (img, y, label, st) => { c.save(); c.beginPath(); c.rect(L.px, y, L.pw, L.ph); c.clip(); const s = L.pw / cur.cw; c.setTransform(d * s, 0, 0, d * s, d * (L.px - cur.sx * s), d * (y - cur.sy * s)); c.drawImage(img, 0, 0); drawDynamic(c, st, t, cur.sx + cur.cw / 2, 52320);
        if (st === cur.S && cur.phase === 'reveal') { const [x, yy, w, h] = cur.a.region; c.strokeStyle = cur.hit ? '#3ddc84' : '#ff5a4f'; c.lineWidth = 6 / s * 1.4; c.beginPath(); c.ellipse(x + w / 2, yy + h / 2, w / 2 + 20, h / 2 + 20, 0, 0, 7); c.stroke(); }
        c.restore(); c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(L.px + 8, y + 8, 92, 26); c.fillStyle = '#fff'; c.font = '800 14px system-ui, sans-serif'; c.textAlign = 'left'; c.fillText(label, L.px + 16, y + 26); };
      panel(cur.normal, L.ay, 'NORMAL', cur.N); panel(cur.odd, L.by, 'FIND IT', cur.S);
      c.save(); c.globalAlpha = 0.35; c.fillStyle = c.createPattern(grain(), 'repeat'); c.fillRect(L.px, L.ay, L.pw, L.ph * 2 + 10); c.restore();
      const bar = H * 0.115;
      if (cur.phase === 'count') { const n = 3 - Math.floor(t / 0.4); if (t >= 1.2) { cur.phase = 'play'; } c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(L.px, L.by, L.pw, L.ph); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `900 ${Math.round(L.pw * 0.25)}px system-ui, sans-serif`; c.fillText(n > 0 ? String(n) : 'GO', W / 2, L.by + L.ph / 2 + L.pw * 0.08); }
      if (cur.phase === 'play') { const left = Math.max(0, SECONDS - (t - 1.2)); if (left <= 0) this.resolve(false);
        c.fillStyle = '#2a2430'; c.fillRect(L.px, bar, L.pw, 10); c.fillStyle = left < 1 ? '#ff5a4f' : '#f2c94c'; c.fillRect(L.px, bar, L.pw * left / SECONDS, 10);
        c.fillStyle = '#fff'; c.textAlign = 'right'; c.font = '900 22px system-ui, sans-serif'; c.fillText(left.toFixed(1) + 's', L.px + L.pw - 8, L.by + L.ph - 12); }
      if (cur.phase === 'reveal') { c.textAlign = 'center'; c.font = `900 ${Math.round(L.pw * 0.07)}px system-ui, sans-serif`; c.fillStyle = cur.hit ? '#3ddc84' : '#ff5a4f'; c.fillText(cur.hit ? `SPOTTED ${cur.rt.toFixed(2)}s` : 'MISSED', W / 2, L.by + L.ph + 34);
        c.fillStyle = '#ddd'; c.font = `700 ${Math.round(L.pw * 0.04)}px system-ui, sans-serif`; c.fillText(cur.a.name, W / 2, L.by + L.ph + 62); }
    }
    c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = '800 16px system-ui, sans-serif'; c.fillText(`ROUND ${Math.min(this.round, ROUNDS)}/${ROUNDS}`, L.fx + 12, H - 16);
    c.textAlign = 'right'; c.fillText(`SCORE ${this.score}`, L.fx + L.fw - 12, H - 16); c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText('PERIOD 8', W / 2, H - 16);
  }
  resultCard() { // shareable 1080x1920 result image
    const o = document.createElement('canvas'); o.width = 1080; o.height = 1920; const c = o.getContext('2d');
    c.drawImage(this.cv, (this.cv.width - Math.min(this.cv.width, this.cv.height * 9 / 16)) / 2, 0, Math.min(this.cv.width, this.cv.height * 9 / 16), this.cv.height, 0, 0, 1080, 1920);
    c.fillStyle = 'rgba(10,8,14,0.82)'; c.fillRect(90, 640, 900, 640); c.textAlign = 'center'; c.fillStyle = '#f2c94c'; c.font = '900 80px system-ui, sans-serif'; c.fillText('I SPOTTED', 540, 790);
    c.fillStyle = '#fff'; c.font = '900 220px system-ui, sans-serif'; c.fillText(`${this.finalScore}/${ROUNDS}`, 540, 1020); c.font = '800 54px system-ui, sans-serif'; c.fillText('Can you beat me?', 540, 1130); c.fillStyle = '#bbb'; c.font = '700 40px system-ui, sans-serif'; c.fillText('PERIOD 8 · free to play', 540, 1210);
    return o;
  }
}
