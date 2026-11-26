// Final Cast v0.2.2 — hookset success/fail logging by fish size, plus
// pacing, retention and crash logging for the Game Test Lab reviews
// (2026-11-25) and the VEX review (2026-11-26).
// No telemetry leaves the device: logs stay in localStorage until the
// player exports them from Settings. Telemetry is off on localhost and
// whenever Do Not Track is set (see main.js).

const KEY = 'finalcast.playtest.v0_2';

export function newSession({ phoneModel = 'unknown', playerType = 'first-time' } = {}) {
  const session = {
    app: 'Final Cast',
    version: '0.2.2',
    startedAt: new Date().toISOString(),
    phoneModel,
    playerType,
    // Device RAM bucket (navigator.deviceMemory, GB) — recorded so
    // low-memory shutdowns can be reproduced by device (Lab fix #3).
    deviceMemoryGB: typeof navigator !== 'undefined' ? (navigator.deviceMemory ?? null) : null,
    attempts: [],
    // Pacing markers (Lab fix #5): ms from session start to each event.
    pacing: {},
    // Retention (VEX fix #5): which calendar days the game was opened,
    // and whether the player came back 1 day and 7 days after their
    // first day. Day-1 / day-7 return is the retention signal the
    // review asked for; review sentiment cannot be measured in-game —
    // Final Cast has no public store listing (see docs/build-sheet.md).
    firstDay: null,
    daysPlayed: [],
    retention: {},
    // Crash / error log, each entry tagged with device RAM (Lab fix #3).
    crashes: [],
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function currentSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || newSession();
  } catch {
    return newSession();
  }
}

// Fill in device RAM for sessions started before it was recorded.
export function recordDevice() {
  const session = currentSession();
  if (session.deviceMemoryGB == null && typeof navigator !== 'undefined') {
    session.deviceMemoryGB = navigator.deviceMemory ?? null;
    localStorage.setItem(KEY, JSON.stringify(session));
  }
  return session;
}

// Record that the game was opened today, and flag day-1 / day-7 return.
// Call once per launch (main.js init). Dates are YYYY-MM-DD in UTC.
export function recordPlayDay() {
  const session = currentSession();
  const today = new Date().toISOString().slice(0, 10);
  session.firstDay ??= today;
  session.daysPlayed ??= [];
  if (!session.daysPlayed.includes(today)) session.daysPlayed.push(today);
  const dayIndex = Math.round((Date.parse(today) - Date.parse(session.firstDay)) / 86400000);
  session.retention ??= {};
  if (dayIndex >= 1) session.retention.day1 = true;
  if (dayIndex >= 7) session.retention.day7 = true;
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

// Record one hookset attempt. `size` is one of small | medium | large | legend.
// `reactionMs` is the time from the bite cue to the tap; `windowMs` is the
// hookset window that was in force (from src/tuning.json).
export function logHooksetAttempt({ size, success, reactionMs, windowMs, firstAttempt = false, graceApplied = false }) {
  const session = currentSession();
  session.attempts.push({
    at: new Date().toISOString(),
    size,
    success: Boolean(success),
    reactionMs: Math.round(reactionMs),
    windowMs,
    firstAttempt,
    graceApplied,
  });
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.attempts[session.attempts.length - 1];
}

// Record a pacing milestone as milliseconds since the session started.
// Known events: 'first_hand_catch' (first hand-fought fish landed),
// 'first_legend' (first legend fish landed — the "first boss" equivalent).
export function logPacingEvent(name) {
  const session = currentSession();
  if (session.pacing[name] != null) return session.pacing[name]; // first occurrence only
  const startedAt = Date.parse(session.startedAt);
  session.pacing[name] = Number.isFinite(startedAt) ? Date.now() - startedAt : null;
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.pacing[name];
}

// Record an error/crash with the device RAM bucket, so low-memory
// shutdowns can be grouped by device (Lab fix #3).
export function logCrash({ message, source = '' }) {
  const session = currentSession();
  session.crashes.push({
    at: new Date().toISOString(),
    message: String(message || 'unknown error'),
    source: String(source || ''),
    deviceMemoryGB: session.deviceMemoryGB ?? (typeof navigator !== 'undefined' ? (navigator.deviceMemory ?? null) : null),
  });
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.crashes[session.crashes.length - 1];
}

// Success/fail rate grouped by fish size — the numbers the bite/hookset
// tuning is judged by. A size with fewer than 5 attempts is "not enough data".
export function successRateBySize() {
  const { attempts } = currentSession();
  const bySize = {};
  for (const a of attempts) {
    bySize[a.size] = bySize[a.size] || { attempts: 0, successes: 0 };
    bySize[a.size].attempts += 1;
    if (a.success) bySize[a.size].successes += 1;
  }
  for (const size of Object.keys(bySize)) {
    const s = bySize[size];
    s.rate = s.attempts ? +(s.successes / s.attempts).toFixed(2) : 0;
    s.enoughData = s.attempts >= 5;
  }
  return bySize;
}

export function exportSession() {
  return JSON.stringify(currentSession(), null, 2);
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
