// Procedurally drawn, hand-drawn-style 360° panoramas: the hallway outside Room 8 and Room 8 itself.
// Panorama space is 4000 x 1000 (four 1000-wide faces that wrap). Static parts are rendered once per loop
// into a cached base canvas; clocks, eyes, water, flicker etc. are drawn every frame by drawDynamic().
import { Pen, INK, paperize, HAND } from './sketch.js';

export const PW = 4000, PH = 1000;
const C = { wall: '#e8ddc3', wall2: '#dccfb1', ceil: '#d7d0bf', locker: '#5e8c87', locker2: '#507a75', wood: '#9a6a43', wood2: '#7d5434',
  floorA: '#d4c9b0', floorB: '#958a77', band: '#6f8d68', board: '#2f4a3c', sky: '#cfe0ea', skin: ['#f1c9a5', '#c99872', '#8d5a3b', '#e6b48c', '#5f3b28', '#f4d3b8', '#b07a55'] };

export const HALL_DEFAULT = {
  scene: 'hall', zf: 5, lightsOut: false, figure: false, handprints: false, footprints: false, ceilingHole: false, extraDoor: false,
  lockers: 12, openLocker: -1, hallPass: false, posters: ['SCIENCE|FAIR', 'BE|KIND', 'LOST &|FOUND'], posterMissing: -1,
  plaque: '8', portrait: 'normal', clock: 'normal', flicker: false, fountain: false, extinguisher: 'normal',
  student: 'normal', tree: 'normal', trophyYou: false, banner: 'GO HORNETS!',
};
export const CLASS_DEFAULT = {
  scene: 'class', board: 'normal', clock: 'normal', shadow: false, apple: 'normal', globe: false, night: false, blinds: false,
  plant: 'normal', chart: 'normal', map: 'normal', students: 'normal', noface: -1, extraDesk: false, doorFace: false,
  backpack: false, poster: 'READ',
};

/* ---------------------------------------------------------------- shared bits */
function flatWall(P, ox, { floor = 'tile', top = 110, wainscot = true, block = true, wall = C.wall } = {}) {
  const c = P.c;
  P.at('ceil' + ox).rect(ox, -5, 1000, top + 5, C.ceil, null);
  c.save(); c.globalAlpha = 0.25; for (let x = ox; x <= ox + 1000; x += 125) P.line(x, 0, x, top, 1.5); P.line(ox, top * 0.5, ox + 1000, top * 0.5, 1.5); c.restore();
  P.rect(ox, top, 1000, 820 - top, wall, null);
  if (block) { c.save(); c.globalAlpha = 0.13; for (let y = top + 50, r = 0; y < 820; y += 52, r++) { P.line(ox, y, ox + 1000, y, 1.4); for (let x = ox + (r % 2) * 60; x < ox + 1000; x += 120) P.line(x, y - 52, x, y, 1.2); } c.restore(); }
  if (wainscot) { P.rect(ox, 560, 1000, 34, C.band, null); P.rect(ox, 594, 1000, 226, C.wall2, null); P.line(ox, 560, ox + 1000, 560, 2.5); P.line(ox, 594, ox + 1000, 594, 2.5); }
  P.line(ox, top, ox + 1000, top, 3);
  // floor with a gentle fan perspective
  const rows = [820, 846, 880, 925, 985, 1060], cx = ox + 500, k = y => 1 + (y - 820) / 180 * 0.9;
  for (let i = 0; i < rows.length - 1; i++) for (let x = ox - 400, n = 0; x < ox + 1400; x += 90, n++) {
    const y0 = rows[i], y1 = rows[i + 1], X = (xx, y) => cx + (xx - cx) * k(y);
    const fill = floor === 'wood' ? ((n + i) % 3 ? '#b88a5c' : '#a77a4f') : ((n + i) % 2 ? C.floorA : C.floorB);
    c.fillStyle = fill; c.beginPath(); c.moveTo(X(x, y0), y0); c.lineTo(X(x + 90, y0), y0); c.lineTo(X(x + 90, y1), y1); c.lineTo(X(x, y1), y1); c.closePath(); c.fill();
  }
  P.rect(ox, 806, 1000, 16, '#3d3530', null); P.line(ox, 822, ox + 1000, 822, 3);
}
function frameBox(P, x, y, w, h, fill, frame = C.wood, fw = 12) {
  P.rect(x - fw, y - fw, w + fw * 2, h + fw * 2, frame); P.rect(x, y, w, h, fill);
}
export function drawFace(P, cx, cy, r, o = {}) {
  const skin = o.skin || C.skin[0];
  if (o.hairBack) P.ellipse(cx, cy + r * 0.2, r * 1.15, r * 1.25, o.hair, INK, 2.5);
  P.ellipse(cx, cy, r * 0.92, r, skin, INK, 3);
  if (o.hair) { const c = P.c; c.fillStyle = o.hair; c.beginPath(); c.ellipse(cx, cy - r * 0.35, r * 0.98, r * 0.7, 0, Math.PI, 0); c.lineTo(cx + r * 0.95, cy - r * 0.1); c.quadraticCurveTo(cx, cy - r * 0.55, cx - r * 0.95, cy - r * 0.1); c.closePath(); c.fill(); P.line(cx - r * 0.95, cy - r * 0.2, cx - r * 0.2, cy - r * 0.6, 2); }
  if (o.eyes === 'none') { P.c.save(); P.c.globalAlpha = 0.12; P.ellipse(cx, cy + r * 0.1, r * 0.55, r * 0.6, '#fff', null); P.c.restore(); return; }
  const ey = cy + r * 0.05, ex = r * 0.34, er = Math.max(2, r * 0.11);
  if (o.eyes === 'down') { P.line(cx - ex - er, ey + 2, cx - ex + er, ey + 2, 2.4); P.line(cx + ex - er, ey + 2, cx + ex + er, ey + 2, 2.4); }
  else if (o.eyes !== 'skip') { const [lx, ly] = o.look || [0, 0]; for (const s of [-1, 1]) { P.ellipse(cx + s * ex, ey, er * 1.5, er * 1.2, '#fbf8ef', INK, 1.6); P.circle(cx + s * ex + lx * er * 0.6, ey + ly * er * 0.5, er * 0.7, INK, null); } }
  if (o.brows !== false) { P.line(cx - ex - er, ey - er * 2.2, cx - ex + er, ey - er * 2.5, 2); P.line(cx + ex - er, ey - er * 2.5, cx + ex + er, ey - er * 2.2, 2); }
  P.line(cx - r * 0.06, cy + r * 0.25, cx - r * 0.1, cy + r * 0.4, 1.8);
  if (o.mouth === 'smile') { const c = P.c; c.save(); c.strokeStyle = INK; c.lineWidth = 2.6; c.beginPath(); c.arc(cx, cy + r * 0.38, r * 0.42, 0.15, Math.PI - 0.15); c.stroke(); c.restore(); }
  else P.line(cx - r * 0.2, cy + r * 0.6, cx + r * 0.2, cy + r * 0.58, 2.2);
}
function clockFace(P, cx, cy, r, thirteen = false) {
  P.circle(cx, cy, r + 7, '#3a3330'); P.circle(cx, cy, r, '#f7f2e4', INK, 2);
  // the '13' anomaly squeezes thirteen numerals onto the face (13 in red at the top), so it reads at a glance
  const n = thirteen ? 13 : 12;
  for (let i = 1; i <= n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2; const odd = i === 13; P.text(String(i), cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * (odd ? 0.72 : 0.78), r * (odd ? 0.36 : 0.24), odd ? '#b3261e' : INK, 'center', 'system-ui, sans-serif', odd ? 900 : 700); }
}
export function clockHands(ctx, cx, cy, r, sec) {
  const s = ((sec % 60) + 60) % 60, m = ((sec / 60) % 60 + 60) % 60, h = ((sec / 3600) % 12 + 12) % 12;
  const hand = (a, len, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke(); };
  const A = f => f * Math.PI * 2 - Math.PI / 2;
  hand(A(h / 12), r * 0.5, 6, INK); hand(A(m / 60), r * 0.72, 4, INK); hand(A(Math.floor(s) / 60), r * 0.8, 1.8, '#b3261e');
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
}

/* ---------------------------------------------------------------- hallway */
const VY = 470;
const proj = (ox, zf) => ({ X: (u, z) => ox + 500 + (u - 0.5) * 1000 / z, Yc: z => VY - 470 / z, Yf: z => VY + 530 / z, Yh: (h, z) => VY + 530 / z - h * 1000 / z, zf });
export function hallLight(ox, i, zf) { const p = proj(ox, zf), z = 1.5 + i, z2 = z + 0.32; return [[p.X(0.38, z), p.Yc(z)], [p.X(0.62, z), p.Yc(z)], [p.X(0.62, z2), p.Yc(z2)], [p.X(0.38, z2), p.Yc(z2)]]; }

function corridor(P, ox, S, back) {
  const c = P.c, zf = back ? 5 : S.zf, { X, Yc, Yf, Yh } = proj(ox, zf);
  P.at('cor' + ox);
  P.poly([[ox, 0], [ox + 1000, 0], [X(1, zf), Yc(zf)], [X(0, zf), Yc(zf)]], C.ceil, null);
  c.save(); c.globalAlpha = 0.3; for (const u of [0.25, 0.5, 0.75]) P.line(X(u, 1), Yc(1), X(u, zf), Yc(zf), 1.4); for (let z = 1.25; z < zf; z += 0.5) P.line(X(0, z), Yc(z), X(1, z), Yc(z), 1.4); c.restore();
  // floor tiles
  const rows = []; for (let z = 1; z < zf; z += 0.42) rows.push(z); rows.push(zf);
  for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < 8; k++) {
    const z0 = rows[i], z1 = rows[i + 1], u0 = k / 8, u1 = (k + 1) / 8;
    c.fillStyle = (i + k) % 2 ? C.floorA : C.floorB; c.beginPath(); c.moveTo(X(u0, z0), Yf(z0)); c.lineTo(X(u1, z0), Yf(z0)); c.lineTo(X(u1, z1), Yf(z1)); c.lineTo(X(u0, z1), Yf(z1)); c.closePath(); c.fill();
  }
  c.save(); c.globalAlpha = 0.13; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(X(0.42, 1), Yf(1)); c.lineTo(X(0.58, 1), Yf(1)); c.lineTo(X(0.52, zf), Yf(zf)); c.lineTo(X(0.48, zf), Yf(zf)); c.fill(); c.restore();
  // walls
  for (const s of [0, 1]) {
    const nx = ox + s * 1000;
    P.poly([[nx, 0], [X(s, zf), Yc(zf)], [X(s, zf), Yf(zf)], [nx, 1000]], C.wall, null);
    P.poly([[nx, Yh(0.64, 1)], [X(s, zf), Yh(0.64, zf)], [X(s, zf), Yh(0.67, zf)], [nx, Yh(0.67, 1)]], C.band, null);
    P.line(nx, 0, X(s, zf), Yc(zf), 3); P.line(nx, 1000, X(s, zf), Yf(zf), 3);
    for (let z = 1, n = 0; z + 0.3 <= zf - 0.15; z += 0.3, n++) {
      const z2 = z + 0.3;
      if (!back && s === 0 && S.extraDoor && z >= 1.75 && z < 2.35) { if (z < 1.85) door(P, X, Yh, s, 1.8, 2.3); continue; }
      const pts = [[X(s, z), Yh(0.62, z)], [X(s, z2), Yh(0.62, z2)], [X(s, z2), Yh(0.04, z2)], [X(s, z), Yh(0.04, z)]];
      P.poly(pts, n % 2 ? C.locker : C.locker2, INK, 3.2 / Math.sqrt(z));
      for (const h of [0.55, 0.57, 0.59]) P.line(X(s, z + 0.06), Yh(h, z + 0.06), X(s, z2 - 0.06), Yh(h, z2 - 0.06), 1.6 / z);
      P.line(X(s, z2 - 0.05), Yh(0.36, z2 - 0.05), X(s, z2 - 0.05), Yh(0.3, z2 - 0.05), 3 / z);
    }
    P.poly([[X(s, 1), Yh(0.04, 1)], [X(s, zf - 0.15), Yh(0.04, zf - 0.15)], [X(s, zf - 0.15), Yf(zf - 0.15)], [X(s, 1), Yf(1)]], '#3d3530', null);
  }
  // ceiling lights
  for (let i = 0; 1.5 + i < zf - 0.3; i++) {
    const z = 1.5 + i, q = hallLight(ox, i, zf), dark = S.lightsOut && !back && z > 2.4;
    if (!dark) { c.save(); c.globalAlpha = 0.18; c.fillStyle = '#fff8d6'; c.beginPath(); c.ellipse(X(0.5, z + 0.16), Yc(z + 0.16) + 30 / z, 260 / z, 110 / z, 0, 0, 7); c.fill(); c.restore(); }
    P.poly(q, dark ? '#55524b' : '#fffbe6', INK, 2 / Math.sqrt(z));
  }
  // end wall
  const x0 = X(0, zf), x1 = X(1, zf), y0 = Yc(zf), y1 = Yf(zf), fw = x1 - x0, fh = y1 - y0;
  if (!back) {
    P.rect(x0, y0, fw, fh, C.wall, INK, 2);
    const dx0 = x0 + fw * 0.2, dw = fw * 0.3, dy0 = y1 - fh * 0.74;
    for (const k of [0, 1]) { const dx = dx0 + k * dw; P.rect(dx, dy0, dw, y1 - dy0, '#8b8270', INK, 2); P.rect(dx + dw * 0.32, dy0 + fh * 0.07, dw * 0.36, fh * 0.34, '#fbf1d2', INK, 1.5); P.line(dx + dw * 0.1, dy0 + fh * 0.45, dx + dw * 0.9, dy0 + fh * 0.45, 2.5); }
    c.save(); c.globalAlpha = 0.25; c.fillStyle = '#fff6d0'; c.beginPath(); c.ellipse(x0 + fw / 2, y1 - 6, fw * 0.45, 10, 0, 0, 7); c.fill(); c.restore();
    if (S.handprints) { c.save(); c.fillStyle = 'rgba(55,45,55,0.78)'; for (const [hx, hy, s] of [[dx0 + dw * 0.45, dy0 + fh * 0.16, 1], [dx0 + dw * 0.6, dy0 + fh * 0.3, -1], [dx0 + dw * 1.5, dy0 + fh * 0.22, -1], [dx0 + dw * 1.42, dy0 + fh * 0.36, 1], [dx0 + dw * 1.3, dy0 + fh * 0.08, 1]]) hand(c, hx, hy, fw * 0.042, s); c.restore(); }
    if (S.figure) { const z = zf - 0.35, fx = X(0.56, z), fy = Yf(z), hgt = 0.66 * 1000 / z, wdt = 0.12 * 1000 / z; c.fillStyle = '#16121a';
      c.beginPath(); c.moveTo(fx - wdt * 0.5, fy); c.lineTo(fx - wdt * 0.55, fy - hgt * 0.72); c.quadraticCurveTo(fx, fy - hgt * 0.84, fx + wdt * 0.55, fy - hgt * 0.72); c.lineTo(fx + wdt * 0.5, fy); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(fx, fy - hgt * 0.88, wdt * 0.28, wdt * 0.36, 0, 0, 7); c.fill(); c.fillRect(fx - wdt * 0.75, fy - hgt * 0.7, wdt * 0.14, hgt * 0.55); c.fillRect(fx + wdt * 0.61, fy - hgt * 0.7, wdt * 0.14, hgt * 0.55); }
  } else {
    P.rect(x0, y0, fw, fh, '#a5634a', INK, 2);
    c.save(); c.globalAlpha = 0.3; for (let y = y0 + 8; y < y1; y += 8) P.line(x0, y, x1, y, 0.8); c.restore();
    P.rect(x0 + fw * 0.08, y0 + fh * 0.12, fw * 0.84, fh * 0.26, '#2f4f8f', INK, 2);
    P.text(S.banner, x0 + fw / 2, y0 + fh * 0.25, fh * 0.11, '#f6e7a8', 'center', HAND, 900);
    P.rect(x0 + fw * 0.6, y1 - fh * 0.55, fw * 0.25, fh * 0.55, '#6d5a45', INK, 2); P.rect(x0 + fw * 0.66, y1 - fh * 0.48, fw * 0.12, fh * 0.14, '#3c4450', INK, 1);
  }
  if (!back && S.lightsOut) { const z = 2.4; const g = c.createLinearGradient(0, Yc(z), 0, Yf(z)); g.addColorStop(0, 'rgba(8,6,10,0.92)'); g.addColorStop(1, 'rgba(8,6,10,0.8)'); c.fillStyle = g; c.fillRect(X(0, z), Yc(z), X(1, z) - X(0, z), Yf(z) - Yc(z)); }
  if (!back && S.footprints) { c.save(); c.fillStyle = 'rgba(55,70,85,0.5)'; let n = 0; for (let z = zf - 0.5; z > 1.15; z -= 0.28, n++) { const u = n % 2 ? 0.46 : 0.54; c.beginPath(); c.ellipse(X(u, z), Yf(z) - 4 / z, 22 / z, 46 / z / z * 1.2, 0, 0, 7); c.fill(); } c.restore(); }
  if (!back && S.ceilingHole) { const q = [[X(0.12, 1.25), Yc(1.25)], [X(0.3, 1.25), Yc(1.25)], [X(0.3, 1.7), Yc(1.7)], [X(0.12, 1.7), Yc(1.7)]]; P.poly(q, '#0b0a0d', INK, 2); c.fillStyle = '#e9e2a6'; const ex = (q[0][0] + q[1][0]) / 2, ey = (q[0][1] + q[2][1]) / 2; c.beginPath(); c.arc(ex - 9, ey, 3, 0, 7); c.arc(ex + 9, ey, 3, 0, 7); c.fill(); }
}
function door(P, X, Yh, s, z, z2) {
  P.poly([[X(s, z), Yh(0.72, z)], [X(s, z2), Yh(0.72, z2)], [X(s, z2), Yh(0, z2)], [X(s, z), Yh(0, z)]], '#4a3a30', INK, 2.5);
  const zm = (z + z2) / 2; P.poly([[X(s, z + 0.12), Yh(0.6, z + 0.12)], [X(s, zm), Yh(0.6, zm)], [X(s, zm), Yh(0.42, zm)], [X(s, z + 0.12), Yh(0.42, z + 0.12)]], '#14121a', INK, 1.5);
  P.circle(X(s, z2 - 0.07), Yh(0.33, z2 - 0.07), 5, '#c9a64a', INK, 1.2);
}
function hand(c, x, y, r, s) { c.beginPath(); c.ellipse(x, y, r, r * 1.15, 0, 0, 7); c.fill(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.38 * s + (i === 0 ? -0.5 * s : 0); c.save(); c.translate(x + Math.cos(a) * r, y + Math.sin(a) * r); c.rotate(a + Math.PI / 2); c.fillRect(-r * 0.18, -r * 1.1, r * 0.36, r * 1.1); c.restore(); } }

function hallRight(P, S) { // face 1 (x 1000-2000): fountain, bulletin board, clock, Room 8 door, portrait, extinguisher
  const c = P.c; flatWall(P, 1000);
  // water fountain
  P.at('fountain').poly([[1040, 560], [1150, 560], [1140, 610], [1050, 610]], '#b8bcc0'); P.rect(1060, 610, 70, 40, '#9ea3a8'); P.rect(1088, 548, 14, 14, '#7b8085');
  P.circle(1135, 575, 6, '#7b8085', INK, 1.5);
  if (S.fountain) { c.save(); c.globalAlpha = 0.55; P.ellipse(1100, 868, 120, 20, '#8ec3e6', null); c.globalAlpha = 0.8; for (const [x, y] of [[1070, 660], [1110, 700], [1090, 760]]) P.ellipse(x, y, 5, 9, '#8ec3e6', null); c.restore(); }
  // bulletin board
  frameBox(P.at('board'), 1195, 290, 285, 265, '#b98a5c', C.wood, 10); P.hatch([[1195, 290], [1480, 290], [1480, 555], [1195, 555]], 9, '#5c3a1c', 0.12);
  const posters = [[1208, 305, 88, 150, '#f3e3a1'], [1306, 318, 82, 160, '#cfe3ef'], [1396, 305, 76, 145, '#f2c7c0']];
  posters.forEach(([x, y, w, h, col], i) => {
    if (S.posterMissing === i) { c.save(); c.globalAlpha = 0.25; P.rect(x, y, w, h, '#d9b88c', null); c.restore(); for (const [px, py] of [[x + 6, y + 6], [x + w - 6, y + 6]]) P.circle(px, py, 4, '#c33', INK, 1); return; }
    P.at('poster' + i).rect(x, y, w, h, col, INK, 2); const [a, b] = S.posters[i].split('|');
    P.text(a, x + w / 2, y + 26, 17, INK, 'center', HAND, 900); P.text(b, x + w / 2, y + 48, 19, '#7a2f22', 'center', HAND, 900);
    if (i === 0) { P.poly([[x + 34, y + 70], [x + 54, y + 70], [x + 54, y + 92], [x + 70, y + 128], [x + 18, y + 128], [x + 34, y + 92]], '#a9d8c2', INK, 2); }
    if (i === 1) { if (b === 'KIND') { c.fillStyle = '#d0453a'; c.beginPath(); c.moveTo(x + 41, y + 135); c.bezierCurveTo(x + 5, y + 105, x + 25, y + 70, x + 41, y + 92); c.bezierCurveTo(x + 57, y + 70, x + 77, y + 105, x + 41, y + 135); c.fill(); }
      else { P.ellipse(x + 41, y + 105, 26, 14, '#fff', INK, 2); P.circle(x + 41, y + 105, 8, INK, null); } }
    if (i === 2) { P.poly([[x + 22, y + 75], [x + 46, y + 75], [x + 46, y + 120], [x + 60, y + 128], [x + 22, y + 130]], '#5b7fb0', INK, 2); }
    P.circle(x + w / 2, y + 5, 4, '#c33', INK, 1);
  });
  for (let i = 0; i < 4; i++) P.at('card' + i).rect(1212 + i * 66, 490, 54, 40, '#fbf7ea', INK, 1.5);
  // clock above the door
  clockFace(P.at('hclock'), 1620, 196, 66, S.clock === 'thirteen');
  // door + plaque
  P.at('door8').rect(1530, 270, 180, 552, '#5b4a3b', INK, 3); P.rect(1542, 282, 156, 540, C.wood, INK, 2.5); P.hatch([[1542, 282], [1698, 282], [1698, 822], [1542, 822]], 18, '#4b2e17', 0.12, 1.4);
  P.rect(1595, 330, 50, 150, '#2c3946', INK, 2); c.save(); c.globalAlpha = 0.25; P.line(1600, 470, 1640, 340, 3, '#cfe3ef'); c.restore();
  P.rect(1555, 540, 14, 40, '#c9a64a', INK, 1.5);
  c.save(); if (S.plaque !== '8') { c.translate(1756, 344); c.rotate(0.16); c.translate(-1756, -344); }
  P.rect(1718, 340, 76, 96, '#2e3a5a', INK, 2.5); P.text('ROOM', 1756, 357, 13, '#e9e2c8', 'center', 'system-ui, sans-serif', 700); P.text(S.plaque, 1756, 402, 56, '#f4eed6', 'center', 'system-ui, sans-serif', 900); c.restore();
  // portrait of the founder
  frameBox(P.at('portrait'), 1812, 262, 136, 176, '#5b6b5e', '#b48a3a', 14);
  P.poly([[1830, 438], [1845, 380], [1915, 380], [1930, 438]], '#2c2c34', INK, 2); P.poly([[1868, 380], [1880, 410], [1892, 380]], '#f2efe6', INK, 1.5);
  drawFace(P, 1880, 335, 34, { skin: '#e9c7a6', hair: '#b9b9b9', eyes: S.portrait === 'watch' ? 'skip' : 'open', look: [-0.6, 0], mouth: S.portrait === 'smile' ? 'smile' : 'flat' });
  if (S.portrait === 'smile') { c.save(); c.fillStyle = '#3a1d1d'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(1848, 340); c.quadraticCurveTo(1880, 398, 1912, 340); c.quadraticCurveTo(1880, 358, 1848, 340); c.fill(); c.stroke(); c.fillStyle = '#f7f2e4'; c.fillRect(1860, 347, 40, 7); for (let i = 0; i < 5; i++) c.fillRect(1862 + i * 8, 354, 1.6, 6); c.restore(); }
  else { P.line(1866, 357, 1880, 352, 3, '#8d8d8d'); P.line(1880, 352, 1894, 357, 3, '#8d8d8d'); }
  P.rect(1840, 452, 80, 20, '#c9a64a', INK, 1.5); P.text('E. HARLOW 1958', 1880, 462, 9.5, INK, 'center', 'Georgia, serif', 700);
  // extinguisher cabinet
  P.at('ext').rect(1866, 572, 92, 176, '#f3efe6', INK, 2.5);
  c.save(); if (S.extinguisher === 'upside') { c.translate(1912, 660); c.rotate(Math.PI); c.translate(-1912, -660); }
  P.rect(1890, 610, 44, 120, '#c7362c', INK, 2); P.rect(1902, 590, 20, 20, '#333', INK, 1.5); P.line(1922, 596, 1944, 600, 3); P.rect(1898, 640, 28, 30, '#f4eed6', INK, 1); c.restore();
  c.save(); c.globalAlpha = 0.2; P.line(1872, 740, 1950, 580, 4, '#fff'); c.restore();
}

function hallLeft(P, S) { // face 3 (x 3000-4000): lockers, trophy case, window + bench with the quiet student
  const c = P.c; flatWall(P, 3000, { wainscot: false });
  const n = S.lockers, lw = 480 / n;
  for (let i = 0; i < n; i++) {
    const x = 3030 + i * lw; P.at('lk' + i + '_' + n);
    if (i === S.openLocker) { P.rect(x, 250, lw, 560, '#0f0d12', INK, 3); P.poly([[x + lw, 250], [x + lw + lw * 0.55, 236], [x + lw + lw * 0.55, 826], [x + lw, 810]], C.locker2, INK, 3); continue; }
    P.rect(x, 250, lw, 560, i % 2 ? C.locker : C.locker2, INK, 3);
    for (let k = 0; k < 4; k++) P.line(x + 8, 280 + k * 10, x + lw - 8, 280 + k * 10, 1.6);
    P.rect(x + lw - 13, 500, 6, 34, '#c9c9c9', INK, 1); P.rect(x + lw / 2 - 11, 340, 22, 13, '#f1ead2', INK, 1); P.text(String(101 + i), x + lw / 2, 347, 8.5, INK, 'center', 'system-ui, sans-serif', 700);
  }
  P.rect(3030, 810, 480, 12, '#2b2522', null);
  if (S.hallPass) { c.save(); c.translate(3171, 420); c.rotate(-0.12); P.at('pass').rect(-25, -16, 50, 32, '#f2c94c', '#8a6a12', 2.5); P.text('PASS', 0, 1, 13, '#5a3d00', 'center', 'system-ui, sans-serif', 900); c.restore(); P.rect(3156, 400, 30, 7, 'rgba(255,255,255,0.6)', null); }
  // trophy case
  frameBox(P.at('trophy'), 3548, 300, 146, 312, '#3a3240', C.wood2, 10); c.save(); c.globalAlpha = 0.18; P.line(3560, 600, 3680, 320, 6, '#fff'); c.restore();
  P.line(3548, 404, 3694, 404, 3, C.wood2); P.line(3548, 508, 3694, 508, 3, C.wood2);
  P.poly([[3580, 360], [3610, 360], [3604, 384], [3586, 384]], '#d9b44a', INK, 1.5); P.rect(3588, 384, 14, 14, '#d9b44a', INK, 1); P.rect(3580, 396, 30, 8, '#6b4a2a', INK, 1);
  P.circle(3655, 372, 12, '#c0c0c8', INK, 1.5); P.rect(3646, 384, 18, 16, '#6b4a2a', INK, 1);
  P.rect(3560, 444, 122, 60, '#b07a3a', INK, 1.5); P.rect(3566, 452, 110, 32, '#e8d8a8', INK, 1); P.text(S.trophyYou ? 'YOU' : 'CHAMPS 1987', 3621, 470, S.trophyYou ? 36 : 15, S.trophyYou ? '#9a1f18' : INK, 'center', 'Georgia, serif', 900);
  P.poly([[3600, 540], [3640, 540], [3632, 586], [3608, 586]], '#cf9b52', INK, 1.5); P.rect(3596, 586, 48, 14, '#6b4a2a', INK, 1);
  // window to the courtyard
  const wx = 3740, wy = 220, ww = 220, wh = 250;
  frameBox(P.at('win'), wx, wy, ww, wh, S.tree === 'snow' ? '#dfe6ec' : C.sky, '#f3efe6', 10);
  c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
  P.rect(wx, wy + wh * 0.72, ww, wh * 0.3, S.tree === 'snow' ? '#f7f9fb' : '#8aa864', null);
  if (S.tree !== 'none') { P.rect(wx + 100, wy + 120, 20, 70, '#6b4a2a', INK, 2); if (S.tree === 'snow') { for (const [a, l] of [[-0.6, 55], [-1.3, 60], [-2.2, 52]]) P.line(wx + 110, wy + 135, wx + 110 + Math.cos(a) * l, wy + 135 + Math.sin(a) * l, 3); }
    else for (const [x, y, r, col] of [[0, 0, 55, '#d07a2c'], [-38, 22, 38, '#c4572a'], [40, 18, 40, '#e0a03a']]) P.circle(wx + 110 + x, wy + 92 + y, r, col, INK, 2); }
  else P.rect(wx + 98, wy + 170, 24, 18, '#6b4a2a', INK, 2);
  if (S.tree === 'snow') { c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(wx + P.r() * ww, wy + P.r() * wh, 2 + P.r() * 2, 0, 7); c.fill(); } }
  c.restore(); P.line(wx + ww / 2, wy, wx + ww / 2, wy + wh, 5, '#f3efe6'); P.line(wx, wy + wh / 2, wx + ww, wy + wh / 2, 5, '#f3efe6');
  // bench + student
  P.at('bench').rect(3735, 712, 230, 22, C.wood, INK, 2.5); P.line(3755, 734, 3755, 815, 5); P.line(3945, 734, 3945, 815, 5);
  if (S.student === 'gone') { P.poly([[3800, 704], [3860, 698], [3866, 712], [3806, 716]], '#f7f2e4', INK, 2); P.line(3833, 700, 3836, 714, 1.5); }
  else {
    P.at('kid').poly([[3800, 712], [3790, 600], [3878, 600], [3866, 712]], '#7a5aa0', INK, 2.5);
    P.rect(3800, 712, 26, 95, '#3b4a6b', INK, 2); P.rect(3840, 712, 26, 95, '#3b4a6b', INK, 2); P.rect(3796, 800, 34, 14, '#222', INK, 1.5); P.rect(3836, 800, 34, 14, '#222', INK, 1.5);
    drawFace(P, 3833, 556, 36, { skin: C.skin[1], hair: '#2c1c14', eyes: S.student === 'noface' ? 'none' : S.student === 'stare' ? 'skip' : 'down', brows: S.student !== 'noface' });
    if (S.student !== 'noface') { for (const sx of [-14, 14]) P.circle(3833 + sx, 556, 13, '#cfe3ef', INK, 4); P.line(3829, 556, 3837, 556, 4); }
    if (S.student === 'stare') { for (const sx of [-14, 14]) { P.circle(3833 + sx, 556, 14, '#fbf8ef', INK, 2.5); P.circle(3833 + sx, 557, 8, INK, null); } P.line(3810, 532, 3826, 538, 4); P.line(3856, 532, 3840, 538, 4); P.line(3822, 584, 3844, 584, 3); }
    P.poly([[3800, 650], [3866, 650], [3874, 690], [3792, 690]], '#c0392b', INK, 2); P.line(3833, 650, 3833, 690, 1.5);
  }
}

function corners(P, col) { // soften the seams between faces with a wall-corner pillar
  const c = P.c; for (const x of [0, 1000, 2000, 3000, 4000]) { P.at('corner' + x); c.save(); const g = c.createLinearGradient(x - 26, 0, x + 26, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(40,30,25,0.28)'); g.addColorStop(0.55, 'rgba(40,30,25,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - 26, 0, 52, 1000); c.restore(); P.rect(x - 9, 0, 18, 1000, col, null); P.line(x - 9, 0, x - 9, 1000, 2.5); P.line(x + 9, 0, x + 9, 1000, 2.5); }
}
function hallBase(P, S) { corridor(P, 0, S, false); hallRight(P, S); corridor(P, 2000, S, true); hallLeft(P, S); corners(P, '#d9cdb0'); }

/* ---------------------------------------------------------------- classroom */
const KIDS = [ // back row then front row: [x, baseY, scale, skin, hair, shirt]
  [2140, 610, 0.66, 3, '#3b2416', '#4f7a5a'], [2380, 610, 0.66, 2, '#141014', '#c9824a'], [2620, 610, 0.66, 0, '#a8742c', '#5a6fa8'], [2860, 610, 0.66, 4, '#141014', '#a8455a'],
  [2200, 760, 1, 5, '#6b3d1f', '#3f6f8f'], [2800, 760, 1, 6, '#1f1a18', '#8a6b3a'],
];
function student(P, i, x, by, s, skin, hair, shirt, S) {
  const c = P.c; P.at('st' + i);
  P.poly([[x - 52 * s, by], [x - 46 * s, by - 105 * s], [x + 46 * s, by - 105 * s], [x + 52 * s, by]], shirt, INK, 2.5 * s);
  const eyes = S.noface === i ? 'none' : S.students === 'stare' ? 'skip' : 'open';
  drawFace(P, x, by - 148 * s, 38 * s, { skin: C.skin[skin], hair, eyes, look: [((i * 37) % 5 - 2) * 0.3, -0.6], brows: eyes !== 'none' });
  desk(P, x, by, s);
}
function desk(P, x, by, s) {
  P.poly([[x - 78 * s, by - 6 * s], [x + 78 * s, by - 6 * s], [x + 92 * s, by + 26 * s], [x - 92 * s, by + 26 * s]], '#c8a06a', INK, 2.5 * s);
  P.rect(x - 92 * s, by + 26 * s, 184 * s, 10 * s, '#8d6a3c', INK, 2 * s);
  P.line(x - 84 * s, by + 36 * s, x - 84 * s, by + 120 * s, 5 * s, '#555'); P.line(x + 84 * s, by + 36 * s, x + 84 * s, by + 120 * s, 5 * s, '#555');
}
function classFront(P, S) { // face 0: clock, chalkboard, teacher desk
  const c = P.c; flatWall(P, 0, { floor: 'wood', top: 80, wainscot: false, block: false, wall: '#e9e1c9' });
  clockFace(P.at('cclock'), 500, 140, 46);
  frameBox(P.at('chalk'), 120, 220, 760, 340, C.board, '#9b7448', 14);
  c.save(); c.globalAlpha = 0.035; for (let i = 0; i < 14; i++) P.line(140 + P.r() * 700, 240 + P.r() * 300, 160 + P.r() * 700, 240 + P.r() * 300, 20, '#fff', 1); c.restore();
  P.at('chalktext');
  if (S.board === 'repeat') { for (let i = 0; i < 7; i++) P.chalk('I will stay after class.', 160, 262 + i * 42, 28); }
  else {
    P.chalk('Period 8 · Ms. Alvarez', 160, 262, 30); P.chalk(S.board === 'date' ? 'Fri. Oct 32' : 'Fri. Oct 16', 860, 310, 54, undefined, 'right'); if (S.board === 'date') { c.save(); c.strokeStyle = 'rgba(240,240,230,0.85)'; c.lineWidth = 4; c.beginPath(); c.ellipse(830, 312, 44, 34, -0.1, 0, 7); c.stroke(); c.restore(); }
    P.chalk('Review: The Water Cycle', 160, 318, 32);
    const k = 'rgba(240,240,230,0.85)'; c.save(); c.strokeStyle = k; c.lineWidth = 3; c.globalAlpha = 0.8;
    for (const [x, y, r] of [[300, 420, 30], [335, 405, 36], [372, 422, 28]]) { c.beginPath(); c.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1); c.stroke(); }
    c.beginPath(); c.moveTo(270, 440); c.lineTo(400, 440); c.stroke();
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(290 + i * 28, 455); c.lineTo(282 + i * 28, 478); c.stroke(); }
    c.beginPath(); c.arc(700, 400, 32, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; c.beginPath(); c.moveTo(700 + Math.cos(a) * 40, 400 + Math.sin(a) * 40); c.lineTo(700 + Math.cos(a) * 54, 400 + Math.sin(a) * 54); c.stroke(); }
    c.beginPath(); for (let x = 200; x < 840; x += 10) c.lineTo(x, 520 + Math.sin(x / 18) * 6); c.stroke();
    c.beginPath(); c.moveTo(620, 500); c.quadraticCurveTo(560, 430, 470, 415); c.stroke(); c.restore();
    P.chalk('evaporation', 560, 488, 20); P.chalk('rain', 250, 492, 20);
  }
  P.rect(130, 560, 740, 14, '#9b7448', INK, 2); P.rect(300, 552, 40, 10, '#f4f1e8', INK, 1); P.rect(380, 552, 18, 8, '#f4f1e8', INK, 1); P.rect(600, 548, 56, 14, '#5b4a3b', INK, 1.5);
  // teacher desk
  P.at('tdesk').rect(560, 640, 340, 30, '#a6764a', INK, 3); P.rect(575, 670, 310, 150, '#8d6038', INK, 3); P.rect(600, 690, 120, 40, '#7d5434', INK, 2); P.rect(740, 690, 120, 40, '#7d5434', INK, 2);
  P.rect(680, 622, 70, 18, '#f7f2e4', INK, 1.5); P.rect(684, 614, 64, 10, '#f1ecdf', INK, 1);
  if (S.apple === 'core') { P.poly([[612, 638], [618, 602], [630, 600], [624, 618], [636, 638]], '#f1e7c4', INK, 2); P.circle(624, 600, 10, '#c0392b', INK, 2); P.circle(624, 636, 9, '#c0392b', INK, 2); }
  else { P.circle(624, 620, 20, '#c0392b', INK, 2.5); P.line(624, 600, 628, 590, 3, '#5a3b1f'); P.ellipse(636, 592, 8, 4, '#5a8f3a', INK, 1.5, -0.4); }
  if (!S.globe) globe(c, P, 820, 560, 0);
  P.rect(810, 610, 20, 30, '#5b4a3b', INK, 2);
}
export function globe(c, P, x, y, rot) {
  P.at('globe').circle(x, y, 42, '#6aa0c8', INK, 2.5); c.save(); c.beginPath(); c.arc(x, y, 41, 0, 7); c.clip(); c.fillStyle = '#7fae6a';
  for (const [lx, ly, rx, ry] of [[-20, -12, 18, 12], [16, 8, 14, 20], [40, -20, 16, 10], [-60, 10, 16, 18]]) { let gx = ((lx + rot) % 170 + 255) % 170 - 85; c.beginPath(); c.ellipse(x + gx, y + ly, rx, ry, 0.3, 0, 7); c.fill(); }
  c.restore(); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 50, -1.2, 1.9); c.stroke();
}
function classWindows(P, S) { // face 1
  const c = P.c; flatWall(P, 1000, { floor: 'wood', top: 80, wainscot: false, block: false, wall: '#e9e1c9' });
  for (let i = 0; i < 3; i++) {
    const x = 1080 + i * 290, y = 170, w = 260, h = 450;
    P.at('cw' + i).rect(x - 10, y - 10, w + 20, h + 20, '#f3efe6');
    const g = c.createLinearGradient(0, y, 0, y + h); if (S.night) { g.addColorStop(0, '#0d1430'); g.addColorStop(1, '#1d2348'); } else { g.addColorStop(0, '#bcd6e6'); g.addColorStop(1, '#f2e6c8'); }
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (S.night) { c.fillStyle = '#fff'; for (let k = 0; k < 14; k++) c.fillRect(x + P.r() * w, y + P.r() * h * 0.6, 2, 2); if (i === 1) P.circle(x + 170, y + 120, 26, '#f4efd2', null); }
    for (let k = 0; k < 5; k++) P.circle(x - 20 + k * 70, y + h - 40 - (k % 2) * 30, 50 + (k % 3) * 10, S.night ? '#141a2e' : ['#d07a2c', '#c4572a', '#e0a03a', '#a9662b', '#cf8f3a'][(k + i) % 5], S.night ? null : INK, 2);
    P.rect(x, y + h - 30, w, 30, S.night ? '#0f1424' : '#8aa864', null);
    c.restore();
    P.line(x + w / 2, y, x + w / 2, y + h, 6, '#f3efe6'); P.rect(x - 16, y + h + 8, w + 32, 18, '#efe9dc', INK, 2);
    if (!S.blinds) blinds(c, P, x, y, w, 0, i);
  }
  P.at('radiator').rect(1150, 668, 700, 100, '#cfc8b8', INK, 2.5); for (let x = 1170; x < 1840; x += 26) P.line(x, 676, x, 760, 2.4);
  if (S.plant === 'huge') { for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + (P.r() - 0.5) * 2.6, l = 120 + P.r() * 160; P.line(1860, 600, 1860 + Math.cos(a) * l, 600 + Math.sin(a) * l, 5, '#3f6b2f'); P.ellipse(1860 + Math.cos(a) * l, 600 + Math.sin(a) * l, 34, 16, '#5f9a3f', INK, 2, a); } }
  else for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.35; P.ellipse(1860 + Math.cos(a) * 26, 588 + Math.sin(a) * 26, 18, 8, '#5f9a3f', INK, 1.5, a); }
  P.poly([[1838, 600], [1882, 600], [1876, 640], [1844, 640]], '#b5653a', INK, 2);
}
export function blinds(c, P, x, y, w, sway, i) {
  P.at('blind' + i); for (let k = 0; k < 12; k++) { const yy = y + 6 + k * 10, off = Math.sin(sway + k * 0.5) * sway * 0.0 + (sway ? Math.sin(sway * 1.3 + k * 0.6) * 6 : 0); P.rect(x + 2 + off, yy, w - 4, 7, '#efe8d6', INK, 1); }
  P.line(x + 20, y, x + 20, y + 140, 1.4, '#777'); P.line(x + w - 20, y, x + w - 20, y + 140, 1.4, '#777');
}
function classBack(P, S) { // face 2: chart, map, students (they face the board, so you see their faces)
  const c = P.c; flatWall(P, 2000, { floor: 'wood', top: 80, wainscot: false, block: false, wall: '#e9e1c9' });
  frameBox(P.at('chart'), 2060, 150, 320, 230, '#f6f1df', '#ddd2b4', 6); P.text('ELEMENTS', 2220, 172, 22, '#2e3a5a', 'center', HAND, 900);
  const sym = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Ag'];
  const cols = ['#f2c7c0', '#cfe3ef', '#f3e3a1', '#d6e9c9'];
  for (let i = 0; i < 24; i++) { const x = 2072 + (i % 8) * 37, y = 192 + Math.floor(i / 8) * 58; P.rect(x, y, 33, 52, cols[(i * 7) % 4], INK, 1.2); P.text(S.chart === 'eights' ? '8' : sym[i], x + 16.5, y + 24, 15, INK, 'center', 'system-ui, sans-serif', 800); P.text(S.chart === 'eights' ? '8' : String(i + 1), x + 6, y + 8, 7, INK, 'left', 'system-ui, sans-serif', 600); }
  frameBox(P.at('map'), 2620, 150, 320, 230, '#9cc6dc', '#ddd2b4', 6);
  c.save(); if (S.map === 'flipped') { c.translate(2780 * 2, 0); c.scale(-1, 1); }
  for (const [x, y, rx, ry, a] of [[2680, 220, 40, 32, 0.4], [2700, 300, 24, 40, 0.2], [2790, 210, 36, 22, -0.2], [2800, 290, 30, 46, 0.1], [2880, 230, 44, 30, 0.3], [2900, 330, 22, 16, 0]]) P.at('cont' + x).ellipse(x, y, rx, ry, '#d9c27a', INK, 2, a);
  c.restore(); P.text('OUR WORLD', 2780, 168, 16, '#2e3a5a', 'center', HAND, 900);
  KIDS.slice(0, 4).forEach((k, i) => student(P, i, k[0], k[1], k[2], k[3], k[4], k[5], S));
  if (S.extraDesk) desk(P.at('extra'), 2360, 720, 0.82);
  student(P, 4, ...KIDS[4], S);
  desk(P.at('mydesk'), 2500, 760, 1); P.poly([[2470, 748], [2530, 746], [2534, 760], [2466, 762]], '#f7f2e4', INK, 1.5); P.text('8', 2500, 754, 10, '#b3261e', 'center', HAND, 900);
  student(P, 5, ...KIDS[5], S);
}
function classDoor(P, S) { // face 3: hallway door, coat hooks + backpack, READ poster, cubbies
  const c = P.c; flatWall(P, 3000, { floor: 'wood', top: 80, wainscot: false, block: false, wall: '#e9e1c9' });
  P.at('cdoor').rect(3070, 250, 200, 572, '#5b4a3b', INK, 3); P.rect(3082, 262, 176, 560, C.wood, INK, 2.5);
  P.rect(3140, 320, 60, 150, '#2c3946', INK, 2); c.save(); c.beginPath(); c.rect(3140, 320, 60, 150); c.clip(); P.rect(3140, 380, 60, 90, C.locker, null); c.restore();
  if (S.doorFace) { c.save(); c.beginPath(); c.rect(3140, 320, 60, 150); c.clip(); drawFace(P.at('dface'), 3170, 400, 26, { skin: '#d9d4cc', eyes: 'open', look: [0, 0], brows: false }); c.restore(); }
  P.rect(3240, 540, 12, 40, '#c9a64a', INK, 1.5);
  P.at('hooks').rect(3320, 290, 300, 16, C.wood2, INK, 2); for (let x = 3345; x < 3610; x += 60) P.line(x, 306, x + 6, 326, 4, '#555');
  P.poly([[3520, 320], [3580, 318], [3600, 470], [3500, 470]], '#3f5f8f', INK, 2.5);
  if (!S.backpack) backpack(P, 3440, 384, 1);
  frameBox(P.at('read'), 3690, 180, 130, 190, '#f3e3a1', '#c66a3a', 6); P.text(S.poster, 3755, 226, 46, S.poster === 'READ' ? '#7a2f22' : '#c0261b', 'center', HAND, 900);
  P.poly([[3705, 330], [3755, 312], [3805, 330], [3805, 350], [3755, 334], [3705, 350]], '#fbf7ea', INK, 2);
  P.at('cubby').rect(3660, 580, 300, 230, '#c8a06a', INK, 3);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) { const x = 3672 + k * 96, y = 592 + r * 108; P.rect(x, y, 88, 98, '#7d5434', INK, 2); for (let b = 0; b < 4; b++) P.rect(x + 8 + b * 18, y + 30 + (b % 2) * 8, 14, 64 - (b % 2) * 8, ['#c0392b', '#2e86c1', '#e5b532', '#27ae60'][(b + k + r) % 4], INK, 1); }
  P.at('sharp').rect(3330, 520, 50, 36, '#9aa0a6', INK, 2); P.line(3380, 530, 3398, 520, 3);
}
export function backpack(P, x, y, s) {
  P.at('bp'); const c = P.c; c.save(); c.translate(x, y); c.scale(s, s);
  P.ellipse(0, 0, 44, 62, '#c0392b', INK, 2.5); P.rect(-28, 10, 56, 38, '#a93226', INK, 2); P.line(-10, -60, -16, -84, 3, '#555'); P.line(10, -60, 16, -84, 3, '#555'); P.line(-24, 22, 24, 22, 1.5);
  c.restore();
}
function classBase(P, S) { classFront(P, S); classWindows(P, S); classBack(P, S); classDoor(P, S); corners(P, '#ddd3bb'); }

/* ---------------------------------------------------------------- public API */
let cache = { key: '', canvas: null };
export function renderBase(S, q = 1) {
  const key = JSON.stringify(S) + q;
  if (cache.key === key) return cache.canvas;
  const cv = document.createElement('canvas');
  cv.width = Math.round(PW * q); cv.height = Math.round(PH * q);
  const ctx = cv.getContext('2d'); ctx.setTransform(q, 0, 0, q, 0, 0); ctx.clearRect(0, 0, PW, PH);
  const P = new Pen(ctx); (S.scene === 'hall' ? hallBase : classBase)(P, S); paperize(ctx, PW, PH, S.scene === 'hall' ? 3 : 5);
  cache = { key, canvas: cv }; return cv;
}
export function invalidate() { cache.key = ''; }

/** Per-frame layer, drawn in panorama coordinates. t = seconds since the loop began. camX = panorama x at screen centre. */
/** Accessibility switches shared by the renderers. */
export const fx = { reduceFlash: false };
export function drawDynamic(ctx, S, t, camX, clockBase) {
  const P = new Pen(ctx);
  if (S.scene === 'hall') {
    clockHands(ctx, 1620, 196, 66, S.clock === 'back' ? clockBase - t * 40 : clockBase + t);
    if (S.portrait === 'blink' && (t % 1.5) < 0.3) { for (const s of [-1, 1]) P.at('lid' + s).ellipse(1880 + s * 11.6, 337, 9, 7.5, '#e9c7a6', INK, 2); }
    if (S.portrait === 'watch') { const d = wrapDelta(camX, 1880), lx = Math.max(-1, Math.min(1, d / 350)); for (const s of [-1, 1]) { P.at('pw' + s).ellipse(1880 + s * 13, 335, 11.5, 10, '#fbf8ef', INK, 2.4); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(1880 + s * 13 + lx * 5.5, 335, 5.8, 0, 7); ctx.fill(); } }
    // Reduced flash (Settings): the flicker anomaly becomes a slow dim instead of rapid on/off strobing.
    if (S.flicker) { const on = fx.reduceFlash ? (t % 2.4) < 1.2 : Math.sin(t * 23) + Math.sin(t * 7.1) * 0.8 > 0.6 || (t % 2.3) > 1.4; if (!on) { P.at('fl').poly(hallLight(0, 0, S.zf), '#57534c', INK, 1.6); ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#000'; ctx.fillRect(250, 150, 500, 500); ctx.restore(); } }
    if (S.titleDoor) { // title screen: light behind Room 8's door window flickers (slow pulse with reduced flash)
      const k = fx.reduceFlash ? 0.5 + Math.sin(t * 1.6) * 0.35 : (Math.sin(t * 17) + Math.sin(t * 5.3) > 0.4 || (t % 3.1) > 2.6 ? 1 : 0.15);
      ctx.save(); ctx.globalAlpha = 0.25 + k * 0.6; ctx.fillStyle = '#f6e7a8'; ctx.fillRect(1597, 332, 46, 146);
      const g = ctx.createRadialGradient(1620, 405, 10, 1620, 405, 190); g.addColorStop(0, `rgba(246,231,168,${0.28 * k})`); g.addColorStop(1, 'rgba(246,231,168,0)'); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(1430, 215, 380, 380);
      ctx.fillStyle = `rgba(246,231,168,${0.35 * k})`; ctx.fillRect(1544, 816, 152, 8); ctx.restore(); }
    if (S.fountain) { ctx.save(); ctx.strokeStyle = 'rgba(120,180,230,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(1095, 554); ctx.quadraticCurveTo(1112 + Math.sin(t * 20) * 2, 520, 1128, 566); ctx.stroke(); ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1090, 554); ctx.quadraticCurveTo(1108, 528 + Math.sin(t * 17) * 3, 1122, 568); ctx.stroke(); ctx.restore(); }
    if (S.student === 'stare') { const d = wrapDelta(camX, 3833), lx = Math.max(-1, Math.min(1, d / 300)); for (const s of [-1, 1]) { P.at('se' + s).ellipse(3833 + s * 12.2, 558, 6, 4.8, '#fbf8ef', INK, 1.4); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(3833 + s * 12.2 + lx * 3, 558, 2.8, 0, 7); ctx.fill(); } }
  } else {
    clockHands(ctx, 500, 140, 46, S.clock === 'fast' ? clockBase + t * 140 : clockBase + t);
    if (S.globe) globe(ctx, P, 820, 560, t * 60);
    if (S.blinds) for (let i = 0; i < 3; i++) blinds(ctx, P, 1080 + i * 290, 170, 260, t * 1.7 + i, i);
    if (S.backpack) backpack(P, 3440, 384, 1 + Math.sin(t * 1.6) * 0.06);
    if (S.shadow) { ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#0c140f'; const x = 330 + Math.sin(t * 0.35) * 120; ctx.beginPath(); ctx.ellipse(x, 300, 34, 42, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 80, 560); ctx.quadraticCurveTo(x - 70, 350, x, 345); ctx.quadraticCurveTo(x + 70, 350, x + 80, 560); ctx.fill(); ctx.restore(); }
    if (S.students === 'stare') KIDS.forEach(([x, by, s], i) => { if (S.noface === i) return; const cy = by - 148 * s, r = 38 * s, ey = cy + r * 0.05, er = Math.max(2, r * 0.11); const d = wrapDelta(camX, x), lx = Math.max(-1, Math.min(1, d / 300));
      for (const k of [-1, 1]) { P.at('ks' + i + k).ellipse(x + k * r * 0.34, ey, er * 1.6, er * 1.4, '#fbf8ef', INK, 1.5); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + k * r * 0.34 + lx * er * 0.6, ey, er * 0.75, 0, 7); ctx.fill(); } });
  }
}
export function wrapDelta(a, b) { let d = a - b; while (d > PW / 2) d -= PW; while (d < -PW / 2) d += PW; return d; }
