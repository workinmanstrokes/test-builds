/* Analysis runs off the UI thread. Messages: {op:'detect', img} -> {quad, found, confidence}; {op:'analyze', img, quad} -> result */
importScripts('grade-core.js');
self.onmessage = e => {
  const { id, op, img, quad } = e.data;
  try {
    const im = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.buf) };
    if (op === 'detect') { const d = GradeCore.detectCard(im); self.postMessage({ id, ok: true, res: d }); return; }
    if (op === 'analyze') {
      const r = GradeCore.analyzeSide(im, quad ? { quad } : {});
      const card = r.card; delete r.card;
      self.postMessage({ id, ok: true, res: r, card: { w: card.w, h: card.h, buf: card.d.buffer } }, [card.d.buffer]);
    }
  } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.stack || err) }); }
};
