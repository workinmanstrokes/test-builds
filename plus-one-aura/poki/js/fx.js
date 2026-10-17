// Canvas renderer: skin background, the tap target, particles, floating "+1" text, shockwave rings, screen pulse/shake.
export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  const parts = [], texts = [], rings = [];
  let squash = 0, pulse = 0, shake = 0, flash = 0, flashColor = '#fff', hop = 0, reduced = false;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; }
  resize(); window.addEventListener('resize', resize);
  const target = () => ({ x: w / 2, y: h * 0.47, r: Math.min(w, h) * 0.17 });

  function burst(x, y, colors, n = 8, speed = 220, size = 4) {
    if (reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.7 + Math.random() * 0.5, max: 1.2, size: size * (0.6 + Math.random()), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, color: colors[i % colors.length], g: 320 }); }
  }
  function float(x, y, text, color, size = 26, opts = {}) { texts.push({ x, y, text, color, size, life: opts.life || 0.9, max: opts.life || 0.9, vy: opts.vy || -110, stroke: opts.stroke ?? true }); if (texts.length > 60) texts.shift(); }
  function ring(color, power = 1) { const t = target(); rings.push({ x: t.x, y: t.y, r: t.r, life: 0.5, max: 0.5, color, power }); }
  function ambient(skin, si, dt) {
    const a = skin.ambient(si); const st = skin.stages[si];
    if (Math.random() < dt * 14) parts.push({ x: Math.random() * w, y: a.vy < 0 ? h + 5 : a.vy > 0 ? -5 : Math.random() * h, vx: a.vx, vy: a.vy, life: 4, max: 4, size: 1.5 + Math.random() * 2, rot: 0, vr: 0.5, color: st.colors[(Math.random() * 3) | 0], g: 0, amb: true });
  }

  function frame(skin, si, t, dt, o) {
    hop = Math.max(0, hop - dt * 2.2);
    squash *= Math.pow(0.0005, dt); pulse *= Math.pow(0.02, dt); shake *= Math.pow(0.004, dt); flash *= Math.pow(0.01, dt);
    ambient(skin, si, dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (Math.random() - 0.5) * shake * 14, sy = (Math.random() - 0.5) * shake * 14;
    ctx.save(); ctx.translate(sx, sy);
    const tg = target();
    skin.drawBackground(ctx, w, h, si, t, { ...o, target: tg, dt });
    for (const r of rings) { r.life -= dt; const k = 1 - r.life / r.max; ctx.strokeStyle = r.color; ctx.globalAlpha = Math.max(0, r.life / r.max) * 0.8; ctx.lineWidth = 6 * r.power * (1 - k) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1 + k * 1.6 * r.power), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const hy = -Math.sin(Math.min(1, hop) * Math.PI) * tg.r * 0.9; // jump arc
    if (o.pulse != null) drawPulse(tg, o.pulse);
    drawAuraRing(tg.x, tg.y + hy, tg.r, o.tier || 0, t);
    if (o.halos) drawHalos(tg.x, tg.y + hy - tg.r * 1.55, tg.r, o.halos, t);
    if (o.wisp) drawWisp(o.wisp, t);
    skin.drawTarget(ctx, tg.x, tg.y + hy, tg.r * (1 + pulse * 0.08 + Math.sin(t * 2.2) * 0.02), si, t, { squash, heat: o.heat, locked: o.locked, combo: o.combo || 0 });
    for (const p of parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; skin.drawParticle(ctx, p, si); }
    skin.drawOverlay?.(ctx, w, h, si, t, { ...o, target: tg, squash, dt });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of texts) { f.life -= dt; f.y += f.vy * dt; f.vy *= 0.96; const k = f.life / f.max; ctx.globalAlpha = Math.min(1, k * 2); const sc = 1 + (1 - k) * 0.15 + (k > 0.85 ? (k - 0.85) * 3 : 0); ctx.font = `900 ${f.size * sc}px system-ui, sans-serif`; if (f.stroke) { ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(f.text, f.x, f.y); } ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1; ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = flashColor; ctx.globalAlpha = flash * 0.35; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    for (const arr of [parts, texts, rings]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0 || arr[i].y < -50 || arr[i].y > h + 60) arr.splice(i, 1);
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }
  // Aura ring: colour tier changes every 5 Tap Power + Glow-Up levels and the ring grows (plan §3.1 "Visual").
  // Tiers also differ by ring count/dashes so the change reads without colour (colour-blind safe).
  const TIER = ['#ffffff', '#5dff8a', '#4aa8ff', '#b46bff', '#ffd23f', null];
  function drawAuraRing(x, y, r, tier, t) {
    ctx.save(); ctx.translate(x, y); ctx.lineWidth = 3 + tier * 1.2; ctx.globalAlpha = 0.55 + 0.1 * Math.sin(t * 3);
    const rr = r * (1.28 + tier * 0.07);
    ctx.strokeStyle = TIER[tier] || `hsl(${(t * 90) % 360},100%,65%)`;
    if (tier >= 5) { const g = ctx.createConicGradient ? ctx.createConicGradient(t, 0, 0) : null; if (g) { for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60},100%,62%)`); ctx.strokeStyle = g; } }
    ctx.setLineDash(tier % 2 ? [r * 0.18, r * 0.08] : []); ctx.rotate(t * 0.4);
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
    if (tier >= 3) { ctx.setLineDash([]); ctx.lineWidth = 2; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(0, 0, rr + 9, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function drawHalos(x, y, r, n, t) {
    const k = Math.min(n, 5); ctx.save(); ctx.strokeStyle = '#ffe27a'; ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 10; ctx.lineWidth = 3;
    for (let i = 0; i < k; i++) { const dx = (i - (k - 1) / 2) * r * 0.5, dy = Math.sin(t * 2 + i) * 4; ctx.beginPath(); ctx.ellipse(x + dx, y + dy, r * 0.2, r * 0.07, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (n > 5) { ctx.shadowBlur = 0; ctx.fillStyle = '#ffe27a'; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`x${n}`, x, y - 14); }
    ctx.restore();
  }
  // floor-6 twist: a ring closes in on the hero; tapping as it lands is a PERFECT (x3). phase 0..1, 1 = beat.
  function drawPulse(tg, ph) {
    if (ph < 0.6) return; const k = (ph - 0.6) / 0.4;
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.25 + 0.6 * k; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * (1.05 + 1.9 * (1 - k)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function drawWisp(wp, t) {
    ctx.save(); ctx.translate(wp.x, wp.y); const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.4, '#ffd23f'); g.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26 + Math.sin(t * 8) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3b00'; ctx.beginPath(); ctx.arc(-4, -2, 2, 0, 7); ctx.arc(4, -2, 2, 0, 7); ctx.fill(); ctx.restore();
  }
  return {
    frame, burst, float, ring, target, resize, size: () => ({ w, h }),
    hitTest(x, y) { const t = target(); return Math.hypot(x - t.x, y - t.y) < t.r * 1.5; },
    kick(sq = 1, p = 1) { squash = Math.min(1, squash + sq); pulse = Math.min(1.5, pulse + p); },
    shake(v) { if (!reduced) shake = Math.max(shake, v); },
    flash(color, v = 1) { flashColor = color; flash = Math.max(flash, reduced ? v * 0.25 : v); },
    hop() { if (hop <= 0) hop = 1; },
    setReduced(v) { reduced = !!v; },
    counts: () => ({ parts: parts.length, texts: texts.length }),
  };
}
