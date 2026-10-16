// Default skin: "+1 Aura" starring Aurie, an original wisp of light (no third-party characters or music).
const TAU = Math.PI * 2;

const stages = [
  { name: 'Ember Wilds', bg: ['#2a0c06', '#0d0503'], accent: '#ffb347', glow: '#ff7a1a', text: '#ffe2b8',
    particle: 'ember', colors: ['#ffd27a', '#ff9b3d', '#ff5e1a'], root: 57 },
  { name: 'Neon Rift', bg: ['#16063a', '#05010f'], accent: '#33f0ff', glow: '#ff3df2', text: '#e3fbff',
    particle: 'shard', colors: ['#33f0ff', '#ff3df2', '#9b6bff'], root: 62 },
  { name: 'Celestial Crown', bg: ['#0b1238', '#01020a'], accent: '#ffe27a', glow: '#fff4c2', text: '#fff8e1',
    particle: 'star', colors: ['#fff4c2', '#ffe27a', '#a7c7ff'], root: 66 },
];

export default {
  id: 'aura',
  name: '+1 Aura',
  text: {
    title: '+1 Aura', subtitle: 'Tap to Ascend', currency: 'Aura', perSec: 'aura/s',
    tapHint: 'TAP AURIE', streak: 'STREAK', overheat: 'OVERHEAT!', burst: 'AURA BURST',
    mascot: 'Aurie',
    upgrades: {
      power: ['Brighter Glow', '+1 aura per tap'],
      auto:  ['Little Wisps', '+1 aura every second, even offline'],
      combo: ['Deep Focus', '+0.5 max streak multiplier'],
      cool:  ['Calm Mind', 'Builds 9% less heat per tap'],
      crit:  ['Lucky Spark', '+3% chance of a x10 Aura Burst'],
    },
    reward: { boost: '2x Aura · 3 min', revive: 'Revive & keep streak', skip: 'Skip to next stage', offline: 'Double it' },
    stageUnlock: n => `NEW STAGE: ${n}`, levelUp: L => `LEVEL ${L}`,
  },
  stages,

  // ---- sound: everything is synthesized (WebAudio), original, no samples ----
  sound: {
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],   // major pentatonic, climbs with combo
    tap: { wave: 'triangle', dur: 0.09, gain: 0.18, detune: 7 },
    burst: { wave: 'square', dur: 0.25, gain: 0.12 },
    bank: { chord: [0, 4, 7, 12], wave: 'sine', dur: 0.35, gain: 0.14 },
    overheat: { from: 600, to: 70, dur: 0.6, noise: true },
    unlock: { arp: [0, 4, 7, 12, 16, 19, 24], wave: 'triangle', step: 0.07 },
    levelUp: { arp: [0, 7, 12], wave: 'sine', step: 0.06 },
    buy: { arp: [12, 19], wave: 'square', step: 0.04 },
  },

  // ---- visuals ----
  drawBackground(ctx, w, h, si, t) {
    const st = stages[si];
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, st.bg[0]); g.addColorStop(1, st.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (si === 0) { // layered ember dunes
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = ['#3d1307', '#2a0d05', '#170703'][k];
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.72 + k * 0.09) + Math.sin(x * 0.012 + k * 2 + t * 0.15 * (k + 1)) * 18);
        ctx.lineTo(w, h); ctx.fill();
      }
    } else if (si === 1) { // scrolling neon grid floor
      ctx.save(); ctx.strokeStyle = 'rgba(255,61,242,.35)'; ctx.lineWidth = 1.5;
      const hz = h * 0.62;
      for (let i = 0; i < 14; i++) { const p = ((i + (t * 0.6) % 1) / 14); const y = hz + Math.pow(p, 2.2) * (h - hz); ctx.globalAlpha = p; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(51,240,255,.4)';
      for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 14, hz); ctx.lineTo(w / 2 + i * w * 0.22, h); ctx.stroke(); }
      ctx.restore();
    } else { // starfield + slow golden rays
      ctx.save();
      for (let i = 0; i < 90; i++) { const x = (i * 97.3) % w, y = (i * 53.7 + i * i) % h; ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.3 + i)); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1.6, 1.6); }
      ctx.translate(w / 2, h * 0.42); ctx.rotate(t * 0.05); ctx.globalAlpha = 0.07; ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -h); ctx.lineTo(40, -h); ctx.fill(); }
      ctx.restore();
    }
  },

  // Aurie: a different body per stage (flame -> crystal -> crowned star), same face so players bond with it.
  drawTarget(ctx, x, y, r, si, t, o) {
    const st = stages[si]; const heat = o.heat / 100; const sq = o.squash;
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + sq * 0.12, 1 - sq * 0.12);
    // halo
    const hg = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.1);
    hg.addColorStop(0, hexA(heat > 0.7 ? '#ff3b2f' : st.glow, 0.55)); hg.addColorStop(1, hexA(st.glow, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.fill();
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    if (si === 0) {
      body.addColorStop(0, '#fff6d6'); body.addColorStop(0.45, '#ffb347'); body.addColorStop(1, '#ff4d12');
      ctx.fillStyle = body; ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; const top = Math.max(0, -Math.sin(a)); const fl = 1 + top * (0.45 + 0.12 * Math.sin(t * 9 + a * 3)) ; const rr = r * (a > Math.PI ? fl : 1); ctx.lineTo(Math.cos(a) * r * (1 - top * 0.25), Math.sin(a) * rr); }
      ctx.fill();
    } else if (si === 1) {
      ctx.rotate(Math.sin(t * 0.8) * 0.15);
      body.addColorStop(0, '#f2ffff'); body.addColorStop(0.5, '#33f0ff'); body.addColorStop(1, '#b02cff');
      ctx.fillStyle = body; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(0, -r * 1.08); ctx.lineTo(0, r * 1.08); ctx.moveTo(-r * 0.93, -r * 0.54); ctx.lineTo(r * 0.93, r * 0.54); ctx.moveTo(r * 0.93, -r * 0.54); ctx.lineTo(-r * 0.93, r * 0.54); ctx.stroke(); ctx.globalAlpha = 1;
    } else {
      ctx.save(); ctx.strokeStyle = 'rgba(255,226,122,.7)'; ctx.lineWidth = 3;
      for (let k = 0; k < 2; k++) { ctx.save(); ctx.rotate(t * (k ? -0.7 : 0.5) + k); ctx.scale(1, 0.32); ctx.beginPath(); ctx.arc(0, 0, r * (1.45 + k * 0.25), 0, TAU); ctx.stroke(); ctx.restore(); }
      ctx.restore();
      ctx.fillStyle = '#ffe27a'; // crown
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.8);
      for (let i = 0; i <= 4; i++) { const px = -r * 0.55 + i * r * 0.275; ctx.lineTo(px, -r * (i % 2 ? 1.05 : 1.35)); }
      ctx.lineTo(r * 0.55, -r * 0.8); ctx.fill();
      body.addColorStop(0, '#ffffff'); body.addColorStop(0.5, '#fff1b0'); body.addColorStop(1, '#f2a93b');
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    }
    if (heat > 0.05) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,40,20,${heat * 0.45})`; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4); ctx.globalCompositeOperation = 'source-over'; }
    drawFace(ctx, r, t, o);
    ctx.restore();
  },

  drawParticle(ctx, p, si) {
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    const kind = stages[si].particle, s = p.size;
    if (kind === 'ember') { ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
    else if (kind === 'shard') { ctx.beginPath(); ctx.moveTo(0, -s * 1.8); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s * 1.8); ctx.lineTo(-s * 0.7, 0); ctx.fill(); }
    else { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? s * 0.4 : s * 1.6; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); }
    ctx.restore();
  },
  // gentle ambient drift particles per stage (embers rise, shards fall, stars twinkle in place)
  ambient(si) { return [{ vy: -40, vx: 8 }, { vy: 30, vx: -12 }, { vy: -6, vx: 0 }][si]; },
};

function drawFace(ctx, r, t, o) {
  const heat = o.heat / 100, blink = (t % 3.7) < 0.12 || o.locked;
  ctx.fillStyle = '#2a1030'; ctx.strokeStyle = '#2a1030'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
  const ex = r * 0.3, ey = -r * 0.05, er = r * 0.12;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (blink) { ctx.moveTo(s * ex - er, ey); ctx.lineTo(s * ex + er, ey); ctx.stroke(); }
    else if (heat > 0.7) { ctx.moveTo(s * ex - er * s, ey - er); ctx.lineTo(s * ex + er * s, ey); ctx.lineTo(s * ex - er * s, ey + er); ctx.stroke(); }
    else { ctx.ellipse(s * ex, ey, er * 0.8, er * (1.1 + o.squash * 0.4), 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * ex + er * 0.25, ey - er * 0.4, er * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a1030'; }
  }
  ctx.beginPath();
  if (o.locked) ctx.arc(0, r * 0.32, r * 0.1, 0, TAU);
  else ctx.arc(0, r * 0.18, r * (0.12 + o.squash * 0.1), 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,90,140,.35)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.5, r * 0.18, r * 0.11, r * 0.06, 0, 0, TAU); ctx.fill(); }
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
