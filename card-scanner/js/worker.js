/* Analysis runs off the UI thread. Messages: {op:'detect', img} -> {quad, found, confidence}; {op:'analyze', img, quad} -> result */
importScripts('grade-core.js');
self.onmessage = e => {
  const { id, op, img, quad } = e.data;
  try {
    const im = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.buf) };
    if (op === 'detect') { const d = GradeCore.detectCard(im); self.postMessage({ id, ok: true, res: d }); return; }
    if (op === 'warp') { // hi-res straightened card for text recognition
      const q = quad, L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), land = (L(q[0], q[1]) + L(q[3], q[2])) > (L(q[0], q[3]) + L(q[1], q[2]));
      const W = land ? 1680 : 1200, H = land ? 1200 : 1680, c = GradeCore.warp(im, quad, W, H);
      self.postMessage({ id, ok: true, card: { w: c.w, h: c.h, buf: c.d.buffer } }, [c.d.buffer]); return;
    }
    if (op === 'analyze') {
      const r = GradeCore.analyzeSide(im, quad ? { quad } : {});
      const card = r.card; delete r.card;
      self.postMessage({ id, ok: true, res: r, card: { w: card.w, h: card.h, buf: card.d.buffer } }, [card.d.buffer]);
    }
  } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.stack || err) }); }
};
