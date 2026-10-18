// +1 Speed Escape renderer + input (top-down 3-lane track). Logic lives in runner.js.
// Original art: the current skin's background and hero (Aurie / Keycap / Skipper), the player's aura ring tier and
// halos (cosmetic), glowing slab walls and spike rows tinted with the skin's stage palette, aura wisps to collect.
import * as R from './runner.js';
const TAU = Math.PI * 2;

export function createEscapeView(canvas, fx) {
  const ctx = fx.ctx;
  let lastSize = { w: 0, h: 0 };
  function geom() {
    const { w, h } = fx.size(); lastSize = { w, h };
    const roadW = Math.min(w * 0.94, 440), x0 = (w - roadW) / 2, laneW = roadW / R.RUN.lanes;
    const py = h * 0.77, top = h * 0.13;
    return { w, h, roadW, x0, laneW, py, top, laneCx: l => x0 + laneW * (l + 0.5) };
  }

  function frame(run, skin, si, t, dt, o = {}) {
    const g = geom(), st = skin.stages[si];
    const ppm = (g.py - g.top) / R.viewAhead(run.speed);
    const yOf = at => g.py - (at - run.dist) * ppm;
    ctx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
    const px = g.laneCx(R.laneX(run)), pr = Math.min(g.laneW * 0.3, 46);
    skin.drawBackground(ctx, g.w, g.h, si, t * (1 + run.speed / 40), { target: { x: px, y: g.py, r: pr }, dt, heat: 0, combo: 0, locked: false });
    // track
    ctx.save();
    ctx.fillStyle = 'rgba(5,2,12,.55)'; rr(ctx, g.x0 - 6, -20, g.roadW + 12, g.h + 40, 18); ctx.fill();
    ctx.strokeStyle = hexA(st.accent, 0.55); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g.x0 - 6, 0); ctx.lineTo(g.x0 - 6, g.h); ctx.moveTo(g.x0 + g.roadW + 6, 0); ctx.lineTo(g.x0 + g.roadW + 6, g.h); ctx.stroke();
    // scrolling lane dashes (scroll with distance, so the +1 speed is felt)
    const dash = 5 * ppm, off = (run.dist * ppm) % (dash * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.setLineDash([dash, dash]); ctx.lineDashOffset = -off;
    for (let l = 1; l < R.RUN.lanes; l++) { const x = g.x0 + g.laneW * l; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, g.h); ctx.stroke(); }
    ctx.setLineDash([]);
    // speed streaks at the edges, stronger as speed climbs
    const k = Math.min(1, Math.max(0, (run.speed - 15) / 60));
    if (k > 0 && !o.reduced) {
      ctx.strokeStyle = hexA(st.glow, 0.15 + 0.35 * k); ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const side = i % 2 ? g.x0 - 14 - (i % 3) * 7 : g.x0 + g.roadW + 14 + (i % 3) * 7; const len = 40 + 120 * k; const y = ((i * 97 + run.dist * ppm * 1.4) % (g.h + len)) - len; ctx.beginPath(); ctx.moveTo(side, y); ctx.lineTo(side, y + len); ctx.stroke(); }
    }
    // best-distance marker
    if (o.best > 0) { const y = yOf(o.best); if (y > -10 && y < g.h + 10) { ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(g.x0, y); ctx.lineTo(g.x0 + g.roadW, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffe27a'; ctx.font = '900 12px system-ui'; ctx.textAlign = 'left'; ctx.fillText(`BEST ${o.best} m`, g.x0 + 6, y - 7); } }
    // wisps
    for (const w of run.orbs) { const y = yOf(w.at); if (y < -30 || y > g.h + 30) continue; drawWisp(g.laneCx(w.lane), y, st, t); }
    // walls / spikes
    for (const ob of run.obstacles) {
      const y1 = yOf(ob.at + ob.len / 2), y2 = yOf(ob.at - ob.len / 2); if (y2 < -20 || y1 > g.h + 20) continue;
      const hgt = Math.max(16, y2 - y1), x = g.x0 + g.laneW * ob.lane + 6, wdt = g.laneW - 12;
      drawWall(x, y1, wdt, hgt, ob.kind, st, t);
    }
    // trail + hero
    ctx.globalAlpha = 1;
    for (let i = 1; i <= 6; i++) { ctx.fillStyle = hexA(st.glow, 0.22 - i * 0.03); ctx.beginPath(); ctx.arc(px, g.py + pr * 0.5 + i * (6 + run.speed * 0.12), pr * (0.8 - i * 0.1), 0, TAU); ctx.fill(); }
    const blink = run.invuln > 0 && Math.floor(t * 12) % 2 === 0;
    if (!blink) {
      const lean = (R.laneX(run) - Math.round(R.laneX(run))) * 0.6;
      fx.auraRingAt(px, g.py, pr, o.tier || 0, t);
      if (o.halos) fx.halosAt(px, g.py - pr * 1.55, pr, o.halos, t);
      ctx.save(); ctx.translate(px, g.py); ctx.rotate(lean); ctx.translate(-px, -g.py);
      skin.drawTarget(ctx, px, g.py + Math.sin(t * 14) * 2, pr, si, t, { squash: 0.15 + 0.15 * Math.abs(Math.sin(t * 14)), heat: run.alive ? 0 : 100, locked: !run.alive, combo: 0 });
      ctx.restore();
    }
    ctx.restore();
    fx.overlay(skin, si, dt);
  }

  function drawWall(x, y, w, h, kind, st, t) {
    ctx.save();
    ctx.shadowColor = st.glow; ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#2c1840'); g.addColorStop(1, '#120a1e');
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 8); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = st.accent; ctx.lineWidth = 2.5; rr(ctx, x, y, w, h, 8); ctx.stroke();
    ctx.save(); rr(ctx, x, y, w, h, 8); ctx.clip(); ctx.strokeStyle = hexA(st.glow, 0.35); ctx.lineWidth = 5;
    for (let i = -h; i < w + h; i += 16) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
    ctx.restore();
    if (kind === 'spike') { // a row of glowing spikes on the edge facing the player
      ctx.fillStyle = st.accent; const n = 5, sw = w / n, by = y + h;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(x + i * sw, by - 2); ctx.lineTo(x + (i + 0.5) * sw, by + 12 + Math.sin(t * 6 + i) * 2); ctx.lineTo(x + (i + 1) * sw, by - 2); ctx.fill(); }
    } else { // two angry slits so walls read as hazards at a glance
      ctx.strokeStyle = hexA(st.accent, 0.9); ctx.lineWidth = 3; ctx.lineCap = 'round'; const cy = y + Math.min(h / 2, 14), cx = x + w / 2;
      ctx.beginPath(); ctx.moveTo(cx - 16, cy - 3); ctx.lineTo(cx - 6, cy + 1); ctx.moveTo(cx + 16, cy - 3); ctx.lineTo(cx + 6, cy + 1); ctx.stroke();
    }
    ctx.restore();
  }
  function drawWisp(x, y, st, t) {
    const b = Math.sin(t * 6 + x) * 3; ctx.save(); ctx.translate(x, y + b);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, st.accent); g.addColorStop(1, hexA(st.accent, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b0a00'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+1', 0, 1);
    ctx.restore();
  }

  /** Swipe (any length > 26 px) or tap the left/right half to change lanes. */
  function bindInput(getRun, onMove) {
    let sx = 0, sy = 0, swiped = false, down = false;
    canvas.addEventListener('pointerdown', e => { if (!getRun()) return; down = true; sx = e.clientX; sy = e.clientY; swiped = false; });
    canvas.addEventListener('pointermove', e => {
      if (!down || swiped || !getRun()) return; const dx = e.clientX - sx;
      if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(e.clientY - sy)) { swiped = true; onMove(dx > 0 ? 1 : -1); }
    });
    canvas.addEventListener('pointerup', e => { if (!down) return; down = false; if (swiped || !getRun()) return; onMove(e.clientX < lastSize.w / 2 ? -1 : 1); });
    canvas.addEventListener('pointercancel', () => { down = false; });
  }
  return { frame, bindInput, geom };
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function hexA(hex, a) { if (!hex || hex[0] !== '#') return hex; const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
