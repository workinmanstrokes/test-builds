// Aurie "looks": cosmetic body variants for the aura skin. Same r, same (0,0) centre anchor, same face.
const TAU = Math.PI * 2;
const blob = (ctx, r, t, wob = 0.05, n = 6) => { ctx.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, rr = r * (1 + wob * Math.sin(a * n + t * 3)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); };
const flame = (ctx, r, t) => { ctx.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, top = Math.max(0, -Math.sin(a)), fl = 1 + top * (0.45 + 0.12 * Math.sin(t * 9 + a * 3)); ctx.lineTo(Math.cos(a) * r * (1 - top * 0.25), Math.sin(a) * r * (a > Math.PI ? fl : 1)); } ctx.fill(); };
export const LOOKS = {
  frostbite: { name: 'Frostbite', glow: '#7fd8ff', stops: ['#ffffff', '#9be7ff', '#2f7bff'], shape: (c, r, t) => {
    c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - Math.PI / 2, rr = r * (i % 2 ? 0.98 : 1.14); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); } },
  toxic_drip: { name: 'Toxic Drip', glow: '#7dff3a', stops: ['#f4ffd6', '#9dff3a', '#1f9e3a'], shape: (c, r, t) => {
    blob(c, r, t, 0.03); for (const [x, l] of [[-0.5, 0.45], [0.05, 0.7], [0.55, 0.35]]) { const d = r * l * (0.85 + 0.15 * Math.sin(t * 2 + x * 9)); c.beginPath(); c.ellipse(r * x, r * 0.75 + d / 2, r * 0.11, d / 2 + r * 0.1, 0, 0, TAU); c.fill(); } } },
  void_glitch: { name: 'Void Glitch', glow: '#ff3df2', stops: ['#b8a6ff', '#4b2bbf', '#12052e'], shape: (c, r, t) => {
    blob(c, r, t, 0); const o = Math.sin(t * 13) > 0.6 ? r * 0.12 : 0; c.save(); c.globalAlpha = 0.55; c.fillStyle = '#33f0ff'; c.fillRect(-r + o, -r * 0.35, r * 2, r * 0.1); c.fillStyle = '#ff3df2'; c.fillRect(-r - o, r * 0.42, r * 2, r * 0.08); c.restore(); } },
  sunset_drip: { name: 'Golden Hour', glow: '#ff8fb1', stops: ['#fff3c4', '#ffb26b', '#e8437a'], shape: (c, r, t) => {
    flame(c, r, t); c.save(); c.fillStyle = '#1b1030'; c.beginPath(); c.roundRect(-r * 0.62, -r * 0.2, r * 0.52, r * 0.26, r * 0.08); c.roundRect(r * 0.1, -r * 0.2, r * 0.52, r * 0.26, r * 0.08); c.fill(); c.fillRect(-r * 0.12, -r * 0.14, r * 0.24, r * 0.06); c.restore(); }, noEyes: true },
  bubblegum: { name: 'Bubblegum', glow: '#ff7ad9', stops: ['#ffffff', '#ffb3e6', '#ff4fb8'], shape: (c, r, t) => {
    blob(c, r, t, 0.07, 3); c.save(); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-r * 0.45, -r * 0.55, r * 0.18, r * 0.1, -0.6, 0, TAU); c.fill(); c.restore(); } },
  storm_core: { name: 'Storm Core', glow: '#c9d6ff', stops: ['#ffffff', '#a9b8d9', '#3b4766'], shape: (c, r, t) => {
    blob(c, r, t, 0.09, 9); c.save(); c.strokeStyle = '#fff36b'; c.lineWidth = r * 0.06; c.lineJoin = 'round'; const k = Math.floor(t * 4) % 2 ? 1 : -1; c.beginPath(); c.moveTo(k * r * 0.2, -r * 1.05); c.lineTo(k * r * 0.45, -r * 0.7); c.lineTo(k * r * 0.25, -r * 0.65); c.lineTo(k * r * 0.5, -r * 0.35); c.stroke(); c.restore(); } },
};

// ---------------- Behaviours (v2) ----------------
// Hooks (all optional, all ctx-free except draw*):
//   look.idle(t)              -> {dx,dy,sx,sy,rot}  body transform every frame (cheap trig only)
//   look.react(k)             -> {dx,dy,sx,sy,rot}  body transform during the tap reaction, k = 0..1 over look.reactDur s
//   look.drawReact(ctx,r,k,t) -> extra strokes over the body during the reaction (cracks, arcs, sparkle)
//   look.onTap({x,y,r,combo,crit,rand}) -> { parts:[particle objects in fx.js shape + kind], ring?, flash?, shake? }
//   look.particle(ctx,p)      -> draw one particle (ctx already translated/rotated/alpha'd by fx)
//   look.float                -> {color,size,life,vy,prefix?,suffix?,jitter?}  style for the "+N" text
//   look.tapSound             -> partial override merged onto skin.sound.tap (existing tone() fields)
//   look.face                 -> {ink, shine} colours for drawFace
const P = (o) => ({ vx: 0, vy: 0, g: 320, rot: 0, vr: 0, life: 0.8, max: 0.8, size: 4, ...o });
const ring = (n, f) => Array.from({ length: n }, (_, i) => f(i / n * TAU, i));
const B = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
const ease = k => 1 - (1 - k) * (1 - k);
const BEH = {
  frostbite: {
    reactDur: 0.45, face: { ink: '#13234a', shine: '#fff' },
    idle: t => ({ ...B, rot: Math.sin(t * 0.7) * 0.06 }),                                  // slow crystalline sway
    react: k => ({ ...B, dx: Math.sin(k * 60) * 3 * (1 - k), sx: 1 + 0.04 * (1 - k), sy: 1 + 0.04 * (1 - k) }), // hard shiver, no squash
    drawReact(c, r, k) { c.save(); c.globalAlpha = 1 - k; c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.035; c.beginPath();
      for (const a of [-2.4, -0.6, 0.9, 2.2]) { c.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); c.lineTo(Math.cos(a + 0.2) * r * 0.65, Math.sin(a + 0.2) * r * 0.65); c.lineTo(Math.cos(a - 0.1) * r * 1.05, Math.sin(a - 0.1) * r * 1.05); } c.stroke(); c.restore(); },
    onTap: s => ({ parts: ring(6, (a, i) => P({ kind: 'flake', x: s.x + Math.cos(a) * s.r, y: s.y + Math.sin(a) * s.r, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140 - 40, g: 60, vr: 2, life: 1.1, max: 1.1, size: 6 + (i % 2) * 3, color: i % 2 ? '#ffffff' : '#9be7ff' })), ring: '#cfefff' }),
    particle(c, p) { c.strokeStyle = p.color; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI; c.moveTo(Math.cos(a) * p.size, Math.sin(a) * p.size); c.lineTo(-Math.cos(a) * p.size, -Math.sin(a) * p.size); } c.stroke(); },
    float: { color: '#dff6ff', size: 26, life: 1.0, vy: -60, suffix: '❄' },
    tapSound: { wave: 'sine', dur: 0.12, detune: 2 },                                       // glassy ping
  },
  toxic_drip: {
    reactDur: 0.55, face: { ink: '#12361a', shine: '#fff' },
    idle: t => ({ ...B, sy: 1 + Math.sin(t * 2.4) * 0.03, sx: 1 - Math.sin(t * 2.4) * 0.03, dy: Math.sin(t * 2.4) * 1.5 }), // gooey breathing
    react: k => { const w = Math.sin(k * 14) * (1 - k); return { ...B, sx: 1 + 0.22 * w, sy: 1 - 0.22 * w, dy: 6 * w }; }, // splat + wobble
    onTap: s => ({ parts: [...ring(7, (a, i) => P({ kind: 'drop', x: s.x, y: s.y + s.r * 0.6, vx: Math.cos(a) * 160, vy: -120 - (i % 3) * 60, g: 700, life: 0.9, max: 0.9, size: 5 + (i % 3) * 2, color: i % 2 ? '#9dff3a' : '#3ddc5a' })),
      ...ring(2, (a, i) => P({ kind: 'drop', x: s.x + (i ? 0.3 : -0.3) * s.r, y: s.y + s.r, vy: 30, g: 400, life: 0.9, max: 0.9, size: 6, color: '#7dff3a' }))] }),
    particle(c, p) { c.rotate(-p.rot + Math.atan2(p.vy, p.vx) - Math.PI / 2); const s = p.size; c.beginPath(); c.moveTo(0, -s * 1.8); c.quadraticCurveTo(s, 0, 0, s); c.quadraticCurveTo(-s, 0, 0, -s * 1.8); c.fill(); },
    float: { color: '#b6ff5c', size: 28, life: 1.1, vy: 40, prefix: '+' },                  // number DRIPS down
    tapSound: { wave: 'sine', dur: 0.14, detune: 30 },                                      // wet bloop
  },
  void_glitch: {
    reactDur: 0.35, face: { ink: '#e9fbff', shine: '#33f0ff' },                             // FIX: light eyes on dark body
    idle: t => ({ ...B, dx: (Math.sin(t * 31) > 0.97 ? 3 : 0) }),                          // rare 1-frame twitch
    react: k => ({ ...B, dx: k < 0.3 ? 9 * Math.sign(Math.sin(k * 80)) : 0, dy: k < 0.3 ? -4 : 0, sx: k < 0.15 ? 1.25 : 1, sy: k < 0.15 ? 0.7 : 1 }), // teleport hop
    drawReact(c, r, k) { if (k > 0.5) return; c.save(); c.globalAlpha = 0.7; for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#33f0ff' : '#ff3df2'; c.fillRect(-r * 1.2 + ((i * 37) % 20), -r + i * r * 0.5, r * (1.4 + (i % 2)), r * 0.09); } c.restore(); },
    onTap: s => ({ parts: ring(8, (a, i) => P({ kind: 'pixel', x: s.x + Math.cos(a) * s.r * 0.9, y: s.y + Math.sin(a) * s.r * 0.9, vx: Math.round(Math.cos(a)) * 180, vy: Math.round(Math.sin(a)) * 180, g: 0, life: 0.5, max: 0.5, size: 5, color: ['#33f0ff', '#ff3df2', '#ffffff'][i % 3] })), shake: 0.15 }),
    particle(c, p) { c.rotate(-p.rot); const s = p.size; c.fillRect(-s, -s, s * 2, s * 2); if (p.life > p.max * 0.5) c.fillRect(s * 1.5, -s * 0.5, s, s); },
    float: { color: '#33f0ff', size: 26, life: 0.7, vy: -130, jitter: 4, prefix: '+' },     // number jitters (fx: x += rand*jitter)
    tapSound: { wave: 'square', dur: 0.05, gain: 0.1, detune: 80 },                         // bitcrush blip
  },
  sunset_drip: {
    reactDur: 0.5, face: { ink: '#2a1030', shine: '#fff' },
    idle: t => ({ ...B, rot: Math.sin(t * 1.3) * 0.05, dy: Math.sin(t * 2.6) * 2 }),         // laid-back head bob
    react: k => ({ ...B, sx: 1 + 0.08 * Math.sin(k * Math.PI), sy: 1 + 0.08 * Math.sin(k * Math.PI), rot: -0.12 * Math.sin(k * Math.PI) }), // smug tilt
    drawReact(c, r, k) { const s = r * 0.35 * Math.sin(Math.min(1, k * 1.6) * Math.PI); if (s <= 0) return; c.save(); c.translate(r * 0.52, -r * 0.18); c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.2 : s; const a = i / 8 * TAU; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); c.restore(); }, // glint off the shades
    onTap: s => ({ parts: ring(5, (a, i) => P({ kind: 'spark', x: s.x + s.r * 0.5, y: s.y - s.r * 0.2, vx: Math.cos(a - 1) * 90, vy: Math.sin(a - 1) * 90 - 50, g: -20, life: 0.9, max: 0.9, size: 5 + (i % 2) * 3, color: i % 2 ? '#fff3c4' : '#ff8fb1' })), flash: '#ffd6a0' }),
    particle(c, p) { const s = p.size; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.25, 0); c.lineTo(0, s); c.lineTo(-s * 0.25, 0); c.moveTo(-s, 0); c.lineTo(0, s * 0.25); c.lineTo(s, 0); c.lineTo(0, -s * 0.25); c.fill(); },
    float: { color: '#ffd27a', size: 30, life: 1.0, vy: -80, suffix: ' ✨' },
    tapSound: { wave: 'triangle', dur: 0.16, detune: 0 },                                   // smooth chime
  },
  bubblegum: {
    reactDur: 0.6, face: { ink: '#4a0f33', shine: '#fff' },
    idle: t => ({ ...B, sx: 1 + Math.sin(t * 3) * 0.035, sy: 1 + Math.cos(t * 3) * 0.035 }), // jelly
    react: k => { const e = Math.sin(k * 18) * (1 - ease(k)); return { ...B, sx: 1 - 0.25 * e, sy: 1 + 0.3 * e, dy: -8 * e }; }, // big stretch + spring
    drawReact(c, r, k) { if (k > 0.45) return; const s = r * (0.15 + k * 0.9); c.save(); c.fillStyle = 'rgba(255,170,230,.65)'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(0, r * 0.32 + s * 0.6, s * 0.5, 0, TAU); c.fill(); c.stroke(); c.restore(); }, // bubble blows then pops
    onTap: s => ({ parts: ring(8, (a, i) => P({ kind: 'bubble', x: s.x, y: s.y + s.r * 0.6, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 30, g: -40, life: 0.9, max: 0.9, size: 3 + (i % 3) * 2, color: '#ffb3e6' })) }),
    particle(c, p) { c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, p.size, 0, TAU); c.globalAlpha *= 0.6; c.fill(); c.globalAlpha /= 0.6; c.stroke(); },
    float: { color: '#ff7ad9', size: 30, life: 0.9, vy: -100, suffix: '!' },
    tapSound: { wave: 'triangle', dur: 0.07, detune: 40 },                                  // pop
  },
  storm_core: {
    reactDur: 0.4, face: { ink: '#1c2236', shine: '#fff' },
    idle: t => ({ ...B, dx: Math.sin(t * 1.1) * 3, dy: Math.sin(t * 0.8) * 2 }),            // drifting cloud
    react: k => ({ ...B, sx: 1 + 0.1 * (1 - k), sy: 1 - 0.06 * (1 - k), dx: (k < 0.2 ? 2 : 0) }), // thunder puff
    drawReact(c, r, k) { if (k > 0.6) return; c.save(); c.strokeStyle = '#fff36b'; c.shadowColor = '#fff36b'; c.shadowBlur = 10; c.lineWidth = r * 0.06; c.lineJoin = 'round'; c.globalAlpha = 1 - k / 0.6;
      for (const sgn of [-1, 1]) { c.beginPath(); c.moveTo(sgn * r * 0.8, r * 0.2); let x = sgn * r * 0.8, y = r * 0.2; for (let i = 1; i <= 4; i++) { x += sgn * r * 0.35; y += (i % 2 ? -1 : 1) * r * 0.25; c.lineTo(x, y); } c.stroke(); } c.restore(); }, // twin arcs
    onTap: s => ({ parts: ring(6, (a, i) => P({ kind: 'bolt', x: s.x, y: s.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, rot: a + Math.PI / 2, g: 0, life: 0.35, max: 0.35, size: 7, color: i % 2 ? '#fff36b' : '#ffffff' })), flash: '#e8eeff', shake: 0.25 }),
    particle(c, p) { const s = p.size; c.strokeStyle = p.color; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, -s * 1.6); c.lineTo(s * 0.5, -s * 0.2); c.lineTo(-s * 0.4, s * 0.2); c.lineTo(0, s * 1.6); c.stroke(); },
    float: { color: '#fff36b', size: 28, life: 0.6, vy: -170, prefix: '⚡+' },
    tapSound: { wave: 'sawtooth', dur: 0.08, gain: 0.12, detune: 20 },                      // zap
  },
};
for (const k in BEH) Object.assign(LOOKS[k], BEH[k]);
LOOKS.void_glitch.shape = (c, r, t) => { blob(c, r, t, 0); }; // scanlines now come from idle/react overlay only
