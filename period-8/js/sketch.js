// Hand-drawn-style canvas helpers: wobbly double-stroked lines, jittered fills, hatching, chalk/marker text.
// Everything is seeded, so a scene redraws identically every loop (anomalies are the only differences).
export function makeRng(seed) {
  let s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0 || 0x9e3779b9;
  for (let i = 0; i < 4; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; }
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export const HAND = '"Comic Sans MS", "Chalkboard SE", "Segoe Print", casual, cursive';
export const INK = '#2b2522';

export class Pen {
  constructor(ctx) { this.c = ctx; this.r = makeRng(1); this.ink = INK; this.w = 3; this.wob = 1.6; }
  at(key) { this.r = makeRng(typeof key === 'number' ? key : hash(key)); return this; }
  j(a = this.wob) { return (this.r() - 0.5) * 2 * a; }
  line(x1, y1, x2, y2, w = this.w, col = this.ink, passes = 2) {
    const c = this.c; const a0 = c.globalAlpha; c.save(); c.strokeStyle = col; c.lineCap = 'round';
    const len = Math.hypot(x2 - x1, y2 - y1), bow = Math.min(4, len * 0.012);
    for (let p = 0; p < passes; p++) {
      c.globalAlpha = a0 * (p ? 0.55 : 0.9); c.lineWidth = w * (p ? 0.6 : 1);
      const mx = (x1 + x2) / 2 + this.j(bow), my = (y1 + y2) / 2 + this.j(bow);
      c.beginPath(); c.moveTo(x1 + this.j(), y1 + this.j()); c.quadraticCurveTo(mx, my, x2 + this.j(), y2 + this.j()); c.stroke();
    }
    c.restore();
  }
  path(pts, close = true) { const c = this.c; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x + this.j(0.8), y + this.j(0.8)) : c.moveTo(x + this.j(0.8), y + this.j(0.8))); if (close) c.closePath(); }
  poly(pts, fill, stroke = this.ink, w = this.w) {
    if (fill) { this.c.fillStyle = fill; this.path(pts); this.c.fill(); }
    if (stroke) for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; this.line(a[0], a[1], b[0], b[1], w, stroke); }
  }
  rect(x, y, w, h, fill, stroke = this.ink, lw = this.w) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, stroke, lw); }
  ellipse(cx, cy, rx, ry, fill, stroke = this.ink, lw = this.w, rot = 0) {
    const c = this.c, n = 22, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot) + this.j(0.6), cy + x * Math.sin(rot) + y * Math.cos(rot) + this.j(0.6)]); }
    if (fill) { c.fillStyle = fill; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
    if (stroke) { const a0 = c.globalAlpha; c.save(); c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.globalAlpha = a0 * 0.9; c.beginPath(); const s = this.r() * n | 0;
      for (let i = 0; i <= n + 1; i++) { const [x, y] = pts[(s + i) % n]; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); }
  }
  circle(cx, cy, r, fill, stroke, lw) { this.ellipse(cx, cy, r, r, fill, stroke, lw); }
  hatch(pts, gap = 14, col = this.ink, alpha = 0.18, angle = -0.9, lw = 1.6) {
    const c = this.c; c.save(); this.path(pts); c.clip();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), d = (x1 - x0) + (y1 - y0);
    c.strokeStyle = col; c.globalAlpha = alpha; c.lineWidth = lw; c.beginPath();
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (let t = -d; t < d; t += gap) { const ox = (x0 + x1) / 2 + t * -dy, oy = (y0 + y1) / 2 + t * dx; c.moveTo(ox - dx * d + this.j(2), oy - dy * d + this.j(2)); c.lineTo(ox + dx * d + this.j(2), oy + dy * d + this.j(2)); }
    c.stroke(); c.restore();
  }
  shade(pts, col = 'rgba(30,20,40,0.18)') { this.c.fillStyle = col; this.path(pts); this.c.fill(); }
  text(str, x, y, size = 30, col = this.ink, align = 'center', font = HAND, weight = 700, rot = 0) {
    const c = this.c; c.save(); c.translate(x, y); c.rotate(rot + this.j(0.012)); c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle';
    const a0 = c.globalAlpha; c.fillStyle = col; c.globalAlpha = a0 * 0.95; c.fillText(str, 0, 0); c.globalAlpha = a0 * 0.35; c.fillText(str, this.j(1.2), this.j(1.2)); c.restore();
  }
  chalk(str, x, y, size = 30, col = 'rgba(240,240,230,0.9)', align = 'left', rot = 0) {
    const c = this.c; c.save(); c.translate(x, y); c.rotate(rot); c.font = `700 ${size}px ${HAND}`; c.textAlign = align; c.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) { c.globalAlpha = [0.75, 0.35, 0.25][i]; c.fillStyle = col; c.fillText(str, this.j(1.3), this.j(1.3)); } c.restore();
  }
}

let grainTile = null;
export function grain() {
  if (grainTile) return grainTile;
  const g = document.createElement('canvas'); g.width = g.height = 192; const x = g.getContext('2d'); const d = x.createImageData(192, 192); const r = makeRng(7);
  for (let i = 0; i < d.data.length; i += 4) { const v = 120 + r() * 135 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = r() < 0.5 ? 26 : 0; }
  x.putImageData(d, 0, 0); return (grainTile = g);
}
/** Paper fibre texture multiplied over a finished base drawing. */
export function paperize(ctx, w, h, seed = 3) {
  const r = makeRng(seed); ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.05; ctx.strokeStyle = '#6b5a48'; ctx.lineWidth = 1;
  for (let i = 0; i < w * h / 9000; i++) { const x = r() * w, y = r() * h, a = r() * 6.28, l = 6 + r() * 18; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  ctx.restore();
}
export const lerp = (a, b, t) => a + (b - a) * t;
