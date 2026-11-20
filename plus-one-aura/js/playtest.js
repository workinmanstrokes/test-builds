// +1 Aura: real-phone playtest logging. Pure helpers (no DOM, no network).
// Records time-per-floor, overheat frequency and the exact floor/minute tapping
// gets boring across three real-phone sessions, so streak decay, the overheat
// warning and the floor twists can be retuned from the log — not from balance
// tests alone. Sessions persist in localStorage and export as JSON.

export const PLAYTEST_KEY = 'aura.playtest.v1';
export const PLAYTEST_SESSIONS_REQUIRED = 3;
export const TOWER_FLOORS = 9;

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Start a new playtest session. deviceLabel is free text, e.g. "Pixel 8, Android 15". */
export function newSession(deviceLabel = '') {
  return {
    id: uid(),
    startedAt: new Date().toISOString(),
    device: deviceLabel,
    floors: [], // { floor, seconds } in climb order
    overheats: 0,
    taps: 0,
    // { floor, minute, note } — set by the player the moment tapping gets boring.
    boredom: null,
    finishedAt: null,
  };
}

/** Record that the player cleared a floor after `seconds` on that floor. */
export function recordFloor(session, floor, seconds) {
  if (!session || !(floor >= 1 && floor <= TOWER_FLOORS) || !(seconds >= 0)) return session;
  session.floors.push({ floor, seconds: Math.round(seconds * 10) / 10 });
  return session;
}

/** Record one tap (drives taps-per-minute) and one overheat event. */
export function recordTap(session) { if (session) session.taps++; return session; }
export function recordOverheat(session) { if (session) session.overheats++; return session; }

/**
 * Record the boredom point: the exact floor and the minute into the session
 * when tapping started feeling boring. Call once, when the player says so —
 * later calls overwrite, so the last mark wins.
 */
export function recordBoredom(session, floor, minute, note = '') {
  if (!session || !(floor >= 1 && floor <= TOWER_FLOORS) || !(minute >= 0)) return session;
  session.boredom = { floor, minute: Math.round(minute * 10) / 10, note: String(note).slice(0, 200) };
  return session;
}

/** Close a session and return its summary. */
export function finishSession(session) {
  if (!session) return null;
  session.finishedAt = new Date().toISOString();
  return summarizeSession(session);
}

/** Per-session summary: total time, time per floor, overheats per minute. */
export function summarizeSession(session) {
  const totalSeconds = session.floors.reduce((a, f) => a + f.seconds, 0);
  const minutes = totalSeconds / 60;
  return {
    id: session.id,
    device: session.device,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    floorsCleared: session.floors.length,
    totalSeconds: Math.round(totalSeconds * 10) / 10,
    timePerFloor: session.floors.map((f) => ({ floor: f.floor, seconds: f.seconds })),
    taps: session.taps,
    overheats: session.overheats,
    overheatsPerMinute: minutes > 0 ? Math.round((session.overheats / minutes) * 100) / 100 : 0,
    boredom: session.boredom,
  };
}

/** Aggregate across sessions (the 3-session log): averages + the boredom points. */
export function summarizeSessions(sessions) {
  const done = (sessions || []).filter((s) => s && s.finishedAt);
  const perFloor = {};
  for (const s of done) {
    for (const f of s.floors) (perFloor[f.floor] ??= []).push(f.seconds);
  }
  const avgTimePerFloor = Object.keys(perFloor)
    .sort((a, b) => a - b)
    .map((floor) => {
      const xs = perFloor[floor];
      return { floor: +floor, avgSeconds: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, sessions: xs.length };
    });
  const totalMinutes = done.reduce((a, s) => a + summarizeSession(s).totalSeconds, 0) / 60;
  const totalOverheats = done.reduce((a, s) => a + s.overheats, 0);
  return {
    sessionsCompleted: done.length,
    sessionsRequired: PLAYTEST_SESSIONS_REQUIRED,
    complete: done.length >= PLAYTEST_SESSIONS_REQUIRED,
    avgTimePerFloor,
    totalOverheats,
    overheatsPerMinute: totalMinutes > 0 ? Math.round((totalOverheats / totalMinutes) * 100) / 100 : 0,
    boredomPoints: done.map((s) => s.boredom).filter(Boolean),
    sessions: done.map(summarizeSession),
    coreLoopProof: coreLoopProof(sessions),
  };
}

// ---- Core-loop proof (VEX scope-risk red flag, 5.0/10 C) ----
// The core loop (tap -> streak -> overheat -> tower climb) counts as proven
// past tower one only when the 3-session real-phone log is complete AND every
// finished session cleared all 9 floors. Until then the second act (Ascend
// prestige, Speed Escape bonus, skins) stays scope-frozen: no new modes,
// floors or skins, and streak decay / overheat warning / floor twists change
// only from this log — never from balance tests alone.
export function isCoreLoopProven(sessions) { return coreLoopProof(sessions).proven; }

export function coreLoopProof(sessions) {
  const done = (sessions || []).filter((s) => s && s.finishedAt);
  const fullClears = done.filter((s) => summarizeSession(s).floorsCleared >= TOWER_FLOORS);
  const missing = [];
  if (done.length < PLAYTEST_SESSIONS_REQUIRED) {
    missing.push(`${PLAYTEST_SESSIONS_REQUIRED - done.length} more finished session(s) needed (${done.length}/${PLAYTEST_SESSIONS_REQUIRED})`);
  }
  if (fullClears.length < done.length) {
    missing.push(`${done.length - fullClears.length} finished session(s) did not clear all ${TOWER_FLOORS} floors`);
  }
  return {
    proven: done.length >= PLAYTEST_SESSIONS_REQUIRED && fullClears.length === done.length,
    sessionsCompleted: done.length,
    sessionsRequired: PLAYTEST_SESSIONS_REQUIRED,
    fullTowerClears: fullClears.length,
    floorsRequired: TOWER_FLOORS,
    missing,
  };
}

// ---------- persistence (localStorage; safe no-op when unavailable) ----------

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function loadSessions() {
  const store = storage();
  if (!store) return [];
  try { return JSON.parse(store.getItem(PLAYTEST_KEY) || '[]'); } catch { return []; }
}

export function saveSession(session) {
  const store = storage();
  if (!store || !session) return false;
  const all = loadSessions().filter((s) => s.id !== session.id);
  all.push(session);
  try { store.setItem(PLAYTEST_KEY, JSON.stringify(all)); return true; } catch { return false; }
}

/** Export the full 3-session log as a JSON string (Settings → Playtest log → Export). */
export function exportLog() {
  return JSON.stringify(summarizeSessions(loadSessions()), null, 2);
}
