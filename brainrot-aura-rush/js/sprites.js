// Original "brainrot" cast, drawn in code (no image files): glossy toy-like hybrids with big eyes and teeth.
// Every sprite is rendered once at startup into one in-memory atlas canvas; the game then only blits frames
// with drawImage (cheap on low-end Android). Coordinates in the draw functions are world units with the origin at
// the character's feet (y grows downward like a normal canvas). Frames: 0/1 = idle/move cycle, 'hit' = white flash.
(function (root) {
  'use strict';
  const OUT = '#1a1033';
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (h, t) => { const [r, g, b] = hex(h), f = c => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t)); return `rgb(${f(r)},${f(g)},${f(b)})`; };
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2); }
  // glossy fill: light spot up-left, base colour, darker rim
  function glossFill(c, x, y, rx, ry, base) {
    const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.45, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.15);
    g.addColorStop(0, mix(base, 0.55)); g.addColorStop(0.45, base); g.addColorStop(1, mix(base, -0.38)); return g;
  }
  function blob(c, x, y, rx, ry, base, lw = 1.3, rot = 0) {
    ell(c, x, y, rx, ry, rot); c.fillStyle = glossFill(c, x, y, rx, ry, base); c.fill();
    if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
  }
  function box(c, x, y, w, h, r, base, lw = 1.3) {
    rr(c, x, y, w, h, r); c.fillStyle = glossFill(c, x + w / 2, y + h / 2, w / 2, h / 2, base); c.fill();
    if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
  }
  function shine(c, x, y, rx, ry, a = 0.75, rot = -0.5) { ell(c, x, y, rx, ry, rot); c.fillStyle = `rgba(255,255,255,${a})`; c.fill(); }
  function eye(c, x, y, r, px = 0, py = 0.15, angry = 0, iris = '#1a1033') {
    blob(c, x, y, r, r * 1.08, '#ffffff', r * 0.22);
    ell(c, x + px * r * 0.35, y + py * r * 0.35, r * 0.52, r * 0.58); c.fillStyle = iris; c.fill();
    shine(c, x + px * r * 0.35 - r * 0.2, y + py * r * 0.35 - r * 0.25, r * 0.2, r * 0.16, 0.95, 0);
    if (angry) { c.beginPath(); c.moveTo(x - r * 1.1, y - r * (1.0 + 0.35 * angry)); c.lineTo(x + r * 1.1, y - r * (1.0 - 0.35 * angry)); c.lineWidth = r * 0.45; c.lineCap = 'round'; c.strokeStyle = OUT; c.stroke(); }
  }
  function grin(c, x, y, w, h, teeth = 4, lw = 1) { // toothy smile
    c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x, y + h * 2, x + w / 2, y); c.closePath();
    c.fillStyle = '#5b0f2e'; c.fill(); c.save(); c.clip();
    c.fillStyle = '#fff'; const tw = w / teeth; for (let i = 0; i < teeth; i++) { rr(c, x - w / 2 + i * tw + tw * 0.08, y - 1, tw * 0.84, h * 0.75, tw * 0.2); c.fill(); }
    c.restore(); c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x, y + h * 2, x + w / 2, y); c.closePath(); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke();
  }
  function fangs(c, x, y, w, n, h, up) { // jagged shark teeth row
    c.beginPath(); const s = w / n; for (let i = 0; i < n; i++) { const x0 = x - w / 2 + i * s; c.moveTo(x0, y); c.lineTo(x0 + s / 2, y + (up ? -h : h)); c.lineTo(x0 + s, y); }
    c.fillStyle = '#fff'; c.fill(); c.lineWidth = 0.7; c.strokeStyle = OUT; c.stroke();
  }

  // ---------- The cast ----------
  const CAST = {
    // Player troops: chrome toaster with a penguin face and a cyan toast-blaster.
    trooper: { name: 'Tostino Pingwhirl', role: 'Your trooper', w: 26, h: 34, frames: 2, draw(c, f) {
      const step = f ? 1 : -1;
      blob(c, -5 + step * 1.5, -2, 4.5, 2.4, '#fb923c', 1); blob(c, 5 - step * 1.5, -2, 4.5, 2.4, '#fb923c', 1);  // feet
      blob(c, -11.5, -15 + step, 3, 6.5, '#1e293b', 1, 0.35); blob(c, 11.5, -15 - step, 3, 6.5, '#1e293b', 1, -0.35); // flippers
      box(c, -10, -28, 20, 25, 6, '#cbd5e1');                                // toaster body
      rr(c, -6.5, -27, 4, 2.2, 1); c.fillStyle = OUT; c.fill(); rr(c, 2.5, -27, 4, 2.2, 1); c.fill(); // bread slots
      box(c, -6, -33, 4.5, 6, 1.5, '#f59e0b', 0.9); box(c, 2, -32 + step * 0.6, 4.5, 5, 1.5, '#f59e0b', 0.9); // toast popping
      box(c, -7.5, -21, 15, 15, 6, '#f8fafc', 0.9);                         // penguin belly/face
      eye(c, -3.2, -16.5, 2.7, 0, -0.3); eye(c, 3.2, -16.5, 2.7, 0, -0.3);
      c.beginPath(); c.moveTo(-2.4, -12.5); c.lineTo(2.4, -12.5); c.lineTo(0, -9); c.closePath(); c.fillStyle = '#fb923c'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = OUT; c.stroke();
      box(c, 9, -26, 3, 9, 1.4, '#22d3ee', 0.9);                            // toast lever = blaster
      shine(c, -6, -24.5, 3, 1.4);
    } },
    // Squad commander: pink flamingo with helicopter rotor hair, hovers behind the squad.
    leader: { name: 'Flamenco Rotorina', role: 'Squad commander', w: 46, h: 62, frames: 2, draw(c, f) {
      c.save(); c.translate(0, -6);
      c.lineWidth = 2.2; c.lineCap = 'round'; c.strokeStyle = '#be185d'; c.beginPath(); c.moveTo(-3, -2); c.lineTo(-4, -12); c.moveTo(3, -2); c.lineTo(5, -12); c.stroke();
      blob(c, 0, -20, 13, 10, '#f472b6');                                     // body
      blob(c, -12, -22, 6, 4, '#ec4899', 1, -0.6); blob(c, 12, -22, 6, 4, '#ec4899', 1, 0.6); // wings
      c.lineWidth = 6; c.strokeStyle = OUT; c.beginPath(); c.moveTo(4, -26); c.quadraticCurveTo(13, -33, 4, -38); c.stroke();
      c.lineWidth = 4; c.strokeStyle = '#f9a8d4'; c.stroke();                 // neck
      blob(c, 2, -41, 8, 7.5, '#f472b6');                                     // head
      c.beginPath(); c.moveTo(7, -41); c.quadraticCurveTo(16, -40, 14, -34); c.lineTo(8, -37); c.closePath(); c.fillStyle = '#facc15'; c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(13, -36); c.lineTo(14, -34); c.lineTo(10.5, -35.5); c.fillStyle = OUT; c.fill();
      eye(c, -1, -43, 3.2, 0.4, -0.2); eye(c, 5.2, -43.5, 2.6, 0.4, -0.2);
      box(c, 0, -52, 3, 4, 1, '#64748b', 0.9);                               // rotor mast
      const a = f ? 0.5 : 0; c.save(); c.translate(1.5, -52); c.scale(1, 0.42);
      for (let i = 0; i < 2; i++) { c.save(); c.rotate(a + i * Math.PI / 2); rr(c, -21, -2.2, 42, 4.4, 2); c.fillStyle = 'rgba(203,213,225,0.95)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke(); c.restore(); }
      c.restore(); blob(c, 1.5, -52, 2.2, 1.6, '#facc15', 0.8);
      shine(c, -5, -24, 4, 2);
      c.restore();
    } },
    // Swarm enemy: pineapple knight with a tin visor and a tiny sword.
    swarmA: { name: 'Ananasso Spadino', role: 'Swarm grunt', w: 46, h: 52, frames: 2, draw(c, f) {
      const s = f ? 1 : -1;
      blob(c, -6, -2, 4.5, 2.6, '#7c2d12', 1); blob(c, 6, -2, 4.5, 2.6, '#7c2d12', 1);
      for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; c.save(); c.translate(0, -34); c.rotate(a + s * 0.05); blob(c, 0, -8, 3, 9, i % 2 ? '#16a34a' : '#4ade80', 1); c.restore(); } // crown
      blob(c, 0, -19, 13, 16, '#facc15');                                     // fruit body
      c.save(); ell(c, 0, -19, 13, 16); c.clip(); c.strokeStyle = 'rgba(146,64,14,0.55)'; c.lineWidth = 1;
      for (let k = -40; k < 40; k += 6) { c.beginPath(); c.moveTo(k, -40); c.lineTo(k + 34, 0); c.moveTo(k + 34, -40); c.lineTo(k, 0); c.stroke(); } c.restore();
      ell(c, 0, -19, 13, 16); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();
      box(c, -10, -27, 20, 8, 3, '#94a3b8', 1);                              // visor band
      eye(c, -4.5, -23, 3.6, 0.1, 0.2, 0.8, '#b91c1c'); eye(c, 4.5, -23, 3.6, -0.1, 0.2, 0.8, '#b91c1c');
      grin(c, 0, -12, 13, 3.4, 5);
      c.save(); c.translate(16, -12); c.rotate(0.35 + s * 0.2); box(c, -1.2, -15, 2.4, 14, 1, '#e2e8f0', 0.8); box(c, -3.5, -2, 7, 2.2, 1, '#a16207', 0.8); c.restore();
      blob(c, 14, -12, 3, 3, '#facc15', 1);
      shine(c, -6, -29, 3, 1.6, 0.6);
    } },
    // Swarm variant (later zones): snail whose shell is a mint gelato in a waffle cone.
    swarmB: { name: 'Lumacone Gelatoso', role: 'Swarm grunt (later zones)', w: 44, h: 42, frames: 2, draw(c, f) {
      const s = f ? 1.5 : 0;
      c.beginPath(); c.moveTo(-18 + s, -1); c.quadraticCurveTo(-20, -8, -10, -9); c.lineTo(16, -9); c.quadraticCurveTo(20, -1, 14, -1); c.closePath();
      c.fillStyle = glossFill(c, 0, -5, 18, 5, '#a855f7'); c.fill(); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();  // foot
      c.save(); c.translate(-2, -17); c.rotate(-0.35);
      c.beginPath(); c.moveTo(-9, -2); c.lineTo(9, -2); c.lineTo(0, 16); c.closePath(); c.fillStyle = glossFill(c, 0, 4, 9, 9, '#d97706'); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
      c.save(); c.clip(); c.strokeStyle = 'rgba(120,53,15,0.6)'; c.lineWidth = 0.8; for (let k = -12; k < 14; k += 4) { c.beginPath(); c.moveTo(k, -2); c.lineTo(k + 9, 16); c.moveTo(k + 9, -2); c.lineTo(k, 16); c.stroke(); } c.restore();
      blob(c, 0, -6, 11, 9.5, '#6ee7b7'); blob(c, -5, -1, 4, 3, '#6ee7b7', 0); blob(c, 5, -1, 4, 3, '#6ee7b7', 0);   // scoop
      blob(c, 1, -15, 2.4, 2.4, '#ef4444', 1); shine(c, -4, -10, 3.5, 1.8, 0.7);
      c.restore();
      c.lineWidth = 1.2; c.strokeStyle = OUT; c.beginPath(); c.moveTo(12, -9); c.lineTo(11 + s * 0.4, -24); c.moveTo(16, -9); c.lineTo(19 - s * 0.4, -23); c.stroke(); // eye stalks
      blob(c, 15, -12, 5.5, 5, '#a855f7');                                    // head
      eye(c, 11 + s * 0.4, -26, 3.6, 0.3, 0.2); eye(c, 19 - s * 0.4, -25, 3.6, 0.3, 0.2);
      grin(c, 16, -11.5, 7, 2.2, 3, 0.8);
    } },
    // Heavy enemy: angry shark head riding tank treads with a cannon in its jaws.
    tank: { name: 'Squalo Cingolone', role: 'Heavy tank', w: 66, h: 58, frames: 2, draw(c, f) {
      box(c, -28, -14, 56, 13, 6.5, '#475569');                               // treads
      for (let i = 0; i < 6; i++) blob(c, -22 + i * 8.8 + (f ? 2 : 0), -7.5, 3.2, 3.2, '#94a3b8', 0.9);
      c.beginPath(); c.moveTo(-6, -40); c.quadraticCurveTo(2, -60, 10, -42); c.closePath(); c.fillStyle = glossFill(c, 2, -46, 8, 8, '#0e7490'); c.fill(); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke(); // dorsal fin
      blob(c, 0, -27, 26, 16, '#0e7490');                                      // shark head
      c.save(); ell(c, 0, -27, 26, 16); c.clip(); ell(c, 0, -14, 22, 10); c.fillStyle = mix('#e0f2fe', 0); c.fill(); c.restore();
      ell(c, 0, -27, 26, 16); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(-17, -22); c.quadraticCurveTo(0, -12, 17, -22); c.quadraticCurveTo(0, -4, -17, -22); c.closePath(); c.fillStyle = '#5b0f2e'; c.fill(); // jaw
      fangs(c, 0, -21.5, 30, 7, 4, false); fangs(c, 0, -10, 22, 6, 3.5, true);
      c.beginPath(); c.moveTo(-17, -22); c.quadraticCurveTo(0, -12, 17, -22); c.quadraticCurveTo(0, -4, -17, -22); c.closePath(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
      box(c, -4, -18 - (f ? 1 : 0), 8, 9, 2, '#334155', 1); blob(c, 0, -10 - (f ? 1 : 0), 3, 1.5, '#0f172a', 0.8);  // cannon
      eye(c, -12, -32, 4.6, 0.3, 0.2, 1, '#991b1b'); eye(c, 12, -32, 4.6, -0.3, 0.2, 1, '#991b1b');
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(21 - i * 2.5, -33 + i * 0); c.lineTo(23 - i * 2.5, -26); c.lineWidth = 0.9; c.strokeStyle = 'rgba(26,16,51,0.6)'; c.stroke(); } // gills
      shine(c, -11, -38, 6, 2.4, 0.6);
    } },
    // Boss: a gorilla-sized red espresso machine with gorilla arms, a chrome grin and steam.
    boss: { name: 'Espressorilla, the Gorilla King', role: 'Boss', w: 184, h: 192, frames: 3, draw(c, f) {
      const angry = f === 2, up = f === 1 ? -5 : 0;
      blob(c, -40, -8, 16, 8, '#3f2a1e'); blob(c, 40, -8, 16, 8, '#3f2a1e');   // feet
      c.save(); c.translate(-58, -70 + up); c.rotate(0.25); blob(c, 0, 0, 16, 34, '#5b3a29'); blob(c, 0, 36, 15, 12, '#3f2a1e'); c.restore(); // arms
      c.save(); c.translate(58, -70 - up); c.rotate(-0.25); blob(c, 0, 0, 16, 34, '#5b3a29'); blob(c, 0, 36, 15, 12, '#3f2a1e'); c.restore();
      box(c, -50, -132, 100, 124, 18, '#dc2626', 2);                          // machine body
      box(c, -54, -146, 108, 20, 8, '#e2e8f0', 2);                            // chrome top
      for (let i = 0; i < 3; i++) { box(c, -36 + i * 26, -160, 20, 15, 5, ['#fef3c7', '#e0f2fe', '#fce7f3'][i], 1.4); } // cups on top
      blob(c, 0, -152, 20, 10, '#5b3a29', 1.6);                               // gorilla brow tuft
      box(c, -40, -122, 80, 52, 16, '#3f2a1e', 1.6);                          // gorilla face plate
      box(c, -32, -116, 64, 30, 14, '#a8826b', 1.2);                          // muzzle-light area
      const ir = angry ? '#ef4444' : '#1a1033';
      eye(c, -16, -104, 9, 0, 0.3, angry ? 1 : 0.5, ir); eye(c, 16, -104, 9, 0, 0.3, angry ? 1 : 0.5, ir);
      if (angry) { blob(c, -16, -101, 3.5, 3.5, '#fecaca', 0); blob(c, 16, -101, 3.5, 3.5, '#fecaca', 0); }
      blob(c, -5, -88, 3, 2.2, '#1a1033', 0); blob(c, 5, -88, 3, 2.2, '#1a1033', 0); // nostrils
      grin(c, 0, -80, 50, angry ? 9 : 6, 8, 1.6);
      box(c, -38, -62, 76, 14, 6, '#cbd5e1', 1.6);                            // portafilter / group head
      box(c, -6, -50, 12, 10, 3, '#94a3b8', 1.2);
      box(c, -16, -36, 32, 24, 6, '#fef3c7', 1.6); box(c, -12, -34, 24, 6, 3, '#78350f', 0); // cup with espresso
      blob(c, 38, -28, 8, 8, '#facc15', 1.4); blob(c, -38, -28, 8, 8, '#22d3ee', 1.4);   // dials
      const st = f === 1 ? 6 : 0;                                             // steam puffs
      c.globalAlpha = 0.85;
      blob(c, -50, -166 - st, 8, 6, '#f1f5f9', 1); blob(c, -58, -178 - st, 6, 5, '#f1f5f9', 1);
      blob(c, 52, -164 + st * 0.5, 8, 6, '#f1f5f9', 1); blob(c, 60, -176 + st * 0.5, 6, 5, '#f1f5f9', 1); c.globalAlpha = 1;
      shine(c, -38, -126, 10, 4, 0.55); shine(c, -40, -142, 12, 3, 0.8, 0);
    } },
  };

  // ---------- Atlas ----------
  const PX = 3; // atlas pixels per world unit (sprites are drawn at <= ~2.6 px/unit on phones)
  let atlas = null; const frames = {};
  function build() {
    const doc = root.document; if (!doc) return;
    const pad = 4; let x = 0, y = 0, rowH = 0; const maxW = 1400, place = [];
    for (const key in CAST) {
      const s = CAST[key], px = key === 'boss' ? 2 : PX, fw = Math.ceil(s.w * px) + pad * 2, fh = Math.ceil(s.h * px) + pad * 2;
      const list = [...Array(s.frames).keys(), 'hit'];
      for (const fr of list) { if (x + fw > maxW) { x = 0; y += rowH; rowH = 0; } place.push({ key, fr, x, y, fw, fh, px }); x += fw; rowH = Math.max(rowH, fh); }
    }
    atlas = doc.createElement('canvas'); atlas.width = maxW; atlas.height = y + rowH;
    const c = atlas.getContext('2d');
    for (const p of place) {
      const s = CAST[p.key];
      c.save(); c.beginPath(); c.rect(p.x, p.y, p.fw, p.fh); c.clip();
      c.translate(p.x + p.fw / 2, p.y + p.fh - pad); c.scale(p.px, p.px); c.lineJoin = 'round';
      s.draw(c, p.fr === 'hit' ? 0 : p.fr);
      if (p.fr === 'hit') { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,0.78)'; c.fillRect(p.x, p.y, p.fw, p.fh); c.globalCompositeOperation = 'source-over'; }
      c.restore();
      (frames[p.key] = frames[p.key] || {})[p.fr] = { sx: p.x, sy: p.y, sw: p.fw, sh: p.fh, pad: pad / p.px };
    }
  }
  /** Draw a sprite with its feet at (x, y) in a normal (y-down) context. scale 1 = the sprite's design size. */
  function draw(ctx, key, fr, x, y, scale = 1) {
    if (!atlas) build();
    const f = frames[key] && frames[key][fr]; if (!f) return;
    const s = CAST[key], w = (s.w + f.pad * 2) * scale, h = (s.h + f.pad * 2) * scale;
    ctx.drawImage(atlas, f.sx, f.sy, f.sw, f.sh, x - w / 2, y - h + f.pad * scale, w, h);
  }
  root.Sprites = { CAST, draw, build, atlas: () => atlas };
})(typeof window !== 'undefined' ? window : globalThis);
