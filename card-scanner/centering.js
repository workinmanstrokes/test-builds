// Real centering measurement: finds card outer edge and inner border along many scanlines.
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function measureCentering(src) {
  const img = await loadImg(src), W = 600, H = Math.round(img.height * W / img.width);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
  const d = cx.getImageData(0, 0, W, H).data, g = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // scan from one side inward; returns [outerEdge, innerEdge] distances
  function scan(len, get) { const bg = get(1); let i = 2, outer = -1;
    for (; i < len / 2; i++) if (diff(get(i), bg) > 60) { outer = i; break; }
    if (outer < 0) outer = 0; const bc = get(Math.min(outer + 3, len - 1));
    for (i = outer + 4; i < len / 2; i++) if (diff(get(i), bc) > 70) return [outer, i];
    return null; }
  const med = a => { a = a.filter(Boolean).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
  const sides = { L: [], R: [], T: [], B: [] };
  for (let k = 1; k <= 9; k++) { const y = Math.round(H * (0.3 + k * 0.04)), x = Math.round(W * (0.3 + k * 0.04));
    let s; if ((s = scan(W, i => g(i, y)))) sides.L.push(s[1] - s[0]); if ((s = scan(W, i => g(W - 1 - i, y)))) sides.R.push(s[1] - s[0]);
    if ((s = scan(H, i => g(x, i)))) sides.T.push(s[1] - s[0]); if ((s = scan(H, i => g(x, H - 1 - i)))) sides.B.push(s[1] - s[0]); }
  const L = med(sides.L), R = med(sides.R), T = med(sides.T), B = med(sides.B);
  if (!L || !R || !T || !B) return { ok: false };
  const lr = 100 * L / (L + R), tb = 100 * T / (T + B), max = Math.max(lr, 100 - lr, tb, 100 - tb);
  return { ok: true, lr: `${lr.toFixed(1)} / ${(100 - lr).toFixed(1)}`, tb: `${tb.toFixed(1)} / ${(100 - tb).toFixed(1)}`, max };
}
function centeringGrade(front, back) { // PSA-style centering caps
  const caps = [[55, 75, 10], [60, 90, 9], [65, 90, 8], [70, 90, 7], [80, 90, 6], [85, 90, 5], [90, 100, 4]];
  for (const [f, b, gr] of caps) if (front.max <= f && (!back?.ok || back.max <= b)) return gr; return 3; }
// Condition ESTIMATES from photos (not a real grade): edge/corner whitening and surface glare/scratch proxies.
async function conditionEstimate(front, corners) {
  const stat = async (src, region) => { const i = await loadImg(src), W = 400, H = Math.round(i.height * W / i.width), c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0, W, H); const b = cardBox(x, W, H), r = region(b, W, H);
    const d = x.getImageData(Math.max(0, r.x), Math.max(0, r.y), Math.max(1, r.w), Math.max(1, r.h)).data; let white = 0, glare = 0, n = d.length / 4, lap = 0;
    for (let k = 0; k < d.length; k += 4) { const v = (d[k] + d[k + 1] + d[k + 2]) / 3, sat = Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]);
      if (v > 225 && sat < 20) white++; if (v > 248) glare++; if (k > 4 * r.w && k % (4 * r.w)) lap += Math.abs(v - (d[k - 4] + d[k - 3] + d[k - 2]) / 3); }
    return { white: white / n, glare: glare / n, tex: lap / n }; };
  const band = 0.03, score = f => Math.max(1, Math.min(10, Math.round(10 - f * 60)));
  const edges = await stat(front, b => ({ x: b.x, y: b.y, w: b.w, h: Math.round(b.h * band) }));
  const edgesB = await stat(front, b => ({ x: b.x, y: b.y + Math.round(b.h * (1 - band)), w: b.w, h: Math.round(b.h * band) }));
  const surf = await stat(front, b => ({ x: b.x + b.w * .15, y: b.y + b.h * .15, w: b.w * .7, h: b.h * .7 }));
  const cs = []; for (const s of corners) cs.push(score((await stat(s, (b, W, H) => ({ x: 0, y: 0, w: W, h: H }))).white * 0.5));
  return { edges: score((edges.white + edgesB.white) / 2), corners: cs.length ? Math.min(...cs) : null, cornerScores: cs, surface: Math.max(1, Math.min(10, Math.round(10 - surf.glare * 80))), glare: surf.glare > 0.02 };
}
// Centering on the straightened card (photo → detect corners → perspective-correct), so tilt and background don't skew it.
// Measures the printed border on each side along many scanlines, returns L/R and T/B ratios plus an overlay image.
async function measureCard(src, quad) {
  let canvas, found = true;
  try { if (!quad) { const d = await ID.detect(src); quad = d.quad; found = d.found; } canvas = (await ID.rectify(src, quad)).canvas; } catch { return { ok: false }; }
  const W = 500, H = Math.round(canvas.height * W / canvas.width), c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data;
  const px = (X, Y) => { const i = (Y * W + X) * 4; return [d[i], d[i + 1], d[i + 2]]; }, diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const inset = 3; // skip the cut edge itself
  const lim = len => Math.round(len * 0.25);
  const next = (len, get, from) => { const ref = get(from + inset); for (let i = from + inset + 2; i < lim(len); i++) if (diff(get(i), ref) > 75 && diff(get(i + 1), ref) > 75) return i; return null; };
  const border = (len, get) => { // first colour change from the edge; if it's a tiny background sliver left by corner detection, measure from there
    const t1 = next(len, get, 0); if (t1 == null) return null; if (t1 > len * 0.015) return t1;
    const t2 = next(len, get, t1); return t2 == null ? null : t2 - t1; };
  const med = a => { a = a.filter(v => v != null).sort((p, q) => p - q); return a.length >= 4 ? a[a.length >> 1] : null; };
  const S = { L: [], R: [], T: [], B: [] };
  for (let k = 0; k < 15; k++) { const y = Math.round(H * (0.2 + k * 0.04)), X = Math.round(W * (0.2 + k * 0.04));
    S.L.push(border(W, i => px(i, y))); S.R.push(border(W, i => px(W - 1 - i, y))); S.T.push(border(H, i => px(X, i))); S.B.push(border(H, i => px(X, H - 1 - i))); }
  const L = med(S.L), R = med(S.R), T = med(S.T), B = med(S.B);
  if (!L || !R || !T || !B) return { ok: false, found };
  const lr = 100 * L / (L + R), tb = 100 * T / (T + B), max = Math.max(lr, 100 - lr, tb, 100 - tb);
  x.strokeStyle = '#22d3ee'; x.lineWidth = 2; x.setLineDash([6, 4]); x.strokeRect(L, T, W - L - R, H - T - B); x.setLineDash([]); x.strokeStyle = '#f97316'; x.strokeRect(1, 1, W - 2, H - 2);
  x.fillStyle = '#000a'; x.fillRect(0, H / 2 - 14, 70, 28); x.fillRect(W - 70, H / 2 - 14, 70, 28); x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif';
  x.fillText(lr.toFixed(0) + '%', 8, H / 2 + 6); x.fillText((100 - lr).toFixed(0) + '%', W - 62, H / 2 + 6);
  return { ok: true, found, lr: `${lr.toFixed(1)} / ${(100 - lr).toFixed(1)}`, tb: `${tb.toFixed(1)} / ${(100 - tb).toFixed(1)}`, max, px: { L, R, T, B }, overlay: c.toDataURL('image/jpeg', 0.85) };
}
const psaCentering = max => [[55, 10], [60, 9], [65, 8], [70, 7], [80, 6], [85, 5], [90, 4]].find(([m]) => max <= m)?.[1] || 3; // PSA front-centering limits
