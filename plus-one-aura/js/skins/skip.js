// Skin "+1 Aura Skip": stone skipping. Pebb, an original flat pebble, skips across a lake. Each tap is a skip,
// the streak is the skip chain (slower, more forgiving rhythm), throwing too hard = SPLASH. Perfect Skips are more common.
const TAU = Math.PI * 2;
const stages = [
  { name: 'Mossy Pond', sky: ['#1d4a5a', '#6aa596'], water: ['#164652', '#0a252c'], accent: '#a8f0c6', glow: '#4fd1a5', text: '#effff7', particle: 'drop', colors: ['#d9fff0', '#9fe6d0', '#ffffff'], root: 62,
    stone: ['#c9c6bf', '#8d8a84', '#5e5b56'], bg: ['#1d4a5a', '#0a252c'] },
  { name: 'Dusk River', sky: ['#2a1640', '#e07a4a'], water: ['#3a1e3c', '#120a1c'], accent: '#ffb27a', glow: '#ff7a4a', text: '#fff2e8', particle: 'drop', colors: ['#ffd2b0', '#ff9e7a', '#ffffff'], root: 57,
    stone: ['#b9906c', '#7a5a42', '#4a3426'], band: '#f2efe6', bg: ['#2a1640', '#120a1c'] },
  { name: 'Moonlit Lake', sky: ['#040a22', '#1a2a5c'], water: ['#081436', '#020612'], accent: '#bfe3ff', glow: '#7fb6ff', text: '#eef6ff', particle: 'drop', colors: ['#eaf6ff', '#a9d4ff', '#fff6c2'], root: 65,
    stone: ['#f4fbff', '#bcd6f2', '#7c9cc8'], bg: ['#040a22', '#020612'] },
];
const ripples = []; let lastCombo = 0, lastLocked = false;
const horizon = h => h * 0.36;

export default {
  id: 'skip',
  name: '+1 Aura Skip',
  blurb: 'Stone skipping. Calm rhythm, long chains, big splashes.',
  tuning: { comboEvery: 12, heat: 0.85, window: 1.15, critBonus: 0.04 },
  text: {
    title: '+1 Aura Skip', subtitle: 'Skip to Ascend', currency: 'Ripples', perSec: 'ripples/s',
    tapHint: 'TAP TO SKIP', streak: 'SKIP CHAIN', overheat: 'SPLASH!', burst: 'PERFECT SKIP', heat: 'SPLASH RISK',
    mascot: 'Pebb',
    overheatMsg: (lost, cur) => `Pebb was thrown too hard and sank, losing your chain of <b>+${lost}</b> ${cur}.`,
    upgrades: {
      power: ['Flatter Stone', '+1 ripple per skip'],
      auto:  ['Lake Breeze', '+1 ripple every second, even offline'],
      combo: ['Wrist Flick', '+0.5 max chain multiplier'],
      cool:  ['Steady Arm', '9% less splash risk per skip'],
      crit:  ['Lucky Stone', '+3% chance of a x10 Perfect Skip'],
    },
    reward: { boost: '2x Ripples · 3 min', revive: 'Fish Pebb out & keep chain', skip: 'Skip to next lake', offline: 'Double it' },
    stageUnlock: n => `NEW WATERS: ${n}`, levelUp: L => `ARM LEVEL ${L}`,
  },
  stages,

  sound: {
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
    play(name, A, arg) {
      const st = A.stage, f = m => A.midi(A.root + m);
      const plink = (m, at = 0, g = 1) => {
        const fr = f(m); A.sweep(fr * 1.7, fr, { wave: st === 1 ? 'triangle' : 'sine', dur: 0.1, gain: 0.16 * g, at });
        A.noise({ dur: 0.03, gain: 0.05 * g, type: 'highpass', freq: 3500, at });
        if (st === 2) A.sweep(fr * 1.7, fr, { dur: 0.1, gain: 0.05 * g, at: at + 0.16 }); // moonlit echo
      };
      const sc = this.scale;
      switch (name) {
        case 'tap': { const k = Math.min(Math.floor(arg / 2), sc.length - 1); plink(sc[k] + 12); break; }
        case 'burst': plink(24); plink(31, 0.06); plink(36, 0.12, 0.7); break;
        case 'bank': A.sweep(f(0), f(12), { dur: 0.25, gain: 0.12 }); A.sweep(f(4), f(16), { dur: 0.25, gain: 0.08, at: 0.05 }); A.noise({ dur: 0.25, gain: 0.06, type: 'lowpass', freq: 900 }); break;
        case 'overheat': A.noise({ dur: 0.8, gain: 0.55, type: 'lowpass', freq: 3500, to: 250 }); A.sweep(260, 50, { dur: 0.5, gain: 0.18 }); for (let i = 0; i < 5; i++) A.sweep(f(12 + i * 3), f(i * 3), { dur: 0.08, gain: 0.05, at: 0.35 + i * 0.07 }); break;
        case 'unlock': [0, 4, 7, 12, 16, 19, 24].forEach((m, i) => plink(m + 12, i * 0.08)); break;
        case 'levelUp': A.tone(f(24), { dur: 0.5, gain: 0.07 }); A.tone(f(31), { dur: 0.5, gain: 0.05 }, 0.12); break;
        case 'buy': A.sweep(f(19), f(12), { dur: 0.07, gain: 0.08 }); break;
        default: return false;
      }
    },
  },

  drawBackground(ctx, w, h, si, t, o) {
    const st = stages[si], hz = horizon(h);
    let g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz + 1);
    g = ctx.createLinearGradient(0, hz, 0, h); g.addColorStop(0, st.water[0]); g.addColorStop(1, st.water[1]);
    ctx.fillStyle = g; ctx.fillRect(0, hz, w, h - hz);
    if (si === 0) { // treeline + lily pads
      ctx.fillStyle = '#123a3a'; ctx.beginPath(); ctx.moveTo(0, hz); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, hz - 18 - Math.abs(Math.sin(x * 0.07)) * 26); ctx.lineTo(w, hz); ctx.fill();
      for (let i = 0; i < 6; i++) { const x = (i * 131 + 40) % w, y = hz + 40 + (i * 97) % (h * 0.5); ctx.fillStyle = '#2f7d4f'; ctx.beginPath(); ctx.ellipse(x, y + Math.sin(t + i) * 2, 22, 8, 0, 0.3, TAU - 0.1); ctx.lineTo(x, y); ctx.fill(); }
    } else if (si === 1) { // sun on the horizon + flowing reflections
      const sg = ctx.createRadialGradient(w * .7, hz, 4, w * .7, hz, 60); sg.addColorStop(0, '#fff1c2'); sg.addColorStop(.4, '#ffb066'); sg.addColorStop(1, 'rgba(255,140,80,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(w * .7, hz, 60, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,110,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const y = hz + 6 + i * (h - hz) / 26, x = ((i * 53 + t * 40 * (1 + i * 0.05)) % (w + 120)) - 60, len = 20 + (i % 5) * 14; ctx.globalAlpha = 0.25 + 0.5 * (1 - i / 26); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else { // moon, stars, moon path, fireflies
      ctx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t + i * 1.7)); ctx.fillRect((i * 89.3) % w, (i * 41.7) % hz, 1.5, 1.5); }
      ctx.globalAlpha = 1; const mg = ctx.createRadialGradient(w * .28, hz * .45, 6, w * .28, hz * .45, 70); mg.addColorStop(0, '#fffbe6'); mg.addColorStop(.35, '#fff3c2'); mg.addColorStop(.4, 'rgba(200,220,255,.25)'); mg.addColorStop(1, 'rgba(120,160,255,0)'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(w * .28, hz * .45, 70, 0, TAU); ctx.fill();
      for (let i = 0; i < 30; i++) { const y = hz + 4 + i * (h - hz) / 30, half = 8 + i * 2.2 + Math.sin(t * 2 + i) * 6; ctx.globalAlpha = 0.5 * (1 - i / 34); ctx.fillStyle = '#fff3c2'; ctx.fillRect(w * .28 - half, y, half * 2, 2); }
      ctx.globalAlpha = 1; for (let i = 0; i < 9; i++) { const x = (w * 0.1 + i * w * 0.11 + Math.sin(t * .6 + i) * 30), y = hz - 20 + Math.sin(t * .9 + i * 2) * 26; ctx.fillStyle = `rgba(255,240,140,${0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
    }
    // skip ripples: each tap leaves a ripple further along the stone's path across the water
    const combo = o.combo || 0;
    if (combo > lastCombo) {
      const k = combo % 7, dir = Math.floor(combo / 7) % 2 ? -1 : 1;
      ripples.push({ x: o.target.x + dir * (k - 3) * w * 0.12, y: o.target.y + o.target.r * 0.9 + (k % 2) * 14 + 30 + k * 6, r: 6, life: 1.4 });
      ripples.push({ x: o.target.x, y: o.target.y + o.target.r * 0.55, r: o.target.r * 0.9, life: 0.8 });
    }
    if (o.locked && !lastLocked) for (let i = 0; i < 4; i++) ripples.push({ x: o.target.x, y: o.target.y + o.target.r * .4, r: 10 + i * 18, life: 1.6 + i * 0.2 });
    lastCombo = combo; lastLocked = o.locked;
    ctx.save(); ctx.strokeStyle = st.accent;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const p = ripples[i]; p.life -= o.dt; p.r += o.dt * 70; if (p.life <= 0) { ripples.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life) * 0.7; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.28, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.6, p.r * 0.17, 0, 0, TAU); ctx.stroke();
    }
    if (ripples.length > 60) ripples.splice(0, ripples.length - 60);
    ctx.restore();
  },

  drawTarget(ctx, x, y, r, si, t, o) {
    const st = stages[si], heat = o.heat / 100;
    const bob = Math.sin(t * 2) * r * 0.05, sink = o.locked ? r * 0.55 : 0, dip = o.squash * r * 0.12;
    const cy = y + bob + sink + dip, rx = r * 1.2, ry = r * 0.72;
    ctx.save();
    // glow + reflection
    const hg = ctx.createRadialGradient(x, cy, r * .3, x, cy, r * 2); hg.addColorStop(0, hexA(heat > .7 ? '#ff6a4a' : st.glow, .35)); hg.addColorStop(1, hexA(st.glow, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, cy, r * 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.25; ctx.fillStyle = st.stone[1]; ctx.beginPath(); ctx.ellipse(x, cy + ry * 1.55, rx * 0.95, ry * 0.45, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    // clip to above the waterline when sunk
    if (sink) { ctx.beginPath(); ctx.rect(x - rx * 2, cy - ry * 3, rx * 4, ry * 3 - sink * 0.2); ctx.clip(); }
    const g = ctx.createRadialGradient(x - rx * .35, cy - ry * .45, r * .1, x, cy, rx * 1.1);
    g.addColorStop(0, st.stone[0]); g.addColorStop(.6, st.stone[1]); g.addColorStop(1, st.stone[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, Math.sin(t * 1.3) * 0.04, 0, TAU); ctx.fill();
    if (st.band) { ctx.save(); ctx.clip(); ctx.strokeStyle = st.band; ctx.lineWidth = r * .12; ctx.globalAlpha = .8; ctx.beginPath(); ctx.ellipse(x, cy + ry * .1, rx * 1.1, ry * .35, -0.25, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.restore(); }
    if (si === 2) { ctx.globalCompositeOperation = 'lighter'; const ir = ctx.createLinearGradient(x - rx, cy, x + rx, cy); ir.addColorStop(0, `hsla(${(t * 40) % 360},80%,70%,.25)`); ir.addColorStop(1, `hsla(${(t * 40 + 120) % 360},80%,70%,.25)`); ctx.fillStyle = ir; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    if (heat > .05) { ctx.fillStyle = `rgba(255,60,30,${heat * .35})`; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, TAU); ctx.fill(); }
    // Pebb's face
    const ey = cy - ry * .1, blink = (t % 3.3) < .12 || o.locked;
    ctx.fillStyle = '#1e2430'; ctx.strokeStyle = '#1e2430'; ctx.lineWidth = r * .06; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); if (blink) { ctx.moveTo(x + s * r * .32 - r * .08, ey); ctx.lineTo(x + s * r * .32 + r * .08, ey); ctx.stroke(); } else { ctx.ellipse(x + s * r * .32, ey, r * .07, r * (.1 + o.squash * .04), 0, 0, TAU); ctx.fill(); } }
    ctx.beginPath(); if (heat > .7) { ctx.moveTo(x - r * .12, ey + r * .24); ctx.lineTo(x + r * .12, ey + r * .24); } else ctx.arc(x, ey + r * .12, r * .1, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
    ctx.restore();
    if (o.locked) { ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 6; i++) { const bx = x + Math.sin(t * 3 + i) * r * .5, by = cy - ((t * 60 + i * 30) % (r * 1.4)); ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 3), 0, TAU); ctx.fill(); } }
  },

  drawParticle(ctx, p) {
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.amb ? 0.5 : 1); ctx.fillStyle = p.color; ctx.translate(p.x, p.y);
    const s = p.size; ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -s * 1.8); ctx.quadraticCurveTo(s * 1.1, s * .2, 0, s); ctx.quadraticCurveTo(-s * 1.1, s * .2, 0, -s * 1.8); ctx.fill();
    ctx.restore();
  },
  ambient(si) { return [{ vy: -8, vx: 10 }, { vy: -5, vx: -14 }, { vy: -10, vx: 3 }][si]; },
};
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
