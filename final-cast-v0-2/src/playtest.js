// Final Cast v0.2 — hookset success/fail logging by fish size.
// No telemetry leaves the device: logs stay in localStorage until the
// player exports them from Settings. Telemetry is off on localhost and
// whenever Do Not Track is set (see main.js).

const KEY = 'finalcast.playtest.v0_2';

export function newSession({ phoneModel = 'unknown', playerType = 'first-time' } = {}) {
  const session = {
    app: 'Final Cast',
    version: '0.2.0',
    startedAt: new Date().toISOString(),
    phoneModel,
    playerType,
    attempts: [],
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
