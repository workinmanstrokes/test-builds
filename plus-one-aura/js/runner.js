// "+1 Speed Escape": pure runner logic (no DOM). A 3-lane escape run where speed rises +1 every second.
// Swipe or tap left/right to change lanes, dodge the walls, grab aura wisps. One rewarded revive per run.
// Cosmetic tie-ins only: the current skin, aura ring tier and halos are drawn on the runner, but no upgrade, halo,
// skin or purchase changes speed, hitboxes, spawns or revives (not pay-to-win). Aura earned goes to the main game.
export const RUN = {
  lanes: 3,
  startSpeed: 10,        // m/s at t = 0
  speedPerSec: 1,        // +1 speed every whole second (the hook)
  viewBase: 46, viewPerSpeed: 0.35,   // metres visible ahead: the window grows slower than speed, so it gets harder
  rowGapMin: 13, rowGapPerSpeed: 0.62, // metres between obstacle rows (>= ~0.6 s of reaction time at any speed)
  firstRowAt: 40,        // a short calm start
  wallLen: 3.2,          // obstacle depth (m)
  playerHalf: 0.9,       // player hit half-depth (m); lanes are exact
  laneTweenSec: 0.09,    // lane change animation; collision lane flips at the halfway point
  reviveInvulnSec: 2,    // grace after a revive
  reviveClearM: 30,      // walls removed ahead of the player on revive
  orbChance: 0.45,       // chance a row also carries an aura wisp in a free lane
  auraPerM: 0.1,         // aura reward = (dist * auraPerM + wisps * auraPerWisp) * value of one tap
  auraPerWisp: 3,
};

/** Speed at time t (seconds into the run): a +1 step every second. */
export const speedAt = (t, startSpeed = RUN.startSpeed) => startSpeed + RUN.speedPerSec * Math.floor(Math.max(0, t));
export const viewAhead = speed => RUN.viewBase + RUN.viewPerSpeed * speed;
export const rowGap = speed => Math.max(RUN.rowGapMin, RUN.rowGapPerSpeed * speed);

/** Small seeded PRNG (mulberry32) so runs and tests are reproducible. */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function newRun(seed = (Math.random() * 2 ** 32) >>> 0) {
  return {
    t: 0, speed: RUN.startSpeed, dist: 0, lane: 1, laneFrom: 1, laneK: 1, alive: true, revived: false, invuln: 0,
    obstacles: [], orbs: [], wisps: 0, nextRow: RUN.firstRowAt, lastFree: [0, 1, 2], seed, rnd: rng(seed), deaths: 0, events: [],
  };
}

/** The lane used for collisions: the target lane once the lane-change tween is past halfway. */
export const hitLane = r => (r.laneK >= 0.5 ? r.lane : r.laneFrom);
/** Visual lane position (float) for rendering. */
export const laneX = r => r.laneFrom + (r.lane - r.laneFrom) * Math.min(1, r.laneK);

export function move(r, dir) {
  if (!r.alive) return false;
  const to = Math.max(0, Math.min(RUN.lanes - 1, r.lane + Math.sign(dir)));
  if (to === r.lane) return false;
  r.laneFrom = Math.round(laneX(r)); r.lane = to; r.laneK = 0; return true;
}

/** Does a wall overlap the player? (same lane, depth ranges overlap) */
export function hits(r, o) {
  if (o.lane !== hitLane(r)) return false;
  return o.at - o.len / 2 < r.dist + RUN.playerHalf && o.at + o.len / 2 > r.dist - RUN.playerHalf;
}
export const collides = r => r.invuln <= 0 && r.obstacles.some(o => hits(r, o));

// A row blocks 1 or 2 lanes (never all 3) and always leaves a free lane next to (or equal to) a free lane of the
// previous row, so every run is escapable with lane-by-lane moves.
function spawnRow(r, at) {
  const R = r.rnd, lanes = [0, 1, 2];
  const early = r.speed < 16;
  let blocked = [];
  for (let tries = 0; ; tries++) {
    if (tries >= 20) { blocked = []; r.lastFree = [0, 1, 2]; break; } // safety: an empty row is always fair
    const n = !early && R() < 0.42 ? 2 : 1;
    const pool = lanes.slice(); blocked = [];
    for (let i = 0; i < n; i++) blocked.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    const free = lanes.filter(l => !blocked.includes(l));
    if (free.some(f => r.lastFree.some(p => Math.abs(p - f) <= 1))) { r.lastFree = free; break; }
  }
  if (r.log) r.log.push(blocked.slice());   // tests only
  for (const lane of blocked) r.obstacles.push({ lane, at, len: RUN.wallLen, kind: R() < 0.25 ? 'spike' : 'wall' });
  if (R() < RUN.orbChance) { const free = r.lastFree; r.orbs.push({ lane: free[Math.floor(R() * free.length)], at: at + rowGap(r.speed) / 2 }); }
}

/**
 * Advance the run by dt seconds. Returns events: 'speed' (each +1), 'wisp', 'dead'.
 * Physics: speed is constant within each second, distance += speed * dt.
 */
export function step(r, dt) {
  const ev = [];
  if (!r.alive) return ev;
  const before = r.speed;
  r.t += dt; r.speed = speedAt(r.t);
  if (r.speed > before) ev.push({ type: 'speed', speed: r.speed, gained: r.speed - before });
  r.dist += r.speed * dt;
  r.laneK = Math.min(1, r.laneK + dt / RUN.laneTweenSec);
  if (r.invuln > 0) r.invuln = Math.max(0, r.invuln - dt);
  const horizon = r.dist + viewAhead(r.speed) + 10;
  while (r.nextRow < horizon) { spawnRow(r, r.nextRow); r.nextRow += rowGap(r.speed); }
  for (let i = r.orbs.length - 1; i >= 0; i--) {
    const o = r.orbs[i];
    if (o.lane === hitLane(r) && Math.abs(o.at - r.dist) < 1.6) { r.orbs.splice(i, 1); r.wisps++; ev.push({ type: 'wisp', lane: o.lane }); }
    else if (o.at < r.dist - 5) r.orbs.splice(i, 1);
  }
  if (collides(r)) { r.alive = false; r.deaths++; ev.push({ type: 'dead', dist: r.dist, speed: r.speed }); }
  r.obstacles = r.obstacles.filter(o => o.at + o.len > r.dist - 6);
  return ev;
}

export const canRevive = r => !r.alive && !r.revived;
/** Rewarded revive (once per run): clear walls just ahead, short grace period, speed is kept. */
export function revive(r) {
  if (!canRevive(r)) return false;
  r.revived = true; r.alive = true; r.invuln = RUN.reviveInvulnSec;
  r.obstacles = r.obstacles.filter(o => o.at > r.dist + RUN.reviveClearM || o.at < r.dist - 6);
  return true;
}

/** Aura paid into the main game at the end of a run. tapValue = value of one tap (cosmetic tie-in: no gameplay effect). */
export const runAura = (r, tapValue = 1) => Math.max(0, Math.round((Math.floor(r.dist) * RUN.auraPerM + r.wisps * RUN.auraPerWisp) * Math.max(1, tapValue)));

/** Record keeping in the main save (s.escape). Returns { newBest }. */
export function recordRun(esc, r) {
  const d = Math.floor(r.dist), newBest = d > (esc.best || 0);
  esc.runs = (esc.runs || 0) + 1;
  if (newBest) esc.best = d;
  esc.bestSpeed = Math.max(esc.bestSpeed || 0, r.speed);
  esc.wisps = (esc.wisps || 0) + r.wisps;
  return { newBest };
}
