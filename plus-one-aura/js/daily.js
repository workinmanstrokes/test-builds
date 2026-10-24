// +1 Aura: daily challenge seed, ghost-race timelines and login streaks. Pure helpers (no DOM, no network).
import { speedAt, RUN } from './runner.js';

// ---------- daily challenge: one Speed Escape seed per UTC date, the same for everyone ----------
export const dayId = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);          // 2026-10-23 (UTC)
export const DAY_RE = /^20[2-9]\d-[01]\d-[0-3]\d$/;
/** FNV-1a hash of the date id -> 32-bit seed for runner.newRun(). */
export function daySeed(id = dayId()) { let h = 0x811c9dc5; for (const c of `aura-daily:${id}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
/** Local daily bests { id, best, tries } (offline fallback). */
export function recordDaily(d, id, dist) {
  if (!d || d.id !== id) d = { id, best: 0, tries: 0 };
  d.tries++; const newBest = dist > d.best; if (newBest) d.best = Math.floor(dist);
  return { d, newBest };
}

// ---------- ghosts: compact lane timeline. Distance is a pure function of time (speed is +1/s regardless of
// obstacles), so a ghost only needs lane changes: "g1|<end cs>|<t cs>:<lane>,..." (times in centiseconds). ----------
export const GHOST_MAX_MOVES = 1200, GHOST_MAX_CHARS = 12000, GHOST_MAX_T = 3600;
/** Distance travelled after t seconds (same integration as runner.step: speed constant within each second). */
export function distAt(t, v0 = RUN.startSpeed) { const n = Math.floor(Math.max(0, t)); return n * v0 + (n * (n - 1)) / 2 + (t - n) * speedAt(t, v0); }
export function encodeGhost(moves, endT) {
  const m = moves.slice(0, GHOST_MAX_MOVES).map(([t, l]) => `${Math.round(t * 100).toString(36)}:${l}`).join(',');
  return `g1|${Math.round(Math.min(endT, GHOST_MAX_T) * 100).toString(36)}|${m}`;
}
export function decodeGhost(str) {
  if (typeof str !== 'string' || str.length > GHOST_MAX_CHARS) return null;
  const [v, e, m] = str.split('|'); if (v !== 'g1' || e == null) return null;
  const endT = parseInt(e, 36) / 100; if (!(endT > 0) || endT > GHOST_MAX_T) return null;
  const moves = []; let last = -1;
  for (const p of (m ? m.split(',') : [])) {
    const [ts, ls] = p.split(':'); const t = parseInt(ts, 36) / 100, l = +ls;
    if (!Number.isFinite(t) || t < last || t > endT || ![0, 1, 2].includes(l)) return null;
    moves.push([t, l]); last = t;
  }
  return { endT, moves, dist: Math.floor(distAt(endT)) };
}
/** Ghost state at time t: { lane (float, tweened like the player), dist, done }. */
export function ghostAt(g, t) {
  const tt = Math.min(t, g.endT); let lane = 1, from = 1, at = -1;
  for (const [mt, l] of g.moves) { if (mt > tt) break; from = lane; lane = l; at = mt; }
  const k = at < 0 ? 1 : Math.min(1, (tt - at) / RUN.laneTweenSec);
  return { lane: from + (lane - from) * k, dist: distAt(tt), done: t >= g.endT };
}

// ---------- login streaks: stacking reward for consecutive (local) days, one gentle saver ----------
export const STREAK_CAP = 7;            // reward stacks up to day 7, then stays at the cap
export const streakReward = (streak, base) => Math.round(base * Math.min(STREAK_CAP, Math.max(1, streak)));
export const localDay = (t = Date.now()) => { const d = new Date(t); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); };
/**
 * Called on open. st = { day, streak, best, saverDay }. Returns { st, status } where status is
 *  'same' (already counted today) | 'up' (consecutive day) | 'new' (first day or broken) | 'savable' (missed exactly one day;
 *  a rewarded ad keeps the streak, at most once every 7 days).
 */
export function streakCheck(st, today) {
  st = { day: -1, streak: 0, best: 0, saverDay: -99, ...(st || {}) };
  if (st.day === today) return { st, status: 'same' };
  const gap = today - st.day;
  if (st.day >= 0 && gap === 1) { st.streak++; st.day = today; st.best = Math.max(st.best, st.streak); return { st, status: 'up' }; }
  if (st.day >= 0 && gap === 2 && st.streak >= 2 && today - st.saverDay >= 7) return { st, status: 'savable', lost: st.streak };
  st.streak = 1; st.day = today; st.best = Math.max(st.best, 1); return { st, status: 'new' };
}
/** Apply the result of the saver offer (true = ad watched: the streak continues as if no day was missed). */
export function streakResolve(st, today, saved) {
  if (saved) { st.streak++; st.saverDay = today; } else st.streak = 1;
  st.day = today; st.best = Math.max(st.best, st.streak); return st;
}
