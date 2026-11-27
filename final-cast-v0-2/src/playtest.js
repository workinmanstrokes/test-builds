// Final Cast v0.2.6 — hookset success/fail logging by fish size, plus
// pacing, retention, crash and performance logging for the Game Test Lab
// reviews (2026-11-25, 2026-11-27) and the VEX reviews (2026-11-26, 5.0/10).
// New in 0.2.6 (VEX 5.0 follow-up, suggestion 497): session version bump
// only — the pacing targets themselves live in src/tuning.json and are
// wired in main.js; questSummary() below is what the real 1–12
// playthrough is judged against (target minutes and active share in
// docs/quests.md).
// New in 0.2.5 (VEX 5.0 items 1, 4, 8): per-phone session details for the
// 3–5 phone playtest matrix (see docs/playtest-protocol.md), bite hit/miss
// logging separate from hookset attempts, and quest timing (idle vs active
// minutes, time per quest) so a quest that is only wait, fight, repeat can
// be found from the numbers instead of a feeling.
// No telemetry leaves the device: logs stay in localStorage until the
// player exports them from Settings. Telemetry is off on localhost and
// whenever Do Not Track is set (see main.js).

const KEY = 'finalcast.playtest.v0_2';

export function newSession({ phoneModel = 'unknown', androidVersion = 'unknown', screenSize = 'unknown', orientation = 'unknown', playerType = 'first-time' } = {}) {
  const session = {
    app: 'Final Cast',
    version: '0.2.6',
    startedAt: new Date().toISOString(),
    phoneModel,
    // Per-phone details for the multi-phone playtest (VEX 5.0 item 1):
    // model and Android version are entered by the tester in Settings
    // (setPhoneDetails); screen size and orientation are filled in
    // automatically at launch (main.js init). One exported session is
    // one phone's full session — see docs/playtest-protocol.md.
    phone: { model: phoneModel, androidVersion, screenSize, orientation },
    playerType,
    // Device RAM bucket (navigator.deviceMemory, GB) — recorded so
    // low-memory shutdowns can be reproduced by device (Lab fix #3).
    deviceMemoryGB: typeof navigator !== 'undefined' ? (navigator.deviceMemory ?? null) : null,
    attempts: [],
    // Bite log (VEX 5.0 item 1): every bite cue shown, and whether the
    // player hooked it or let it go. A hookset attempt only exists when
    // the player taps; a bite with no tap is a miss here, not silence.
    bites: [],
    // Quest timing (VEX 5.0 item 4): one entry per finished quest, plus
    // the live clock for the quest in progress. idleMs is time the line
    // fished on its own; activeMs is time inside a bite or a fight.
    quests: [],
    questClock: null,
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
    // Performance (Lab 3.8 fix #3): load time, frame drops and memory
    // use for the 10-minute low-end Android test pass. Recorded
    // on-device only; read them from the exported session.
    performance: { loadMs: null, frameDrops: 0, longFrames: 0, memorySamples: [] },
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

// Fill in the test phone's details (VEX 5.0 item 1). Called from Settings
// when the tester types the phone model / Android version, and from
// main.js init for the automatic fields (screen size, orientation).
// Fields merge — setting one never wipes the others.
export function setPhoneDetails(details = {}) {
  const session = currentSession();
  session.phone ??= {};
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined && value !== null && value !== '') session.phone[key] = value;
  }
  if (session.phone.model) session.phoneModel = session.phone.model;
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.phone;
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

// Record one bite cue. `outcome` is 'shown' (cue appeared), 'hooked'
// (player tapped Hookset inside the window) or 'missed' (window closed
// with no successful hookset). `reactionMs` is the time from the bite cue
// to the tap, or to the window closing for a miss.
export function logBite({ size, outcome, reactionMs = null, windowMs = null }) {
  const session = currentSession();
  session.bites ??= [];
  session.bites.push({
    at: new Date().toISOString(),
    size,
    outcome,
    reactionMs: reactionMs == null ? null : Math.round(reactionMs),
    windowMs,
  });
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.bites[session.bites.length - 1];
}

// Bite hit/miss rate grouped by fish size — the numbers the multi-phone
// playtest is judged by. A size with fewer than 5 bites is "not enough data".
export function biteRateBySize() {
  const { bites = [] } = currentSession();
  const bySize = {};
  for (const b of bites) {
    if (b.outcome === 'shown') continue; // the cue itself is not a result
    bySize[b.size] = bySize[b.size] || { bites: 0, hooked: 0 };
    bySize[b.size].bites += 1;
    if (b.outcome === 'hooked') bySize[b.size].hooked += 1;
  }
  for (const size of Object.keys(bySize)) {
    const s = bySize[size];
    s.rate = s.bites ? +(s.hooked / s.bites).toFixed(2) : 0;
    s.enoughData = s.bites >= 5;
  }
  return bySize;
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

// Add idle/active milliseconds to the clock for the quest in progress
// (VEX 5.0 item 4). main.js calls this as the game runs: idle time while
// the line fishes on its own, active time inside a bite or a fight.
// `quest` is the 1-based quest number; a new number starts a fresh clock
// (the old one is kept only if logQuestComplete was called for it).
export function noteQuestClock({ quest, idleMs = 0, activeMs = 0 }) {
  const session = currentSession();
  session.questClock ??= null;
  if (!session.questClock || session.questClock.quest !== quest) {
    session.questClock = { quest, startedAt: new Date().toISOString(), idleMs: 0, activeMs: 0 };
  }
  session.questClock.idleMs += idleMs;
  session.questClock.activeMs += activeMs;
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.questClock;
}

// Close out a quest's timing entry when it is completed: moves the live
// clock into session.quests with minutes split out, ready to read in the
// export. Call with the same numbers the clock holds; omitting them
// closes the clock as it stands.
export function logQuestComplete({ quest, idleMs = null, activeMs = null } = {}) {
  const session = currentSession();
  session.quests ??= [];
  const clock = session.questClock && session.questClock.quest === quest ? session.questClock : null;
  const done = {
    quest,
    startedAt: clock ? clock.startedAt : new Date().toISOString(),
    completedAt: new Date().toISOString(),
    idleMs: idleMs ?? clock?.idleMs ?? 0,
    activeMs: activeMs ?? clock?.activeMs ?? 0,
  };
  done.durationMs = done.idleMs + done.activeMs;
  done.idleMinutes = +(done.idleMs / 60000).toFixed(1);
  done.activeMinutes = +(done.activeMs / 60000).toFixed(1);
  session.quests.push(done);
  if (clock) session.questClock = null;
  localStorage.setItem(KEY, JSON.stringify(session));
  return done;
}

// Per-quest timing summary for the pacing audit: minutes idle vs active
// and total time per quest. A quest whose active minutes are a small
// slice of its total — mostly waiting — is the wait, fight, repeat loop
// the VEX 5.0 review flagged; vary, shorten, or give it a new mechanic.
export function questSummary() {
  const { quests = [], questClock = null } = currentSession();
  const rows = quests.map((q) => ({
    quest: q.quest,
    idleMinutes: q.idleMinutes,
    activeMinutes: q.activeMinutes,
    totalMinutes: +((q.durationMs ?? q.idleMs + q.activeMs) / 60000).toFixed(1),
    completed: true,
  }));
  if (questClock) {
    rows.push({
      quest: questClock.quest,
      idleMinutes: +(questClock.idleMs / 60000).toFixed(1),
      activeMinutes: +(questClock.activeMs / 60000).toFixed(1),
      totalMinutes: +((questClock.idleMs + questClock.activeMs) / 60000).toFixed(1),
      completed: false,
    });
  }
  return rows;
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

// Record page load time (Lab 3.8 fix #3) from the Navigation Timing API.
// Call once at launch (main.js init). Null when the API is unavailable.
export function recordLoadTime() {
  const session = currentSession();
  session.performance ??= { loadMs: null, frameDrops: 0, longFrames: 0, memorySamples: [] };
  try {
    const nav = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0] : null;
    if (nav) session.performance.loadMs = Math.round(nav.domContentLoadedEventEnd || nav.duration);
  } catch { /* timing API unavailable — leave loadMs null */ }
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.performance.loadMs;
}

// Frame-drop monitor (Lab 3.8 fix #3): counts frames that miss the 60fps
// budget (gap > 33.4 ms) and visible stalls (gap > 100 ms) during the
// first 10 minutes of a session — the low-end Android test pass. Start
// once at launch; it stops itself after 10 minutes and writes the totals.
export function startFrameMonitor() {
  if (typeof requestAnimationFrame !== 'function') return;
  const startedAt = performance.now();
  let last = startedAt;
  let drops = 0;
  let longFrames = 0;
  function tick(now) {
    const gap = now - last;
    last = now;
    if (gap > 100) longFrames += 1; // visible stall
    else if (gap > 33.4) drops += 1; // missed a 60fps frame
    if (now - startedAt < 10 * 60 * 1000) {
      requestAnimationFrame(tick);
    } else {
      const session = currentSession();
      session.performance ??= { loadMs: null, frameDrops: 0, longFrames: 0, memorySamples: [] };
      session.performance.frameDrops = (session.performance.frameDrops || 0) + drops;
      session.performance.longFrames = (session.performance.longFrames || 0) + longFrames;
      localStorage.setItem(KEY, JSON.stringify(session));
    }
  }
  requestAnimationFrame(tick);
}

// Sample JS heap use (Lab 3.8 fix #3) — only on browsers that expose
// performance.memory (Chrome / Android WebView); a no-op elsewhere.
// Call every 30 s while the game runs (main.js init).
export function sampleMemory() {
  const session = currentSession();
  session.performance ??= { loadMs: null, frameDrops: 0, longFrames: 0, memorySamples: [] };
  try {
    const mem = typeof performance !== 'undefined' ? performance.memory : null;
    if (mem) {
      session.performance.memorySamples.push({
        at: new Date().toISOString(),
        usedMB: +(mem.usedJSHeapSize / 1048576).toFixed(1),
      });
      if (session.performance.memorySamples.length > 40) session.performance.memorySamples.shift();
    }
  } catch { /* ignore */ }
  localStorage.setItem(KEY, JSON.stringify(session));
  return session.performance.memorySamples;
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
