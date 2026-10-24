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

  // Shared bodies (palette P) so the same character can serve as a friendly unit or a tinted enemy.
  // Top-hat kid. Optional evolution gear in P: hatUp (taller hat), hat colour, gem, trim, glow (cyan aura alpha),
  // cape {cloth, lining}, goggles, pads, sparkles.
  // Mullet dude: Michael's own Grok Imagine art, cut from his reference sheet by tools/art/grok-cut.py into
  // www/assets/hero/*.png. Each evolution stage has 2 frames; the atlas is rebuilt once the images load.
  let atlas = null;
  const HERO = {}, HERO_FR = { 1: ['mullet_base', 'mullet_base'], 2: ['mullet_run1', 'mullet_run2'], 3: ['mullet_caped', 'mullet_caped'], 4: ['mullet_armor', 'mullet_armor'] };
  if (typeof Image !== 'undefined') for (const k of ['mullet_base', 'mullet_run1', 'mullet_run2', 'mullet_caped', 'mullet_armor']) { const im = new Image(); im.onload = () => { atlas = null; }; im.src = 'assets/hero/' + k + '.png'; HERO[k] = im; }
  function drawHero(c, f, stage, W, H) {
    const im = HERO[HERO_FR[stage][f ? 1 : 0]];
    if (!im || !im.complete || !im.naturalWidth) { blob(c, 0, -H * 0.4, W * 0.3, H * 0.4, '#d4ff1e', 1.3); return; }
    const k = Math.min(W / im.naturalWidth, H / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k, bob = (f && HERO_FR[stage][0] === HERO_FR[stage][1]) ? H * 0.03 : 0;
    ell(c, 0, -0.5, dw * 0.32, 1.6); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill(); // ground shadow
    c.drawImage(im, -dw / 2, -dh - bob, dw, dh);
  }
  function drawWasher(c, f, P) {
      const b = f ? 1 : 0, SKIN = '#f6c7a1';
      blob(c, -7, -1.5, 3.2, 1.8, '#64748b', 0.9); blob(c, 7, -1.5, 3.2, 1.8, '#64748b', 0.9);             // little feet
      c.save(); c.translate(-10, -25); c.rotate(-0.55 - b * 0.1); box(c, -1, -2.5, 20, 3.6, 1.6, P.body, 1); c.restore(); // open lid (behind head)
      blob(c, 0, -29 - b * 1.2, 7.2, 7.4, SKIN, 1.2);                                                      // head
      for (let k = 0; k < 5; k++) blob(c, -5 + k * 2.5, -35.5 - b * 1.2 - (k % 2) * 0.8, 2, 1.7, P.hair, 0.8); // messy hair tuft
      eye(c, -2.8, -30 - b * 1.2, 2.1, 0.2, 0, P.angry, P.iris); eye(c, 2.8, -30 - b * 1.2, 2.1, -0.2, 0, P.angry, P.iris);
      grin(c, 0, -26.3 - b * 1.2, 8, 2, 4, 0.8);
      box(c, -12, -25, 24, 23, 4.5, P.body, 1.3);                                                       // machine body
      box(c, -12, -25, 24, 5.5, 2.5, P.strip, 1);                                                        // control strip
      blob(c, 6.5, -22.3, 1.6, 1.6, P.light, 0.7); blob(c, 2.5, -22.3, 1.1, 1.1, P.light2, 0.6); rr(c, -9.5, -23.3, 6, 2, 1); c.fillStyle = '#0f172a'; c.fill();
      blob(c, 0, -11, 7.6, 7.6, '#94a3b8', 1.2);                                                           // porthole rim
      ell(c, 0, -11, 5.6, 5.6); c.fillStyle = glossFill(c, 0, -11, 5.6, 5.6, P.water); c.fill();
      c.save(); ell(c, 0, -11, 5.6, 5.6); c.clip(); c.fillStyle = P.bubble;
      for (let k = 0; k < 5; k++) { const a = k * 1.26 + b * 0.6; ell(c, Math.cos(a) * 3, -11 + Math.sin(a) * 3, 1.3, 1.3); c.fill(); }
      c.restore(); shine(c, -2.4, -13.6, 1.8, 0.9, 0.85);
      c.globalAlpha = 0.9;                                                                                 // suds spilling over the top
      for (const [x, y, r] of [[-10, -25.5, 2.2], [-7.5, -26.5, 1.6], [9.5, -25.6, 2.3], [11.5, -27.5 - b, 1.5], [-12, -29 - b, 1.2], [13, -31 + b, 1]]) blob(c, x, y, r, r, P.suds, 0.6);
      c.globalAlpha = 1;
      box(c, 11, -16, 4, 6, 1.4, P.light, 0.9);                                                          // soap-gun nozzle
      shine(c, -8, -18, 2.4, 1.2, 0.7);
  }

  // Squad evolution palettes (all keep the teal/cyan squad identity).
  // Evolution stages, unlocked by aura earned in the current run (resets every run). Sorted by threshold.
  const EVOLVE = [
    { key: 'trooper', title: 'ROOKIE', at: 0 },
    { key: 'trooper2', title: 'RUNNER', at: 1500 },
    { key: 'trooper3', title: 'CAPED', at: 5000 },
    { key: 'trooper4', title: 'LEGEND', at: 12000 },
  ];
  const stageFor = runAura => { let i = 0; while (i + 1 < EVOLVE.length && runAura >= EVOLVE[i + 1].at) i++; return i; };

  // ---------- The cast ----------
  const CAST = {
    // Player troops: the mullet dude (Michael) in an open hi-vis vest with his yellow pole staff.
    // The squad EVOLVES during a run (see EVOLVE below): trooper -> trooper2 -> trooper3 -> trooper4, each bigger and flashier.
    trooper: { name: 'Mulletto Bastonato', role: 'Your trooper (evo 1: start)', w: 44, h: 44, frames: 2, draw(c, f) {
      drawHero(c, f, 1, this.w, this.h);
    } },
    trooper2: { name: 'Mulletto Bastonato (Runner)', role: 'Evo 2: 1,500 run aura', w: 48, h: 52, frames: 2, draw(c, f) {
      drawHero(c, f, 2, this.w, this.h);
    } },
    trooper3: { name: 'Mulletto Bastonato (Caped)', role: 'Evo 3: 5,000 run aura', w: 54, h: 59, frames: 2, draw(c, f) {
      drawHero(c, f, 3, this.w, this.h);
    } },
    trooper4: { name: 'Mulletto Bastonato (Legend)', role: 'Evo 4: 12,000 run aura', w: 60, h: 70, frames: 2, draw(c, f) {
      drawHero(c, f, 4, this.w, this.h);
    } },
    // Squad commander: a wild-haired, grinning old grease-monkey in overalls, sweeping up dust clouds with a push broom.
    leader: { name: 'Nonno Scopazzo', role: 'Boss base art (not in the squad)', w: 114, h: 84, frames: 2, draw(c, f) {
      const sw = f ? 1 : 0, SKIN = '#f2c6a0', DEN = '#2563eb';
      c.lineCap = 'round'; c.lineJoin = 'round';
      // legs (overalls) + boots, bent knees, one stepping into the sweep
      box(c, -12 - sw, -26, 9, 22, 3.5, DEN, 1.2); box(c, 2 + sw, -26, 9, 22, 3.5, DEN, 1.2);
      blob(c, -9 - sw, -3, 7, 3.4, '#4a2c17', 1.1); blob(c, 7.5 + sw, -3, 7, 3.4, '#4a2c17', 1.1);
      // back arm (sleeve) reaching to the broom
      c.beginPath(); c.moveTo(-8, -46); c.quadraticCurveTo(0, -36, 10 + sw * 2, -34); c.lineWidth = 6.5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.5; c.strokeStyle = '#9ca3af'; c.stroke();
      // grey work shirt torso
      blob(c, -1, -42, 15, 15, '#9ca3af', 1.3);
      // overall bib, straps, pocket with a wrench
      box(c, -10, -46, 19, 22, 4, DEN, 1.2);
      c.beginPath(); c.moveTo(-9, -45); c.lineTo(-12, -55); c.moveTo(8, -45); c.lineTo(10, -55); c.lineWidth = 3.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2; c.strokeStyle = DEN; c.stroke();
      blob(c, -8.5, -45, 1.6, 1.6, '#facc15', 0.7); blob(c, 7.5, -45, 1.6, 1.6, '#facc15', 0.7);
      box(c, -5, -40, 9, 7, 2, '#1d4ed8', 0.9);
      c.save(); c.translate(1, -42); c.rotate(0.35); box(c, -1, -6, 2.2, 8, 1, '#cbd5e1', 0.8); blob(c, 0.1, -6.5, 2.4, 1.8, '#cbd5e1', 0.8); c.restore();
      blob(c, 6, -30, 3, 2, '#1a1033', 0); // grease smudge
      // push broom: handle angled down-right to a wide bristle head on the ground (sweeps between frames)
      c.save(); c.translate(-2, -42); const ang = 0.86 - sw * 0.1; c.rotate(ang);
      box(c, 0, -1.6, 46, 3.2, 1.6, '#a16207', 1);
      c.translate(46, 0); c.rotate(-ang);
      c.beginPath(); for (let k = -12; k <= 12; k += 2.4) { c.moveTo(k, 2); c.lineTo(k - 1.5 - sw * 1.5, 7.5); } c.lineWidth = 1.6; c.strokeStyle = '#d6b36a'; c.stroke();
      box(c, -14, -3, 28, 5, 2, '#78350f', 1.1);
      c.restore();
      // dust puffs kicked up by the broom (move with the sweep)
      c.globalAlpha = 0.8;
      const dx = sw ? 6 : 0;
      for (const [x, y, r] of [[38, -5, 6], [45, -11, 5.5], [33, -14, 4.5], [47, -3, 4.5], [40, -19, 3.6], [26, -3, 3.4]]) blob(c, x + dx + (r % 2) * sw * 2, y - sw * (r > 5 ? 2 : 0), r, r * 0.85, '#e7d8bf', 0.9);
      c.globalAlpha = 1;
      // front arm gripping the handle
      c.beginPath(); c.moveTo(10, -50); c.quadraticCurveTo(22, -40, 22 - sw * 2, -26); c.lineWidth = 6.5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.5; c.strokeStyle = '#9ca3af'; c.stroke();
      blob(c, 22 - sw * 2, -24.5, 3.4, 3.2, SKIN, 1); blob(c, 10 + sw * 2, -33, 3.2, 3, SKIN, 1);
      // head: wild white hair explosion behind, bald shiny dome
      for (let k = 0; k < 11; k++) { const a = -Math.PI * 0.95 + k * 0.29, r = 13 + (k % 3) * 2.5 + (sw && k % 2 ? 1.5 : 0); c.save(); c.translate(-2, -62); c.rotate(a); blob(c, r, 0, 6.5, 3.4, '#f1f5f9', 1, 0); c.restore(); }
      blob(c, -15, -58, 5, 3.6, '#f1f5f9', 1, 0.6); blob(c, 11, -58, 5, 3.6, '#f1f5f9', 1, -0.6);
      blob(c, -2, -62, 12, 12.5, SKIN, 1.4); shine(c, -6, -70, 4, 2, 0.7);
      blob(c, -14, -61, 2.5, 3.5, SKIN, 1); blob(c, 10, -61, 2.5, 3.5, SKIN, 1); // ears
      // bushy brows, big crazy eyes, bulb nose, gap-toothed grin, stubble chin
      c.beginPath(); c.moveTo(-10, -69); c.quadraticCurveTo(-6, -72, -3, -68.5); c.moveTo(0, -68.5); c.quadraticCurveTo(4, -72.5, 7, -69); c.lineWidth = 2.6; c.strokeStyle = '#e5e7eb'; c.stroke();
      eye(c, -6, -64.5, 3.2, 0.3, 0.1); eye(c, 3.2, -64.5, 3.6, -0.2, 0.2);
      blob(c, -1.2, -59.5, 3.2, 2.6, '#e8907a', 1);
      grin(c, -1.4, -55.5, 14, 3.4, 5, 1);
      c.fillStyle = '#5b0f2e'; rr(c, -1.6, -55.6, 2.3, 2.6, 0.6); c.fill(); // missing tooth
      c.fillStyle = 'rgba(100,116,139,0.35)'; for (let k = 0; k < 7; k++) { ell(c, -7 + k * 2, -51.2 + (k % 2) * 0.6, 0.45, 0.45); c.fill(); }
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
    // Swarm variant mixed in with the pineapple knights: an angry washing machine (rusty red body, scorched-orange porthole
    // sludge, grimy suds, red warning lights) with a grinning head popping out of the lid.
    swarmC: { name: 'Lavatrino Schiumoso', role: 'Swarm grunt (mixed in)', w: 40, h: 50, frames: 2, draw(c, f) {
      c.scale(1.22, 1.22);
      drawWasher(c, f, { body: '#b91c1c', strip: '#3f1d1d', water: '#f97316', suds: '#d9d4b8', bubble: 'rgba(60,20,10,0.7)', light: '#ef4444', light2: '#facc15', iris: '#991b1b', angry: 0.8, hair: '#1f1209' });
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
    // Boss 2: the Sweeping Old Man. Nonno Scopazzo gone rogue, hunched over a giant push broom. Reuses the commander's
    // art, bigger and stooped. Frame 2 is the wind-up, with the broom hauled back before a Dust Bawl.
    sweeper: { name: 'Nonno Scopazzo, the Sweeping Old Man', role: 'Boss', w: 172, h: 132, frames: 3, draw(c, f) {
      c.save(); c.scale(1.5, 1.5);
      c.transform(1, 0, f === 2 ? 0.28 : -0.12, 1, 0, 0); // hunch forward, rear back on the wind-up
      if (f === 2) { c.translate(4, 0); c.scale(-1, 1); }
      CAST.leader.draw(c, f & 1);
      c.restore();
    } },
    // Boss: a GIANT grumpy fleshy blob head in mirrored aviator shades with a bushy mustache, waddling on stubby feet.
    // Frame 2 (laser telegraph/strike): the shades glow red.
    boss: { name: 'Testone Baffolini, the Grump King', role: 'Boss', w: 184, h: 192, frames: 3, draw(c, f) {
      const angry = f === 2, wd = f === 1 ? 1 : 0, lean = wd ? 0.05 : -0.03, FLESH = '#f0b8a0';
      blob(c, -34, -10 + (wd ? -5 : 0), 20, 10, '#d99583', 1.8); blob(c, 34, -10 + (wd ? 0 : -5), 20, 10, '#d99583', 1.8); // stubby feet
      for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) blob(c, s * 34 + k * 9 + s * 4, -14 + (wd === (s > 0 ? 0 : 1) ? -5 : 0), 3.4, 3, '#f5c9b6', 1); // toes
      c.save(); c.translate(0, -100); c.rotate(lean);
      blob(c, -79, 30, 12, 10, FLESH, 1.8, 0.4); blob(c, 79, 30, 12, 10, FLESH, 1.8, -0.4);                 // stubby hands
      blob(c, 0, 0, 76, 78, FLESH, 2.2);                                                                     // the head
      c.save(); ell(c, 0, 0, 76, 78); c.clip();
      ell(c, 0, 62, 70, 30); c.fillStyle = 'rgba(190,100,90,0.25)'; c.fill();                              // jowl shading
      c.lineWidth = 2.2; c.strokeStyle = 'rgba(150,70,60,0.45)';
      c.beginPath(); c.moveTo(-30, -58); c.quadraticCurveTo(0, -66, 30, -58); c.moveTo(-24, -48); c.quadraticCurveTo(0, -55, 24, -48); c.stroke();          // forehead folds
      c.beginPath(); c.moveTo(-62, 30); c.quadraticCurveTo(-44, 52, -20, 50); c.moveTo(62, 30); c.quadraticCurveTo(44, 52, 20, 50); c.stroke();             // jowl creases
      c.restore();
      blob(c, -74, -4, 9, 15, FLESH, 1.8); blob(c, 74, -4, 9, 15, FLESH, 1.8);                              // ears
      // scowl brows
      c.beginPath(); c.moveTo(-50, -38); c.lineTo(-10, angry ? -26 : -30); c.moveTo(50, -38); c.lineTo(10, angry ? -26 : -30); c.lineWidth = 7; c.lineCap = 'round'; c.strokeStyle = '#7a4a3a'; c.stroke();
      // mirrored aviator shades (red glow before/while firing the laser)
      if (angry) { c.save(); c.shadowColor = '#ef4444'; c.shadowBlur = 30; }
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(s * 6, -24); c.lineTo(s * 52, -26); c.quadraticCurveTo(s * 56, 0, s * 38, 6); c.quadraticCurveTo(s * 10, 8, s * 6, -10); c.closePath();
        const g = c.createLinearGradient(0, -26, 0, 8);
        if (angry) { g.addColorStop(0, '#fecaca'); g.addColorStop(0.35, '#ef4444'); g.addColorStop(1, '#7f1d1d'); }
        else { g.addColorStop(0, '#fde68a'); g.addColorStop(0.45, '#f59e0b'); g.addColorStop(0.5, '#ea580c'); g.addColorStop(1, '#7c2d12'); }
        c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = '#d4af37'; c.stroke();
        c.beginPath(); c.moveTo(s * 14, -20); c.lineTo(s * 30, -21); c.lineTo(s * 18, -6); c.closePath(); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); // mirror glint
      }
      c.beginPath(); c.moveTo(-6, -22); c.quadraticCurveTo(0, -27, 6, -22); c.lineWidth = 3; c.strokeStyle = '#d4af37'; c.stroke();  // bridge
      c.beginPath(); c.moveTo(-52, -25); c.lineTo(-72, -12); c.moveTo(52, -25); c.lineTo(72, -12); c.stroke();                          // arms of the shades
      if (angry) c.restore();
      blob(c, 0, 14, 14, 12, '#e89a85', 1.8); shine(c, -5, 9, 4, 2.4, 0.6);                                    // big nose
      // bushy mustache (layered tufts), grumpy down-turned mouth
      const tufts = []; for (const s of [-1, 1]) { tufts.push([s * 13, 31, 15, 9, s * 0.15], [s * 27, 35, 12, 7.5, s * 0.45], [s * 37, 42, 7, 5, s * 0.9]); }
      for (const [x, y, rx, ry, r] of tufts) { ell(c, x, y, rx, ry, r); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); }  // one merged outline
      for (const [x, y, rx, ry, r] of tufts) { ell(c, x, y, rx, ry, r); c.fillStyle = glossFill(c, x, y, rx, ry, '#6b4532'); c.fill(); }
      c.lineWidth = 1.3; c.strokeStyle = 'rgba(40,20,10,0.55)'; c.beginPath();
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const x = s * (6 + k * 6); c.moveTo(x, 27 + k * 0.8); c.lineTo(x + s * 4, 36 + k * 1.2); } c.stroke();  // hair strokes
      c.beginPath(); c.moveTo(-24, 52); c.quadraticCurveTo(0, angry ? 38 : 42, 24, 52); c.lineWidth = 4.5; c.strokeStyle = '#7a3b34'; c.stroke();
      shine(c, -40, -58, 18, 7, 0.55); shine(c, 44, 30, 6, 3, 0.25);
      c.restore();
    } },
  };

  // ---------- Atlas ----------
  const PX = 3; // atlas pixels per world unit (sprites are drawn at <= ~2.6 px/unit on phones)
  const frames = {};
  function build() {
    const doc = root.document; if (!doc) return;
    const pad = 4; let x = 0, y = 0, rowH = 0; const maxW = 1400, place = [];
    for (const key in CAST) {
      const s = CAST[key], px = (key === 'boss' || key === 'sweeper') ? 2 : PX, fw = Math.ceil(s.w * px) + pad * 2, fh = Math.ceil(s.h * px) + pad * 2;
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
  root.Sprites = { CAST, EVOLVE, stageFor, draw, build, atlas: () => atlas };
})(typeof window !== 'undefined' ? window : globalThis);
