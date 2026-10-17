// Canvas renderer: skin background, the tap target, particles, floating "+1" text, shockwave rings, screen pulse/shake.
export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  const parts = [], texts = [], rings = [];
  let squash = 0, pulse = 0, shake = 0, flash = 0, flashColor = '#fff';
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; }
  resize(); window.addEventListener('resize', resize);
  const target = () => ({ x: w / 2, y: h * 0.47, r: Math.min(w, h) * 0.17 });

  function burst(x, y, colors, n = 8, speed = 220, size = 4) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.7 + Math.random() * 0.5, max: 1.2, size: size * (0.6 + Math.random()), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, color: colors[i % colors.length], g: 320 }); }
  }
  function float(x, y, text, color, size = 26, opts = {}) { texts.push({ x, y, text, color, size, life: opts.life || 0.9, max: opts.life || 0.9, vy: opts.vy || -110, stroke: opts.stroke ?? true }); if (texts.length > 60) texts.shift(); }
  function ring(color, power = 1) { const t = target(); rings.push({ x: t.x, y: t.y, r: t.r, life: 0.5, max: 0.5, color, power }); }
  function ambient(skin, si, dt) {
    const a = skin.ambient(si); const st = skin.stages[si];
    if (Math.random() < dt * 14) parts.push({ x: Math.random() * w, y: a.vy < 0 ? h + 5 : a.vy > 0 ? -5 : Math.random() * h, vx: a.vx, vy: a.vy, life: 4, max: 4, size: 1.5 + Math.random() * 2, rot: 0, vr: 0.5, color: st.colors[(Math.random() * 3) | 0], g: 0, amb: true });
  }

  function frame(skin, si, t, dt, o) {
    squash *= Math.pow(0.0005, dt); pulse *= Math.pow(0.02, dt); shake *= Math.pow(0.004, dt); flash *= Math.pow(0.01, dt);
    ambient(skin, si, dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (Math.random() - 0.5) * shake * 14, sy = (Math.random() - 0.5) * shake * 14;
    ctx.save(); ctx.translate(sx, sy);
    const tg = target();
    skin.drawBackground(ctx, w, h, si, t, { ...o, target: tg, dt });
    for (const r of rings) { r.life -= dt; const k = 1 - r.life / r.max; ctx.strokeStyle = r.color; ctx.globalAlpha = Math.max(0, r.life / r.max) * 0.8; ctx.lineWidth = 6 * r.power * (1 - k) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1 + k * 1.6 * r.power), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    skin.drawTarget(ctx, tg.x, tg.y, tg.r * (1 + pulse * 0.08 + Math.sin(t * 2.2) * 0.02), si, t, { squash, heat: o.heat, locked: o.locked, combo: o.combo || 0 });
    for (const p of parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; skin.drawParticle(ctx, p, si); }
    skin.drawOverlay?.(ctx, w, h, si, t, { ...o, target: tg, squash, dt });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of texts) { f.life -= dt; f.y += f.vy * dt; f.vy *= 0.96; const k = f.life / f.max; ctx.globalAlpha = Math.min(1, k * 2); const sc = 1 + (1 - k) * 0.15 + (k > 0.85 ? (k - 0.85) * 3 : 0); ctx.font = `900 ${f.size * sc}px system-ui, sans-serif`; if (f.stroke) { ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(f.text, f.x, f.y); } ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1; ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = flashColor; ctx.globalAlpha = flash * 0.35; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    for (const arr of [parts, texts, rings]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0 || arr[i].y < -50 || arr[i].y > h + 60) arr.splice(i, 1);
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }
  return {
    frame, burst, float, ring, target, resize, size: () => ({ w, h }),
    hitTest(x, y) { const t = target(); return Math.hypot(x - t.x, y - t.y) < t.r * 1.5; },
    kick(sq = 1, p = 1) { squash = Math.min(1, squash + sq); pulse = Math.min(1.5, pulse + p); },
    shake(v) { shake = Math.max(shake, v); },
    flash(color, v = 1) { flashColor = color; flash = Math.max(flash, v); },
    counts: () => ({ parts: parts.length, texts: texts.length }),
  };
}
