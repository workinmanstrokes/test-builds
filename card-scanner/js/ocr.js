/* On-device text recognition. Android: Google ML Kit (bundled model, free, offline) via the TextOcr plugin in
 * android/app/src/main/java/.../TextOcrPlugin.java. Web/test builds: tesseract.js loaded on demand.
 * read(canvas) -> { engine, lines:[{text,x,y,w,h}] } with boxes normalized 0..1 to the canvas. */
const OCR = (() => {
  const plugin = () => window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.Plugins && Capacitor.Plugins.TextOcr;
  async function mlkit(canvas) {
    const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1], r = await plugin().read({ image: b64 });
    return (r.lines || []).map(l => ({ text: l.text, x: l.x, y: l.y, w: l.w, h: l.h }));
  }
  const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let tw = null;
  function tessWorker() {
    if (tw) return tw;
    tw = (async () => {
      if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = TESS; s.onload = res; s.onerror = () => rej(new Error('OCR engine could not load')); document.head.appendChild(s); });
      return Tesseract.createWorker('eng', 1);
    })();
    tw.catch(() => { tw = null; });
    return tw;
  }
  async function tesseract(canvas) {
    const w = await tessWorker(), c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.4)'; g.drawImage(canvas, 0, 0);
    const d = (await w.recognize(c, {}, { blocks: true })).data, out = [];
    for (const b of d.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) { const t = (l.text || '').trim(); if (t && l.confidence > 35) out.push({ text: t, x: l.bbox.x0 / c.width, y: l.bbox.y0 / c.height, w: (l.bbox.x1 - l.bbox.x0) / c.width, h: (l.bbox.y1 - l.bbox.y0) / c.height }); }
    return out;
  }
  async function read(canvas) {
    if (plugin()) { try { return { engine: 'ML Kit', lines: await mlkit(canvas) }; } catch (e) { console.warn('ML Kit failed, using tesseract', e); } }
    return { engine: 'Tesseract', lines: await tesseract(canvas) };
  }
  // Preload the web engine shortly after start so the first scan doesn't wait for it.
  const warm = () => { if (!plugin()) tessWorker().catch(() => {}); };
  return { read, warm, native: () => !!plugin() };
})();
