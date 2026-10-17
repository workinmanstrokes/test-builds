// Pure game logic for +1 Aura (no DOM). Unit-tested in tests/unit.mjs.
// Core loop: every tap = +1 x power x stage x level bonus x boost. Fast taps build a combo whose
// bonus goes into a "streak pot" that banks when you ease off. Tap too hard and you OVERHEAT:
// the pot is lost and tapping locks briefly, unless you revive (rewarded ad).

export const SAVE_KEY = 'plus1aura.save.v1';
export const STAGE_THRESHOLDS = [0, 3000, 75000];   // lifetime aura needed per stage
export const STAGE_MULT = [1, 4, 16];
export const COMBO_WINDOW = 0.9;   // s without a tap before the combo ends and the pot banks
export const OVERHEAT_LOCK = 4;    // s tapping is locked after an overheat
const HEAT_PER_TAP = 2.4, HEAT_DECAY = 14;

export const UPGRADES = {
  power: { base: 15,  growth: 1.55, max: 200 }, // +1 base per tap
  auto:  { base: 40,  growth: 1.60, max: 200 }, // +1 aura/s each (x stage)
  combo: { base: 120, growth: 2.1,  max: 6 },   // +0.5 max combo multiplier (base x3)
  cool:  { base: 70,  growth: 1.8,  max: 8 },   // -9% heat per tap each
  crit:  { base: 250, growth: 1.85, max: 10 },  // +3% chance of a x10 Aura Burst
};

export function newState(now = Date.now()) {
  return {
    v: 1, aura: 0, lifetime: 0, taps: 0, level: 1,
    stage: 0, curStage: 0, skipped: [],
    up: { power: 0, auto: 0, combo: 0, cool: 0, crit: 0 },
    boostUntil: 0, installedAt: now, lastSeen: now, lastDayLogged: 0,
    ads: { day: '', count: 0, lastReward: 0, earned: 0 },
    settings: { sound: true, vibe: true }, skin: null, noAds: false, best: { combo: 0 },
    // transient (not saved)
    rt: freshRuntime(),
  };
}
const freshRuntime = () => ({ heat: 0, combo: 0, pot: 0, sinceTap: 99, lockUntil: 0, lostPot: 0, overheatAt: 0, now: 0, tune: {} });

// Per-skin mechanics flavour (set by the UI from skin.tuning). All optional; defaults = classic +1 Aura.
//   heat: x heat per tap · comboEvery: taps per +0.5 streak step · window: s before the streak banks
//   critBonus: extra burst chance · chainEvery/chainBonus: every N streak taps pay base x chainBonus (e.g. a typed word)
export function setTuning(s, tune) { s.rt.tune = tune || {}; }
const T = (s, k, d) => (s.rt.tune && s.rt.tune[k] != null ? s.rt.tune[k] : d);

export function upgradeCost(id, lvl) { const u = UPGRADES[id]; return Math.ceil(u.base * Math.pow(u.growth, lvl)); }
export function canBuy(s, id) { return s.up[id] < UPGRADES[id].max && s.aura >= upgradeCost(id, s.up[id]); }
export function buy(s, id) { if (!canBuy(s, id)) return false; s.aura -= upgradeCost(id, s.up[id]); s.up[id]++; return true; }

export const levelNeed = L => Math.floor(40 * Math.pow(L, 2.2));       // cumulative lifetime for level L+1
export function levelFor(lifetime) { let L = 1; while (lifetime >= levelNeed(L)) L++; return L; }
export const levelBonus = s => 1 + (s.level - 1) * 0.02;
export const maxCombo = s => 3 + s.up.combo * 0.5;
export const comboMult = s => Math.min(1 + Math.floor(s.rt.combo / T(s, 'comboEvery', 10)) * 0.5, maxCombo(s));
export const boostMult = (s, now) => (s.boostUntil > now ? 2 : 1);
export const basePerTap = (s, now) => (1 + s.up.power) * STAGE_MULT[s.curStage] * levelBonus(s) * boostMult(s, now);
export const autoPerSec = (s, now) => s.up.auto * STAGE_MULT[s.stage] * levelBonus(s) * boostMult(s, now);
export const heatPerTap = s => HEAT_PER_TAP * T(s, 'heat', 1) * (0.6 + 0.4 * comboMult(s)) * Math.pow(0.91, s.up.cool);
export const comboWindow = s => T(s, 'window', COMBO_WINDOW);

function gain(s, n) { s.aura += n; s.lifetime += n; }

/** One tap. Returns a result the UI turns into juice, or null if locked. rnd injectable for tests. */
export function tap(s, now = Date.now(), rnd = Math.random) {
  const rt = s.rt;
  if (now < rt.lockUntil) return { locked: true };
  rt.combo++; rt.sinceTap = 0; s.taps++;
  s.best.combo = Math.max(s.best.combo, rt.combo);
  const base = basePerTap(s, now);
  const crit = rnd() < s.up.crit * 0.03 + T(s, 'critBonus', 0);
  const immediate = Math.round(base * (crit ? 10 : 1));
  const bonus = Math.round(base * (comboMult(s) - 1));
  gain(s, immediate);
  rt.pot += bonus;
  rt.heat += heatPerTap(s);
  const res = { value: immediate, bonus, crit, combo: rt.combo, mult: comboMult(s), events: [] };
  const every = T(s, 'chainEvery', 0);
  if (every && rt.combo % every === 0) { const c = Math.round(base * T(s, 'chainBonus', 1)); rt.pot += c; res.events.push({ type: 'chain', value: c, n: rt.combo / every }); }
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

/** Per-frame update. dt in seconds. Returns events (bank, stage_unlock, level_up). */
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

export function checkProgress(s, events) {
  const L = levelFor(s.lifetime);
  if (L > s.level) { events.push({ type: 'level_up', from: s.level, level: L }); s.level = L; }
  while (s.stage < STAGE_THRESHOLDS.length - 1 && s.lifetime >= STAGE_THRESHOLDS[s.stage + 1]) {
    s.stage++; s.curStage = s.stage; events.push({ type: 'stage_unlock', stage: s.stage, via: 'aura' });
  }
}
export function nextStageProgress(s) {
  if (s.stage >= STAGE_THRESHOLDS.length - 1) return 1;
  const a = STAGE_THRESHOLDS[s.stage], b = STAGE_THRESHOLDS[s.stage + 1];
  return Math.max(0, Math.min(1, (s.lifetime - a) / (b - a)));
}
export const canSkip = (s, minProgress) => s.stage < STAGE_THRESHOLDS.length - 1 && !s.skipped.includes(s.stage + 1) && nextStageProgress(s) >= minProgress;
export function skipStage(s) {
  if (s.stage >= STAGE_THRESHOLDS.length - 1) return null;
  s.stage++; s.curStage = s.stage; s.skipped.push(s.stage);
  return { type: 'stage_unlock', stage: s.stage, via: 'skip' };
}
export function addBoost(s, now, ms, capMs) { s.boostUntil = Math.min(Math.max(s.boostUntil, now) + ms, now + capMs); }

/** Offline earnings from auto aura (boost not applied while away). */
export function offlineGain(s, now, capHours, eff) {
  const secs = Math.min(Math.max(0, (now - s.lastSeen) / 1000), capHours * 3600);
  const rate = s.up.auto * STAGE_MULT[s.stage] * levelBonus(s);
  return { secs, value: Math.floor(rate * secs * eff) };
}
export function grant(s, n) { const e = []; gain(s, n); checkProgress(s, e); return e; }

export const dayIndex = (s, now) => Math.floor((startOfDay(now) - startOfDay(s.installedAt)) / 864e5);
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

export function serialize(s, now = Date.now()) { const { rt, _autoFrac, ...rest } = s; return JSON.stringify({ ...rest, lastSeen: now }); }
export function deserialize(str, now = Date.now()) {
  const base = newState(now);
  try {
    const d = JSON.parse(str); if (!d || d.v !== 1) return base;
    const s = { ...base, ...d, up: { ...base.up, ...d.up }, ads: { ...base.ads, ...d.ads }, settings: { ...base.settings, ...d.settings }, best: { ...base.best, ...d.best }, rt: freshRuntime() };
    for (const k of ['aura', 'lifetime', 'taps']) if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = 0;
    s.stage = Math.min(Math.max(0, s.stage | 0), STAGE_THRESHOLDS.length - 1);
    s.curStage = Math.min(Math.max(0, s.curStage | 0), s.stage);
    return s;
  } catch { return base; }
}

export function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.0+$/, '') + u[i];
}
