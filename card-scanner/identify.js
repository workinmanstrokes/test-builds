// Best-available on-device identification:
// 1) find + perspective-rectify the card, 2) targeted OCR (name strip, bottom strip, YGO set-code line),
// 3) candidate retrieval from free databases by name, number and set code,
// 4) DINOv2-small visual embeddings (photo vs. official card images), 5) fused score ranking.
const ID = (() => {
  const CW = 600, CH = 838;
  let session = null, ortReady = null;
  const embCache = new Map();
  // ---------- geometry ----------
  function findQuad(ctx, W, H) { for (const k of [1, 1.6, 0.7, 2.3]) { const q = findQuadT(ctx, W, H, k); if (q) return q; } return null; }
  function findQuadT(ctx, W, H, K) {
    const d = ctx.getImageData(0, 0, W, H).data, px = i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const border = []; for (let x = 0; x < W; x += 3) border.push(px(x), px((H - 1) * W + x)); for (let y = 0; y < H; y += 3) border.push(px(y * W), px(y * W + W - 1));
    const med = [0, 1, 2].map(k => border.map(p => p[k]).sort((a, b) => a - b)[border.length >> 1]);
    const dist = p => Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]);
    const bd = border.map(dist).sort((a, b) => a - b), th = Math.max(30, (bd[Math.floor(bd.length * 0.95)] + 12) * K);
    const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = dist(px(i)) > th ? 1 : 0;
    // largest connected component (4-neighbour) starting near center
    const seen = new Uint8Array(W * H); let best = null;
    for (const s of [((H >> 1) * W + (W >> 1)), ((H * 0.4 | 0) * W + (W >> 1)), ((H * 0.6 | 0) * W + (W >> 1))]) {
      if (!m[s] || seen[s]) continue; const st = [s]; seen[s] = 1; let n = 0, tl = [1e9], br = [-1e9], tr = [-1e9], bl = [1e9];
      while (st.length) { const i = st.pop(), x = i % W, y = i / W | 0; n++;
        if (x + y < tl[0]) tl = [x + y, x, y]; if (x + y > br[0]) br = [x + y, x, y]; if (x - y > tr[0]) tr = [x - y, x, y]; if (x - y < bl[0]) bl = [x - y, x, y];
        for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && m[j] && !seen[j]) { seen[j] = 1; st.push(j); } }
      if (!best || n > best.n) best = { n, q: [tl, tr, br, bl].map(p => [p[1], p[2]]) };
    }
    if (!best || best.n < W * H * 0.12) return null;
    const [a, b, c, e] = best.q, len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const ratio = (len(a, e) + len(b, c)) / (len(a, b) + len(e, c)); if (ratio < 1.1 || ratio > 1.75) return null;
    return best.q;
  }
  function homography(src, dst) { // maps dst -> src (8 unknowns)
    const A = [], B = []; for (let i = 0; i < 4; i++) { const [x, y] = dst[i], [u, v] = src[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v); }
    for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; } }
    return B.map((b, i) => b / A[i][i]);
  }
  // quad: optional [[x,y]x4] normalized 0..1 (TL,TR,BR,BL) from the manual crop editor
  async function rectify(src, quad) {
    const img = typeof src === 'string' ? await loadImg(src) : src, sc = Math.min(1, 1600 / Math.max(img.width, img.height)), W = img.width * sc | 0, H = img.height * sc | 0;
    const full = document.createElement('canvas'); full.width = W; full.height = H; const fx = full.getContext('2d', { willReadFrequently: true }); fx.drawImage(img, 0, 0, W, H);
    const s2 = 360 / W, w2 = 360, h2 = H * s2 | 0, sm = document.createElement('canvas'); sm.width = w2; sm.height = h2; const sx = sm.getContext('2d', { willReadFrequently: true }); sx.drawImage(full, 0, 0, w2, h2);
    let q = quad ? null : findQuad(sx, w2, h2), found = !!(q || quad); q = quad ? quad.map(([x, y]) => [x * W, y * H]) : q ? q.map(([x, y]) => [x / s2, y / s2]) : [[0, 0], [W, 0], [W, H], [0, H]];
    const h = homography(q, [[0, 0], [CW, 0], [CW, CH], [0, CH]]), sd = fx.getImageData(0, 0, W, H).data;
    const out = document.createElement('canvas'); out.width = CW; out.height = CH; const ox = out.getContext('2d'), od = ox.createImageData(CW, CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const z = h[6] * x + h[7] * y + 1, u = (h[0] * x + h[1] * y + h[2]) / z, v = (h[3] * x + h[4] * y + h[5]) / z;
      const ui = u | 0, vi = v | 0, o = (y * CW + x) * 4; if (ui < 0 || vi < 0 || ui >= W - 1 || vi >= H - 1) continue;
      const fu = u - ui, fv = v - vi, i0 = (vi * W + ui) * 4, i1 = i0 + 4, i2 = i0 + W * 4, i3 = i2 + 4;
      for (let k = 0; k < 3; k++) od.data[o + k] = (sd[i0 + k] * (1 - fu) + sd[i1 + k] * fu) * (1 - fv) + (sd[i2 + k] * (1 - fu) + sd[i3 + k] * fu) * fv; od.data[o + 3] = 255; }
    ox.putImageData(od, 0, 0); return { canvas: out, found, quad: q.map(([x, y]) => [x / W, y / H]) };
  }
  function binarize(c) { // Otsu threshold
    const g = c.getContext('2d', { willReadFrequently: true }), im = g.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++; const N = d.length / 4; let sum = 0; hist.forEach((h, i) => sum += i * h);
    let sB = 0, wB = 0, best = 0, th = 128; for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += i * hist[i];
      const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = i; } }
    let dark = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] > th ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; if (!v) dark++; }
    if (dark > N / 2) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i]; // keep text dark on light
    g.putImageData(im, 0, 0); return c; }
  function region(cv, [x, y, w, h], scale = 2.4, contrast = 1.8) {
    const c = document.createElement('canvas'); c.width = cv.width * w * scale; c.height = cv.height * h * scale; const g = c.getContext('2d');
    g.filter = `grayscale(1) contrast(${contrast})`; g.drawImage(cv, cv.width * x, cv.height * y, cv.width * w, cv.height * h, 0, 0, c.width, c.height); return c;
  }
  // ---------- OCR ----------
  const ROI = { name: [0.03, 0.02, 0.8, 0.09], bottom: [0, 0.89, 1, 0.11], ygoCode: [0.45, 0.715, 0.53, 0.05], top: [0, 0, 1, 0.16] };
  let _cw = null; // second worker restricted to code characters (numbers, set codes)
  async function codeWorker() { if (_cw) return _cw; await ocrWorker(); const base = new URL('vendor/tesseract/', location.href).href;
    _cw = await Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false });
    await _cw.setParameters({ tessedit_char_whitelist: '0123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ-', tessedit_pageseg_mode: '11' }); return _cw; }
  async function ocrAll(cv, game) {
    const w = await ocrWorker(), rd = async r => (await w.recognize(region(cv, r).toDataURL('image/png'))).data.text;
    const t = { name: await rd(ROI.name), bottom: (await w.recognize(region(cv, ROI.bottom, 3.2, 2.2).toDataURL('image/png'))).data.text };
    // targeted code passes: restricted charset, sparse text, high upscale
    const cw = await codeWorker(), rc = async (r, sc) => (await cw.recognize(region(cv, r, sc, 2.4).toDataURL('image/png'))).data.text;
    if (game === 'yugioh') t.code = await rc(ROI.ygoCode, 3.5);
    else { t.codeL = await rc([0, 0.9, 0.5, 0.1], 4); t.codeR = await rc([0.5, 0.9, 0.5, 0.1], 4); }
    t.top = await rd(ROI.top); if (game === 'pokemon') t.top2 = (await w.recognize(region(cv, [0.05, 0.03, 0.9, 0.13], 2.4, 2.8).toDataURL('image/png'))).data.text;
    return t;
  }
  const STOP = /^(Evolves|Stage|Basic|Put|From|Pokemon|Pokémon|Trainer|Energy|Item|Supporter|Tool|Weakness|Resistance|Retreat|Illus|HP|Creature|Instant|Sorcery|Legendary|Monster|Spell|Trap|Card|Character|Action|Song)$/i;
  function parse(t, game) {
    const all = Object.values(t).join('\n'), names = [];
    for (const src of [t.name, t.top || '', t.top2 || '']) for (const line of src.split('\n')) {
      const clean = line.replace(/[^A-Za-zÀ-ÿ0-9'’,\-.: &]/g, ' ').replace(/\s+/g, ' ').trim();
      const toks = clean.split(' ').filter(x => x.length > 1 && !STOP.test(x) && !/^\d+$/.test(x) && !/^HP\d*/i.test(x));
      if (toks.length) { names.push(toks.join(' ')); if (toks.length > 1) names.push(toks.slice(0, 2).join(' '), toks.sort((a, b) => b.length - a.length)[0]); }
    }
    const r = { names: [...new Set(names.filter(n => n.length > 2))].slice(0, 6) };
    if (game === 'pokemon') { const m = [t.codeL, t.codeR, all].join('\n').match(/\b([A-Z]{0,3}\d{1,3}[a-z]?)\s*[\/|l]\s*([A-Z]{0,3}\d{1,3})\b/); if (m) { r.number = m[1].replace(/^0+(?=\d)/, ''); r.total = m[2].replace(/^0+(?=\d)/, ''); } }
    if (game === 'magic') { const bt = (t.codeL || '') + '\n' + t.bottom; const m = bt.match(/\b(\d{1,4})\s*\/\s*\d{2,4}\b/) || bt.match(/\b[CURMLST]?\s*(\d{3,4})\b/); if (m) r.number = String(+m[1]);
      const s = bt.match(/\b([A-Z0-9]{3,4})\s*[•·.*-]\s*(EN|ES|FR|DE|IT|JP|PT)\b/); if (s) r.setCode = s[1].toLowerCase(); }
    if (game === 'yugioh') { const m = (t.code + ' ' + all).replace(/[oO](?=\d)/g, '0').match(/\b([A-Z0-9]{2,5})-([A-Z]{0,2})(\d{2,3})\b/); if (m) r.setCode = `${m[1]}-${m[2]}${m[3]}`; }
    if (game === 'lorcana') { const m = all.match(/\b(\d{1,3})\s*\/\s*\d{2,3}\b/); if (m) r.number = String(+m[1]); }
    r.words = all.split(/\s+/).filter(x => /[A-Za-z]{3,}/.test(x)).length; return r;
  }
  // ---------- name catalogs (free, cached) for fuzzy OCR correction ----------
  const catalogs = {};
  async function catalog(game) {
    if (catalogs[game]) return catalogs[game]; const k = 'names:' + game; let l = null;
    try { const h = JSON.parse(localStorage.getItem(k) || 'null'); if (h && Date.now() - h.t < 7 * 864e5) l = h.v; } catch {}
    if (!l) try {
      if (game === 'pokemon') l = [...new Set((await Net.raw('https://api.tcgdex.net/v2/en/cards').then(r => r.json())).map(c => c.name))];
      else if (game === 'magic') l = (await Net.raw('https://api.scryfall.com/catalog/card-names').then(r => r.json())).data.flatMap(n => n.split(' // '));
      else if (game === 'yugioh') l = await Net.raw('data/ygo-names.json').then(r => r.json()); // bundled snapshot (14.6k names)
      if (l) try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v: l })); } catch {}
    } catch {}
    return catalogs[game] = l ? l.map(n => [n, norm(n)]) : null;
  }
  async function fixNames(game, names) {
    const cat = await catalog(game); if (!cat) return names;
    const scored = new Map();
    for (const line of names) { const toks = line.split(' ');
      for (let i = 0; i < toks.length; i++) for (let L = 1; L <= 4 && i + L <= toks.length; L++) { const q = norm(toks.slice(i, i + L).join(' ')); if (q.length < 3) continue;
        for (const [n, nn] of cat) { if (Math.abs(nn.length - q.length) > Math.max(2, q.length * 0.3)) continue; const s = lev(q, nn); if (s > 0.72 && s > (scored.get(n) || 0)) scored.set(n, s); } } }
    const best = [...scored].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 4);
    fixNames.best = best[0]?.[1] || 0; return best.length ? best.map(x => x[0]) : names;
  }
  function lev(a, b) { if (a === b) return 1; const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1])); prev = cur; }
    return 1 - prev[n] / Math.max(m, n); }
  // ---------- candidates ----------
  async function candidates(game, p) {
    const out = new Map(), add = l => l.forEach(c => out.has(c.id) || out.set(c.id, c));
    const tryName = async n => { try { add(await Adapters[game].search(n, '')); } catch {} };
    if (game === 'yugioh' && p.setCode) try { const s = await Net.json(`https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=${p.setCode}`);
      if (s?.name) { add((await Adapters.yugioh.search(s.name)).filter(c => c.number === p.setCode)); p.codeName = s.name; } } catch {}
    if (game === 'magic' && p.setCode && p.number) try { const c = await Net.json(`https://api.scryfall.com/cards/${p.setCode}/${p.number}`); add([Adapters.magic.map(c)]); } catch {}
    for (const n of p.names.slice(0, 3)) { if (out.size >= 80) break; await tryName(n);
      if (game === 'magic' && !out.size) try { const c = await Net.json(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(n)}`); add((await Adapters.magic.search(c.name)).slice(0, 40)); } catch {} }
    if (game === 'pokemon' && p.number && out.size < 3) try { // number + set total lookup when the name is unreadable
      const [list, sets] = await Promise.all([Net.json(`https://api.tcgdex.net/v2/en/cards?localId=${encodeURIComponent(p.number)}`), Net.json('https://api.tcgdex.net/v2/en/sets')]);
      const ok = new Set(sets.filter(s => String(s.cardCount?.official) === String(p.total)).map(s => s.id));
      add(list.filter(c => ok.has(c.id.slice(0, c.id.lastIndexOf('-')))).map(c => ({ game, id: c.id, name: c.name, number: c.localId, img: c.image ? c.image + '/low.webp' : '', set: c.id.split('-')[0] })));
    } catch {}
    return [...out.values()].filter(c => game !== 'pokemon' || !/^(A\d|P-A|B\d)/.test(c.id)); // TCG Pocket is digital-only
  }
  // ---------- visual embedding (DINOv2-small, ONNX, on-device) ----------
  async function loadModel() {
    if (session) return session;
    if (!ortReady) ortReady = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/ort/ort.wasm.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    await ortReady; ort.env.wasm.wasmPaths = new URL('vendor/ort/', location.href).href; ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create('vendor/models/dinov2-small/model_quantized.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    return session;
  }
  async function embed(source) {
    const s = await loadModel(), S = 224, c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(source, 0, 0, S, S); const d = g.getImageData(0, 0, S, S).data, f = new Float32Array(3 * S * S), M = [0.485, 0.456, 0.406], SD = [0.229, 0.224, 0.225];
    for (let i = 0; i < S * S; i++) for (let k = 0; k < 3; k++) f[k * S * S + i] = (d[i * 4 + k] / 255 - M[k]) / SD[k];
    const r = await s.run({ pixel_values: new ort.Tensor('float32', f, [1, 3, S, S]) }), h = (r.last_hidden_state || Object.values(r)[0]).data, D = 384, N = h.length / D;
    const v = new Float32Array(D * 2); for (let k = 0; k < D; k++) { v[k] = h[k]; let m = 0; for (let t = 1; t < N; t++) m += h[t * D + k]; v[D + k] = m / (N - 1); }
    let n = 0; for (let k = 0; k < D; k++) n += v[k] ** 2; n = Math.sqrt(n); let n2 = 0; for (let k = D; k < 2 * D; k++) n2 += v[k] ** 2; n2 = Math.sqrt(n2);
    for (let k = 0; k < D; k++) v[k] /= n; for (let k = D; k < 2 * D; k++) v[k] /= n2; return v;
  }
  const cos = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s / 2; };
  const imgUrl = c => !c.img ? '' : c.game === 'yugioh' ? `https://wsrv.nl/?url=${encodeURIComponent(c.img.replace('cards_small', 'cards_small'))}&w=240` : c.img;
  async function candEmbed(c, blob) {
    const u = imgUrl(c); if (!u) return null; if (embCache.has(u)) return embCache.get(u);
    const k = 'e:' + u; try { const h = localStorage.getItem(k); if (h) { const v = Float32Array.from(JSON.parse(h)); embCache.set(u, v); return v; } } catch {}
    try { if (!blob) { const r = await Net.raw(u); if (!r.ok) return null; blob = await r.blob(); } const bm = await createImageBitmap(blob); const v = await embed(bm); embCache.set(u, v);
      try { localStorage.setItem(k, JSON.stringify(Array.from(v, x => +x.toFixed(3)))); } catch {} return v; } catch { return null; }
  }
  // ---------- fuzzy text ----------
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  function sim(a, b) { a = norm(a); b = norm(b); if (!a || !b) return 0; if (b.includes(a) || a.includes(b)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.5 + 0.5;
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] !== b[j - 1]));
    return 1 - m[a.length][b.length] / Math.max(a.length, b.length); }
  // ---------- main ----------
  async function detect(src) { const r = await rectify(src); return { quad: r.quad, found: r.found }; }
  // hint: AI-vision result {name, number, setCode, total} – skips OCR and goes straight to database confirmation + visual ranking
  async function run(photo, game, step = () => {}, hint = null, quad = null) {
    const t0 = performance.now(); step('Finding the card…'); const { canvas, found } = await rectify(photo, quad);
    const cv0 = () => canvas; let p;
    if (hint) { p = { names: [hint.name, ...(hint.altNames || [])].filter(Boolean), number: hint.number, total: hint.total, setCode: hint.setCode, words: 9, raw: [hint.name] }; fixNames.best = 1; }
    else { step('Reading text…'); p = parse(await ocrAll(canvas, game), game); }
    if (!hint) {
    if (!p.names.length || !found) { try { const r = await readCard(photo); const more = parse({ name: r.nameLines.join('\n'), top: r.lines.slice(0, 4).join('\n'), bottom: r.lines.slice(-3).join('\n') }, game);
      p.names = [...new Set([...p.names, ...more.names])]; p.number ||= more.number; p.total ||= more.total; p.setCode ||= more.setCode; p.words += more.words; } catch {} }
    if (p.words < 1 && !p.names.length && !p.number && !p.setCode) return { back: true, rect: canvas, parsed: p, ranked: [] };
    p.raw = p.names; p.names = await fixNames(game, p.names);
    if (fixNames.best < 0.85) { step('Re-reading the name…'); const w = await ocrWorker(), extra = [];
      for (const [r, sc] of [[game === 'yugioh' ? [0.05, 0.03, 0.78, 0.08] : ROI.name, 3], [ROI.top, 2.5]]) { extra.push((await w.recognize(binarize(region(cv0(), r, sc, 1.4)).toDataURL('image/png'))).data.text); }
      const more = parse({ name: extra.join('\n'), bottom: '' }, game).names, b0 = fixNames.best, fixed = await fixNames(game, [...p.raw, ...more]);
      if (fixNames.best >= b0) p.names = fixed; } } step('Searching databases…'); let cands = await candidates(game, p);
    step(`Comparing artwork with ${Math.min(cands.length, 40)} prints…`);
    // pre-rank by text so the visual pass spends time on the likeliest prints
    const nameScore = c => Math.max(0, ...p.names.map(n => sim(n, c.name)), p.codeName ? sim(p.codeName, c.name) : 0);
    const numScore = c => (p.number && norm(c.number) === norm(p.number) ? 1 : 0) + (p.setCode && norm(c.number) === norm(p.setCode) ? 1 : 0) + (p.setCode && game === 'magic' && c.setCode === p.setCode ? 0.6 : 0);
    cands.forEach(c => { c._name = nameScore(c); c._num = Math.min(1, numScore(c)); c._pre = c._name + c._num; });
    cands.sort((a, b) => b._pre - a._pre); cands = cands.slice(0, 80);
    let pe = null; try { pe = await embed(canvas); } catch (e) { console.warn('embedding unavailable', e); }
    if (pe) { const blobs = new Map(); let i = 0; // fetch images 6 at a time, embed sequentially
      const fetchOne = async c => { const u = imgUrl(c); if (!u || embCache.has(u) || localStorage.getItem('e:' + u)) return; try { const r = await Net.raw(u); if (r.ok) blobs.set(u, await r.blob()); } catch {} };
      await Promise.all(Array.from({ length: 6 }, async () => { while (i < cands.length) await fetchOne(cands[i++]); }));
      for (const c of cands) { const v = await candEmbed(c, blobs.get(imgUrl(c))); c._vis = v ? cos(pe, v) : null; } }
    const vis = cands.map(c => c._vis).filter(v => v != null), lo = Math.min(...vis), hi = Math.max(...vis);
    for (const c of cands) { const vn = c._vis == null ? 0 : hi > lo ? (c._vis - lo) / (hi - lo) : 0.5;
      c.score = (pe ? 0.5 * vn + 0.15 * (c._vis ?? 0) : 0) + 0.25 * c._name + 0.35 * c._num; }
    cands.sort((a, b) => b.score - a.score);
    const conf = cands.length ? Math.max(0, Math.min(1, (cands[0].score - (cands[1]?.score ?? 0)) * 2 + cands[0]._name * 0.3 + (cands[0]._num ? 0.2 : 0))) : 0;
    return { rect: canvas, found, parsed: p, ranked: cands, confidence: conf, ms: performance.now() - t0, visual: !!pe };
  }
  return { run, rectify, detect, embed, loadModel };
})();
