// Final Cast v0.2.6 — idle fishing with hand-fought big bites.
// Vanilla JS, no dependencies. Tuning lives in src/tuning.json; hookset
// logging lives in src/playtest.js.
//
// New in 0.2.5 (VEX 5.0 review): a forgiving first-quest bite/hookset
// window (quests 1–2), a two-tone audio bite cue alongside the visual
// BITE! banner and haptic buzz, per-water pond visuals with a swimming
// fish on the canvas, legend-fight difficulty per water from tuning,
// bite hit/miss logging, quest idle-vs-active timing, and a Settings
// field for the test phone's model / Android version (multi-phone
// playtest, see docs/playtest-protocol.md).
//
// New in 0.2.6 (VEX 5.0 follow-up, suggestion 497): pacing, economy and
// difficulty tuning for the 12-quest arc, written down in src/tuning.json
// and wired in here — the idle gap comes from tuning.pacing.idleGapMs,
// bite/hookset windows tighten by quest band (tuning.pacing.difficultyRamp),
// and coin rewards come from tuning.economy. Quest-completion bonuses stay
// design targets until in-game quest tracking ships (see tuning.json).
//
// Saves live in localStorage and are written automatically — on every
// catch, every settings change, and whenever the page is hidden or
// unloaded (Lab fix #2, the save trap: no button to remember, and the HUD
// shows "Saved ✓ time" after every save so autosave is visible).
// There is still no cloud save: the first-launch tutorial warns that
// deleting the app deletes progress, and Settings offers "Back up save",
// which downloads the save as a JSON file (VEX fix #3).

import { logHooksetAttempt, logBite, logPacingEvent, logCrash, recordDevice, recordPlayDay, recordLoadTime, startFrameMonitor, sampleMemory, successRateBySize, exportSession, newSession, setPhoneDetails, noteQuestClock } from './playtest.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'finalcast.save.v0_2';
const TELEMETRY_OFF =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  navigator.doNotTrack === '1';

const WATERS = {
  Millpond: { legend: 'Old Mossback', spot: 'Sunken Log', timeOfDay: 'dawn', fish: ['Bluegill', 'Perch', 'Bass'], pond: ['#7fb069', '#2f7fb8'], fishColor: '#eaf6ff' },
  'Cedar Creek': { legend: 'Silver King', spot: 'Boulder Run', timeOfDay: 'dusk', fish: ['Trout', 'Chub', 'Salmon'], pond: ['#5b5f97', '#1d3557'], fishColor: '#ffb703' },
  'Ember Lake': { legend: 'Emberfin', spot: 'Hot Spring Inlet', timeOfDay: 'night', fish: ['Ember Trout', 'Lava Carp', 'Cinder Catfish'], pond: ['#bc4b1a', '#1a0e0e'], fishColor: '#ff9e00' },
};

const DEFAULT_TUNING = {
  biteWindowMsBySize: { small: 1400, medium: 1000, large: 750, legend: 600 },
  hooksetWindowMsBySize: { small: 900, medium: 700, large: 550, legend: 450 },
  firstAttemptGraceMs: 250,
  firstQuestWindowMs: { biteMs: 1800, hooksetMs: 1200, quests: [1, 2] },
  legendFight: {
    Millpond: { difficulty: 3, fightDrift: 10, reelGain: 16, tickMs: 120 },
    'Cedar Creek': { difficulty: 4, fightDrift: 12, reelGain: 14, tickMs: 120 },
    'Ember Lake': { difficulty: 5, fightDrift: 14, reelGain: 14, tickMs: 110 },
  },
  missPenalty: { type: 'lineSlack', slackSeconds: 8, spotCooldownSeconds: 30 },
  pacing: {
    idleGapMs: { min: 4000, max: 9000 },
    difficultyRamp: { quests3to5: 1, quests6to8: 0.95, quests9to12: 0.9 },
  },
  economy: { idleCatchCoins: 5, handCatchCoins: 25, legendCatchCoins: 100 },
  performance: { lowMemoryGB: 2, lowMemoryBuzzMs: 30, lowMemoryIdleDelayMs: 9000, lowMemoryFightTickMs: 200 },
};

const save = loadSave();
let tuning = DEFAULT_TUNING;
let lowMemory = false;
let biteTimer = null;
let biteStartedAt = 0;
let currentBite = null; // { size, fish, firstAttempt }
let idleTimer = null;
let fightValue = 50;
// Quest clock (VEX 5.0 item 4): idle ms accrue while the line fishes on
// its own; active ms accrue inside a bite or a fight. Flushed to the
// playtest session as the game runs (noteQuestClock).
let activeStartedAt = 0;

function loadSave() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(SAVE_KEY)) || freshSave();
  } catch {
    s = freshSave();
  }
  // Migrate older saves: new fields default instead of breaking.
  s.coins ??= 0;
  s.fishCaught ??= 0;
  s.handCaught ??= 0;
  s.questIndex ??= 0;
  s.water ??= 'Millpond';
  s.collection ??= [];
  s.legends ??= [];
  s.haptics ??= true;
  s.createdAt ??= Date.now();
  s.lastSavedAt ??= null;
  s.sawTutorial ??= false;
  return s;
}

function freshSave() {
  return { coins: 0, fishCaught: 0, handCaught: 0, questIndex: 0, water: 'Millpond', collection: [], legends: [], haptics: true, createdAt: Date.now(), lastSavedAt: null, sawTutorial: false };
}

function persist() {
  save.lastSavedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage full / unavailable: say so instead of silently losing progress.
    const el = $('save-status');
    if (el) el.textContent = 'Save failed — storage unavailable';
    return;
  }
  const el = $('save-status');
  if (el) el.textContent = 'Saved ✓ ' + new Date(save.lastSavedAt).toLocaleTimeString();
}

// Back up the save (VEX fix #3): there is no cloud save yet, so the player
// can download their save as a file and keep it themselves. Deleting the
// app without a backup still loses progress — the tutorial says so.
function backupSave() {
  persist();
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'final-cast-save.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadTuning() {
  try {
    const res = await fetch('src/tuning.json');
    if (res.ok) tuning = { ...DEFAULT_TUNING, ...(await res.json()) };
  } catch {
    tuning = DEFAULT_TUNING; // offline / file:// preview keeps defaults
  }
}

function buzz(pattern = 40) {
  if (!save.haptics || !navigator.vibrate) return;
  // Low-memory mode: one short pulse instead of a vibration pattern.
  navigator.vibrate(lowMemory ? (tuning.performance?.lowMemoryBuzzMs ?? 30) : pattern);
}

// Audio bite cue (VEX 5.0 item 2): a two-tone beep (880 Hz then 1320 Hz)
// through WebAudio — no audio asset to download, and it plays alongside
// the visual BITE! banner and the haptic buzz so a miss feels fair, not
// random. Any failure (no AudioContext, sound blocked before a gesture)
// is silent: the visual cue and haptics still fire.
let audioCtx = null;
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const t = audioCtx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  } catch { /* audio cue is best-effort — visual + haptic still fire */ }
}

// Forgiving first-quest window (VEX 5.0 item 2): quests 1–2 use the wide
// firstQuestWindowMs from tuning so a first-time player succeeds most big
// bites; from quest 3 the per-size windows apply. The first-attempt grace
// period still adds on top for the hookset.
// Difficulty ramp (VEX 5.0 follow-up, suggestion 497): bite/hookset
// windows tighten by quest band — quests 3–5 at baseline, 6–8 at x0.95,
// 9–12 at x0.90 — so the arc gets harder only after the player has
// learned it. Quests 1–2 keep the forgiving first-quest window above.
// questIndex is 0-based: quest 6 is index 5, quest 9 is index 8.
function questWindowMultiplier() {
  const band = tuning.pacing?.difficultyRamp;
  if (!band) return 1;
  if (save.questIndex < 5) return band.quests3to5 ?? 1;
  if (save.questIndex < 8) return band.quests6to8 ?? 0.95;
  return band.quests9to12 ?? 0.9;
}
function biteWindowFor(size) {
  if (save.questIndex < 2) return tuning.firstQuestWindowMs?.biteMs ?? tuning.biteWindowMsBySize[size] ?? 1000;
  return Math.round((tuning.biteWindowMsBySize[size] ?? 1000) * questWindowMultiplier());
}
function hooksetWindowFor(size) {
  if (save.questIndex < 2) return tuning.firstQuestWindowMs?.hooksetMs ?? tuning.hooksetWindowMsBySize[size] ?? 700;
  return Math.round((tuning.hooksetWindowMsBySize[size] ?? 700) * questWindowMultiplier());
}

function sizeOf(fish) {
  if (Object.values(WATERS).some((w) => w.legend === fish)) return 'legend';
  return Math.random() < 0.25 ? 'large' : Math.random() < 0.5 ? 'medium' : 'small';
}

// Pond canvas (VEX 5.0 item 10): each water has its own dawn/dusk/night
// palette, and one pixel fish swims across the pond so the water is alive
// instead of a static gradient. In low-memory mode the fish is drawn once
// and does not animate.
let pondX = 0;
function drawPond() {
  const canvas = $('game');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const water = WATERS[save.water];
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, water.pond[0]);
  grad.addColorStop(1, water.pond[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Pixel fish: a body, a tail triangle and an eye, in the water's accent.
  const x = pondX % (canvas.width + 60);
  const y = canvas.height * 0.55 + Math.sin(pondX / 40) * 12;
  ctx.fillStyle = water.fishColor;
  ctx.fillRect(x, y, 34, 12);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 12, y + 6);
  ctx.lineTo(x, y + 12);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 24, y + 3, 3, 3);
}
function tickPond() {
  if (lowMemory) { drawPond(); return; } // static pond on small-RAM devices
  pondX += 2;
  drawPond();
  requestAnimationFrame(tickPond);
}

function render() {
  $('coins').textContent = save.coins;
  $('fish-count').textContent = save.fishCaught;
  $('water-label').textContent = `${save.water} — ${WATERS[save.water].timeOfDay}`;
  $('quest-name').textContent = `Quest ${save.questIndex + 1} of 12`;
  $('panel-quests').innerHTML =
    '<p>Quest log lives in <code>docs/quests.md</code>. Current quest: ' +
    `quest ${save.questIndex + 1} of 12 — see the table for its objective and unlock.</p>` +
    `<p>Hookset success by size: ${JSON.stringify(successRateBySize())}</p>`;
  $('panel-tackle').innerHTML =
    '<p>Rod / line / reel / tackle upgrades and lure unlocks. (Starter skeleton — upgrade shop wired in milestone 4.)</p>';
  $('panel-waters').innerHTML = Object.entries(WATERS)
    .map(([name, w]) => `<p><strong>${name}</strong> — legend: ${w.legend} at ${w.spot} (${w.timeOfDay})</p>`)
    .join('');
  $('panel-collection').innerHTML =
    `<p>Caught: ${save.collection.length} species. Legends: ${save.legends.join(', ') || 'none yet'}.</p>`;
  drawPond();
}

function scheduleIdleBite() {
  clearTimeout(idleTimer);
  // Low-memory mode (VEX fix #2): on small-RAM devices the idle line waits
  // a fixed, longer gap between bites, so the busiest moments do less
  // work per second on a low-end Android 6.0–8 phone.
  // Idle gap from tuning (0.2.6): pacing.idleGapMs, 4–9 s as shipped.
  const gap = tuning.pacing?.idleGapMs;
  const delay = lowMemory
    ? (tuning.performance?.lowMemoryIdleDelayMs ?? 9000)
    : gap ? gap.min + Math.random() * (gap.max - gap.min)
    : 4000 + Math.random() * 5000;
  try { noteQuestClock({ quest: save.questIndex + 1, idleMs: delay }); } catch { /* logging must never break the game */ }
  idleTimer = setTimeout(() => {
    const water = WATERS[save.water];
    const fish = water.fish[Math.floor(Math.random() * water.fish.length)];
    // Small fish are caught by the idle line automatically.
    if (Math.random() < 0.6) {
      save.fishCaught += 1;
      save.coins += tuning.economy?.idleCatchCoins ?? 5;
      save.collection.includes(fish) || save.collection.push(fish);
      persist();
      render();
      scheduleIdleBite();
      return;
    }
    startBite(fish);
  }, delay);
}

function startBite(fish) {
  const size = sizeOf(fish);
  currentBite = { size, fish, firstAttempt: true };
  biteStartedAt = performance.now();
  activeStartedAt = biteStartedAt;
  $('bite-cue').classList.remove('hidden');
  $('hook-btn').disabled = false;
  buzz([60, 40, 60]);
  beep();
  try { logBite({ size, outcome: 'shown', windowMs: biteWindowFor(size) }); } catch { /* logging must never break the game */ }
  const windowMs = biteWindowFor(size);
  biteTimer = setTimeout(() => missBite('The fish got away — bite window closed.'), windowMs);
}

function missBite(message) {
  if (!currentBite) return;
  const { size } = currentBite;
  const reactionMs = performance.now() - biteStartedAt;
  logHooksetAttempt({
    size,
    success: false,
    reactionMs,
    windowMs: hooksetWindowFor(size),
    firstAttempt: currentBite.firstAttempt,
    graceApplied: false,
  });
  try { logBite({ size, outcome: 'missed', reactionMs, windowMs: hooksetWindowFor(size) }); } catch { /* logging must never break the game */ }
  try { noteQuestClock({ quest: save.questIndex + 1, activeMs: reactionMs }); } catch { /* ignore */ }
  activeStartedAt = 0;
  endBite();
  // Stated miss penalty (src/tuning.json): line goes slack, spot rests.
  const penalty = tuning.missPenalty;
  alert(`${message}\nMiss penalty: line slack for ${penalty.slackSeconds}s; this spot rests for ${penalty.spotCooldownSeconds}s. No coins or tackle lost.`);
  setTimeout(scheduleIdleBite, penalty.slackSeconds * 1000);
}

function endBite() {
  clearTimeout(biteTimer);
  currentBite = null;
  $('bite-cue').classList.add('hidden');
  $('fight-bar').classList.add('hidden');
  $('hook-btn').disabled = true;
}

function hookset() {
  if (!currentBite) return;
  const reactionMs = performance.now() - biteStartedAt;
  const { size, fish, firstAttempt } = currentBite;
  const windowMs = hooksetWindowFor(size);
  const grace = firstAttempt ? tuning.firstAttemptGraceMs : 0;
  const success = reactionMs <= windowMs + grace;
  logHooksetAttempt({ size, success, reactionMs, windowMs, firstAttempt, graceApplied: success && reactionMs > windowMs });
  if (!success) {
    missBite('Too slow — the hookset missed.');
    return;
  }
  try { logBite({ size, outcome: 'hooked', reactionMs, windowMs }); } catch { /* logging must never break the game */ }
  endBite();
  // Fight: keep the bar in the green by tapping; difficulty comes from
  // the legend-fight table in tuning (VEX 5.0 item 2) — harder legends
  // drift faster and give less per reel tap. Non-legend fish fight at
  // the Millpond baseline.
  fightValue = 50;
  $('fight-bar').classList.remove('hidden');
  $('fight-text').textContent = `Fighting ${fish}! Tap the bar to reel.`;
  const legendFight = tuning.legendFight?.[save.water] ?? { fightDrift: 10, reelGain: 16, tickMs: 120 };
  // Low-memory mode (VEX fix #2): tick the fight bar slower on small-RAM devices.
  const tickMs = lowMemory ? (tuning.performance?.lowMemoryFightTickMs ?? 200) : legendFight.tickMs ?? 120;
  const fight = setInterval(() => {
    fightValue += (Math.random() - 0.45) * legendFight.fightDrift;
    fightValue = Math.max(0, Math.min(100, fightValue));
    $('fight-fill').style.width = `${fightValue}%`;
    if (fightValue <= 0 || fightValue >= 100) {
      clearInterval(fight);
      $('fight-bar').classList.add('hidden');
      if (activeStartedAt) {
        try { noteQuestClock({ quest: save.questIndex + 1, activeMs: performance.now() - activeStartedAt }); } catch { /* ignore */ }
        activeStartedAt = 0;
      }
      if (fightValue >= 100) {
        const firstHandCatch = save.handCaught === 0;
        save.handCaught += 1;
        save.fishCaught += 1;
        save.coins += size === 'legend'
          ? (tuning.economy?.legendCatchCoins ?? 100)
          : (tuning.economy?.handCatchCoins ?? 25);
        save.collection.includes(fish) || save.collection.push(fish);
        if (size === 'legend') {
          save.legends.push(fish);
          if (save.legends.length === 1) logPacingEvent('first_legend');
        }
        if (firstHandCatch) logPacingEvent('first_hand_catch');
        alert(`Caught ${fish}! (+${size === 'legend'
          ? (tuning.economy?.legendCatchCoins ?? 100)
          : (tuning.economy?.handCatchCoins ?? 25)} coins)`);
      } else {
        alert(`${fish} broke the line.`);
      }
      persist();
      render();
      scheduleIdleBite();
    }
  }, tickMs);
  $('fight-bar').onclick = () => { fightValue += legendFight.reelGain ?? 14; };
}

function initTabs() {
  document.querySelectorAll('#tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
      $(`panel-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });
}

async function init() {
  await loadTuning();
  // Low-memory mode (Lab fix #3): on small-RAM devices, cap effects —
  // one short haptic pulse, no pulsing bite-cue animation (see CSS
  // .low-memory). The RAM bucket is recorded in the playtest session.
  const ramGB = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const lowGB = tuning.performance?.lowMemoryGB ?? 2;
  lowMemory = ramGB !== null && ramGB <= lowGB;
  if (lowMemory) document.getElementById('app').classList.add('low-memory');
  recordDevice();
  if (!localStorage.getItem('finalcast.playtest.v0_2')) newSession();
  // Multi-phone playtest (VEX 5.0 item 1): screen size and orientation
  // are recorded automatically; the tester enters the phone model and
  // Android version in Settings (see below).
  try {
    setPhoneDetails({
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      orientation: window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait',
    });
  } catch { /* logging must never break the game */ }
  // Retention tracking (VEX fix #5): record today's play day so day-1 /
  // day-7 return can be read from the exported session.
  recordPlayDay();
  // Performance logging for the low-end test pass (Lab 3.8 fix #3):
  // load time once, frame drops for the first 10 minutes, JS heap
  // sampled every 30 s while the game runs. All on-device, exported
  // with the playtest session from Settings.
  try { recordLoadTime(); startFrameMonitor(); } catch { /* logging must never break the game */ }
  setInterval(() => { try { sampleMemory(); } catch { /* ignore */ } }, 30000);
  // Crash logging by device RAM (Lab fix #3). Logging must never break the game.
  window.addEventListener('error', (e) => {
    try { logCrash({ message: String((e && e.message) || 'unknown error'), source: (e && e.filename) || '' }); } catch { /* ignore */ }
  });
  // Autosave (Lab fix #2): persist whenever the page is hidden or unloaded,
  // so a background kill or reinstall-era tab close never loses progress.
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);
  // First-launch tutorial (Lab fix #4): unmissable, and it names the first
  // hand-fought fish and the first legend so the first 10 minutes have a
  // goal players can remember. It also states that saving is automatic.
  if (!save.sawTutorial) $('tutorial').classList.remove('hidden');
  $('tutorial-done').addEventListener('click', () => {
    save.sawTutorial = true;
    persist();
    $('tutorial').classList.add('hidden');
  });
  $('cast-btn').addEventListener('click', () => {
    $('cast-btn').disabled = true;
    setTimeout(() => { $('cast-btn').disabled = false; }, 1500);
    scheduleIdleBite();
  });
  $('hook-btn').addEventListener('click', hookset);
  $('opt-haptics').checked = save.haptics;
  $('opt-haptics').addEventListener('change', (e) => { save.haptics = e.target.checked; persist(); });
  $('opt-telemetry').checked = !TELEMETRY_OFF;
  $('opt-telemetry').disabled = TELEMETRY_OFF;
  $('export-playtest').addEventListener('click', () => { $('playtest-log').textContent = exportSession(); });
  $('backup-save').addEventListener('click', backupSave);
  // Test-phone details (VEX 5.0 item 1): the tester records which phone
  // this session ran on, so one exported log is one phone's full session.
  $('save-phone').addEventListener('click', () => {
    try {
      const phone = setPhoneDetails({
        model: $('phone-model').value.trim(),
        androidVersion: $('android-version').value.trim(),
      });
      $('phone-status').textContent = `Phone saved: ${phone.model || 'unknown model'} / Android ${phone.androidVersion || 'unknown'} (${phone.screenSize || ''} ${phone.orientation || ''})`;
    } catch {
      $('phone-status').textContent = 'Could not save phone details.';
    }
  });
  initTabs();
  render();
  tickPond();
  persist(); // show "Saved ✓" on launch so autosave is visible from the start
  scheduleIdleBite();
  if (window.matchMedia('(orientation: landscape)').matches) {
    document.getElementById('app').classList.replace('portrait', 'landscape');
  }
}

init();
