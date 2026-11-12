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
      // ...and the strongest remaining lines: a real cut edge can also rank below a dense run of
      // artwork lines (text rows) even when it is strong — top-8 by value alone buries it.
      const rest = out.filter(r => r.v >= mx * 0.15 && !top.includes(r) && !outer.includes(r)).sort((a, b) => b.v - a.v).slice(0, 2);
      return top.concat(outer, rest);
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
    function sideBg(a, b, cx, cy, sgn) { // fraction of samples along the side whose colour matches the photo's background; sgn +1 = just outside, -1 = just inside
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); let nx = -dy / len, ny = dx / len;
      if ((cx - (a[0] + b[0]) / 2) * nx + (cy - (a[1] + b[1]) / 2) * ny > 0) { nx = -nx; ny = -ny; } let hit = 0, n = 0;
      for (let k = 0.15; k <= 0.85; k += 0.05) { const x = Math.round(a[0] + dx * k + nx * 4 * sgn), y = Math.round(a[1] + dy * k + ny * 4 * sgn); if (x < 0 || y < 0 || x >= W || y >= H) continue; n++; const i = (y * W + x) * 4;
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
      const qcx = (q[0][0] + q[2][0]) / 2, qcy = (q[0][1] + q[2][1]) / 2;
      // Per side: how much of the band just OUTSIDE / just INSIDE the side matches the photo's background.
      // Indexed by side (0 top, 1 right, 2 bottom, 3 left); frame sides stay neutral.
      const obBy = [0.5, 0.5, 0.5, 0.5], ibBy = [0.5, 0.5, 0.5, 0.5];
      [[t, 0, 1], [r, 1, 2], [b, 2, 3], [l, 3, 0]].forEach(([ln, i, j]) => { if (!ln.frame) { obBy[i] = sideBg(q[i], q[j], qcx, qcy, 1); ibBy[i] = sideBg(q[i], q[j], qcx, qcy, -1); } });
      const nf = [t, r, b, l].map(x => !x.frame), obf = nf.some(Boolean) ? obBy.filter((_, i) => nf[i]).reduce((a, v) => a + v, 0) / nf.filter(Boolean).length : 0.5;
      // A line only counts as a card edge to the extent that it has background outside it: a strong
      // artwork line (text-box rule, inner frame) has card on both sides, so its support is discounted.
      // Without this, a strong interior line outscores a pale true edge (white Prizm border on skin).
      const sides = [support(q[0], q[1]) * (t.frame ? 0 : 1) * (0.3 + 0.7 * obBy[0]), support(q[1], q[2]) * (r.frame ? 0 : 1) * (0.3 + 0.7 * obBy[1]), support(q[2], q[3]) * (b.frame ? 0 : 1) * (0.3 + 0.7 * obBy[2]), support(q[3], q[0]) * (l.frame ? 0 : 1) * (0.3 + 0.7 * obBy[3])];
      const nFrame = [l, r, t, b].filter(x => x.frame).length;
      const sup = sides.reduce((a, b) => a + b, 0) / 4 + nFrame * 6;
      // A true card side has background OUTSIDE and card INSIDE. A sleeve (or any container) side has
      // background on BOTH sides — that is what lets a sleeve outline, or a hybrid quad mixing card
      // sides with a sleeve side, outscore the real card. Penalise sides whose inside band is background.
      const inFrac = nf.some(Boolean) ? ibBy.filter((_, i) => nf[i]).filter(v => v < 0.5).length / nf.filter(Boolean).length : 0.5;
      const score = sup * Math.exp(-((dev / 0.12) ** 2)) * (0.75 + 0.25 * Math.sqrt(area / (W * H))) * (0.4 + obf) * (0.25 + 0.75 * inFrac);
      const realIdx = [0, 1, 2, 3].filter(i => nf[i]), real = realIdx.map(i => sides[i]), mx = Math.max(...real, 1);
      // A side is a plausible card edge if it is strong, OR if it is weak but has the card
      // signature: background outside, card inside. The relative-strength rule alone kills
      // a pale border (white Prizm on skin) whenever a much stronger line — a sleeve rim —
      // is in the photo; the bg signature is what rescues it.
      const sideOk = (v, k) => v >= 12 && (v >= mx * 0.35 || (obBy[realIdx[k]] > 0.6 && ibBy[realIdx[k]] < 0.5));
      if (real.some((v, i) => !sideOk(v, i))) continue;
      combos.push({ q, score, nFrame, sides, area });
    }
    // nested quads (outer cut edge vs printed inner border) score alike: prefer the outermost strong one
    const topC = combos.reduce((m, c) => !m || c.score > m.score ? c : m, null), top = topC ? topC.score : 0;
    const ang = (q, i) => { const a = q[i], b = q[(i + 1) % 4]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    const inside = (q, p) => q.every((a, i) => { const b = q[(i + 1) % 4]; return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1; });
    const nested = c => c === topC || (c.nFrame <= topC.nFrame && topC.q.every(p => inside(c.q, p)) && [0, 1, 2, 3].every(i => { let d = Math.abs(ang(c.q, i) - ang(topC.q, i)); d = Math.min(d, 2 * Math.PI - d); return d < 0.09; }) && c.area < topC.area * 1.6);
    // A card in a clear sleeve has TWO nested quads: the sleeve outline and the
    // card's cut edge. Preferring the outermost one picks the sleeve — or a hybrid
    // quad that mixes card sides with a sleeve side. If the band just inside the
    // outer quad is background-coloured, the outer quad extends into background
    // there, so it is a container, not the card: take the largest quad nested INSIDE it.
    // Only the widest gap between the quads is tested, and only when it is sleeve-scale
    // (~10–48px here, downscaled): a printed inner border is closer and its band is
    // border-coloured, while a deep artwork line is further in and its band crosses
    // printed artwork. Five samples across the gap need at least four to read as
    // background, so one glare-hit sample cannot flip the answer and artwork that
    // happens to be skin-toned at one point cannot fake it either.
    const bandBg = (outer, inner) => {
      let bestS = -1, bestSep = 0;
      for (let s = 0; s < 4; s++) { const om = [(outer[s][0] + outer[(s + 1) % 4][0]) / 2, (outer[s][1] + outer[(s + 1) % 4][1]) / 2];
        const im = [(inner[s][0] + inner[(s + 1) % 4][0]) / 2, (inner[s][1] + inner[(s + 1) % 4][1]) / 2];
        const sep = Math.hypot(im[0] - om[0], im[1] - om[1]);
        if (sep > bestSep) { bestSep = sep; bestS = s; } }
      if (bestS < 0 || bestSep < 10 || bestSep > 48) return 0;
      const s = bestS, om = [(outer[s][0] + outer[(s + 1) % 4][0]) / 2, (outer[s][1] + outer[(s + 1) % 4][1]) / 2];
      const im = [(inner[s][0] + inner[(s + 1) % 4][0]) / 2, (inner[s][1] + inner[(s + 1) % 4][1]) / 2];
      let hit = 0, n = 0;
      for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) { const x = Math.round(om[0] + (im[0] - om[0]) * f), y = Math.round(om[1] + (im[1] - om[1]) * f);
        if (x < 0 || y < 0 || x >= W || y >= H) continue; n++; const i = (y * W + x) * 4;
        if (Math.hypot(sm.d[i] - bgM[0], sm.d[i + 1] - bgM[1], sm.d[i + 2] - bgM[2]) < bgT) hit++; }
      return n ? hit / n : 0; };
    // Clear plastic lip: the gap is bright and low-saturation, and the outer edge of
    // that gap is brighter than its middle (the specular rim of a toploader). A flat
    // printed white or silver border has no brighter rim, so it is not a holder.
    function bandLight(outer, inner) {
      let bestS = -1, bestSep = 0;
      for (let s = 0; s < 4; s++) { const om = [(outer[s][0] + outer[(s + 1) % 4][0]) / 2, (outer[s][1] + outer[(s + 1) % 4][1]) / 2];
        const im = [(inner[s][0] + inner[(s + 1) % 4][0]) / 2, (inner[s][1] + inner[(s + 1) % 4][1]) / 2];
        const sep = Math.hypot(im[0] - om[0], im[1] - om[1]);
        if (sep > bestSep) { bestSep = sep; bestS = s; } }
      if (bestS < 0 || bestSep < 8 || bestSep > 56) return 0;
      const s = bestS, om = [(outer[s][0] + outer[(s + 1) % 4][0]) / 2, (outer[s][1] + outer[(s + 1) % 4][1]) / 2];
      const im = [(inner[s][0] + inner[(s + 1) % 4][0]) / 2, (inner[s][1] + inner[(s + 1) % 4][1]) / 2];
      let lipL = 0, lipN = 0, bodyL = 0, bodyN = 0, lightN = 0;
      for (const f of [0.08, 0.16, 0.45, 0.55, 0.72]) {
        const x = Math.round(om[0] + (im[0] - om[0]) * f), y = Math.round(om[1] + (im[1] - om[1]) * f);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4, r = sm.d[i], g = sm.d[i + 1], b = sm.d[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (f < 0.25) { lipL += luma; lipN++; }
        else { bodyL += luma; bodyN++; if (luma > 185 && sat < 42) lightN++; }
      }
      if (lightN < 2 || !lipN || !bodyN) return 0;
      if (lipL / lipN < bodyL / bodyN + 8) return 0;
      return lightN / bodyN;
    }
    const gapHolder = (outer, inner) => bandBg(outer, inner) >= 0.66 || bandLight(outer, inner) >= 0.6;
    // innerNested: c sits strictly inside topC, near-parallel, plausibly card-sized.
    // (nested() above only admits quads that CONTAIN topC — the opposite direction.)
    const innerNested = c => c !== topC && c.nFrame <= topC.nFrame && c.q.every(p => inside(topC.q, p))
      && [0, 1, 2, 3].every(i => { let d = Math.abs(ang(c.q, i) - ang(topC.q, i)); d = Math.min(d, 2 * Math.PI - d); return d < 0.09; })
      && c.area < topC.area && c.area >= topC.area * 0.5;
    const inners = topC ? combos.filter(c => innerNested(c)).sort((a, b) => b.area - a.area) : [];
    // A toploader discounts the real card edge (plastic, not background, sits outside
    // it), so that quad scores a few percent of the plastic rim. A clear sleeve still
    // has to clear 35% — its gap is background, and a weak inner line must not win.
    const sleeveInner = inners.find(c => {
      const light = bandLight(topC.q, c.q);
      return gapHolder(topC.q, c.q) && c.score >= top * (light >= 0.6 ? 0.03 : 0.35);
    });
    // Largest combo containing topC — but NOT when the band between it and topC is
    // background or a bright plastic lip: then the larger quad is a sleeve or toploader
    // (or a hybrid mixing a holder side). The largest containing quad whose band is NOT
    // a holder wins; if every containing quad is a container, keep topC.
    const outerCands = topC ? combos.filter(c => c.score >= top * (c === topC ? 0 : 0.2) && nested(c) && c.area <= topC.area * 1.35).sort((a, b) => b.area - a.area) : [];
    const best = sleeveInner || (topC && (outerCands.find(c => c === topC || !gapHolder(c.q, topC.q)) || topC));
    if (!best) return { quad: [[0, 0], [img.w, 0], [img.w, img.h], [0, img.h]], found: false, method: 'frame', confidence: 0, holder: null };
    let holder = null;
    if (topC && best !== topC && gapHolder(topC.q, best.q)) holder = { kind: bandLight(topC.q, best.q) >= 0.6 ? 'toploader' : 'sleeve' };
    else if (topC) {
      const outside = outerCands.find(c => c !== best && c.area > best.area * 1.02 && gapHolder(c.q, best.q));
      if (outside) holder = { kind: bandLight(outside.q, best.q) >= 0.6 ? 'toploader' : 'sleeve' };
    }
    let quad = best.q.map(([x, y]) => [x / s, y / s]);
    quad = refineQuad(img, quad);
    const minSide = Math.min(...best.sides.filter(v => v > 0), 999);
    const confidence = clamp((best.nFrame ? 0.5 : 1) * Math.min(1, minSide / 60), 0, 1);
    return { quad, found: best.nFrame < 4, method: best.nFrame ? 'partial-frame' : 'edges', confidence, holder };
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
  const rgbAt = (d, i) => [d[i], d[i + 1], d[i + 2]];
  const cdist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Outer-band colours. One cluster = a plain border. Two to four = a striped /
  // barber-pole parallel (red-white-blue Prizm). More than that is artwork.
  function borderPalette(samples) {
    const clusters = [];
    for (const s of samples) {
      let best = -1, bd = 46;
      for (let i = 0; i < clusters.length; i++) { const dist = cdist3(s, clusters[i].c); if (dist < bd) { bd = dist; best = i; } }
      if (best >= 0) { const cl = clusters[best], n = cl.n + 1; cl.c = [0, 1, 2].map(k => (cl.c[k] * cl.n + s[k]) / n); cl.n = n; }
      else clusters.push({ c: s.slice(), n: 1 });
    }
    const total = samples.length || 1;
    const sig = clusters.filter(c => c.n >= Math.max(4, total * 0.06)).sort((a, b) => b.n - a.n);
    if (sig.length < 1 || sig.length > 4) return null;
    if (sig.reduce((a, c) => a + c.n, 0) / total < 0.62) return null;
    return sig;
  }
  const inPal = (rgb, pal) => { for (const cl of pal) if (cdist3(rgb, cl.c) <= 58) return true; return false; };
  function measureCentering(card) {
    const { w, h, d } = card, res = {};
    const sides = { L: [w, (k, y) => (y * w + k) * 4], R: [w, (k, y) => (y * w + (w - 1 - k)) * 4], T: [h, (k, x) => (k * w + x) * 4], B: [h, (k, x) => ((h - 1 - k) * w + x) * 4] };
    const scanOf = {};
    for (const key of 'LRTB') {
      const [len, at] = sides[key], other = key === 'L' || key === 'R' ? h : w;
      const scan = []; for (let j = 0; j < 41; j++) scan.push(Math.round(other * (0.22 + 0.56 * j / 40)));
      scanOf[key] = { len, at, scan, s0: Math.max(3, Math.round(len * 0.008)), lim: Math.round(len * 0.18) };
    }
    const samples = [];
    for (const key of 'LRTB') {
      const { len, at, scan, s0 } = scanOf[key], s1 = Math.max(s0 + 2, Math.round(len * 0.02));
      for (const o of scan) for (let k = s0; k <= s1; k += 2) samples.push(rgbAt(d, at(k, o)));
    }
    const pal = borderPalette(samples);
    const all = [];
    for (const key of 'LRTB') {
      const { len, at, scan, s0, lim } = scanOf[key];
      let hits = [];
      if (pal) {
        for (const o of scan) {
          let hit = null;
          for (let k = s0; k < lim; k++) {
            if (!inPal(rgbAt(d, at(k, o)), pal) && !inPal(rgbAt(d, at(k + 1, o)), pal) && !inPal(rgbAt(d, at(k + 2, o)), pal)) { hit = k; break; }
          }
          if (hit !== null) hits.push(hit - (inPal(rgbAt(d, at(Math.max(0, hit - 1), o)), pal) ? 0.45 : 0));
        }
      }
      // Plain-colour fallback. A single reference colour still measures solid borders
      // when the outer band is too noisy for a palette, and it refuses stripes
      // (their median matches nothing, so the hit sits on the cut edge and is rejected).
      if (hits.length < 41 * 0.55) {
        const s1 = Math.max(s0 + 2, Math.round(len * 0.022));
        const ref = [0, 1, 2].map(c => { const v = []; for (const o of scan) for (let k = s0; k <= s1; k++) v.push(d[at(k, o) + c]); return median(v); });
        const noise = median(scan.map(o => { const v = []; for (let k = s0; k <= s1; k++) v.push(cdist(d, at(k, o), ref)); return median(v); }));
        const T = Math.max(38, 5 * noise), alt = [];
        for (const o of scan) {
          let hit = null;
          for (let k = s0; k < lim; k++) if (cdist(d, at(k, o), ref) > T && cdist(d, at(k + 1, o), ref) > T && cdist(d, at(k + 2, o), ref) > T) { hit = k; break; }
          if (hit !== null) { const a = cdist(d, at(hit - 1, o), ref), b = cdist(d, at(hit, o), ref); alt.push(hit - 1 + clamp((T * 0.6 - a) / Math.max(1, b - a), 0, 1)); }
        }
        if (alt.length > hits.length) hits = alt;
      }
      const m = median(hits), spread = hits.length ? mad(hits, m) : 99;
      res[key] = { px: m, n: hits.length, spread, len };
      all.push(res[key]);
    }
    const spreadLim = pal && pal.length >= 2 ? 0.012 : 0.006;
    const ok = all.every(s => s.n >= 41 * 0.55 && s.spread <= s.len * spreadLim && s.px > s.len * 0.016 && s.px < s.len * 0.16);
    const out = { ok, sides: res, patterned: !!(pal && pal.length >= 2) };
    if (!ok) { out.reason = all.some(s => !(s.px > s.len * 0.016) || s.n < 41 * 0.55) ? 'no-border' : 'irregular-border'; return out; }
    const { L, R, T, B } = res, lr = 100 * L.px / (L.px + R.px), tb = 100 * T.px / (T.px + B.px);
    out.lr = [lr, 100 - lr]; out.tb = [tb, 100 - tb]; out.worst = Math.max(lr, 100 - lr, tb, 100 - tb);
    out.inner = { x0: L.px, x1: w - R.px, y0: T.px, y1: h - B.px };
    out.confidence = clamp(1 - Math.max(...all.map(s => s.spread / (s.len * spreadLim))) * 0.5, 0.3, 1);
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
      const bSpread = bi.length ? Math.max(...[0, 1, 2].map(ch => { const vs = bi.map(i => d[i + ch]); return Math.max(...vs) - Math.min(...vs); })) : 0;
      const patternedEdge = bSpread > 90;
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
      const flags = new Uint8Array(len), chipAt = new Uint8Array(len); let n = 0, lip = false;
      if (measurable) {
        const base = median(Array.from(e.subarray(c0, c1)).filter(v => !isNaN(v)));
        const glarePix = i => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mn > 242 && mx - mn < 16; };
        for (let t = c0; t < c1; t++) {
          const ek = Math.max(0, Math.round(isNaN(e[t]) ? 0 : e[t]));
          if (glarePix(at(t, ek))) { e[t] = NaN; continue; }
          const chip = useEdge && !isNaN(e[t]) && e[t] - base >= 3;
          if (chip) chipAt[t] = 1;
          if (white[t] || chip) { flags[t] = 1; n++; }
        }
        // A long, nearly constant inward step is a case lip only when that step
        // lands on bright, low-saturation plastic. A striped border moves the
        // measured edge too, but the pixels there are the printed colours.
        const plastic = (t0, t1) => {
          let light = 0, n = 0, sat = 0;
          for (let k = t0; k < t1; k += 3) {
            const i = at(k, Math.max(0, Math.round(isNaN(e[k]) ? 0 : e[k])));
            const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            n++; sat += mx - mn; if (mn > 175 && mx - mn < 42) light++;
          }
          return n > 0 && light / n > 0.72 && sat / n < 36;
        };
        let t = c0;
        while (t < c1) {
          if (!chipAt[t]) { t++; continue; }
          let u = t; while (u < c1 && chipAt[u]) u++;
          const run = u - t;
          if (run >= (c1 - c0) * 0.16) {
            const depths = []; for (let k = t; k < u; k++) depths.push(e[k]);
            const md = median(depths);
            if (md >= 3 && mad(depths, md) < 1.25 && plastic(t, u)) {
              lip = true;
              for (let k = t; k < u; k++) if (!white[k]) { flags[k] = 0; chipAt[k] = 0; }
            }
          }
          t = u;
        }
        n = 0; for (let k = c0; k < c1; k++) if (flags[k]) n++;
      }
      const segs = []; let st = -1, gap = 0;
      for (let t = c0; t <= c1; t++) { if (t < c1 && flags[t]) { if (st < 0) st = t; gap = 0; } else if (st >= 0) { if (++gap > 4 || t === c1) { const en = t - gap + 1; if (en - st >= 3) segs.push([st, en]); st = -1; gap = 0; } } }
      let frac = measurable && !lip ? n / (c1 - c0) : null, misaligned = frac !== null && frac > 0.5;
      // A striped border moves the single-colour edge model. A high "chip" fraction
      // there is the print, not wear. Leave a real low reading alone.
      let patternedUnreliable = false;
      if (patternedEdge && !lip && frac !== null && frac > 0.04) { frac = null; misaligned = false; patternedUnreliable = true; segs.length = 0; }
      res[name] = { measurable: measurable && !misaligned && !lip && !patternedUnreliable, frac: misaligned || lip || patternedUnreliable ? null : frac, segs: misaligned || lip || patternedUnreliable ? [] : segs, sep: Math.round(sep), lightBorder, whiteArt, misaligned, lip, patternedUnreliable, cropped: vis[name] === false };
      if (measurable && !misaligned && !lip && !patternedUnreliable) { worn += n; tot += c1 - c0; }
    }
    return { sides: res, frac: tot ? worn / tot : null, blocked: Object.values(res).some(s => s.lip) };
  }
  function cornerWear(cm, M, vis = {}) {
    const W = cm.w, w = W - 2 * M, h = cm.h - 2 * M, d = cm.d, S = Math.round(w * 0.09), out = [];
    const defs = [['top-left', (x, y) => [x, y]], ['top-right', (x, y) => [w - 1 - x, y]], ['bottom-right', (x, y) => [w - 1 - x, h - 1 - y]], ['bottom-left', (x, y) => [x, h - 1 - y]]];
    for (const [name, map] of defs) {
      const idx = (x, y) => { const [X, Y] = map(x, y); return ((Y + M) * W + X + M) * 4; };
      const bi = [], gi = []; for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) { bi.push(idx(S + a * 2, 14 + b * 2), idx(14 + b * 2, S + a * 2)); gi.push(idx(-M + 2 + b, S + a * 3), idx(S + a * 3, -M + 2 + b)); }
      const bRef = medColor(d, bi), bgRef = medColor(d, gi), sep = Math.hypot(bRef[0] - bgRef[0], bRef[1] - bgRef[1], bRef[2] - bgRef[2]);
      const bL = 0.299 * bRef[0] + 0.587 * bRef[1] + 0.114 * bRef[2], chroma = Math.max(...bRef) - Math.min(...bRef);
      const sampleSpread = bi.length ? Math.max(...[0, 1, 2].map(ch => { const vs = bi.map(i => d[i + ch]); return Math.max(...vs) - Math.min(...vs); })) : 0;
      const patterned = sampleSpread > 80;
      const lightBorder = bL > 175 && chroma < 45 && !patterned, lab = labeler(bRef, bgRef);
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
      // Real corners are ~3 mm. A huge radius means the cut is confused (case, glare).
      // Patterned borders get a little more room: a white stripe at the corner
      // shifts the diagonal without meaning the corner is missing.
      const rCap = w * (patterned ? 0.11 : 0.075);
      const rOk = sep > 40 && r <= rCap;
      if (patterned || lightBorder) white = 0;
      out.push({ name, seen, patterned, lightBorder, cropped: !seen, measurable: seen && (sep > 40 || !lightBorder) && (sep <= 40 || rOk), whiteArt, white: n ? white / n : null, radius: rOk ? r : null, x: cx, y: cy, size: S, sep: Math.round(sep), _lab: lab, _idx: idx });
    }
    const radii = out.filter(c => c.radius !== null).map(c => c.radius), base = radii.length >= 1 ? median(radii) : null;
    // One sharp corner shares its radius with the others. A striped corner that
    // landed on a white band can miss its own radius while the cut is still there.
    if (base != null) for (const c of out) {
      if (!c.measurable && c.seen && c.sep > 40 && !c.cropped) {
        c.measurable = true; c.radius = base; c.borrowed = true;
        if (c.patterned || c.lightBorder) c.white = 0;
      }
    }
    for (const c of out) {
      let missing = 0;
      if (base !== null && c.radius !== null) { const R = base; const lim = Math.min(S, R + 8); for (let y = 3; y < lim; y++) for (let x = 3; x < lim; x++) { const inArc = x < R && y < R, inside = inArc ? Math.hypot(R - x, R - y) <= R - 3 : true; if (inside && c._lab(d, c._idx(x, y)) === 0) missing++; } }
      c.missing = missing; c.excessRound = missing / (w * 0.01) ** 2;
      // Stripes make the corner model see "missing" ink that is just the pattern.
      // A visible cut with no separate whitening signal is a sharp patterned corner.
      if (c.patterned) { c.white = 0; c.excessRound = 0; if (c.seen && c.sep > 40) c.measurable = true; }
      c.wear = clamp((c.white || 0) * 2.2 + Math.max(0, c.excessRound - 0.5) * 0.4, 0, 1);
      delete c._lab; delete c._idx;
    }
    return out;
  }

  // ---------- border parallel (pixel read, Prizm-style) ----------
  // Reads the card's BORDER colours off the warped card — the parallel the
  // photo shows even when no parallel word is printed on the card. Only
  // returns a parallel when the colour signature is distinctive; anything
  // else is '' (unknown), never a guess. Uses the measured border widths
  // (cent.sides) so artwork is never sampled as border. Deliberately
  // narrow: gold borders are NOT returned — gold trim appears on plenty of
  // non-parallel cards, so border gold alone proves nothing.
  function detectBorderParallel(card, cent) {
    const none = { parallel: '', confidence: 0, detail: null };
    const { w, h, d } = card;
    // Centering can fail on a busy stripe and still leave a readable border band.
    // Fall back to a fixed outer strip so the parallel is not dropped with the ratio.
    const S = cent && cent.ok && cent.sides ? cent.sides : {
      L: { px: Math.round(w * 0.03) }, R: { px: Math.round(w * 0.03) },
      T: { px: Math.round(h * 0.03) }, B: { px: Math.round(h * 0.03) },
    };
    let n = 0, red = 0, blue = 0, white = 0, silver = 0, speckle = 0;
    const px = (x, y) => { const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn; n++;
      if (r > 150 && r - g > 45 && r - b > 45) red++;
      if (b > 130 && b - r > 40 && b - g > 25) blue++;
      if (mn > 205 && sat < 30) white++;
      if (mn > 170 && sat < 35) silver++;
      if (sat >= 40 && sat <= 160) speckle++; };
    const step = 3;
    for (let y = Math.round(h * 0.15); y < h * 0.85; y += step) {
      for (let x = 2; x < S.L.px * 0.85; x += step) px(x, y);
      for (let x = Math.max(2, Math.round(w - S.R.px * 0.85)); x < w - 2; x += step) px(x, y); }
    for (let x = Math.round(w * 0.15); x < w * 0.85; x += step) {
      for (let y = 2; y < S.T.px * 0.85; y += step) px(x, y);
      for (let y = Math.max(2, Math.round(h - S.B.px * 0.85)); y < h - 2; y += step) px(x, y); }
    if (n < 200) return none;
    const f = { red: red / n, blue: blue / n, white: white / n, silver: silver / n, speckle: speckle / n };
    const detail = { n, red: +f.red.toFixed(3), blue: +f.blue.toFixed(3), white: +f.white.toFixed(3), silver: +f.silver.toFixed(3), speckle: +f.speckle.toFixed(3) };
    // Red White Blue Prizm: diagonal red / white / blue stripes around the border — all three present.
    if (f.red > 0.07 && f.blue > 0.07 && f.white > 0.07)
      return { parallel: 'Red White Blue Prizm', confidence: +clamp(Math.min(f.red, f.blue, f.white) / 0.15, 0, 1).toFixed(2), detail };
    // Silver Prizm: most of the border is bright and low-saturation, with rainbow
    // speckle from the holo finish. A flat white border is bright too, but has
    // no speckle — the speckle gate is what keeps white base cards out.
    if (f.silver > 0.5 && f.speckle > 0.03)
      return { parallel: 'Silver Prizm', confidence: +clamp(f.silver * 0.7 + Math.min(1, f.speckle * 5) * 0.3, 0, 1).toFixed(2), detail };
    return { ...none, detail };
  }

  // ---------- full analysis of one side ----------
  function analyzeSide(img, opts = {}) {
    // A caller-supplied quad (the adjust screen) is what we measure, but the holder
    // flag still comes from detection: the plastic rim is outside those corners.
    const det = opts.quad ? { quad: opts.quad, found: true, method: 'manual', confidence: 1, holder: null } : detectCard(img);
    if (opts.quad) { const auto = detectCard(img); if (auto.holder) det.holder = auto.holder; }
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
    const q = quality(card), cent = measureCentering(card), bp = detectBorderParallel(card, cent), pl = printLines(card, q, cent), sc = scratches(card, q, pl), ew = edgeWear(cm, M, vis), cw2 = cornerWear(cm, M, vis);
    const lipSides = Object.entries(ew.sides).filter(([, s]) => s.lip).map(([n]) => n);
    const holder = det.holder || (lipSides.length ? { kind: 'case', edges: lipSides } : null);
    const notes = [];
    if (holder) notes.push(holder.kind === 'sleeve'
      ? 'A sleeve is visible around the card. Edges and corners read through plastic are unreliable — slide the card out, lay it on a dark matte surface, and rescan.'
      : 'This looks like a toploader or hard case. The plastic edge was not graded as wear. Slide the card out, lay it on a dark matte surface, and rescan.');
    if (q.sharp < 9) notes.push('Photo looks soft. Hold steady and tap to focus for sharper results.');
    if (q.glare > 0.01) notes.push('Glare detected. Glare areas are skipped, so tilt the card or move away from direct light.');
    if (!det.found) notes.push('Card edges were not found automatically. Drag the corners to fit the card.');
    if (Object.values(vis).some(v => !v)) notes.push('Part of the card touches the photo border, so those edges and corners were skipped. Leave a little space around the card.');
    if (sc.busyFrac > 0.35) notes.push('Busy holo/refractor pattern: scratch check is less sensitive on this card.');
    if (cent.ok && cent.patterned) notes.push('Patterned border: centering is measured to the inner frame, where the stripes stop.');
    return { quad, detect: { found: det.found, method: det.method, confidence: det.confidence }, card, landscape, holder,
      quality: { sharp: q.sharp, glare: q.glare }, centering: cent, borderParallel: bp, printLines: pl, scratches: sc.list, busyFrac: sc.busyFrac, edges: ew, corners: cw2, notes };
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
  // Corner summary stays consistent with the crops: "all four look sharp" is only
  // true when every corner was actually measured and none shows wear.
  function cornerCall(corners) {
    const all = corners || [], measured = all.filter(c => c.measurable), total = all.length || 4;
    const unread = total - measured.length;
    if (measured.length < 3) {
      const sharp = measured.filter(c => (c.wear || 0) <= 0.15).length;
      const summary = measured.length
        ? `${sharp} of ${measured.length} readable corners look sharp. ${unread} could not be read.`
        : 'Corners could not be read from this photo.';
      return { score: null, summary };
    }
    const worst = measured.reduce((a, c) => c.wear > a.wear ? c : a);
    const score = half(clamp(10 - Math.max(...measured.map(c => c.wear)) * 7 - measured.reduce((a, c) => a + c.wear, 0) / measured.length * 3, 1, 10));
    let summary;
    if (worst.wear > 0.15) summary = `Most wear: ${String(worst.name || '').replace('-', ' ')}`;
    else if (unread === 0 && total === 4) summary = 'All four look sharp';
    else if (unread === 0) summary = 'All measured corners look sharp';
    else summary = `${measured.length} corners look sharp. ${unread} could not be read.`;
    return { score, summary };
  }
  function grade(front, back) {
    const sides = [front, back].filter(Boolean), subs = {}, why = {};
    subs.centering = centeringScore(front && front.centering, back && back.centering);
    const patterned = sides.some(s => s.centering && s.centering.ok && s.centering.patterned);
    why.centering = front && front.centering.ok
      ? `Front L/R ${fmtRatio(front.centering.lr)}, T/B ${fmtRatio(front.centering.tb)}` + (back && back.centering.ok ? ` · Back L/R ${fmtRatio(back.centering.lr)}, T/B ${fmtRatio(back.centering.tb)}` : '') + (patterned ? ' · striped border, measured to the inner frame' : '')
      : 'No even inner frame to measure (full-art or borderless)';
    const call = cornerCall(sides.flatMap(s => s.corners || []));
    subs.corners = call.score;
    why.corners = call.summary;
    const blocked = sides.some(s => (s.edges && s.edges.blocked) || s.holder);
    const patternedEdge = sides.some(s => s.edges && s.edges.sides && Object.values(s.edges.sides).some(x => x.patternedUnreliable));
    const ef = sides.map(s => s.edges && s.edges.frac).filter(v => v !== null && v !== undefined);
    subs.edges = blocked ? null : (ef.length ? edgeScore(Math.max(...ef)) : null);
    why.edges = blocked
      ? 'A toploader, case, or sleeve is covering the cut edge, so edge wear was not scored. Slide the card out and rescan.'
      : (patternedEdge && !ef.length ? 'Striped border: the pattern reads as edge wear, so chipping was not scored.'
        : (!ef.length ? 'Edges blend into the background. Use a contrasting surface.' : (Math.max(...ef) < 0.006 ? 'No whitening or chipping found' : `Wear along ${(Math.max(...ef) * 100).toFixed(1)}% of the worst edge`)));
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

  const api = { CW, CH, make, resize, fit, gray, warp, homography, applyH, detectCard, refineQuad, detectBorderParallel, measureCentering, quality, printLines, scratches, edgeWear, cornerWear, analyzeSide, grade, fmtRatio, centeringScore, edgeScore, median };
  root.GradeCore = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
