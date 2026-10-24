// Aurie cosmetics glue: look registry, unlock rules, the in-game body renderer and gallery card renderer.
// Kid-safe by design: everything unlocks through play (stage, taps, total aura, golden taps). No paid gates, no timers.
import { LOOKS } from './looks.js';
import { HATS, FACES, TRAILS, GOLDEN } from './accessories.js';
export { LOOKS, HATS, FACES, TRAILS, GOLDEN };
const TAU = Math.PI * 2;
const flame = (c, r, t) => { c.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, top = Math.max(0, -Math.sin(a)), fl = 1 + top * (0.45 + 0.12 * Math.sin(t * 9 + a * 3)); c.lineTo(Math.cos(a) * r * (1 - top * .25), Math.sin(a) * r * (a > Math.PI ? fl : 1)); } c.fill(); };
// 'aurie' = the classic look (null in saves); 'golden' = permanent gold look earned by finding a golden tap.
export const ALL = {
  aurie: { name: 'Aurie', glow: '#ff7a1a', stops: ['#fff6d6', '#ffb347', '#ff4d12'], shape: flame, face: { ink: '#2a1030', shine: '#fff' } },
  ...LOOKS,
  golden: { name: 'Golden Aurie', glow: '#ffd23f', stops: GOLDEN.stops, shape: flame, face: { ink: '#5a3200', shine: '#fff' }, idle: t => ({ dx: 0, dy: Math.sin(t * 2) * 2, sx: 1, sy: 1, rot: 0 }), float: { color: '#ffd23f', size: 28, life: 1, vy: -100, prefix: '+' } },
};
// stage unlocks use the best floor ever reached so Ascend never re-locks a look
import { themeOf } from '../game.js';
const st = (s, n) => Math.max(s.stage || 0, themeOf(s.best?.floor || 0)) >= n, taps = (s, n) => s.taps >= n, ever = (s, n) => (s.ever || 0) >= n, gold = s => (s.cos?.golden || 0) > 0;
export const UNLOCK = {
  look: { aurie: [() => true, ''], frostbite: [s => taps(s, 100), '100 taps'], bubblegum: [s => taps(s, 500), '500 taps'], toxic_drip: [s => st(s, 1), 'Reach stage 2'],
    sunset_drip: [s => taps(s, 2000), '2,000 taps'], void_glitch: [s => st(s, 2), 'Reach stage 3'], storm_core: [s => taps(s, 10000), '10,000 taps'], golden: [gold, 'Find a golden tap'] },
  hat: { beanie: [s => st(s, 1), HATS.beanie.unlock], propeller: [s => taps(s, 1000), HATS.propeller.unlock], flowers: [s => ever(s, 5000), HATS.flowers.unlock],
    tophat: [s => st(s, 2), HATS.tophat.unlock], party: [s => taps(s, 5000), HATS.party.unlock], headphones: [s => ever(s, 50000), HATS.headphones.unlock] },
  face: { joy: [() => true, ''], starstruck: [s => taps(s, 200), '200 taps'], sleepy: [s => st(s, 1), 'Reach stage 2'], silly: [s => taps(s, 2000), '2,000 taps'] },
  trail: { hearts: [s => taps(s, 300), '300 taps'], stars: [s => st(s, 1), 'Reach stage 2'], confetti: [s => taps(s, 3000), '3,000 taps'], rainbow: [gold, 'Find a golden tap'] },
};
export const REG = { look: ALL, hat: HATS, face: FACES, trail: TRAILS };
export const unlocked = (kind, id, s) => !!UNLOCK[kind][id]?.[0](s);
export const hint = (kind, id) => UNLOCK[kind][id]?.[1] || '';
export const lookOf = s => (s.cos?.look && ALL[s.cos.look] && unlocked('look', s.cos.look, s)) ? ALL[s.cos.look] : null;

// In-game body: used by aura.js drawTarget when a look or golden tap is active. o.T = body transform from fx,
// o.goldK = golden reaction 0..1 (or null), o.reactK = look reaction 0..1 (or null). drawFace = aura.js face (heat/blink aware).
export function drawBody(ctx, r, t, o, L, drawFace) {
  const golden = o.goldK != null; if (golden) { L = { ...L, glow: GOLDEN.glow, stops: GOLDEN.stops }; GOLDEN.drawRays(ctx, r, o.goldK, t); }
  const T = o.T; if (T) { ctx.translate(T.dx, T.dy); ctx.rotate(T.rot); ctx.scale(T.sx, T.sy); }
  const heat = (o.heat || 0) / 100;
  const hg = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.1); hg.addColorStop(0, (heat > 0.7 ? '#ff3b2f' : L.glow) + '8c'); hg.addColorStop(1, L.glow + '00');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.fill();
  const b = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1); L.stops.forEach((c, i) => b.addColorStop([0, 0.45, 1][i], c));
  ctx.fillStyle = b; L.shape(ctx, r, t);
  if (heat > 0.05) { const h2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r); h2.addColorStop(0, `rgba(255,40,20,${heat * 0.45})`); h2.addColorStop(1, 'rgba(255,40,20,0)'); ctx.fillStyle = h2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); }
  drawFaceLayer(ctx, r, t, o, L, drawFace, golden);
  if (!golden && o.reactK != null && L.drawReact) L.drawReact(ctx, r, o.reactK, t);
  if (o.hat && HATS[o.hat]) HATS[o.hat].draw(ctx, r, t);
}
export function drawFaceLayer(ctx, r, t, o, L, drawFace, golden) {
  if (golden) return GOLDEN.face(ctx, r, t);
  const ink = L?.face?.ink || '#2a1030', shine = L?.face?.shine || '#fff';
  if (o.face && FACES[o.face] && !o.locked && (o.heat || 0) < 70) return FACES[o.face].draw(ctx, r, t, ink);
  if (L?.noEyes && !o.locked) return drawFace(ctx, r, t, { ...o, ink, shine, mouthOnly: true });
  drawFace(ctx, r, t, { ...o, ink, shine });
}
// Gallery card / preview (no heat, idle pose).
export function drawCard(ctx, x, y, r, t, { look = 'aurie', hat = null, face = null, silhouette = false } = {}, drawFace) {
  const L = ALL[look] || ALL.aurie; ctx.save(); ctx.translate(x, y);
  if (silhouette) { ctx.fillStyle = '#1c1530'; L.shape(ctx, r, t); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `900 ${r * 0.8}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, r * 0.05); ctx.restore(); return; }
  drawBody(ctx, r, t, { heat: 0, squash: 0, hat, face, T: null, goldK: null, reactK: null }, L, drawFace); ctx.restore();
}
