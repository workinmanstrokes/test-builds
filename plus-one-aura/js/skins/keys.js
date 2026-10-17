// Skin "+1 Keys": keyboard ASMR. Kappy the keycap; every press types the next letter of a word and finishing
// a word pays a bonus. Stage = keyboard build (membrane -> clicky -> custom thock board). All sounds synthesized.
const TAU = Math.PI * 2;
const WORDS = ['CLICK', 'THOCK', 'CLACK', 'SHIFT', 'ENTER', 'SPACE', 'TYPED', 'CRISP', 'SWIFT', 'MACRO', 'LUBED', 'KEYUP'];
const stages = [
  { name: 'Office Membrane', bg: ['#3a2f25', '#17120d'], accent: '#ffd08a', glow: '#c98a3a', text: '#fff1dc', particle: 'cap', colors: ['#efe6d2', '#cfc3a8', '#ffd08a'], root: 55,
    cap: ['#f1ead9', '#cfc4ab', '#a99d83'], legend: '#5b4f3c' },
  { name: 'Clicky Blues', bg: ['#0b1838', '#03060f'], accent: '#5aa8ff', glow: '#2f6bff', text: '#e5f0ff', particle: 'cap', colors: ['#5aa8ff', '#9cc9ff', '#ffffff'], root: 60,
    cap: ['#2a4fb0', '#1b3478', '#10214d'], legend: '#d8e8ff' },
  { name: 'RGB Custom', bg: ['#111018', '#000000'], accent: '#ff5ad1', glow: '#7a5cff', text: '#ffffff', particle: 'cap', colors: ['#ff5ad1', '#5affd6', '#ffe45a', '#5a8bff'], root: 50,
    cap: ['rgba(240,240,255,.55)', 'rgba(200,200,230,.45)', 'rgba(150,150,190,.5)'], legend: '#ffffff' },
];
const flashes = new Array(48).fill(0); let lastCombo = 0;

export default {
  id: 'keys',
  name: '+1 Keys',
  blurb: 'Keyboard ASMR. Type words, chase the perfect thock.',
  tuning: { comboEvery: 8, heat: 1.1, window: 0.7, chainEvery: 5, chainBonus: 3 },
  text: {
    title: '+1 Keys', subtitle: 'Type to Ascend', currency: 'Clicks', perSec: 'clicks/s',
    tapHint: 'PRESS THE KEY', streak: 'TYPING STREAK', overheat: 'KEY JAM!', burst: 'CRITICAL CLACK', heat: 'JAM',
    mascot: 'Kappy',
    overheatMsg: (lost, cur) => `Kappy jammed from button-mashing and dropped your streak of <b>+${lost}</b> ${cur}.`,
    chain: (n) => `${WORDS[(n - 1) % WORDS.length]}!`,
    upgrades: {
      power: ['Heavier Springs', '+1 click per press'],
      auto:  ['Macro Key', '+1 click every second, even offline'],
      combo: ['Touch Typing', '+0.5 max streak multiplier'],
      cool:  ['Lubed Switches', 'Jams 9% slower per press'],
      crit:  ['Golden Keycap', '+3% chance of a x10 Critical Clack'],
    },
    reward: { boost: '2x Clicks · 3 min', revive: 'Unjam & keep streak', skip: 'Skip to next board', offline: 'Double it' },
    stageUnlock: n => `NEW BOARD: ${n}`, levelUp: L => `WPM LEVEL ${L}`,
  },
  stages,

  sound: {
    play(name, A, arg) {
      const st = A.stage, v = () => 0.9 + Math.random() * 0.2;
      const clack = (at = 0, g = 1) => {
        if (st === 0) { A.noise({ dur: 0.035, gain: 0.28 * g, type: 'lowpass', freq: 1700 * v(), at }); A.tone(150 * v(), { dur: 0.05, gain: 0.1 * g }, at); }
        else if (st === 1) { A.noise({ dur: 0.012, gain: 0.4 * g, type: 'highpass', freq: 5000 * v(), at }); A.noise({ dur: 0.04, gain: 0.22 * g, type: 'bandpass', freq: 2600 * v(), q: 2, at: at + 0.012 }); A.tone(190 * v(), { dur: 0.05, gain: 0.08 * g }, at); }
        else { A.noise({ dur: 0.06, gain: 0.34 * g, type: 'lowpass', freq: 850 * v(), at }); A.tone(92 * v(), { dur: 0.09, gain: 0.2 * g }, at); A.noise({ dur: 0.02, gain: 0.08 * g, type: 'bandpass', freq: 1600, q: 3, at }); }
      };
      const bell = (at = 0) => { A.tone(2093, { dur: 0.5, gain: 0.08 }, at); A.tone(3136, { dur: 0.35, gain: 0.05 }, at); };
      switch (name) {
        case 'tap': clack(0, 1); break;
        case 'burst': clack(0, 1.3); clack(0.05, 1.1); bell(0.08); break;
        case 'chain': bell(); break;
        case 'bank': A.noise({ dur: 0.1, gain: 0.45, type: 'lowpass', freq: 600 }); A.tone(80, { dur: 0.12, gain: 0.2 }); bell(0.06); break;
        case 'overheat': for (let i = 0; i < 9; i++) clack(i * 0.035, 1 - i * 0.09); A.sweep(320, 55, { wave: 'sawtooth', dur: 0.5, gain: 0.08, at: 0.1 }); break;
        case 'unlock': for (let i = 0; i < 10; i++) clack(i * 0.05, 0.8); bell(0.55); A.tone(2637, { dur: 0.5, gain: 0.06 }, 0.62); break;
        case 'levelUp': bell(); bell(0.14); break;
        case 'buy': clack(0, 0.7); A.tone(1320, { dur: 0.08, gain: 0.05 }, 0.03); break;
        default: return false;
      }
    },
  },

  drawBackground(ctx, w, h, si, t, o) {
    const st = stages[si];
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, st.bg[0]); g.addColorStop(1, st.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (si === 0) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (let y = 20; y < h; y += 34) { ctx.beginPath(); ctx.moveTo(0, y + Math.sin(y) * 6); ctx.bezierCurveTo(w * .3, y + 10, w * .6, y - 8, w, y + 4); ctx.stroke(); } }
    if (si === 1) { const r = ctx.createRadialGradient(w / 2, h * .8, 10, w / 2, h * .8, w * .9); r.addColorStop(0, 'rgba(47,107,255,.35)'); r.addColorStop(1, 'rgba(47,107,255,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, w, h); }
    // mini keyboard in perspective; a random key lights up on every press
    if ((o.combo || 0) > lastCombo) flashes[(Math.random() * flashes.length) | 0] = 1;
    lastCombo = o.combo || 0;
    const top = h * 0.66, rows = 4, cols = 12;
    ctx.save();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c; flashes[k] = Math.max(0, flashes[k] - o.dt * 3);
      const p = (r + 1) / rows, rowW = w * (0.75 + p * 0.45), kw = rowW / cols, x0 = (w - rowW) / 2 + c * kw, y = top + Math.pow(p, 1.3) * h * 0.22, kh = kw * (0.55 + p * 0.25);
      let fill = si === 0 ? '#cfc4ab' : si === 1 ? '#1b3478' : `hsl(${(c * 24 + r * 30 + t * 90) % 360},90%,${45 + flashes[k] * 30}%)`;
      ctx.globalAlpha = 0.35 + p * 0.35 + flashes[k] * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, x0 + 2, y + 3 + flashes[k] * 2, kw - 4, kh, 4); ctx.fill();
      ctx.fillStyle = flashes[k] > 0 && si !== 2 ? st.accent : fill; rr(ctx, x0 + 2, y + flashes[k] * 2, kw - 4, kh - 3, 4); ctx.fill();
    }
    ctx.restore();
  },

  drawTarget(ctx, x, y, r, si, t, o) {
    const st = stages[si], heat = o.heat / 100, travel = r * 0.16 * Math.min(1, o.squash * 1.5) + (o.locked ? r * 0.12 : 0);
    const W = r * 2.1, H = r * 1.9;
    ctx.save(); ctx.translate(x, y);
    if (si === 2) { ctx.save(); const hue = (t * 80) % 360; ctx.shadowColor = `hsl(${hue},100%,60%)`; ctx.shadowBlur = 50 + o.squash * 40; ctx.fillStyle = `hsla(${hue},100%,60%,.5)`; rr(ctx, -W / 2, -H / 2 + r * .2, W, H, r * .3); ctx.fill(); ctx.restore(); }
    else { const hg = ctx.createRadialGradient(0, r * .3, r * .5, 0, r * .3, r * 2); hg.addColorStop(0, hexA(st.glow, .35 + o.squash * .3)); hg.addColorStop(1, hexA(st.glow, 0)); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, r * .3, r * 2, 0, TAU); ctx.fill(); }
    // switch housing + skirt
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, -W / 2 - 6, -H / 2 + r * .32, W + 12, H, r * .32); ctx.fill();
    ctx.fillStyle = st.cap[2]; rr(ctx, -W / 2, -H / 2 + r * .2 + travel * .3, W, H, r * .3); ctx.fill();
    // sculpted top face, pushed down by travel
    const tw = W * 0.78, th = H * 0.7, ty = -H / 2 + travel;
    const fg = ctx.createLinearGradient(0, ty, 0, ty + th); fg.addColorStop(0, st.cap[0]); fg.addColorStop(1, st.cap[1]);
    ctx.fillStyle = fg; rr(ctx, -tw / 2, ty, tw, th, r * .22); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; rr(ctx, -tw / 2 + 3, ty + 3, tw - 6, th - 6, r * .2); ctx.stroke();
    if (heat > 0.05) { ctx.fillStyle = `rgba(255,40,20,${heat * .4})`; rr(ctx, -tw / 2, ty, tw, th, r * .22); ctx.fill(); }
    // legend
    ctx.fillStyle = st.legend; ctx.font = `900 ${r * .62}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (si === 2) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; }
    ctx.fillText('+1', 0, ty + th * .38); ctx.shadowBlur = 0;
    // Kappy's face
    const ey = ty + th * .74, blink = (t % 4.1) < .12 || o.locked;
    ctx.fillStyle = st.legend; ctx.strokeStyle = st.legend; ctx.lineWidth = r * .06; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); if (blink) { ctx.moveTo(s * r * .3 - r * .08, ey); ctx.lineTo(s * r * .3 + r * .08, ey); ctx.stroke(); } else if (heat > .7) { ctx.moveTo(s * r * .3 - r * .08, ey - r * .06); ctx.lineTo(s * r * .3 + r * .08, ey + r * .06); ctx.moveTo(s * r * .3 + r * .08, ey - r * .06); ctx.lineTo(s * r * .3 - r * .08, ey + r * .06); ctx.stroke(); } else { ctx.arc(s * r * .3, ey, r * .07, 0, TAU); ctx.fill(); } }
    ctx.beginPath(); ctx.arc(0, ey + r * .02, r * .08, .1 * Math.PI, .9 * Math.PI); ctx.stroke();
    ctx.restore();
  },

  // current word above the key: typed letters light up
  drawOverlay(ctx, w, h, si, t, o) {
    const st = stages[si], every = 5, n = o.combo || 0, word = WORDS[Math.floor(n / every) % WORDS.length], typed = n % every;
    const bx = 34, gap = 6, total = word.length * bx + (word.length - 1) * gap, x0 = w / 2 - total / 2, y = o.target.y - o.target.r * 1.95;
    ctx.save(); ctx.font = '900 20px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < word.length; i++) {
      const x = x0 + i * (bx + gap), on = i < typed;
      ctx.globalAlpha = n ? 1 : 0.45;
      ctx.fillStyle = on ? st.accent : 'rgba(0,0,0,.45)'; rr(ctx, x, y - 18, bx, 36, 7); ctx.fill();
      ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; rr(ctx, x, y - 18, bx, 36, 7); ctx.stroke();
      ctx.fillStyle = on ? '#111' : 'rgba(255,255,255,.7)'; ctx.fillText(word[i], x + bx / 2, y + 1);
    }
    ctx.restore();
  },

  drawParticle(ctx, p, si) {
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.3);
    const s = p.size * 2.2;
    if (p.amb) { ctx.fillStyle = p.color; ctx.fillRect(-1, -1, 2, 2); ctx.restore(); return; }
    ctx.fillStyle = p.color; rr(ctx, -s / 2, -s / 2, s, s, s * .22); ctx.fill();
    ctx.fillStyle = si === 1 ? '#0b1838' : '#222'; ctx.font = `800 ${s * .62}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ABCDEFGHJKLMNPRSTUWXYZ+1'[Math.floor(Math.abs(p.vr) * 100) % 24], 0, s * .04);
    ctx.restore();
  },
  ambient(si) { return [{ vy: -12, vx: 4 }, { vy: -18, vx: 0 }, { vy: -25, vx: 6 }][si]; },
};

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
