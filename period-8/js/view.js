// Panorama viewer: drag/swipe to look around (wraps 360°), pinch or double-tap to zoom, tap to inspect.
// Renders the cached static base + per-frame dynamic layer + overlays (hint glow, inspect ring, reveal, vignette, grain).
import { PW, PH, renderBase, drawDynamic, wrapDelta } from './scenes.js';
import { grain } from './sketch.js';

export const FACES = { hall: ['FORWARD', 'ROOM 8', 'BACK', 'LOCKERS'], class: ['BOARD', 'WINDOWS', 'CLASS', 'DOOR'] };

export class View {
  constructor(canvas, { onTap } = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.onTap = onTap;
    this.camX = 500; this.camY = 500; this.zoom = 1; this.vx = 0; this.S = null; this.base = null; this.t0 = performance.now();
    this.clockBase = 8 * 3600; this.light = [255, 214, 102]; // the clock always reads 8:00 when a loop starts; light = flashlight cosmetic this.hint = null; this.reveal = null; this.rings = []; this.fade = 0; this.walk = 0; this.shake = 0; this.dim = 0;
    this.enabled = true; this.ptrs = new Map(); this.lastTap = 0; this.resize(); addEventListener('resize', () => this.resize());
    this.bind();
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    this.W = r.width || innerWidth; this.H = r.height || innerHeight; this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    const q = Math.max(0.6, Math.min(1.4, this.H * dpr / PH)); if (q !== this.q) { this.q = q; if (this.S) this.base = renderBase(this.S, q); }
  }
  get scale() { return this.H / PH * this.zoom; }
  setScene(S, { camX = 500, keepCam = false } = {}) {
    this.S = S; this.base = renderBase(S, this.q); this.t0 = performance.now(); this.hint = null; this.reveal = null; this.rings = [];
    if (!keepCam) { this.camX = camX; this.camY = 500; this.zoom = 1; this.vx = 0; }
  }
  get t() { return (performance.now() - this.t0) / 1000; }
  toWorld(sx, sy) { const s = this.scale; return [(((this.camX + (sx - this.W / 2) / s) % PW) + PW) % PW, this.camY + (sy - this.H / 2) / s]; }
  clampY() { const half = this.H / 2 / this.scale; this.camY = half * 2 >= PH ? PH / 2 : Math.max(half, Math.min(PH - half, this.camY)); this.camX = ((this.camX % PW) + PW) % PW; }
  setZoom(z, sx = this.W / 2, sy = this.H / 2) { const [wx, wy] = this.toWorld(sx, sy); this.zoom = Math.max(1, Math.min(2.6, z)); const s = this.scale; this.camX = wx - (sx - this.W / 2) / s; this.camY = wy - (sy - this.H / 2) / s; this.clampY(); }
  lookAt(x, y = 500) { this.camX = x; this.camY = y; this.clampY(); }
  face() { return Math.floor((((this.camX + 500) % PW) + PW) % PW / 1000); }

  bind() {
    const cv = this.cv; cv.style.touchAction = 'none';
    let pinch = null, down = null, last = null;
    cv.addEventListener('pointerdown', e => { if (!this.enabled) return; cv.setPointerCapture?.(e.pointerId); this.ptrs.set(e.pointerId, [e.clientX, e.clientY]); this.vx = 0;
      if (this.ptrs.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; last = { x: e.clientX, y: e.clientY, t: performance.now() }; }
      else if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.zoom }; down = null; } });
    cv.addEventListener('pointermove', e => { if (!this.ptrs.has(e.pointerId) || !this.enabled) return; this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.setZoom(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return; }
      if (!last) return; const dx = e.clientX - last.x, dy = e.clientY - last.y, dt = Math.max(1, performance.now() - last.t);
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9) down.moved = true;
      if (down?.moved) { const s = this.scale; this.camX -= dx / s; this.camY -= dy / s; this.clampY(); this.vx = -dx / s / dt * 16; }
      last = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    const up = e => { if (!this.ptrs.has(e.pointerId)) return; this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) pinch = null;
      if (down && !down.moved && performance.now() - down.t < 350 && this.enabled) {
        const nowT = performance.now(), r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        if (nowT - this.lastTap < 300) { this.setZoom(this.zoom > 1.3 ? 1 : 2, sx, sy); this.lastTap = 0; }
        else { this.lastTap = nowT; const [wx, wy] = this.toWorld(sx, sy); this.rings.push({ x: wx, y: wy, t: this.t }); this.onTap?.(wx, wy); }
      }
      if (this.ptrs.size === 0) { down = null; last = null; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) this.setZoom(this.zoom * (e.deltaY < 0 ? 1.12 : 0.89), e.offsetX, e.offsetY); else { this.camX += e.deltaX / this.scale; this.clampY(); } }, { passive: false });
    addEventListener('keydown', e => { if (!this.enabled) return; if (e.key === 'ArrowLeft') this.vx = -18; if (e.key === 'ArrowRight') this.vx = 18; });
  }

  frame(dt) {
    if (!this.S) return;
    if (!this.ptrs.size && Math.abs(this.vx) > 0.05) { this.camX += this.vx * dt * 60 / this.zoom; this.vx *= Math.pow(0.9, dt * 60); this.clampY(); }
    const c = this.ctx, d = this.dpr, s = this.scale, W = this.W, H = this.H, t = this.t;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0a090c'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    const walkZ = 1 + this.walk * 0.6, sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 18 : 0;
    for (const k of [-1, 0, 1]) {
      const ox = W / 2 - (this.camX - k * PW) * s * walkZ, oy = H / 2 - this.camY * s * walkZ;
      if (ox > W || ox + PW * s * walkZ < 0) continue;
      c.setTransform(d * s * walkZ, 0, 0, d * s * walkZ, d * (ox + sh), d * (oy + sh));
      c.drawImage(this.base, 0, 0, PW, PH);
      drawDynamic(c, this.S, t, this.camX, this.clockBase);
      this.overlays(c, t);
    }
    c.setTransform(d, 0, 0, d, 0, 0);
    // screen-space: hint arrow when the highlighted area is off-screen
    if (this.hint) { const dx = wrapDelta(this.hint.x, this.camX) * s; if (Math.abs(dx) > W / 2 - 20) { const dir = Math.sign(dx), y = H * 0.5; c.save(); c.fillStyle = `rgba(${this.light},${0.6 + Math.sin(t * 6) * 0.3})`; c.beginPath(); const x = dir > 0 ? W - 18 : 18; c.moveTo(x, y); c.lineTo(x - dir * 26, y - 22); c.lineTo(x - dir * 26, y + 22); c.fill(); c.restore(); } }
    // vignette + grain + dread
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,3,8,${0.55 + this.dim * 0.3})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.5; c.fillStyle = c.createPattern(grain(), 'repeat'); c.translate((Math.random() * 192) | 0, (Math.random() * 192) | 0); c.fillRect(-192, -192, W + 384, H + 384); c.restore();
    if (this.fade > 0) { c.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade)})`; c.fillRect(0, 0, W, H); }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2);
  }
  overlays(c, t) {
    if (this.hint) { const { x, y, r } = this.hint; const p = 0.5 + Math.sin(t * 5) * 0.5; c.save(); c.strokeStyle = `rgba(${this.light},${0.5 + p * 0.5})`; c.lineWidth = 6; c.setLineDash([18, 12]); c.lineDashOffset = -t * 40; c.beginPath(); c.arc(x, y, r * (1 + p * 0.08), 0, 7); c.stroke();
      const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 1.2); g.addColorStop(0, `rgba(${this.light},0.12)`); g.addColorStop(1, `rgba(${this.light},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.2, 0, 7); c.fill(); c.restore(); }
    if (this.reveal) { const [x, y, w, h] = this.reveal.region; c.save(); c.strokeStyle = '#ff5a4f'; c.lineWidth = 6; c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2 + 26, h / 2 + 26, 0, 0, 7); c.stroke(); c.restore(); }
    this.rings = this.rings.filter(r => t - r.t < 0.6);
    for (const r of this.rings) { const k = (t - r.t) / 0.6; c.save(); c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; c.lineWidth = 3; c.beginPath(); c.arc(r.x, r.y, 14 + k * 40, 0, 7); c.stroke(); c.restore(); }
  }
  showHint(region) { const [x, y, w, h] = region; this.hint = { x: x + w / 2, y: y + h / 2, r: Math.max(w, h) / 2 + 40 }; }
  /** Capture the current view (no UI) as a canvas, optionally framed 9:16 with a watermark. */
  capture({ vertical = false, watermark = true } = {}) {
    const out = document.createElement('canvas'); const src = this.cv;
    if (!vertical) { out.width = src.width; out.height = src.height; out.getContext('2d').drawImage(src, 0, 0); }
    else { out.height = 1920; out.width = 1080; const x = out.getContext('2d'); const sw = Math.min(src.width, src.height * 9 / 16); x.drawImage(src, (src.width - sw) / 2, 0, sw, src.height, 0, 0, 1080, 1920); }
    if (watermark) { const x = out.getContext('2d'), k = out.height / 1000; x.save(); x.font = `900 ${28 * k}px system-ui, sans-serif`; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,0.8)'; x.shadowColor = '#000'; x.shadowBlur = 8; x.fillText('PERIOD 8', out.width - 20 * k, out.height - 24 * k); x.restore(); }
    return out;
  }
}
