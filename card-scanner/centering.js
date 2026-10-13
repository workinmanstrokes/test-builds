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
