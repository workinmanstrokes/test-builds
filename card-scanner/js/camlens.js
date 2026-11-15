/* Rear-camera selection for close-up cards.
 * Samsung Galaxy S25 Ultra exposes one logical rear camera: zoom min ~0.6 is the
 * ultrawide, 1 is the main lens (sharpest for a card in hand), 3 and 5 are telephotos
 * that cannot close-focus. Chrome also crop-and-scales when asked for 16:9, which
 * looks like extra zoom. Callers ask for a 4:3 frame with resizeMode "none", then
 * pin zoom with naturalZoom() so the preview is the main lens at 1×.
 * Pure functions — no getUserMedia — so the choice can be unit tested. */
(function (root) {
  'use strict';
  function clampZoom(z, cap) {
    if (!cap || cap.min == null || cap.max == null || !isFinite(z)) return null;
    const step = cap.step > 0 ? cap.step : 0;
    let v = Math.min(cap.max, Math.max(cap.min, z));
    if (step) v = Math.round(v / step) * step;
    v = Math.min(cap.max, Math.max(cap.min, v));
    return Math.round(v * 1000) / 1000;
  }
  // Zoom ratio of the main 1× lens. null when this camera cannot reach it
  // (telephoto, or an ultrawide that stops below 1×).
  function naturalZoom(zoom) {
    if (!zoom || zoom.min == null || zoom.max == null) return null;
    if (zoom.max < 0.95) return null;
    if (zoom.min >= 1.8) return null;
    if (zoom.min < 0.95 && zoom.max >= 1) return clampZoom(1, zoom);
    return clampZoom(zoom.min, zoom);
  }
  function facingOf(cam) {
    const label = String(cam && cam.label || '').toLowerCase();
    if (cam && cam.facing) return cam.facing;
    if (/front|user|selfie|facetime/.test(label)) return 'user';
    if (/back|rear|environment/.test(label)) return 'environment';
    return 'unknown';
  }
  function zoomOf(cam) {
    if (!cam || cam.zoomMin == null) return null;
    return { min: cam.zoomMin, max: cam.zoomMax == null ? cam.zoomMin : cam.zoomMax, step: cam.zoomStep || 0 };
  }
  // Rank a camera for card close-ups. Logical multi-cam (can sit at 1×, min < 1)
  // is preferred: that 1× is the main lens, not the ultrawide and not a telephoto.
  // A fixed zoom=1 camera is last, because a physical ultrawide also reports 1×.
  function rankCamera(cam) {
    if (facingOf(cam) === 'user') return null;
    const label = String(cam.label || '').toLowerCase();
    if (/front|selfie|facetime/.test(label)) return null;
    const zoom = zoomOf(cam);
    if (!zoom) return { score: 1, zoom: null, kind: 'rear' };
    const z = naturalZoom(zoom);
    if (z == null) return null;
    const logical = zoom.min < 0.95 && zoom.max >= 1;
    const zoomable = zoom.max > zoom.min + 0.2;
    const kind = logical ? 'logical' : zoomable ? 'main' : 'fixed';
    const score = logical ? 3 : zoomable ? 2 : 1;
    return { score, zoom: z, kind };
  }
  function chooseCamera(list) {
    let best = null;
    for (const cam of list || []) {
      const rank = rankCamera(cam);
      if (!rank) continue;
      const pixels = (cam.width || 0) * (cam.height || 0);
      const score = rank.score * 1e12 + pixels;
      if (!best || score > best.score) best = { cam, kind: rank.kind, zoom: rank.zoom, score };
    }
    return best;
  }
  // object-fit: contain. The whole frame is visible; k is smaller than cover's scale.
  function containMap(vw, vh, W, H) {
    if (!vw || !vh || !W || !H) return { k: 1, ox: 0, oy: 0, cover: 1 };
    const k = Math.min(W / vw, H / vh), cover = Math.max(W / vw, H / vh);
    return { k, ox: (W - vw * k) / 2, oy: (H - vh * k) / 2, cover };
  }
  function presetZoom(base, factor, cap) {
    if (!cap) return null;
    const b = base == null ? naturalZoom(cap) : base;
    if (b == null) return null;
    return clampZoom(b * factor, cap);
  }
  const api = { clampZoom, naturalZoom, rankCamera, chooseCamera, containMap, presetZoom, facingOf };
  root.CamLens = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
