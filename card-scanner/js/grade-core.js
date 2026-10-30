/* Card PreGrade – on-device condition analysis (no network, no ML service).
 * Pure JS on RGBA pixel buffers so it runs in a Web Worker and in Node tests.
 * Image = { w, h, d: Uint8ClampedArray RGBA }.
 * Pipeline: detectCard (edge Hough per side + sub-pixel refinement) -> warp (homography)
 *   -> centering (border widths on many scanlines) -> print lines (coherent thin ridges)
 *   -> scratches (thin bright elongated streaks) -> edge whitening -> corner wear -> scoring.
 * All results are ESTIMATES from a photo, never an official grade. */
(function (root) {
  'use strict';
  const CW = 750, CH = 1050; // warped card size (2.5" x 3.5" @ 300 dpi)
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const median = a => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mad = (a, m = median(a)) => median(a.map(v => Math.abs(v - m)));

  // ---------- basic image ops ----------
  function make(w, h) { return { w, h, d: new Uint8ClampedArray(w * h * 4) }; }
  function resize(img, w, h) { // area-average downscale (bilinear when upscaling)
    const out = make(w, h), sx = img.w / w, sy = img.h / h, s = img.d, o = out.d;
    if (sx <= 1 && sy <= 1) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sampleRGB(img, (x + .5) * sx - .5, (y + .5) * sy - .5, o, (y * w + x) * 4); return out; }
    for (let y = 0; y < h; y++) {
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
        let r = 0, g = 0, b = 0, n = 0;
        for (let yy = y0; yy < y1 && yy < img.h; yy++) for (let xx = x0; xx < x1 && xx < img.w; xx++) { const i = (yy * img.w + xx) * 4; r += s[i]; g += s[i + 1]; b += s[i + 2]; n++; }
        const j = (y * w + x) * 4; o[j] = r / n; o[j + 1] = g / n; o[j + 2] = b / n; o[j + 3] = 255;
      }
    }
    return out;
  }
  function fit(img, maxDim) { const k = Math.min(1, maxDim / Math.max(img.w, img.h)); return k >= 1 ? img : resize(img, Math.max(1, Math.round(img.w * k)), Math.max(1, Math.round(img.h * k))); }
  function sampleRGB(img, x, y, o, j) {
    x = clamp(x, 0, img.w - 1.001); y = clamp(y, 0, img.h - 1.001);
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, W = img.w, s = img.d;
    const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
    for (let c = 0; c < 3; c++) o[j + c] = (s[i00 + c] * (1 - fx) + s[i10 + c] * fx) * (1 - fy) + (s[i01 + c] * (1 - fx) + s[i11 + c] * fx) * fy;
    o[j + 3] = 255;
  }
  function gray(img) { const n = img.w * img.h, g = new Float32Array(n), d = img.d; for (let i = 0; i < n; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; return g; }
  function boxBlur(src, w, h, r) { // separable box blur of a Float32 plane
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), k = 2 * r + 1;
    for (let y = 0; y < h; y++) { let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) { tmp[row + x] = acc / k; acc += src[row + clamp(x + r + 1, 0, w - 1)] - src[row + clamp(x - r, 0, w - 1)]; } }
    for (let x = 0; x < w; x++) { let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = acc / k; acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]; } }
    return out;
  }
  const grayAt = (g, w, h, x, y) => { x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001); const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy; };

  // ---------- geometry ----------
  function solve(A, b) { // Gaussian elimination, n<=8
    const n = b.length; A = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; } }
    return A.map((r, i) => r[n] / r[i]);
  }
  function homography(from, to) { // maps from[i] -> to[i]
    const A = [], b = [];
    for (let i = 0; i < 4; i++) { const [x, y] = from[i], [u, v] = to[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    const h = solve(A, b); return [...h, 1];
  }
  const applyH = (H, x, y) => { const z = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / z, (H[3] * x + H[4] * y + H[5]) / z]; };
  function warp(img, quad, w = CW, h = CH) {
    const H = homography([[0, 0], [w, 0], [w, h], [0, h]], quad), out = make(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [sx, sy] = applyH(H, x + .5, y + .5); sampleRGB(img, sx - .5, sy - .5, out.d, (y * w + x) * 4); }
    return out;
  }
  const lineInter = (a, b) => { // lines as {p:[x,y], d:[dx,dy]}
    const den = a.d[0] * b.d[1] - a.d[1] * b.d[0]; if (Math.abs(den) < 1e-9) return null;
    const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / den; return [a.p[0] + t * a.d[0], a.p[1] + t * a.d[1]]; };
  function fitLine(pts) { // total least squares
    let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
    let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); return { p: [mx, my], d: [Math.cos(th), Math.sin(th)] };
  }
  const distToLine = (L, [x, y]) => Math.abs((x - L.p[0]) * L.d[1] - (y - L.p[1]) * L.d[0]);
  const quadArea = q => Math.abs(q.reduce((s, p, i) => { const n = q[(i + 1) % 4]; return s + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;

  // ---------- card detection ----------
  // For each side, a small Hough over near-axis lines on the gradient image; then the 4-line combination whose
  // quad has the strongest edge support and a trading-card aspect ratio wins.
  function detectCard(img) {
    const sm = fit(img, 480), W = sm.w, H = sm.h, s = W / img.w;
    // colour Sobel: per pixel, the channel with the strongest gradient (a blue border on green felt has ~no luma edge)
    const gx = new Float32Array(W * H), gy = new Float32Array(W * H), ch = [0, 1, 2].map(c => { const p = new Float32Array(W * H); for (let i = 0; i < W * H; i++) p[i] = sm.d[i * 4 + c]; return boxBlur(p, W, H, 1); });
    for (const g of ch) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x;
      const ax = (g[i + 1 - W] + 2 * g[i + 1] + g[i + 1 + W]) - (g[i - 1 - W] + 2 * g[i - 1] + g[i - 1 + W]);
      const ay = (g[i + W - 1] + 2 * g[i + W] + g[i + W + 1]) - (g[i - W - 1] + 2 * g[i - W] + g[i - W + 1]);
      if (ax * ax + ay * ay > gx[i] * gx[i] + gy[i] * gy[i]) { gx[i] = ax; gy[i] = ay; } }
    const ANG = []; for (let a = -14; a <= 14; a += 1) ANG.push(Math.tan(a * Math.PI / 180));
    // vertical-ish lines: x = x0 + t*(y - H/2)
    function hough(vert) {
      const L = vert ? W : H, M = vert ? H : W, G = vert ? gx : gy, Go = vert ? gy : gx, res = [];
      for (const t of ANG) { const acc = new Float32Array(L), cnt = new Uint16Array(L);
        for (let m = 2; m < M - 2; m += 2) { const off = Math.round(t * (m - M / 2));
          for (let l0 = 0; l0 < L; l0++) { const l = l0 + off; if (l < 1 || l >= L - 1) continue;
            const i = vert ? m * W + l : l * W + m, a = Math.abs(G[i]), b = Math.abs(Go[i]); acc[l0] += a > b ? a - 0.5 * b : 0; cnt[l0]++; } }
        for (let l0 = 0; l0 < L; l0++) res.push({ l0, t, v: cnt[l0] ? acc[l0] / (M / 2) : 0 }); }
      return res;
    }
    function peaks(res, lo, hi, L) { // local maxima in (position, angle) Hough space
      const nA = ANG.length, at = (ai, l) => l < 0 || l >= L ? 0 : res[ai * L + l].v, out = [];
      for (let ai = 0; ai < nA; ai++) for (let l = Math.max(0, Math.floor(lo)); l < Math.min(L, hi); l++) { const v = at(ai, l); if (v < 8) continue; let isMax = true;
        for (let da = -2; da <= 2 && isMax; da++) for (let dl = -2; dl <= 2; dl++) { if (!da && !dl) continue; const aj = ai + da; if (aj < 0 || aj >= nA) continue; const u = at(aj, l + dl); if (u > v || (u === v && (da < 0 || (da === 0 && dl < 0)))) { isMax = false; break; } }
        if (isMax) out.push(res[ai * L + l]); }
      out.sort((a, b) => b.v - a.v); const top = out.slice(0, 8), mx = out.length ? out[0].v : 0;
      // always keep the outermost reasonably strong lines too: a low-contrast cut edge can rank below busy artwork
      const outer = out.filter(r => r.v >= mx * 0.15 && !top.includes(r)).sort((a, b) => lo === 0 ? a.l0 - b.l0 : b.l0 - a.l0).slice(0, 2);
      return top.concat(outer);
    }
    const V = hough(true), Hh = hough(false);
    
    const lines = { L: peaks(V, 0, W * 0.5, W), R: peaks(V, W * 0.5, W, W), T: peaks(Hh, 0, H * 0.5, H), B: peaks(Hh, H * 0.5, H, H) };
    const mk = (r, vert) => vert ? { p: [r.l0, H / 2], d: [r.t, 1] } : { p: [W / 2, r.l0], d: [1, r.t] };
    // frame-edge fallbacks for photos cropped tight to the card
    const frame = { L: { p: [0, 0], d: [0, 1], frame: 1 }, R: { p: [W - 1, 0], d: [0, 1], frame: 1 }, T: { p: [0, 0], d: [1, 0], frame: 1 }, B: { p: [0, H - 1], d: [1, 0], frame: 1 } };
    const cand = {}; for (const k of 'LRTB') cand[k] = [...lines[k].map(r => mk(r, k === 'L' || k === 'R')), frame[k]];
    function support(a, b) { // mean normal gradient along segment a->b (central 80%)
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 10) return 0; const nx = -dy / len, ny = dx / len; let s = 0, n = 0;
      for (let k = 0.1; k <= 0.9; k += 0.02) { const x = Math.round(a[0] + dx * k), y = Math.round(a[1] + dy * k); if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) { n++; continue; }
        const i = y * W + x; s += Math.abs(gx[i] * nx + gy[i] * ny); n++; }
      return s / n;
    }
    // background model from the photo's outer frame: a true card outline has background just outside it
    const bgIdx = []; const bw = Math.max(2, Math.round(Math.min(W, H) * 0.04));
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (x < bw || y < bw || x >= W - bw || y >= H - bw) bgIdx.push((y * W + x) * 4);
    const bgM = [0, 1, 2].map(c => median(bgIdx.map(i => sm.d[i + c]))), bgD = bgIdx.map(i => Math.hypot(sm.d[i] - bgM[0], sm.d[i + 1] - bgM[1], sm.d[i + 2] - bgM[2]));
    const bgT = Math.max(30, median(bgD) * 2.5);
    function outsideBg(a, b, cx, cy) { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); let nx = -dy / len, ny = dx / len;
      if ((cx - (a[0] + b[0]) / 2) * nx + (cy - (a[1] + b[1]) / 2) * ny > 0) { nx = -nx; ny = -ny; } let hit = 0, n = 0;
      for (let k = 0.15; k <= 0.85; k += 0.05) { const x = Math.round(a[0] + dx * k + nx * 4), y = Math.round(a[1] + dy * k + ny * 4); if (x < 0 || y < 0 || x >= W || y >= H) continue; n++; const i = (y * W + x) * 4;
        if (Math.hypot(sm.d[i] - bgM[0], sm.d[i + 1] - bgM[1], sm.d[i + 2] - bgM[2]) < bgT) hit++; }
      return n ? hit / n : 0.5; }
    const combos = [];
    for (const l of cand.L) for (const r of cand.R) for (const t of cand.T) for (const b of cand.B) {
      const q = [lineInter(t, l), lineInter(t, r), lineInter(b, r), lineInter(b, l)]; if (q.some(p => !p)) continue;
      if (q.some(([x, y]) => x < -W * 0.05 || y < -H * 0.05 || x > W * 1.05 || y > H * 1.05)) continue;
      const wTop = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), wBot = Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1]);
      const hL = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]), hR = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
      const area = quadArea(q); if (area < W * H * 0.08) continue;
      const ar = (wTop + wBot) / (hL + hR), dev = Math.min(Math.abs(Math.log(ar / (2.5 / 3.5))), Math.abs(Math.log(ar / (3.5 / 2.5))) + 0.08); // portrait is far more common
      const sides = [support(q[0], q[1]) * (t.frame ? 0 : 1), support(q[1], q[2]) * (r.frame ? 0 : 1), support(q[2], q[3]) * (b.frame ? 0 : 1), support(q[3], q[0]) * (l.frame ? 0 : 1)];
      const nFrame = [l, r, t, b].filter(x => x.frame).length;
      const sup = sides.reduce((a, b) => a + b, 0) / 4 + nFrame * 6;
      const qcx = (q[0][0] + q[2][0]) / 2, qcy = (q[0][1] + q[2][1]) / 2, ob = [[t, 0, 1], [r, 1, 2], [b, 2, 3], [l, 3, 0]].filter(([ln]) => !ln.frame).map(([, i, j]) => outsideBg(q[i], q[j], qcx, qcy));
      const obf = ob.length ? ob.reduce((a, v) => a + v, 0) / ob.length : 0.5;
      const score = sup * Math.exp(-((dev / 0.12) ** 2)) * (0.75 + 0.25 * Math.sqrt(area / (W * H))) * (0.4 + obf);
      const real = sides.filter((v, i) => ![t, r, b, l][i].frame), mx = Math.max(...real, 1);
      if (real.some(v => v < mx * 0.35 || v < 12)) continue;
      combos.push({ q, score, nFrame, sides, area });
    }
    // nested quads (outer cut edge vs printed inner border) score alike: prefer the outermost strong one
    const topC = combos.reduce((m, c) => !m || c.score > m.score ? c : m, null), top = topC ? topC.score : 0;
    const ang = (q, i) => { const a = q[i], b = q[(i + 1) % 4]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    const inside = (q, p) => q.every((a, i) => { const b = q[(i + 1) % 4]; return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1; });
    const nested = c => c === topC || (c.nFrame <= topC.nFrame && topC.q.every(p => inside(c.q, p)) && [0, 1, 2, 3].every(i => { let d = Math.abs(ang(c.q, i) - ang(topC.q, i)); d = Math.min(d, 2 * Math.PI - d); return d < 0.09; }) && c.area < topC.area * 1.6);
    const best = topC && combos.filter(c => c.score >= top * (c === topC ? 0 : 0.2) && nested(c) && c.area <= topC.area * 1.35).sort((a, b) => b.area - a.area)[0];
    if (!best) return { quad: [[0, 0], [img.w, 0], [img.w, img.h], [0, img.h]], found: false, method: 'frame', confidence: 0 };
    let quad = best.q.map(([x, y]) => [x / s, y / s]);
    quad = refineQuad(img, quad);
    const minSide = Math.min(...best.sides.filter(v => v > 0), 999);
    const confidence = clamp((best.nFrame ? 0.5 : 1) * Math.min(1, minSide / 60), 0, 1);
    return { quad, found: best.nFrame < 4, method: best.nFrame ? 'partial-frame' : 'edges', confidence };
  }
  // Sub-pixel refinement of each side on a larger image: max normal gradient near the side, robust line fit.
  function refineQuad(img, quad) {
    const big = fit(img, 1600), k = big.w / img.w, W = big.w, H = big.h, ta = new Float32Array(4), tb = new Float32Array(4);
    const cdiff = (x1, y1, x2, y2) => { sampleRGB(big, x1 - .5, y1 - .5, ta, 0); sampleRGB(big, x2 - .5, y2 - .5, tb, 0); return Math.hypot(ta[0] - tb[0], ta[1] - tb[1], ta[2] - tb[2]); };
    const q = quad.map(([x, y]) => [x * k, y * k]), out = [];
    const sides = [[0, 1], [1, 2], [2, 3], [3, 0]], L = [];
    const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    for (const [a, b] of sides) {
      const A = q[a], B = q[b], dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy); let nx = -dy / len, ny = dx / len;
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; } // n points inward
      const R = Math.max(4, Math.round(len * 0.012)), pts = [];
      for (let t = 0.12; t <= 0.88; t += 0.76 / 60) { const px = A[0] + dx * t, py = A[1] + dy * t; let bestV = 0, bestO = null;
        for (let o = -R; o <= R; o += 0.5) { const x = px + nx * o, y = py + ny * o; if (x < 2 || y < 2 || x > W - 3 || y > H - 3) continue;
          const v = cdiff(x + nx, y + ny, x - nx, y - ny); if (v > bestV) { bestV = v; bestO = o; } }
        if (bestO !== null && bestV > 6) pts.push([px + nx * bestO, py + ny * bestO]); }
      if (pts.length < 12) { L.push({ p: A, d: [dx / len, dy / len] }); continue; }
      let line = fitLine(pts); 
      for (let it = 0; it < 2; it++) { const r = pts.map(p => distToLine(line, p)), m = median(r); const keep = pts.filter((p, i) => r[i] <= Math.max(1, 2.5 * m)); if (keep.length >= 10) line = fitLine(keep); }
      L.push(line);
    }
    for (let i = 0; i < 4; i++) { const p = lineInter(L[(i + 3) % 4], L[i]); out.push(p ? [p[0] / k, p[1] / k] : quad[i]); }
    if (Math.abs(quadArea(out) / quadArea(quad) - 1) > 0.15) return quad; // refinement went astray
    return out;
  }

  // ---------- centering ----------
  const cdist = (d, i, r) => Math.hypot(d[i] - r[0], d[i + 1] - r[1], d[i + 2] - r[2]);
  function measureCentering(card) {
    const { w, h, d } = card, res = {};
    const sides = { L: [w, (k, y) => (y * w + k) * 4], R: [w, (k, y) => (y * w + (w - 1 - k)) * 4], T: [h, (k, x) => (k * w + x) * 4], B: [h, (k, x) => ((h - 1 - k) * w + x) * 4] };
    const all = [];
    for (const key of 'LRTB') {
      const [len, at] = sides[key], other = key === 'L' || key === 'R' ? h : w, s0 = Math.round(len * 0.012), s1 = Math.round(len * 0.022), lim = Math.round(len * 0.2);
      const scan = []; for (let j = 0; j < 41; j++) scan.push(Math.round(other * (0.22 + 0.56 * j / 40)));
      // border reference colour from the band just inside the cut edge
      const ref = [0, 1, 2].map(c => { const v = []; for (const o of scan) for (let k = s0; k <= s1; k++) v.push(d[at(k, o) + c]); return median(v); });
      const noise = median(scan.map(o => { const v = []; for (let k = s0; k <= s1; k++) v.push(cdist(d, at(k, o), ref)); return median(v); }));
      const T = Math.max(38, 5 * noise), hits = [];
      for (const o of scan) { let hit = null;
        for (let k = s0; k < lim; k++) if (cdist(d, at(k, o), ref) > T && cdist(d, at(k + 1, o), ref) > T && cdist(d, at(k + 2, o), ref) > T) { hit = k; break; }
        if (hit !== null) { // sub-pixel: where distance crosses T/2... use half-way between k-1 and k weighted
          const a = cdist(d, at(hit - 1, o), ref), b = cdist(d, at(hit, o), ref); hits.push(hit - 1 + clamp((T * 0.6 - a) / Math.max(1, b - a), 0, 1)); } }
      const m = median(hits), spread = hits.length ? mad(hits, m) : 99;
      res[key] = { px: m, n: hits.length, spread, ref, len };
      all.push(res[key]);
    }
    const ok = all.every(s => s.n >= 41 * 0.55 && s.spread <= s.len * 0.006 && s.px > s.len * 0.016);
    const out = { ok, sides: res };
    if (!ok) { out.reason = all.some(s => s.px <= s.len * 0.016 || s.n < 41 * 0.55) ? 'no-border' : 'irregular-border'; return out; }
    const { L, R, T, B } = res, lr = 100 * L.px / (L.px + R.px), tb = 100 * T.px / (T.px + B.px);
    out.lr = [lr, 100 - lr]; out.tb = [tb, 100 - tb]; out.worst = Math.max(lr, 100 - lr, tb, 100 - tb);
    out.inner = { x0: L.px, x1: w - R.px, y0: T.px, y1: h - B.px };
    out.confidence = clamp(1 - Math.max(...all.map(s => s.spread / (s.len * 0.006))) * 0.5, 0.3, 1);
    return out;
  }
  const fmtRatio = a => `${Math.round(a[0])}/${Math.round(a[1])}`;

  // ---------- glare / sharpness ----------
  function quality(card) {
    const { w, h, d } = card, g = gray(card); let lap = 0, lapN = 0, glare = 0, n = 0;
    const mask = new Uint8Array(w * h);
    for (let y = 2; y < h - 2; y += 1) for (let x = 2; x < w - 2; x++) { const i = y * w + x, j = i * 4;
      if ((y & 1) === 0 && (x & 1) === 0) { const L = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; lap += L * L; lapN++; }
      const mx = Math.max(d[j], d[j + 1], d[j + 2]), mn = Math.min(d[j], d[j + 1], d[j + 2]);
      if (mn > 243 && mx - mn < 14) { mask[i] = 1; glare++; } n++; }
    // morphological opening drops thin bright streaks (those are scratches, not glare), then grow blobs a little
    const er = boxBlur(Float32Array.from(mask), w, h, 3), core = new Float32Array(w * h); let glareCore = 0;
    for (let i = 0; i < w * h; i++) if (er[i] > 0.97) { core[i] = 1; glareCore++; }
    const dil = boxBlur(core, w, h, 9), grown = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) grown[i] = dil[i] > 0.004 ? 1 : 0;
    glare = Math.min(glare, glareCore * 2);
    return { sharp: Math.sqrt(lap / lapN), glare: glare / n, glareMask: grown, gray: g };
  }

  // ---------- print lines ----------
  // Print lines are long, perfectly straight, axis-aligned thin ridges that run across artwork and border alike.
  // Ridge response per pixel; averaged along the line direction in 8 bands; a line must be coherent in >= 6 bands.
  function printLines(card, q, cent) {
    const { w, h } = card, g = q.gray, out = [];
    for (const vert of [true, false]) {
      const L = vert ? w : h, M = vert ? h : w, BANDS = 8, m0 = Math.round(M * 0.03), m1 = M - m0, bw = (m1 - m0) / BANDS;
      const profile = (r0, r1) => { const p = new Float32Array(L), cnt = new Float32Array(L);
        for (let m = r0; m < r1; m++) for (let l = 3; l < L - 3; l++) {
          const i = vert ? m * w + l : l * w + m, st = vert ? 1 : w;
          if (q.glareMask[i]) continue;
          const c = g[i], a = g[i - 3 * st], bb = g[i + 3 * st], r = c - 0.5 * (a + bb), step = Math.abs(bb - a);
          p[l] += Math.abs(r) > step ? r : 0; cnt[l]++; }
        for (let l = 0; l < L; l++) p[l] = cnt[l] > (r1 - r0) * 0.5 ? p[l] / cnt[l] : 0;
        return p; };
      const prof = []; for (let b = 0; b < BANDS; b++) prof.push(profile(Math.round(m0 + b * bw), Math.round(m0 + (b + 1) * bw)));
      // end caps: the outermost strip of the card (border zone). Real print lines run through it; text rows and frame rules don't.
      const caps = [profile(Math.round(M * 0.01), Math.round(M * 0.03)), profile(Math.round(M * 0.97), Math.round(M * 0.99))];
      const norm = p => { const hp = new Float32Array(L); for (let l = 6; l < L - 6; l++) { let s = 0; for (let k = -6; k <= 6; k++) if (Math.abs(k) > 1) s += p[l + k]; hp[l] = p[l] - s / 10; }
        const vals = Array.from(hp.subarray(8, L - 8)), m = median(vals), sd = Math.max(0.5, 1.4826 * mad(vals, m)); return hp.map(v => (v - m) / sd); };
      const z = prof.map(norm), zc = caps.map(norm);
      const excl = new Set(); if (cent && cent.ok) { const e = vert ? [cent.inner.x0, cent.inner.x1] : [cent.inner.y0, cent.inner.y1]; for (const v of e) for (let k = -10; k <= 10; k++) excl.add(Math.round(v) + k); }
      const edge = Math.round(L * 0.07); let last = -99;
      for (let l = edge; l < L - edge; l++) { if (excl.has(l)) continue;
        for (const sign of [1, -1]) { let run = 0, bestRun = 0, cntB = 0, str = [];
          for (let b = 0; b < BANDS; b++) { const v = Math.max(sign * z[b][l - 1], sign * z[b][l], sign * z[b][l + 1]); if (v > 3.2) { run++; cntB++; str.push(v); bestRun = Math.max(bestRun, run); } else run = 0; }
          const core = sign * z.reduce((s, zb) => s + zb[l], 0) / BANDS;
          const capOk = zc.every(zz => Math.max(sign * zz[l - 1], sign * zz[l], sign * zz[l + 1]) > 3);
          const zs = z.map(zb => Math.max(sign * zb[l - 1], sign * zb[l], sign * zb[l + 1])), weak = zs.filter(v => v > 1.5).length, zmed = median(zs);
          const capStrong = zc.every(zz => Math.max(sign * zz[l - 1], sign * zz[l], sign * zz[l + 1]) > 4);
          if (capOk && l - last > 4 && ((cntB >= 6 && bestRun >= 5 && core > 3.6) || (capStrong && weak >= 6 && zmed > 1.8))) {
            const amp = median(prof.map(p => sign * p[l])); if (amp < 1.5) continue;
            const capAmp = Math.min(...caps.map(p => Math.max(sign * p[l - 1], sign * p[l], sign * p[l + 1]))); if (capAmp < Math.max(1.2, 0.35 * amp)) continue; // same ink through the border
            out.push({ orient: vert ? 'v' : 'h', pos: l, sign: sign > 0 ? 'light' : 'dark', strength: +core.toFixed(1), amp: +amp.toFixed(1), coverage: cntB / BANDS });
            last = l; } } }
    }
    // merge near-duplicates (double-edged lines)
    return out.filter((a, i) => !out.some((b, j) => j !== i && b.orient === a.orient && Math.abs(b.pos - a.pos) <= 8 && (b.strength > a.strength || (b.strength === a.strength && j < i))));
  }

  // ---------- scratches ----------
  function scratches(card, q, lines) {
    const { w, h } = card, g = q.gray, bg = boxBlur(g, w, h, 7), sq = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) sq[i] = (g[i] - bg[i]) ** 2;
    const lv = boxBlur(sq, w, h, 15), cand = new Uint8Array(w * h), mx = Math.round(w * 0.035), my = Math.round(h * 0.035);
    for (let y = my; y < h - my; y++) for (let x = mx; x < w - mx; x++) { const i = y * w + x; if (q.glareMask[i]) continue;
      // thin ridge: brighter than both neighbours 3px away in some direction (a scratch), not just a bright area
      const c = g[i]; let rid = 0;
      for (const o of [3, 3 * w, 2 * w + 2, 2 * w - 2]) { const v = c - Math.max(g[i + o], g[i - o]); if (v > rid) rid = v; }
      const sd = Math.sqrt(lv[i]); if (rid > Math.max(16, 1.8 * sd)) cand[i] = 1; }
    // suppress dense patterned tiles (holo/refractor textures)
    const T = 50, busy = new Set();
    for (let ty = 0; ty < h; ty += T) for (let tx = 0; tx < w; tx += T) { let c = 0, n = 0; for (let y = ty; y < Math.min(h, ty + T); y++) for (let x = tx; x < Math.min(w, tx + T); x++) { c += cand[y * w + x]; n++; } if (c / n > 0.1) busy.add(`${tx},${ty}`); }
    const lab = new Int32Array(w * h), out = [], stack = []; let id = 0, busyFrac = busy.size / (Math.ceil(w / T) * Math.ceil(h / T));
    for (let s = 0; s < w * h; s++) { if (!cand[s] || lab[s]) continue; id++; const px = []; stack.push(s); lab[s] = id;
      while (stack.length) { const i = stack.pop(); px.push(i); const x = i % w, y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (cand[j] && !lab[j]) { lab[j] = id; stack.push(j); } } }
      if (px.length < 18) continue;
      let sx = 0, sy = 0; for (const i of px) { sx += i % w; sy += (i / w) | 0; } sx /= px.length; sy /= px.length;
      let cxx = 0, cyy = 0, cxy = 0; for (const i of px) { const dx = i % w - sx, dy = ((i / w) | 0) - sy; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy; } cxx /= px.length; cyy /= px.length; cxy /= px.length;
      const tr = cxx + cyy, det = cxx * cyy - cxy * cxy, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = Math.max(0, tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det)));
      const len = Math.sqrt(12 * l1), wid = Math.max(1, px.length / len), ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      
      if (len < 40 || wid > 3.2 || len / wid < 14 || Math.sqrt(12 * l2) > Math.max(4.5, len * 0.035)) continue;
      const axisAligned = Math.min(Math.abs(Math.sin(ang)), Math.abs(Math.cos(ang))) < 0.02;
      if (axisAligned) continue; // straight axis-aligned features are print lines or design rules, handled elsewhere
      if (busy.has(`${Math.floor(sx / T) * T},${Math.floor(sy / T) * T}`) && len < 120) continue;
      let con = 0, sIn = 0, sOut = 0; const nx = -Math.sin(ang), ny = Math.cos(ang);
      for (const i of px) { con += g[i] - bg[i]; const x = i % w, y = (i / w) | 0; sIn += sat(card.d, i * 4);
        const xo = clamp(Math.round(x + nx * 5), 0, w - 1), yo = clamp(Math.round(y + ny * 5), 0, h - 1), xo2 = clamp(Math.round(x - nx * 5), 0, w - 1), yo2 = clamp(Math.round(y - ny * 5), 0, h - 1);
        sOut += (sat(card.d, (yo * w + xo) * 4) + sat(card.d, (yo2 * w + xo2) * 4)) / 2; }
      con /= px.length; sIn /= px.length; sOut /= px.length;
      if (len < 70 || con < 30) continue; // calibrated: shorter/fainter streaks were mostly card texture (≈6 mm at card scale)
      if (sIn > sOut * 0.9 + 6) continue; // surface scratches catch light: brighter AND less saturated than the print around them
      const c = Math.cos(ang), s2 = Math.sin(ang);
      out.push({ x: sx, y: sy, len: +len.toFixed(0), width: +wid.toFixed(1), angle: +(ang * 180 / Math.PI).toFixed(0), contrast: +con.toFixed(0), p0: [sx - c * len / 2, sy - s2 * len / 2], p1: [sx + c * len / 2, sy + s2 * len / 2] });
    }
    // families of parallel streaks are a printed pattern (hatching, refractor rays), not scratches
    const keep = out.filter(a => out.filter(b => b !== a && Math.abs(((b.angle - a.angle + 270) % 180) - 90) < 4).length < 2);
    keep.sort((a, b) => b.len - a.len);
    return { list: keep.slice(0, 12), busyFrac };
  }

  // ---------- edges (whitening) & corners ----------
  const luma = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const sat = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  // cm = card warped WITH an M-pixel margin of surrounding photo, so the true cut edge can be found locally.
  // Wear shows as (a) whitening: bright, unsaturated specks just inside the edge that aren't background, or
  // (b) chipping: the local edge sits further in than the straight cut line.
  function labeler(bRef, bgRef) {
    const bL = 0.299 * bRef[0] + 0.587 * bRef[1] + 0.114 * bRef[2];
    return (d, i) => { const dbg = Math.hypot(d[i] - bgRef[0], d[i + 1] - bgRef[1], d[i + 2] - bgRef[2]), db = Math.hypot(d[i] - bRef[0], d[i + 1] - bRef[1], d[i + 2] - bRef[2]);
      if (luma(d, i) > Math.max(150, bL + 55) && sat(d, i) < 55 && dbg > 35) return 2; // whitening
      return dbg < db ? 0 : 1; }; // 0 background, 1 card
  }
  const medColor = (d, idxs) => [0, 1, 2].map(c => median(idxs.map(i => d[i + c])));
  function edgeWear(cm, M, vis = {}) {
    const W = cm.w, w = W - 2 * M, h = cm.h - 2 * M, d = cm.d, res = {};
    const defs = { top: [w, (t, k) => ((M + k) * W + M + t) * 4], bottom: [w, (t, k) => ((M + h - 1 - k) * W + M + t) * 4], left: [h, (t, k) => ((M + t) * W + M + k) * 4], right: [h, (t, k) => ((M + t) * W + M + w - 1 - k) * 4] };
    let worn = 0, tot = 0;
    for (const [name, [len, at]] of Object.entries(defs)) {
      const c0 = Math.round(len * 0.07), c1 = len - c0, bi = [], gi = [];
      for (let t = c0; t < c1; t += 3) { for (let k = 14; k <= 26; k += 3) bi.push(at(t, k)); for (let k = -M + 2; k <= -6; k += 2) gi.push(at(t, k)); }
      const bRef = medColor(d, bi), bgRef = medColor(d, gi), sep = Math.hypot(bRef[0] - bgRef[0], bRef[1] - bgRef[1], bRef[2] - bgRef[2]);
      const bL = 0.299 * bRef[0] + 0.587 * bRef[1] + 0.114 * bRef[2], lightBorder = bL > 175 && Math.max(...bRef) - Math.min(...bRef) < 45;
      const lab = labeler(bRef, bgRef), useEdge = sep > 40, measurable = vis[name] !== false && (useEdge || !lightBorder);
      let wIn = 0, nIn = 0; if (measurable) for (let t = c0; t < c1; t += 2) for (let k = 20; k <= 40; k += 4) { nIn++; if (lab(d, at(t, k)) === 2) wIn++; }
      const whiteArt = nIn > 0 && wIn / nIn > 0.08; // border artwork already has white/silver in it: whitening can't be told apart, count chips only
      const e = new Float32Array(len).fill(NaN), white = new Uint8Array(len);
      if (measurable) for (let t = c0; t < c1; t++) {
        let edge = 0; if (useEdge) { edge = NaN; for (let k = -8; k <= 10; k++) if (lab(d, at(t, k)) && lab(d, at(t, k + 1)) && lab(d, at(t, k + 2))) { edge = k; break; } if (isNaN(edge)) edge = 10; }
        e[t] = edge; const e0 = Math.max(edge, useEdge ? -2 : 2); let c = 0, inner = 0;
        for (let k = e0; k <= e0 + 6; k++) if (lab(d, at(t, k)) === 2) c++;
        for (let k = e0 + 10; k <= e0 + 18; k++) if (lab(d, at(t, k)) === 2) inner++;
        white[t] = !whiteArt && c >= 2 && inner <= 1 ? 1 : 0; } // whitening is a thin rim; printed white that continues inward is design
      const flags = new Uint8Array(len); let n = 0;
      if (measurable) { const base = median(Array.from(e.subarray(c0, c1)).filter(v => !isNaN(v)));
        for (let t = c0; t < c1; t++) { const chip = useEdge && e[t] - base >= 3; if (white[t] || chip) { flags[t] = 1; n++; } } }
      const segs = []; let st = -1, gap = 0;
      for (let t = c0; t <= c1; t++) { if (t < c1 && flags[t]) { if (st < 0) st = t; gap = 0; } else if (st >= 0) { if (++gap > 4 || t === c1) { const en = t - gap + 1; if (en - st >= 3) segs.push([st, en]); st = -1; gap = 0; } } }
      const frac = measurable ? n / (c1 - c0) : null, misaligned = frac !== null && frac > 0.5;
      res[name] = { measurable: measurable && !misaligned, frac: misaligned ? null : frac, segs: misaligned ? [] : segs, sep: Math.round(sep), lightBorder, whiteArt, misaligned, cropped: vis[name] === false };
      if (measurable && !misaligned) { worn += n; tot += c1 - c0; }
    }
    return { sides: res, frac: tot ? worn / tot : null };
  }
  function cornerWear(cm, M, vis = {}) {
    const W = cm.w, w = W - 2 * M, h = cm.h - 2 * M, d = cm.d, S = Math.round(w * 0.09), out = [];
    const defs = [['top-left', (x, y) => [x, y]], ['top-right', (x, y) => [w - 1 - x, y]], ['bottom-right', (x, y) => [w - 1 - x, h - 1 - y]], ['bottom-left', (x, y) => [x, h - 1 - y]]];
    for (const [name, map] of defs) {
      const idx = (x, y) => { const [X, Y] = map(x, y); return ((Y + M) * W + X + M) * 4; };
      const bi = [], gi = []; for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) { bi.push(idx(S + a * 2, 14 + b * 2), idx(14 + b * 2, S + a * 2)); gi.push(idx(-M + 2 + b, S + a * 3), idx(S + a * 3, -M + 2 + b)); }
      const bRef = medColor(d, bi), bgRef = medColor(d, gi), sep = Math.hypot(bRef[0] - bgRef[0], bRef[1] - bgRef[1], bRef[2] - bgRef[2]);
      const bL = 0.299 * bRef[0] + 0.587 * bRef[1] + 0.114 * bRef[2], lightBorder = bL > 175 && Math.max(...bRef) - Math.min(...bRef) < 45, lab = labeler(bRef, bgRef);
      let t = 0; if (sep > 40) { for (t = -6; t < S; t++) if (lab(d, idx(t, t)) && lab(d, idx(t + 1, t + 1))) break; t = Math.max(0, t); }
      let white = 0, n = 0, whiteIn = 0, nIn = 0; const r = Math.max(1, t / (Math.SQRT2 - 1));
      if (!lightBorder || sep > 40) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const inArc = x < r && y < r, dist = inArc ? r - Math.hypot(r - x, r - y) : Math.min(x, y);
        if (dist >= 14 && dist <= 24) { nIn++; if (lab(d, idx(x, y)) === 2) whiteIn++; continue; }
        if (dist < 1 || dist > 9) continue; n++; if (lab(d, idx(x, y)) === 2) white++; }
      // white artwork running into the corner (stripes, white frames) is design, not wear: only whitening beyond the inner level counts
      const whiteArt = nIn > 0 && whiteIn / nIn > 0.15;
      if (n && nIn) white = whiteArt ? 0 : Math.max(0, white - n * (whiteIn / nIn));
      const [cx, cy] = map(0, 0);
      const [v1, v2] = name.split('-'), seen = vis[v1] !== false && vis[v2] !== false;
      const rOk = sep > 40 && r <= w * 0.075; // real corners are ~3 mm radius; a huge 'radius' means the labels are confused (sleeve, pattern)
      out.push({ name, measurable: seen && (sep > 40 || !lightBorder) && (sep <= 40 || rOk), whiteArt, white: n ? white / n : null, radius: rOk ? r : null, x: cx, y: cy, size: S, sep: Math.round(sep), _lab: lab, _idx: idx });
    }
    const radii = out.filter(c => c.radius !== null).map(c => c.radius), base = radii.length >= 3 ? median(radii) : null;
    for (const c of out) {
      let missing = 0;
      if (base !== null && c.radius !== null) { const R = base; const lim = Math.min(S, R + 8); for (let y = 3; y < lim; y++) for (let x = 3; x < lim; x++) { const inArc = x < R && y < R, inside = inArc ? Math.hypot(R - x, R - y) <= R - 3 : true; if (inside && c._lab(d, c._idx(x, y)) === 0) missing++; } }
      c.missing = missing; c.excessRound = missing / (w * 0.01) ** 2;
      c.wear = clamp((c.white || 0) * 2.2 + Math.max(0, c.excessRound - 0.5) * 0.4, 0, 1);
      delete c._lab; delete c._idx;
    }
    return out;
  }

  // ---------- full analysis of one side ----------
  function analyzeSide(img, opts = {}) {
    const det = opts.quad ? { quad: opts.quad, found: true, method: 'manual', confidence: 1 } : detectCard(img);
    let quad = det.quad;
    const wTop = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]), hL = Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]);
    const landscape = wTop > hL * 1.15; const cw = landscape ? CH : CW, ch = landscape ? CW : CH;
    const need = 1.4 * Math.max(cw, ch) / Math.max(wTop, hL, 1), src = need >= 1 ? img : fit(img, Math.round(Math.max(img.w, img.h) * need));
    const k = src.w / img.w, M = 16, sq = quad.map(([x, y]) => [x * k, y * k]);
    const Hm = homography([[M, M], [cw + M, M], [cw + M, ch + M], [M, ch + M]], sq), cm = make(cw + 2 * M, ch + 2 * M);
    for (let y = 0; y < cm.h; y++) for (let x = 0; x < cm.w; x++) { const [sx, sy] = applyH(Hm, x + .5, y + .5); sampleRGB(src, sx - .5, sy - .5, cm.d, (y * cm.w + x) * 4); }
    // which edges have real background around them in the photo (a tight crop hides the cut edge)
    const inImg = (x, y) => { const [sx, sy] = applyH(Hm, x, y); return sx >= 2 && sy >= 2 && sx <= src.w - 3 && sy <= src.h - 3; };
    const vis = {}; for (const [name, f] of Object.entries({ top: t => [M + t * cw, M - 12], bottom: t => [M + t * cw, M + ch + 12], left: t => [M - 12, M + t * ch], right: t => [M + cw + 12, M + t * ch] }))
      vis[name] = [0.05, 0.3, 0.5, 0.7, 0.95].every(t => inImg(...f(t)));
    const card = make(cw, ch); for (let y = 0; y < ch; y++) card.d.set(cm.d.subarray(((y + M) * cm.w + M) * 4, ((y + M) * cm.w + M + cw) * 4), y * cw * 4);
    const q = quality(card), cent = measureCentering(card), pl = printLines(card, q, cent), sc = scratches(card, q, pl), ew = edgeWear(cm, M, vis), cw2 = cornerWear(cm, M, vis);
    const notes = [];
    if (q.sharp < 9) notes.push('Photo looks soft. Hold steady and tap to focus for sharper results.');
    if (q.glare > 0.01) notes.push('Glare detected. Glare areas are skipped, so tilt the card or move away from direct light.');
    if (!det.found) notes.push('Card edges were not found automatically. Drag the corners to fit the card.');
    if (Object.values(vis).some(v => !v)) notes.push('Part of the card touches the photo border, so those edges and corners were skipped. Leave a little space around the card.');
    if (sc.busyFrac > 0.35) notes.push('Busy holo/refractor pattern: scratch check is less sensitive on this card.');
    return { quad, detect: { found: det.found, method: det.method, confidence: det.confidence }, card, landscape,
      quality: { sharp: q.sharp, glare: q.glare }, centering: cent, printLines: pl, scratches: sc.list, busyFrac: sc.busyFrac, edges: ew, corners: cw2, notes };
  }

  // ---------- scoring ----------
  const half = v => Math.round(v * 2) / 2;
  function centeringScore(front, back) {
    const tf = [[55, 10], [60, 9], [65, 8], [70, 7], [75, 6], [80, 5], [85, 4], [90, 3]], tb = [[75, 10], [90, 9], [95, 6]];
    let s = null; if (front && front.ok) s = (tf.find(([m]) => front.worst <= m) || [0, 2])[1];
    if (back && back.ok) { const b = (tb.find(([m]) => back.worst <= m) || [0, 4])[1]; s = s === null ? null : Math.min(s, b); }
    return s;
  }
  function edgeScore(frac) { if (frac === null || frac === undefined) return null; const t = [[0.006, 10], [0.015, 9.5], [0.03, 9], [0.06, 8], [0.1, 7], [0.16, 6], [0.25, 5], [0.4, 4]]; return (t.find(([m]) => frac <= m) || [0, 3])[1]; }
  function grade(front, back) {
    const sides = [front, back].filter(Boolean), subs = {}, why = {};
    subs.centering = centeringScore(front && front.centering, back && back.centering);
    why.centering = front && front.centering.ok ? `Front L/R ${fmtRatio(front.centering.lr)}, T/B ${fmtRatio(front.centering.tb)}` + (back && back.centering.ok ? ` · Back L/R ${fmtRatio(back.centering.lr)}, T/B ${fmtRatio(back.centering.tb)}` : '') : 'No even border found to measure (full-art or patterned border)';
    const cs = sides.flatMap(s => s.corners.filter(c => c.measurable));
    subs.corners = cs.length ? half(clamp(10 - Math.max(...cs.map(c => c.wear)) * 7 - cs.reduce((a, c) => a + c.wear, 0) / cs.length * 3, 1, 10)) : null;
    const ef = sides.map(s => s.edges.frac).filter(v => v !== null && v !== undefined);
    subs.edges = ef.length ? edgeScore(Math.max(...ef)) : null;
    let pen = 0; const surfaceBits = [];
    for (const s of sides) { for (const l of s.printLines) pen += l.strength > 8 ? 2 : 1.5; for (const sc of s.scratches) pen += sc.len > 150 ? 1.5 : sc.len > 80 ? 1 : 0.6; }
    const nl = sides.reduce((a, s) => a + s.printLines.length, 0), ns = sides.reduce((a, s) => a + s.scratches.length, 0);
    subs.surface = half(clamp(10 - pen, 1, 10));
    why.surface = `${nl} print line${nl === 1 ? '' : 's'}, ${ns} scratch${ns === 1 ? '' : 'es'}`;
    const vals = Object.values(subs).filter(v => v !== null);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length, mn = Math.min(...vals);
    let est = Math.min(avg, mn + 1);
    if (nl + ns > 0) est = Math.min(est, 8.5); // any visible print line or scratch normally rules out a gem-mint 10
    let conf = 1; for (const s of sides) { conf = Math.min(conf, s.detect.confidence || 0.5); if (s.quality.sharp < 9) conf -= 0.25; if (s.quality.glare > 0.01) conf -= 0.15; if (s.busyFrac > 0.35) conf -= 0.15; }
    if (subs.centering === null) conf -= 0.15; if (!back) conf -= 0.1; conf = clamp(conf, 0.1, 1);
    const u = conf > 0.75 ? 0.5 : conf > 0.5 ? 1 : 1.5;
    const range = [clamp(Math.floor(est - u + 0.25), 1, 10), clamp(Math.ceil(est + u - 0.25), 1, 10)];
    if (range[0] === range[1]) range[0] = Math.max(1, range[1] - 1);
    return { subs, why, est: +est.toFixed(2), range, confidence: +conf.toFixed(2), label: conf > 0.75 ? 'High' : conf > 0.5 ? 'Medium' : 'Low' };
  }

  const api = { CW, CH, make, resize, fit, gray, warp, homography, applyH, detectCard, refineQuad, measureCentering, quality, printLines, scratches, edgeWear, cornerWear, analyzeSide, grade, fmtRatio, centeringScore, edgeScore, median };
  root.GradeCore = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
