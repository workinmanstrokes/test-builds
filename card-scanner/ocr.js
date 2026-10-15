// Offline OCR (bundled tesseract.js) with auto-crop, contrast boost and multiple passes.
// NOTE: eng.traineddata ships UNcompressed – Android's asset packager silently un-gzips *.gz files (it became eng.traineddata in the APK),
// so requesting eng.traineddata.gz 404'd inside the app and OCR never started on phones.
let _worker = null; // a Promise for the single Tesseract worker (runs in a Web Worker, not the main thread)
function ocrWorker() {
  if (_worker) return _worker;
  const t0 = performance.now();
  _worker = (async () => {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const base = new URL('vendor/tesseract/', location.href).href;
    let fail; const failed = new Promise((_, rej) => { fail = rej; setTimeout(() => rej(new Error('OCR worker not ready after 25s')), 25000); }); failed.catch(() => {});
    const w = await Promise.race([failed, Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: false, workerBlobURL: false, errorHandler: e => { console.error('OCR worker error', e?.message || e); fail(e instanceof Error ? e : new Error(String(e))); } })]);
    console.log('[t] ocr worker loaded ' + Math.round(performance.now() - t0) + 'ms'); return w;
  })();
  _worker.catch(e => { console.error('OCR worker failed to load', e?.message || e); _worker = null; });
  return _worker;
}
// Preload OCR (script + wasm + English data) right after start-up so the first scan doesn't pay for it.
addEventListener('load', () => setTimeout(() => ocrWorker().catch(() => {}), 1200));
// Find the card's bounding box: scan inward from each side until pixels differ from the background.
function cardBox(cx, W, H) {
  const d = cx.getImageData(0, 0, W, H).data, px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const df = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const edge = (len, get) => { const out = []; for (let k = 1; k < 10; k++) { const bg = get(1, k); for (let i = 2; i < len * 0.45; i++) if (df(get(i, k), bg) > 60) { out.push(i); break; } } out.sort((a, b) => a - b); return out.length > 3 ? out[out.length >> 1] : 0; };
  const L = edge(W, (i, k) => px(i, Math.round(H * k / 10))), R = edge(W, (i, k) => px(W - 1 - i, Math.round(H * k / 10)));
  const T = edge(H, (i, k) => px(Math.round(W * k / 10), i)), B = edge(H, (i, k) => px(Math.round(W * k / 10), H - 1 - i));
  const w = W - L - R, h = H - T - B; return w > W * 0.3 && h > H * 0.3 ? { x: L, y: T, w, h } : { x: 0, y: 0, w: W, h: H };
}
async function prepImage(src, { region = null, contrast = 1.6 } = {}) {
  const img = await loadImg(src), W = Math.min(1400, img.width), H = Math.round(img.height * W / img.width);
  const c0 = document.createElement('canvas'); c0.width = W; c0.height = H; const x0 = c0.getContext('2d', { willReadFrequently: true }); x0.drawImage(img, 0, 0, W, H);
  const b = cardBox(x0, W, H), r = region ? { x: b.x + b.w * region[0], y: b.y + b.h * region[1], w: b.w * region[2], h: b.h * region[3] } : b;
  const sc = Math.max(1, 1000 / r.w), c = document.createElement('canvas'); c.width = r.w * sc; c.height = r.h * sc; const x = c.getContext('2d');
  x.filter = `grayscale(1) contrast(${contrast})`; x.drawImage(c0, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return { url: c.toDataURL('image/png'), cropped: b.w < W || b.h < H };
}
async function readCard(src) {
  const w = await ocrWorker(), full = await prepImage(src), name = await prepImage(src, { region: [0, 0, 1, 0.16], contrast: 2 });
  const a = (await w.recognize(full.url)).data, n = (await w.recognize(name.url)).data;
  const text = n.text + '\n' + a.text, words = a.words?.filter(x => x.confidence > 60).length || 0;
  return { text, nameLines: n.lines.map(l => l.text.trim()), lines: a.lines.map(l => l.text.trim()), words, cropped: full.cropped, looksLikeBack: words < 6 || /pok[eé]mon\s*$|^\s*DECK PROTECTOR|MAGIC\s*the gathering/i.test(a.text) && words < 12 };
}
// Sports heuristics from OCR text
const BRANDS = ['Topps Chrome', 'Topps Finest', 'Topps Update', 'Topps Heritage', 'Bowman Chrome', 'Bowman', 'Topps', 'Panini Prizm', 'Prizm', 'Donruss Optic', 'Donruss', 'Select', 'Mosaic', 'Optic', 'Contenders', 'Upper Deck', 'Fleer', 'Score', 'Leaf', 'Stadium Club', 'National Treasures', 'Immaculate', 'Hoops', 'Chronicles', 'Allen & Ginter', 'Gypsy Queen'];
const PARALLELS = ['Refractor', 'Silver', 'Gold', 'Holo', 'Prizm', 'Shimmer', 'Wave', 'Mojo', 'Atomic', 'Xfractor', 'Auto', 'Autograph', 'Patch', 'Rookie', 'RC'];
function sportsGuess(text) {
  const t = text.replace(/\s+/g, ' '), yr = (t.match(/\b(19[5-9]\d|20[0-3]\d)\b/g) || []).sort().pop() || '';
  const brand = BRANDS.find(b => new RegExp(b.replace('&', '&?'), 'i').test(t)) || '';
  const num = (t.match(/(?:No\.?|#)\s*([A-Z]{0,4}-?\d{1,4})/i) || [])[1] || '';
  const serial = (t.match(/\b\d{1,4}\s*\/\s*(\d{1,4})\b/) || [])[1];
  const par = [...new Set(PARALLELS.filter(p => new RegExp('\\b' + p + '\\b', 'i').test(t)))].join(' ') + (serial ? ' /' + serial : '');
  const names = t.match(/\b[A-Z][a-z]+(?:[ '-][A-Z][a-zA-Z']+){1,2}\b/g) || [];
  return { year: yr, brand, number: num, parallel: par.trim(), nameCandidates: [...new Set(names)].filter(n => !BRANDS.some(b => n.includes(b.split(' ')[0]))).slice(0, 6) };
}
// Free player-name check via Wikipedia (no key)
async function wikiPlayer(cands) {
  for (const c of cands) { try {
    const r = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(c + ' baseball OR basketball OR football OR hockey player')}&srlimit=1&format=json&origin=*`)).json();
    const h = r.query?.search?.[0]; if (h && h.title.toLowerCase().includes(c.split(' ').pop().toLowerCase())) return h.title.replace(/ \(.*\)$/, '');
  } catch {} } return '';
}
