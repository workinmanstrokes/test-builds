// Final Cast v0.2 — idle fishing with hand-fought big bites.
// Vanilla JS, no dependencies. Tuning lives in src/tuning.json; hookset
// logging lives in src/playtest.js. Saves live in localStorage.

import { logHooksetAttempt, successRateBySize, exportSession, newSession } from './playtest.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'finalcast.save.v0_2';
const TELEMETRY_OFF =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  navigator.doNotTrack === '1';

const WATERS = {
  Millpond: { legend: 'Old Mossback', spot: 'Sunken Log', timeOfDay: 'dawn', fish: ['Bluegill', 'Perch', 'Bass'] },
  'Cedar Creek': { legend: 'Silver King', spot: 'Boulder Run', timeOfDay: 'dusk', fish: ['Trout', 'Chub', 'Salmon'] },
  'Ember Lake': { legend: 'Emberfin', spot: 'Hot Spring Inlet', timeOfDay: 'night', fish: ['Ember Trout', 'Lava Carp', 'Cinder Catfish'] },
};

const DEFAULT_TUNING = {
  biteWindowMsBySize: { small: 1400, medium: 1000, large: 750, legend: 600 },
  hooksetWindowMsBySize: { small: 900, medium: 700, large: 550, legend: 450 },
  firstAttemptGraceMs: 250,
  missPenalty: { type: 'lineSlack', slackSeconds: 8, spotCooldownSeconds: 30 },
};

const save = loadSave();
let tuning = DEFAULT_TUNING;
let biteTimer = null;
let biteStartedAt = 0;
let currentBite = null; // { size, fish, firstAttempt }
let idleTimer = null;
let fightValue = 50;

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || freshSave();
  } catch {
    return freshSave();
  }
}

function freshSave() {
  return { coins: 0, fishCaught: 0, questIndex: 0, water: 'Millpond', collection: [], legends: [], haptics: true };
}

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
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
  if (save.haptics && navigator.vibrate) navigator.vibrate(pattern);
}

function sizeOf(fish) {
  if (Object.values(WATERS).some((w) => w.legend === fish)) return 'legend';
  return Math.random() < 0.25 ? 'large' : Math.random() < 0.5 ? 'medium' : 'small';
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
}

function scheduleIdleBite() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const water = WATERS[save.water];
    const fish = water.fish[Math.floor(Math.random() * water.fish.length)];
    // Small fish are caught by the idle line automatically.
    if (Math.random() < 0.6) {
      save.fishCaught += 1;
      save.coins += 5;
      save.collection.includes(fish) || save.collection.push(fish);
      persist();
      render();
      scheduleIdleBite();
      return;
    }
    startBite(fish);
  }, 4000 + Math.random() * 5000);
}

function startBite(fish) {
  const size = sizeOf(fish);
  currentBite = { size, fish, firstAttempt: true };
  biteStartedAt = performance.now();
  $('bite-cue').classList.remove('hidden');
  $('hook-btn').disabled = false;
  buzz([60, 40, 60]);
  const windowMs = tuning.biteWindowMsBySize[size] ?? 1000;
  biteTimer = setTimeout(() => missBite('The fish got away — bite window closed.'), windowMs);
}

function missBite(message) {
  if (!currentBite) return;
  const { size } = currentBite;
  logHooksetAttempt({
    size,
    success: false,
    reactionMs: performance.now() - biteStartedAt,
    windowMs: tuning.hooksetWindowMsBySize[size] ?? 700,
    firstAttempt: currentBite.firstAttempt,
    graceApplied: false,
  });
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
  const windowMs = tuning.hooksetWindowMsBySize[size] ?? 700;
  const grace = firstAttempt ? tuning.firstAttemptGraceMs : 0;
  const success = reactionMs <= windowMs + grace;
  logHooksetAttempt({ size, success, reactionMs, windowMs, firstAttempt, graceApplied: success && reactionMs > windowMs });
  if (!success) {
    missBite('Too slow — the hookset missed.');
    return;
  }
  endBite();
  // Fight: keep the bar in the green by tapping; simplified for the skeleton.
  fightValue = 50;
  $('fight-bar').classList.remove('hidden');
  $('fight-text').textContent = `Fighting ${fish}! Tap the bar to reel.`;
  const fight = setInterval(() => {
    fightValue += (Math.random() - 0.45) * 12;
    fightValue = Math.max(0, Math.min(100, fightValue));
    $('fight-fill').style.width = `${fightValue}%`;
    if (fightValue <= 0 || fightValue >= 100) {
      clearInterval(fight);
      $('fight-bar').classList.add('hidden');
      if (fightValue >= 100) {
        save.fishCaught += 1;
        save.coins += size === 'legend' ? 100 : 25;
        save.collection.includes(fish) || save.collection.push(fish);
        if (size === 'legend') save.legends.push(fish);
        alert(`Caught ${fish}! (+${size === 'legend' ? 100 : 25} coins)`);
      } else {
        alert(`${fish} broke the line.`);
      }
      persist();
      render();
      scheduleIdleBite();
    }
  }, 120);
  $('fight-bar').onclick = () => { fightValue += 14; };
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
  if (!localStorage.getItem('finalcast.playtest.v0_2')) newSession();
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
  initTabs();
  render();
  scheduleIdleBite();
  if (window.matchMedia('(orientation: landscape)').matches) {
    document.getElementById('app').classList.replace('portrait', 'landscape');
  }
}

init();
