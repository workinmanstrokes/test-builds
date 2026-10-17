// Pure game logic (no DOM): runs, loop generation, decisions, endings, save data. Unit-tested in tests/unit.mjs.
import { COMMON, byId } from './anomalies.js';
import { HALL_DEFAULT, CLASS_DEFAULT } from './scenes.js';
import { makeRng } from './sketch.js';

export const GOAL = 8;          // correct loops in a row to reach the final bell
export const MAX_MISSES = 12;   // the hallway keeps you: bad ending
export const ANOMALY_CHANCE = 0.58;
export const PASS_CHANCE = 0.07;
export const ENDINGS = {
  normal: { id: 'normal', title: 'The Final Bell', blurb: 'The bell finally rang. The doors opened onto a warm, ordinary afternoon.' },
  secret: { id: 'secret', title: 'The Ninth Period', blurb: 'You kept the golden hall pass. A door that was never there opened just for you.' },
  bad: { id: 'bad', title: 'Held Back', blurb: 'You missed too much. Room 8 has a seat with your name on it now.' },
};
export const SAVE_KEY = 'period8.save.v1';

export function defaultSave() {
  return { v: 1, seen: {}, endings: {}, best: 0, runs: 0, loopsTotal: 0, clipBest: 0, noAds: false,
    settings: { sound: true, scares: 'full', haptics: true, analytics: true, music: 0.8, sfx: 1, reduceFlash: false }, cosmetics: { light: 'warm' }, unlocks: [], warnedOver: false, ads: { day: '', count: 0, lastReward: 0, earned: 0 } };
}
export function loadSave(storage) {
  try { const d = JSON.parse(storage.getItem(SAVE_KEY)); if (d && d.v === 1) { const def = defaultSave(); return { ...def, ...d, settings: { ...def.settings, ...d.settings }, ads: { ...def.ads, ...d.ads }, cosmetics: { ...def.cosmetics, ...d.cosmetics } }; } } catch {}
  return defaultSave();
}
export function writeSave(storage, s) { try { storage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {} }

export function newRun(seed = (Math.random() * 2 ** 31) | 0) {
  return { seed, rng: makeRng(seed), streak: 0, loops: 0, misses: 0, pass: false, lostStreak: 0, keptThisMiss: false,
    recent: [], normalsInRow: 0, anomaliesInRow: 0, current: null, hintUsed: false, startedAt: Date.now(), ending: null, log: [] };
}
export const sceneFor = loops => (loops % 2 ? 'class' : 'hall');

// Level design (Exit-8-style mix): after the two "memorize this" loops, anomaly loops draw ~60% easy, ~20% hard and
// ~20% "game-over" showcase anomalies. Showcase ones only start at loop 5 (index 4); before that it's easy/hard only.
export const SHOWCASE_FROM = 4;
export const MIX = { early: { easy: 0.75, hard: 0.25, over: 0 }, main: { easy: 0.6, hard: 0.2, over: 0.2 } };
export function pickKind(rng, loops) {
  const m = loops < SHOWCASE_FROM ? MIX.early : MIX.main; let r = rng();
  for (const k of ['easy', 'hard', 'over']) { r -= m[k]; if (r < 0) return k; }
  return 'easy';
}
function pick(run, save, scene) {
  const rng = run.rng, kind = pickKind(rng, run.loops), fresh = a => a.scene === scene && !run.recent.includes(a.id);
  let pool = COMMON.filter(a => fresh(a) && a.kind === kind);
  if (!pool.length) pool = COMMON.filter(a => fresh(a) && (a.kind !== 'over' || run.loops >= SHOWCASE_FROM));
  const w = pool.map(a => (save.seen[a.id] ? 1 : 2.5)); // prefer anomalies this player hasn't seen yet
  let r = rng() * w.reduce((x, y) => x + y, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
/** Prepare the next loop: scene + anomaly (or null). Loops 0 and 1 are always normal so you can learn both rooms. */
export function nextLoop(run, save) {
  const scene = sceneFor(run.loops), rng = run.rng;
  let a = null;
  if (run.loops >= 2) {
    if (scene === 'hall' && !run.pass && run.streak >= 2 && rng() < PASS_CHANCE) a = byId.hall_pass;
    else {
      let p = ANOMALY_CHANCE; if (run.normalsInRow >= 2) p = 1; if (run.anomaliesInRow >= 3) p = 0;
      if (rng() < p) a = pick(run, save, scene);
    }
  }
  if (a) { run.recent.push(a.id); if (run.recent.length > 8) run.recent.shift(); run.anomaliesInRow++; run.normalsInRow = 0; }
  else { run.normalsInRow++; run.anomaliesInRow = 0; }
  run.hintUsed = false;
  run.current = { scene, anomaly: a ? a.id : null, startedAt: Date.now() };
  return run.current;
}
export function stateFor(cur) {
  const base = cur.scene === 'hall' ? HALL_DEFAULT : CLASS_DEFAULT;
  const a = cur.anomaly ? byId[cur.anomaly] : null;
  return { ...base, ...(a ? a.s : {}) };
}
/** choice: 'forward' (everything normal) or 'back' (something is wrong). */
export function decide(run, save, choice) {
  const cur = run.current, a = cur.anomaly ? byId[cur.anomaly] : null;
  const correct = a ? choice === 'back' : choice === 'forward';
  if (a) save.seen[a.id] = (save.seen[a.id] || 0) + 1;
  run.loops++; save.loopsTotal++;
  const res = { correct, kind: correct ? 'ok' : a ? 'missed' : 'false_alarm', anomaly: a, ending: null, streak: 0 };
  if (correct) {
    run.streak++; run.keptThisMiss = false;
    if (run.streak > save.best) save.best = Math.min(run.streak, GOAL);
    if (run.streak >= GOAL) res.ending = run.pass ? 'secret' : 'normal';
  } else {
    run.misses++; run.lostStreak = run.streak; run.keptThisMiss = false; run.streak = 0;
    if (run.misses >= MAX_MISSES) res.ending = 'bad';
  }
  res.streak = run.streak;
  run.log.push({ scene: cur.scene, anomaly: cur.anomaly, choice, correct, ms: Date.now() - cur.startedAt });
  if (res.ending) { run.ending = res.ending; save.endings[res.ending] = (save.endings[res.ending] || 0) + 1; save.runs++; }
  return res;
}
/** Rewarded "keep your streak": restores the streak you just lost (once per miss, only if it was worth keeping). */
export const canKeepStreak = run => !run.ending && run.lostStreak >= 2 && !run.keptThisMiss;
export function keepStreak(run) { if (!canKeepStreak(run)) return false; run.streak = run.lostStreak; run.keptThisMiss = true; return true; }
export function collectPass(run) { if (run.current?.anomaly !== 'hall_pass' || run.pass) return false; run.pass = true; return true; }
/** Is a tap (panorama x,y) inside an anomaly region (with padding, wrap-aware)? */
export function inRegion(region, x, y, pad = 30, W = 4000) {
  const [rx, ry, rw, rh] = region; let dx = x - rx; dx = ((dx % W) + W) % W; if (dx > W - pad) dx -= W;
  return dx >= -pad && dx <= rw + pad && y >= ry - pad && y <= ry + rh + pad;
}
