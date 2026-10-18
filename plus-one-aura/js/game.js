// Pure game logic for +1 Aura (no DOM). Unit-tested in tests/unit.mjs and tests/balance.mjs.
// Economy = deepthinker's character-upgrades plan §3.1 (docs/DESIGN.md). Every tap = (1 + Tap Power) x Glow-Up x Halos x boost.
// Fast taps build a streak; with Rizz Combo, a 20+ streak pays x1.5 into a "streak pot" that banks when you ease off.
// Tap too hard and you OVERHEAT: the pot is lost and tapping locks briefly, unless you revive (rewarded ad).
// Progress is a 9-floor tower: each wall shows its aura requirement; a new theme (skin stage) every 3rd floor.

export const SAVE_KEY = 'plus1aura.save.v1';   // key kept; the data version inside is 2 (v1 saves migrate)
export const COMBO_WINDOW = 0.9;   // s without a tap before the streak ends and the pot banks (+0.1 s per Rizz level)
export const OVERHEAT_LOCK = 4;    // s tapping is locked after an overheat
const HEAT_PER_TAP = 2.4, HEAT_DECAY = 14;

// Upgrade tree (plan §3.1). cost = round(base x growth^owned). No stat power is sold: these are bought with aura only.
export const UPGRADES = {
  tap:   { base: 100,  growth: 1.45, max: 30 }, // +1 aura per tap
  farm:  { base: 400,  growth: 1.40, max: 30 }, // +2 aura/s auto; x2 at Lv10 and Lv25
  glow:  { base: 4000, growth: 2.0,  max: 30 }, // x(1 + 0.25 L) to all aura
  rizz:  { base: 250,  growth: 1.6,  max: 10 }, // streak window +0.1 s; 20+ streak pays x1.5
  lucky: { base: 600,  growth: 1.7,  max: 15 }, // +1% chance of a x10 crit tap
};
export const UP_IDS = Object.keys(UPGRADES);
export const HALO_UNIT = 1e6;      // Halos = floor(sqrt(lifetime aura / 1e6)); +10% all aura each

// Tower walls: lifetime aura (this ascension) needed to reach each floor. Tuned with tests/balance.mjs so that a
// 3 taps/s player reaches wall 1 in ~20 s and each later wall takes ~1.75x longer than the previous (plan: 1.5-2x).
export const FLOOR_REQ = [0, 60, 230, 900, 3000, 8700, 25000, 70000, 240000];
export const FLOORS = FLOOR_REQ.length;          // 9 floors = 3 themes x 3
export const FLOORS_PER_THEME = 3;
export const themeOf = floor => Math.min(2, Math.floor(floor / FLOORS_PER_THEME));
// One twist per theme (introduced on floors 3 and 6): golden wisps to catch, then a perfect-timing pulse.
export const TWIST = { wisps: 3, pulse: 6 };
export const hasTwist = (s, k) => s.floor >= TWIST[k];
export const PULSE_PERIOD = 4, PULSE_WINDOW = 0.18, PULSE_MULT = 3;

export function newState(now = Date.now()) {
  return {
    v: 2, aura: 0, lifetime: 0, ever: 0, taps: 0, level: 1,
    floor: 0, stage: 0, curStage: 0, skipped: [],
    up: { tap: 0, farm: 0, glow: 0, rizz: 0, lucky: 0 },
    halos: 0, ascends: 0,
    boostUntil: 0, installedAt: now, lastSeen: now, lastDayLogged: 0, dailyDay: -1,
    ads: { day: '', count: 0, lastReward: 0, earned: 0, last: {} },
    settings: { sound: true, vibe: true, analytics: true, sfx: 0.8, reduceMotion: false, bigText: false },
    flags: { shop: false }, skin: null, noAds: false, best: { combo: 0, floor: 0 },
    escape: { best: 0, bestSpeed: 0, runs: 0, wisps: 0 },   // +1 Speed Escape records (kept through Ascend)
    rt: freshRuntime(),
  };
}
const freshRuntime = () => ({ heat: 0, combo: 0, pot: 0, sinceTap: 99, lockUntil: 0, lostPot: 0, overheatAt: 0, now: 0, tune: {} });

// Per-skin mechanics flavour (set by the UI from skin.tuning). Skin perks only amplify upgrades the player already
// owns (streak/chain need Rizz Lv1, critBonus needs Lucky Lv1), so the base pacing is identical in every skin.
//   heat: x heat per tap · comboEvery: streak taps per step (20+ streak = 2 x comboEvery/10 x 10) · window: base streak window
//   critBonus: extra crit chance · chainEvery/chainBonus: every N streak taps pay base x chainBonus (e.g. a typed word)
export function setTuning(s, tune) { s.rt.tune = tune || {}; }
const T = (s, k, d) => (s.rt.tune && s.rt.tune[k] != null ? s.rt.tune[k] : d);

export function upgradeCost(id, lvl) { const u = UPGRADES[id]; return Math.round(u.base * Math.pow(u.growth, lvl)); }
export function canBuy(s, id) { return s.up[id] < UPGRADES[id].max && s.aura >= upgradeCost(id, s.up[id]); }
export function buy(s, id) { if (!canBuy(s, id)) return false; s.aura -= upgradeCost(id, s.up[id]); s.up[id]++; return true; }
/** Rewarded "free next upgrade": the cheapest upgrade that isn't maxed, at no cost. Returns its id. */
export function freeUpgrade(s) {
  let best = null;
  for (const id of UP_IDS) if (s.up[id] < UPGRADES[id].max && (!best || upgradeCost(id, s.up[id]) < upgradeCost(best, s.up[best]))) best = id;
  if (best) s.up[best]++;
  return best;
}

export const farmRate = L => 2 * L * (L >= 10 ? 2 : 1) * (L >= 25 ? 2 : 1);
export const glowMult = s => 1 + 0.25 * s.up.glow;
export const haloMult = s => 1 + 0.1 * s.halos;
export const boostMult = (s, now) => (s.boostUntil > now ? 2 : 1);
export const allMult = (s, now) => glowMult(s) * haloMult(s) * boostMult(s, now);
export const basePerTap = (s, now) => (1 + s.up.tap) * allMult(s, now);
export const autoPerSec = (s, now) => farmRate(s.up.farm) * allMult(s, now);
export const comboNeed = s => 2 * T(s, 'comboEvery', 10);
export const comboMult = s => (s.up.rizz > 0 && s.rt.combo >= comboNeed(s) ? 1.5 : 1);
export const critChance = s => 0.01 * s.up.lucky + (s.up.lucky > 0 ? T(s, 'critBonus', 0) : 0);
export const heatPerTap = s => HEAT_PER_TAP * T(s, 'heat', 1) * (0.6 + 0.4 * comboMult(s));
export const comboWindow = s => T(s, 'window', COMBO_WINDOW) + 0.1 * s.up.rizz;
/** Visual aura tier: changes every 5 combined Tap Power + Glow-Up levels (white, green, blue, purple, gold, rainbow). */
export const AURA_TIERS = ['White', 'Green', 'Blue', 'Purple', 'Gold', 'Rainbow'];
export const auraTier = s => Math.min(AURA_TIERS.length - 1, Math.floor((s.up.tap + s.up.glow) / 5));

// Levels are an XP display only (no stat bonus) so the plan's cost curve is the whole economy.
export const levelNeed = L => Math.floor(40 * Math.pow(L, 2.2));
export function levelFor(ever) { let L = 1; while (ever >= levelNeed(L)) L++; return L; }

function gain(s, n) { s.aura += n; s.lifetime += n; s.ever += n; }

/** One tap. Returns a result the UI turns into juice, or null if locked. rnd injectable for tests.
 *  opts.perfect: the tap landed on the floor-6 pulse (x3). */
export function tap(s, now = Date.now(), rnd = Math.random, opts = {}) {
  const rt = s.rt;
  if (now < rt.lockUntil) return { locked: true };
  rt.combo++; rt.sinceTap = 0; s.taps++;
  s.best.combo = Math.max(s.best.combo, rt.combo);
  const base = basePerTap(s, now);
  const crit = rnd() < critChance(s);
  const perfect = !!opts.perfect && hasTwist(s, 'pulse');
  const immediate = Math.round(base * (crit ? 10 : 1) * (perfect ? PULSE_MULT : 1));
  const mult = comboMult(s);
  const bonus = Math.round(base * (mult - 1));
  gain(s, immediate);
  rt.pot += bonus;
  rt.heat += heatPerTap(s);
  const res = { value: immediate, bonus, crit, perfect, combo: rt.combo, mult, events: [] };
  const every = T(s, 'chainEvery', 0);
  if (every && s.up.rizz > 0 && rt.combo % every === 0) { const c = Math.round(base * T(s, 'chainBonus', 1)); rt.pot += c; res.events.push({ type: 'chain', value: c, n: rt.combo / every }); }
  if (rt.heat >= 100) { overheat(s, now); res.events.push({ type: 'overheat', lost: rt.lostPot }); }
  checkProgress(s, res.events);
  return res;
}

export function overheat(s, now) {
  const rt = s.rt;
  rt.lostPot = rt.pot; rt.pot = 0; rt.combo = 0; rt.heat = 100;
  rt.lockUntil = now + OVERHEAT_LOCK * 1000; rt.overheatAt = now;
}
/** Rewarded revive: refund the lost pot, cool down, unlock immediately. */
export function revive(s, now = Date.now()) {
  const rt = s.rt; const refund = rt.lostPot;
  gain(s, refund); rt.lostPot = 0; rt.heat = 0; rt.lockUntil = 0; rt.overheatAt = 0;
  const events = []; checkProgress(s, events); return { refund, events };
}
export const canRevive = (s, now, windowMs) => s.rt.lostPot > 0 && s.rt.overheatAt && now - s.rt.overheatAt < windowMs;

/** Per-frame update. dt in seconds. Returns events (bank, floor_up, stage_unlock, level_up). */
export function update(s, dt, now = Date.now()) {
  const rt = s.rt, events = [];
  rt.sinceTap += dt;
  if (now >= rt.lockUntil) rt.heat = Math.max(0, rt.heat - HEAT_DECAY * dt * (rt.lockUntil && now - rt.lockUntil < 1500 ? 3 : 1));
  if (rt.sinceTap > comboWindow(s) && rt.combo > 0) {
    if (rt.pot > 0) { const n = rt.pot; gain(s, n); events.push({ type: 'bank', value: n, combo: rt.combo }); }
    rt.pot = 0; rt.combo = 0;
  }
  const a = autoPerSec(s, now) * dt;
  if (a > 0) { s._autoFrac = (s._autoFrac || 0) + a; const w = Math.floor(s._autoFrac); if (w) { s._autoFrac -= w; gain(s, w); } }
  checkProgress(s, events);
  return events;
}

function setFloor(s, f, via, events) {
  const prevTheme = s.stage;
  s.floor = f; s.best.floor = Math.max(s.best.floor || 0, f);
  events.push({ type: 'floor_up', floor: f, via });
  const th = themeOf(f);
  if (th > prevTheme) { s.stage = th; s.curStage = th; events.push({ type: 'stage_unlock', stage: th, via }); }
  for (const [k, at] of Object.entries(TWIST)) if (f === at) events.push({ type: 'twist', twist: k });
}
export function checkProgress(s, events) {
  const L = levelFor(s.ever);
  if (L > s.level) { events.push({ type: 'level_up', from: s.level, level: L }); s.level = L; }
  while (s.floor < FLOORS - 1 && s.lifetime >= FLOOR_REQ[s.floor + 1]) setFloor(s, s.floor + 1, 'aura', events);
}
export const nextWall = s => (s.floor < FLOORS - 1 ? FLOOR_REQ[s.floor + 1] : null);
export function nextFloorProgress(s) {
  if (s.floor >= FLOORS - 1) return 1;
  const a = FLOOR_REQ[s.floor], b = FLOOR_REQ[s.floor + 1];
  return Math.max(0, Math.min(1, (s.lifetime - a) / (b - a)));
}
export const canSkip = (s, minProgress) => s.floor < FLOORS - 1 && !s.skipped.includes(s.floor + 1) && nextFloorProgress(s) >= minProgress;
/** Rewarded skip: jump over the next wall. Lifetime is raised to the wall so later walls keep their spacing. */
export function skipFloor(s) {
  if (s.floor >= FLOORS - 1) return [];
  const events = [], f = s.floor + 1;
  s.skipped.push(f); s.lifetime = Math.max(s.lifetime, FLOOR_REQ[f]);
  setFloor(s, f, 'skip', events); return events;
}

// ---- Ascend (prestige): reset aura, upgrades and the tower for Halos (+10% all aura each, permanent) ----
export const halosFor = ever => Math.floor(Math.sqrt(ever / HALO_UNIT));
export const pendingHalos = s => Math.max(0, halosFor(s.ever) - s.halos);
export const canAscend = s => pendingHalos(s) >= 1;
export function ascend(s) {
  const gained = pendingHalos(s); if (gained < 1) return 0;
  s.halos += gained; s.ascends++;
  s.aura = 0; s.lifetime = 0; s.floor = 0; s.stage = 0; s.curStage = 0; s.skipped = [];
  s.up = { tap: 0, farm: 0, glow: 0, rizz: 0, lucky: 0 };
  s.rt = { ...freshRuntime(), tune: s.rt.tune };
  return gained;
}

export function addBoost(s, now, ms, capMs) { s.boostUntil = Math.min(Math.max(s.boostUntil, now) + ms, now + capMs); }

/** Offline earnings from Aura Farm (boost not applied while away). */
export function offlineGain(s, now, capHours, eff) {
  const secs = Math.min(Math.max(0, (now - s.lastSeen) / 1000), capHours * 3600);
  const rate = farmRate(s.up.farm) * glowMult(s) * haloMult(s);
  return { secs, value: Math.floor(rate * secs * eff) };
}
export function grant(s, n) { const e = []; gain(s, n); checkProgress(s, e); return e; }

/** Daily gift (menu > Daily): one minute of your current income (3 taps/s + farm), at least 100. Once per calendar day. */
export const dailyValue = (s, now) => Math.max(100, Math.round(60 * (3 * basePerTap(s, 0) + autoPerSec(s, 0))));
export const canClaimDaily = (s, now) => s.dailyDay !== dayIndex(s, now);
export function claimDaily(s, now, mult = 1) { if (!canClaimDaily(s, now)) return null; const v = dailyValue(s, now) * mult; s.dailyDay = dayIndex(s, now); return { value: v, events: grant(s, v) }; }

export const dayIndex = (s, now) => Math.floor((startOfDay(now) - startOfDay(s.installedAt)) / 864e5);
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

// ---- save ----
const V1 = { power: { base: 15, growth: 1.55 }, auto: { base: 40, growth: 1.6 }, combo: { base: 120, growth: 2.1 }, cool: { base: 70, growth: 1.8 }, crit: { base: 250, growth: 1.85 } };
/** v1 (week-1/2 test builds) -> v2: the old upgrades are refunded as aura (the old tree no longer exists). */
function migrateV1(d) {
  let refund = 0;
  for (const [id, u] of Object.entries(V1)) for (let l = 0; l < (d.up?.[id] | 0); l++) refund += Math.ceil(u.base * Math.pow(u.growth, l));
  const out = { ...d, v: 2, aura: (d.aura || 0) + refund, ever: d.lifetime || 0, up: {}, floor: 0, stage: 0, curStage: 0, skipped: [] };
  out.flags = { shop: true };
  return out;
}
export function serialize(s, now = Date.now()) { const { rt, _autoFrac, ...rest } = s; return JSON.stringify({ ...rest, lastSeen: now }); }
export function deserialize(str, now = Date.now()) {
  const base = newState(now);
  try {
    let d = JSON.parse(str); if (!d || (d.v !== 1 && d.v !== 2)) return base;
    if (d.v === 1) d = migrateV1(d);
    const s = { ...base, ...d, up: { ...base.up, ...pick(d.up, UP_IDS) }, ads: { ...base.ads, ...d.ads, last: { ...(d.ads?.last || {}) } }, settings: { ...base.settings, ...d.settings }, flags: { ...base.flags, ...d.flags }, best: { ...base.best, ...d.best }, escape: { ...base.escape, ...d.escape }, rt: freshRuntime() };
    for (const k of Object.keys(base.escape)) if (!Number.isFinite(s.escape[k]) || s.escape[k] < 0) s.escape[k] = 0;
    for (const k of ['aura', 'lifetime', 'ever', 'taps', 'halos']) if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = 0;
    for (const id of UP_IDS) s.up[id] = Math.min(UPGRADES[id].max, Math.max(0, s.up[id] | 0));
    s.ever = Math.max(s.ever, s.lifetime);
    s.floor = Math.min(Math.max(0, s.floor | 0), FLOORS - 1);
    s.stage = themeOf(s.floor);
    s.curStage = Math.min(Math.max(0, s.curStage | 0), s.stage);
    checkProgress(s, []);
    return s;
  } catch { return base; }
}
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o && o[k] != null).map(k => [k, o[k]]));

export function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.0+$/, '') + u[i];
}
