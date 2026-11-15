// Anomaly sampler for Period 8 — without-replacement draws within a run, with an
// explicit clean-loop rate and tier ramp for loops 1-8.
//
// This formalises the rules that game.js already enforces ad hoc (run.recent,
// "no 3 normals in a row", "no 4 anomaly loops in a row", SHOWCASE_FROM = 4):
// loops are 1-based here. Loop 1 and 2 are the tutorial loops and are always
// clean. From loop 3 on, each loop draws at most one anomaly, and no anomaly
// id may appear twice in the same run. Tier 3 and 'over' (showcase) anomalies
// only enter the pool from loop 5 on, so the difficulty ramps instead of
// ambushing a new player with a pixel-hunt on loop 3.
//
// Clean-loop rate (explicit, per the tester fix list): the anomaly chance per
// loop is 0.50 on loops 3-4, 0.58 on loops 5-6 and 0.66 on loops 7-8, so the
// expected clean share falls from ~50% early to ~34% late. Two hard caps bound
// the randomness either way: never 3 clean loops in a row (the 3rd loop after
// two cleans is always an anomaly loop) and never 4 anomaly loops in a row
// (the 4th loop after three anomaly loops is always clean). game.js keeps the
// matching runtime guards (normalsInRow >= 2 forces an anomaly, anomaliesInRow
// >= 3 forces a clean loop); this module is the single source of truth for the
// numbers, and tests/sampler.test.mjs fails if a run ever repeats an anomaly.

export const TOTAL_LOOPS = 8;

// Per-loop plan, 1-based loop number. anomalyChance is the probability the
// loop contains an anomaly at all (before the hard caps below apply).
export const LOOP_PLAN = [
  { loop: 1, anomalyChance: 0,   maxTier: 0, allowOver: false, note: 'tutorial: memorise the hallway' },
  { loop: 2, anomalyChance: 0,   maxTier: 0, allowOver: false, note: 'tutorial: memorise Room 8' },
  { loop: 3, anomalyChance: 0.5, maxTier: 2, allowOver: false, note: 'tiers 1-2 only' },
  { loop: 4, anomalyChance: 0.5, maxTier: 2, allowOver: false, note: 'tiers 1-2 only' },
  { loop: 5, anomalyChance: 0.58, maxTier: 3, allowOver: true,  note: 'tier 3 + showcase enter' },
  { loop: 6, anomalyChance: 0.58, maxTier: 3, allowOver: true,  note: 'tier 3 + showcase enter' },
  { loop: 7, anomalyChance: 0.66, maxTier: 3, allowOver: true,  note: 'hardest mix' },
  { loop: 8, anomalyChance: 0.66, maxTier: 3, allowOver: true,  note: 'hardest mix' },
];

export const planForLoop = n => LOOP_PLAN[Math.min(Math.max(n, 1), TOTAL_LOOPS) - 1];

// Small deterministic RNG (mulberry32) so tests and the playtest log can replay
// an exact run from a seed. The game itself passes run.rng (see sketch.js).
export function makeSeededRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Without-replacement sampler: shuffles a copy of the pool once per run and
// deals from it, so an id can never repeat inside a run. draw() returns null
// when the pool is exhausted instead of re-dealing.
export function createSampler(pool, rng = Math.random) {
  const deck = [...pool];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  let at = 0;
  return {
    remaining: () => deck.length - at,
    draw: () => (at < deck.length ? deck[at++] : null),
  };
}

// Plan one full 8-loop run: for each loop, decide clean vs anomaly from the
// per-loop chance and the hard caps, then draw an anomaly that fits the loop's
// tier/over rules and has not been used yet this run. `pool` is the anomaly
// list (e.g. COMMON from anomalies.js); each entry needs { id, tier, kind }.
// The draw is without replacement: a picked card is removed from the
// remaining pool, so no id can appear twice in a run. Cards that do not fit
// this loop's tier/over rules stay in the pool for later loops.
// Returns [{ loop, anomaly }] with anomaly null for a clean loop.
export function drawRun(pool, rng = Math.random, loops = TOTAL_LOOPS) {
  const remaining = [...pool];
  const out = [];
  let cleanInRow = 0, anomalyInRow = 0;
  for (let loop = 1; loop <= loops; loop++) {
    const plan = planForLoop(loop);
    let isAnomaly;
    if (plan.anomalyChance === 0) isAnomaly = false;
    else if (cleanInRow >= 2) isAnomaly = true;      // never 3 clean loops in a row
    else if (anomalyInRow >= 3) isAnomaly = false;   // never 4 anomaly loops in a row
    else isAnomaly = rng() < plan.anomalyChance;
    let picked = null;
    if (isAnomaly) {
      const fitting = remaining.filter(a => a.tier <= plan.maxTier && (plan.allowOver || a.kind !== 'over'));
      if (fitting.length) {
        picked = fitting[Math.floor(rng() * fitting.length)];
        remaining.splice(remaining.indexOf(picked), 1);
        anomalyInRow++; cleanInRow = 0;
      } else { isAnomaly = false; } // nothing left that fits this loop's rules: clean loop
    }
    if (!isAnomaly) { cleanInRow++; anomalyInRow = 0; }
    out.push({ loop, anomaly: picked ? picked.id : null });
  }
  return out;
}

// Throws (and returns false) if any anomaly id repeats in a run. The unit
// test asserts this never happens; call it from game code in debug builds.
export function assertNoRepeat(draws) {
  const seen = new Set();
  for (const d of draws) {
    if (!d.anomaly) continue;
    if (seen.has(d.anomaly)) throw new Error(`sampler repeated anomaly ${d.anomaly} in one run`);
    seen.add(d.anomaly);
  }
  return true;
}
