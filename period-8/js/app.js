// Period 8: UI + flow. Title -> loops (look around, decide) -> correct / miss (+ jump scare) -> endings.
import { View, FACES } from './view.js';
import { byId } from './anomalies.js';
import * as G from './game.js';
import * as sfx from './audio.js';
import { initAds, showRewarded, rewardGate, adsInfo, showPrivacyOptions, consentAllowsAnalytics } from './ads.js';
import { iapInfo, buyRemoveAds } from './iap.js';
import { track, setAnalyticsAllowed } from './analytics.js';
import { buzzPhone, thud, setHaptics } from './haptics.js';
import { playScare } from './scare.js';
import { drawEnding } from './endings.js';
import { saveImage } from './shot.js';
import { Clip } from './clip.js';
import { PRIVACY_URL } from './config.js';
import { fx } from './scenes.js';
import * as P8 from './portal.js';
import { checkUnlocks, flashlight, FLASHLIGHTS, STICKERS, stickersEarned, lightUnlocked, notebookCount, nextUnlock, NOTEBOOK_TOTAL } from './meta.js';
P8.initPortal(); // portal SDK (Poki / CrazyGames) starts loading in parallel; no-op elsewhere
const bootBar = document.getElementById('bootBar'); if (bootBar) bootBar.style.width = '70%';

const $ = s => document.querySelector(s);
const save = G.loadSave(localStorage); const persist = () => G.writeSave(localStorage, save);
let run = null, busy = false, mode = 'title';
const view = new View($('#view'), { onTap });
setHaptics(save.settings.haptics); sfx.setMuted(!save.settings.sound); applyAccess();

/* ------------------------------------------------------------ helpers */
function toast(msg, ms = 2400) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); }
function modal(html, { cls = '' } = {}) { const m = $('#modal'); $('#modalCard').className = 'card ' + cls; $('#modalCard').innerHTML = html; m.hidden = false; return $('#modalCard'); }
function closeModal() { $('#modal').hidden = true; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function animate(ms, fn) { return new Promise(res => { const t0 = performance.now(); const f = () => { const k = Math.min(1, (performance.now() - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); }
const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
function show(id) { for (const s of ['#title', '#hud', '#clip', '#ending']) $(s).hidden = s !== id; mode = id.slice(1); }

/* ------------------------------------------------------------ title */
function title() {
  show('#title'); view.enabled = false; closeModal(); P8.gameplay(false); endColdOpen(true);
  // live title: Room 8's door with light flickering behind its window (titleDoor), slow idle drift in frame()
  view.setScene({ ...G.stateFor({ scene: 'hall', anomaly: null }), titleDoor: true }, { camX: 1640 }); view.dim = 0.35; view.camY = 470; view.clampY();
  const hasRun = !!save.run;
  $('#btnContinue').hidden = !hasRun; $('#btnNew').hidden = !hasRun; $('#btnStart').hidden = hasRun;
  if (hasRun) $('#btnContinue').textContent = `Continue · ${save.run.streak}/8`;
  $('#endingCount').textContent = `${Object.keys(save.endings).length}/3 endings · notebook ${notebookCount(save)}/${NOTEBOOK_TOTAL}`;
  renderLocker(); sfx.ambience('menu');
}
function renderLocker() {
  const got = stickersEarned(save);
  $('#lkStickers').innerHTML = got.map((st, i) => `<i class="stk" style="background:${st.col};--r:${(i * 37) % 24 - 12}deg" title="${st.label}">${st.icon}</i>`).join('');
}
// Difficulty + speedrun picker before every fresh run (not the first-launch cold open, not resumes).
function pickRun() {
  const d0 = save.lastDiff || 'normal', bests = save.speedBest || {};
  modal(`<h2>New run</h2><div class="diffs">${Object.entries(G.DIFFICULTY).map(([k, D]) => `<button class="btn diff${k === d0 ? ' sel' : ''}" data-d="${k}"><b>${D.label}</b><small>${k === 'easy' ? 'Obvious anomalies, a few more of them' : k === 'normal' ? 'The intended experience' : `Subtle anomalies · ${D.loopMs / 1000}s per loop`}</small></button>`).join('')}</div>
    <label class="srun"><input type="checkbox" id="mSpeed" ${save.lastSpeed ? 'checked' : ''}> Speedrun timer <small class="dim" id="mBest"></small></label>
    <div class="row"><button class="btn" id="mNo">Cancel</button><button class="btn primary" id="mGo">Start</button></div>`);
  let d = d0; const best = () => { $('#mBest').textContent = bests[d] ? `best ${G.fmtTime(bests[d])}` : ''; }; best();
  document.querySelectorAll('.diff').forEach(b => b.onclick = () => { sfx.ui(); d = b.dataset.d; document.querySelectorAll('.diff').forEach(x => x.classList.toggle('sel', x === b)); best(); });
  $('#mNo').onclick = closeModal;
  $('#mGo').onclick = () => { save.lastDiff = d; save.lastSpeed = $('#mSpeed').checked; persist(); closeModal(); startRun(null, { diff: d, speedrun: save.lastSpeed }); };
}
$('#btnStart').onclick = () => { sfx.unlockAudio(); sfx.ui(); pickRun(); };
$('#btnNew').onclick = () => { sfx.unlockAudio(); sfx.ui(); if (save.run) { modal(`<h2>Start over?</h2><p>Your current run (${save.run.streak}/8) will be lost.</p><div class="row"><button class="btn" id="mNo">Cancel</button><button class="btn primary" id="mYes">New run</button></div>`); $('#mNo').onclick = closeModal; $('#mYes').onclick = () => { closeModal(); pickRun(); }; } else pickRun(); };
$('#btnContinue').onclick = () => { sfx.unlockAudio(); sfx.ui(); startRun(save.run); };
$('#btnClip').onclick = () => { sfx.unlockAudio(); sfx.ui(); openClip(); };
$('#btnEndings').onclick = () => { sfx.unlockAudio(); sfx.ui(); endingsModal(); };
$('#btnTitleSettings').onclick = () => { sfx.unlockAudio(); settings(); };
$('#locker').onclick = () => { sfx.unlockAudio(); sfx.ui(); lockerModal(); };

/* ------------------------------------------------------------ run flow */
async function startRun(resume = null, { coldOpen = false, diff = 'normal', speedrun = false } = {}) {
  run = G.newRun(undefined, resume ? { diff: resume.diff, speedrun: resume.speedrun } : { diff, speedrun }); if (resume) Object.assign(run, { speedMs: resume.speedMs || 0, streak: resume.streak, loops: resume.loops, misses: resume.misses, pass: resume.pass, log: Array.isArray(resume.log) ? resume.log : [], startedAt: Date.now() - (resume.playedMs || 0) });
  save.runsStarted = (save.runsStarted || 0) + 1; track(resume ? 'run_resume' : 'run_start', { difficulty: run.diff, speedrun: run.speedrun ? 1 : 0 });
  show('#hud'); view.dim = 0;
  beginLoop({ coldOpen });
}
// Cold open (intros plan): ~6 s of text over the live, playable hallway; the bell rings and the clock reads 8:00.
// Tap Skip (or wait) and the choice buttons appear. Replaces the old rules popup: the game teaches by playing.
const CO_LINES = ['8:00. The last bell never rang.', 'The hallway outside Room 8 keeps repeating.', 'If anything is different, turn back.', 'Eight normal loops in a row, and you can go home.'];
let coTimers = [], coActive = false, coBellRung = false;
function coldOpen() {
  coActive = true; coBellRung = false; $('#hud').classList.add('cold'); $('#coldopen').hidden = false; const line = $('#coLine');
  if (sfx.audioReady()) { sfx.bell(1.6); coBellRung = true; }
  CO_LINES.forEach((txt, i) => { coTimers.push(setTimeout(() => { line.classList.remove('on'); coTimers.push(setTimeout(() => { line.textContent = txt; line.classList.add('on'); }, 180)); }, i * 1500)); });
  coTimers.push(setTimeout(() => endColdOpen(), 6200));
}
function endColdOpen(silent = false) {
  if (!coActive) return; coActive = false; coTimers.forEach(clearTimeout); coTimers = [];
  $('#coldopen').hidden = true; $('#coLine').classList.remove('on'); $('#hud').classList.remove('cold');
  save.introSeen = true; persist(); if (!silent && run) toast('Look around and remember everything. Then keep going.', 4200);
}
$('#coSkip').onclick = () => { sfx.unlockAudio(); endColdOpen(); };
// The snapshot keeps the loop log + play time so a resumed run's ending stats (anomalies spotted, minutes) stay correct.
function snapshotRun() { save.run = run && !run.ending ? { streak: run.streak, loops: run.loops, misses: run.misses, pass: run.pass, diff: run.diff, speedrun: run.speedrun, speedMs: run.speedMs, log: run.log.map(({ scene, anomaly, correct }) => ({ scene, anomaly, correct })), playedMs: Date.now() - run.startedAt } : null; persist(); }

function beginLoop({ coldOpen: cold = false } = {}) {
  const cur = G.nextLoop(run, save), S = G.stateFor(cur);
  view.setScene(S, { camX: 500 }); view.enabled = true; view.fade = 1; view.walk = 0;
  sfx.ambience(cur.scene); sfx.stopLoops(); if (S.flicker) sfx.buzz(true); if (S.fountain) sfx.water(true);
  run.loopLeft = G.diffOf(run).loopMs; hud(); busy = false; track('loop_start', { loop: run.loops, scene: cur.scene, anomaly: cur.anomaly || 'none' }); track('da_level_start', { level: run.loops });
  animate(600, k => { view.fade = 1 - k; });
  if (cold) return coldOpen();
  // warn once before "game-over" anomalies can appear (level plan: warn before mean traps)
  if (run.loops >= G.SHOWCASE_FROM && !save.warnedOver) { save.warnedOver = true; persist(); return toast('From here on, some anomalies are dangerous. Walk past one and the Hall Monitor comes for you.', 5200); }
  const tip = run.loops === 0 ? 'The hallway outside Room 8. Look around and remember everything.' : run.loops === 1 ? 'Room 8. Remember this room too.' : run.loops === 2 ? 'Now: anything different? Turn back. All normal? Keep going.' : '';
  if (tip) toast(tip, 4200);
}
function hud() {
  const pips = $('#pips'); pips.innerHTML = ''; for (let i = 0; i < G.GOAL; i++) { const b = document.createElement('i'); if (i < run.streak) b.className = 'on'; pips.appendChild(b); }
  $('#loopNum').textContent = `${run.streak}/${G.GOAL}`; $('#misses').textContent = run.misses ? `${run.misses}/${G.MAX_MISSES} misses` : '';
  $('#speed').hidden = !run.speedrun; $('#loopTimer').hidden = !G.diffOf(run).loopMs; tickHud();
  $('#passIcon').hidden = !run.pass; $('#btnHint').classList.toggle('used', !!run.hintUsed);
  $('#btnBack').textContent = run.current.scene === 'hall' ? '↩ Turn back' : '↩ Leave';
  $('#btnFwd').textContent = run.current.scene === 'hall' ? 'Keep going →' : 'Next period →';
}
function tickHud() { if (!run) return; if (run.speedrun) $('#speed').textContent = G.fmtTime(run.speedMs);
  if (G.diffOf(run).loopMs) { const s = Math.ceil((run.loopLeft || 0) / 1000); $('#loopTimer').textContent = `⏱ ${s}s`; $('#loopTimer').classList.toggle('low', s <= 5); } }
// Run clocks: advance only while the player can act (not in modals, ads, cold open, scares or pause).
let clockT = 0;
function runClock(t) {
  const dt = clockT ? Math.min(100, t - clockT) : 0; clockT = t;
  if (mode !== 'hud' || !run || run.ending || busy || coActive || !$('#modal').hidden || !view.enabled || document.hidden) return;
  if (run.speedrun) run.speedMs += dt;
  if (G.diffOf(run).loopMs) { run.loopLeft -= dt; if (run.loopLeft <= 0) { run.loopLeft = 0; tickHud(); toast('Too slow. The hallway moved you on.', 2000); return choose('forward'); } }
  tickHud();
}
let lastFace = -1, lastSec = -1;
function compass() {
  const faces = FACES[view.S?.scene || 'hall'], x = ((view.camX % 4000) + 4000) % 4000;
  const strip = $('#compass'); const off = -(x / 1000) * 90; strip.style.setProperty('--off', off + 'px');
  if (strip.dataset.scene !== view.S.scene) { strip.dataset.scene = view.S.scene; strip.querySelector('.track').innerHTML = [...faces, ...faces, ...faces].map(f => `<span>${f}</span>`).join(''); }
}
async function choose(choice) {
  if (busy || !run) return; busy = true; view.enabled = false; sfx.unlockAudio();
  const cur = run.current, res = G.decide(run, save, choice); persist();
  track('loop_result', { result: res.kind, choice, correct: res.correct ? 1 : 0, scene: cur.scene, anomaly: cur.anomaly || 'none', streak: res.streak, loop: run.loops, misses: run.misses });
  track(res.correct ? 'da_level_complete' : 'da_level_fail', { level: run.loops, deaths: res.correct ? 0 : 1 });
  if (choice === 'back') { sfx.turn(); const from = view.camX; await animate(520, k => { view.camX = from + ease(k) * 2000; view.fade = k * 0.3; }); }
  unlockToasts();
  // Only "game-over" anomalies bring the Hall Monitor; missing an easy/hard one is a quieter fail.
  if (res.kind === 'missed') { sfx.stopLoops(); thud(); if (res.anomaly.kind === 'over') await scare(); else { sfx.falseAlarm(); view.shake = 0.6; await sleep(500); } return reveal(res); }
  for (let i = 0; i < 4; i++) setTimeout(() => sfx.step(i), i * 210);
  await animate(850, k => { view.walk = ease(k); view.fade = 0.3 + k * 0.7; });
  sfx.stopLoops();
  if (res.kind === 'false_alarm') { sfx.falseAlarm(); buzzPhone(80); return reveal(res); }
  sfx.correct(run.streak); buzzPhone(20);
  if (res.ending) return ending(res.ending);
  snapshotRun(); await bigText(`${run.streak}`, run.streak === G.GOAL - 1 ? 'one more…' : 'in a row'); beginLoop();
}
async function bigText(n, sub) { const el = $('#big'); el.innerHTML = `<b>${n}</b><small>${sub}</small>`; el.classList.add('on'); await sleep(900); el.classList.remove('on'); await sleep(150); }
async function scare() { sfx.scare(save.settings.scares === 'soft'); await playScare($('#scare'), save.settings.scares === 'soft', save.settings.reduceFlash); }
async function reveal(res) {
  $('#toast').classList.remove('on'); view.fade = 0; view.walk = 0; view.enabled = true;
  if (res.anomaly) { view.reveal = res.anomaly; const [x, y, w, h] = res.anomaly.region; view.lookAt(x + w / 2, y + h / 2); }
  const lost = run.lostStreak, canKeep = G.canKeepStreak(run), gate = rewardGate(save, 'keep');
  const head = res.kind !== 'missed' ? `Nothing was wrong.` : res.anomaly.kind === 'over' ? `The Hall Monitor caught you.` : `You missed it.`;
  const body = res.kind === 'missed' ? `<p class="miss">${res.anomaly.name}.</p>` : `<p>That loop was perfectly normal. Trust what you remember.</p>`;
  if (res.ending) { snapshotRun(); await sleep(400); return ending(res.ending); }
  const card = modal(`<h2>${head}</h2>${body}<p class="dim">The count resets. ${run.misses}/${G.MAX_MISSES} misses.</p>
    <div class="row col">${canKeep ? `<button class="btn reward" id="mKeep" ${gate.ok ? '' : 'disabled'}><span class="tv">▶</span> Keep my ${lost}-loop streak${gate.ok ? '' : ` (${gate.why})`}</button>` : ''}
    <button class="btn primary" id="mNext">Try again</button></div>`, { cls: 'reveal' });
  card.parentElement.classList.add('low');
  if (canKeep && gate.ok) track('ad_reward_offer', { placement: 'keep' });
  const go = () => { card.parentElement.classList.remove('low'); closeModal(); view.reveal = null; view.enabled = false; snapshotRun(); animate(400, k => { view.fade = k; }).then(beginLoop); };
  $('#mNext').onclick = () => { sfx.ui(); if (canKeep && gate.ok) track('ad_reward_declined', { placement: 'keep' }); go(); };
  if (canKeep) $('#mKeep').onclick = async () => { const ok = await showRewarded(save, 'keep'); persist(); if (ok && G.keepStreak(run)) { toast(`Streak kept: ${run.streak}/8`); track('streak_kept', { streak: run.streak }); go(); } else toast('No reward this time.'); };
}
async function hint() {
  if (!run || busy) return; if (run.hintUsed) return toast('One hint per loop.');
  const g = rewardGate(save, 'hint'); if (!g.ok) return toast(g.why);
  modal(`<h2>Need a hint?</h2><p>Watch a short video and your gut will point you to the spot that feels wrong, or tell you all is well.</p><div class="row"><button class="btn" id="mNo">No thanks</button><button class="btn reward primary" id="mYes"><span class="tv">▶</span> Watch</button></div>`);
  track('ad_reward_offer', { placement: 'hint' });
  $('#mNo').onclick = () => { track('ad_reward_declined', { placement: 'hint' }); closeModal(); };
  $('#mYes').onclick = async () => { closeModal(); const ok = await showRewarded(save, 'hint'); persist(); if (!ok) return toast('No reward this time.');
    run.hintUsed = true; hud(); track('hint_used', { anomaly: run.current.anomaly || 'none' });
    const a = run.current.anomaly && byId[run.current.anomaly];
    if (a) { view.showHint(a.region); toast('Something over there feels wrong…', 3000); } else toast('Your gut says… everything here is normal.', 3200); };
}
function onTap(x, y) {
  if (mode !== 'hud' || !run) return; sfx.inspect();
  const a = run.current?.anomaly && byId[run.current.anomaly];
  if (a?.id === 'hall_pass' && G.inRegion(a.region, x, y, 24) && G.collectPass(run)) { sfx.pickup(); buzzPhone(40); track('hall_pass'); hud(); snapshotRun(); toast('You found a golden HALL PASS. Hold on to it until the final bell…', 4500); }
}
$('#btnBack').onclick = () => choose('back');
$('#btnFwd').onclick = () => choose('forward');
$('#btnHint').onclick = () => { sfx.ui(); hint(); };
$('#btnShot').onclick = () => { sfx.ui(); shotMenu(); };
$('#btnPause').onclick = () => { sfx.ui(); pauseMenu(); };

/* ------------------------------------------------------------ endings */
async function ending(id) {
  const rec = G.recordSpeed(save, run); save.run = null; persist(); track('ending_reached', { ending: id, loops: run.loops, misses: run.misses, minutes: Math.round((Date.now() - run.startedAt) / 60000), pass: run.pass ? 1 : 0, endings_found: Object.keys(save.endings).length });
  view.enabled = false; sfx.stopLoops(); P8.gameplay(false);
  if (id !== 'bad') { sfx.bell(); view.fade = 1; await sleep(1400); }
  else { sfx.falseAlarm(); await sleep(900); }
  const E = G.ENDINGS[id], mins = Math.max(1, Math.round((Date.now() - run.startedAt) / 60000)), spotted = run.log.filter(l => l.anomaly && l.correct).length;
  show('#ending'); drawEnding($('#endArt'), id);
  $('#endTitle').textContent = E.title; $('#endBlurb').textContent = E.blurb;
  $('#endStats').textContent = `${G.diffOf(run).label} · ${run.speedrun && id !== 'bad' ? `⏱ ${G.fmtTime(run.speedMs)}${rec ? ' NEW BEST' : ` (best ${G.fmtTime(save.speedBest[run.diff])})`} · ` : ''}${run.loops} loops · ${spotted} ${spotted === 1 ? 'anomaly' : 'anomalies'} spotted · ${run.misses} ${run.misses === 1 ? 'miss' : 'misses'} · ${mins} min`;
  $('#endTag').textContent = `Ending ${Object.keys(save.endings).length}/3 found`;
  unlockToasts();
}
$('#btnEndAgain').onclick = () => { sfx.ui(); startRun(null, { diff: run?.diff, speedrun: run?.speedrun }); };
$('#btnEndTitle').onclick = () => { sfx.ui(); title(); };
$('#btnEndShot').onclick = async () => { const r = await saveImage($('#endArt'), 'period8-ending'); if (r.ok) toast('Saved'); };
function endingsModal() {
  const hints = { normal: 'Reach 8 in a row.', secret: 'Something golden is hiding in the hallway…', bad: 'Miss too many times.' };
  const n = notebookCount(save), nx = nextUnlock(save), where = { hall: 'hallway', class: 'classroom' };
  const items = Object.values(byId).map(a => save.seen[a.id] ? `<li>${a.name}</li>` : `<li class="unseen">??? · ${where[a.scene]}</li>`).join('');
  modal(`<h2>Endings</h2><div class="ends">${Object.values(G.ENDINGS).map(e => save.endings[e.id] ? `<div class="end on"><b>${e.title}</b><small>${e.blurb}</small></div>` : `<div class="end"><b>???</b><small>${hints[e.id]}</small></div>`).join('')}</div>
    <h3>Anomaly notebook · ${n}/${NOTEBOOK_TOTAL}</h3><ul class="notebook journal">${items}</ul>
    <p class="dim">${nx ? `${nx.left} more ${nx.left === 1 ? 'entry unlocks' : 'entries unlock'} a new flashlight colour.` : 'Every flashlight colour unlocked.'} Best streak ${save.best}/8 · Clip mode best ${save.clipBest}/10</p><div class="row"><button class="btn" id="mLocker">Locker</button><button class="btn primary" id="mClose">Close</button></div>`);
  $('#mClose').onclick = closeModal; $('#mLocker').onclick = lockerModal;
}
// Locker: cosmetic stickers + flashlight colour (unlocked by the notebook / endings; nothing for sale, no stats).
function lockerModal() {
  checkUnlocks(save); persist(); const have = new Set(stickersEarned(save).map(s => s.id)), cur = flashlight(save).id;
  modal(`<h2>Your locker</h2><p class="dim">Spot anomalies to fill your notebook: every 10 entries unlocks a flashlight colour. Endings earn stickers.</p>
    <h3>Flashlight</h3><div class="lights">${FLASHLIGHTS.map(f => `<button class="light ${f.id === cur ? 'on' : ''}" data-l="${f.id}" ${lightUnlocked(save, f.id) ? '' : 'disabled'}><i style="background:${f.color}"></i>${lightUnlocked(save, f.id) ? f.name : `${f.need} entries`}</button>`).join('')}</div>
    <h3>Stickers · ${have.size}/${STICKERS.length}</h3><div class="stickers">${STICKERS.map(st => `<div class="stk-wrap"><span class="stk big ${have.has(st.id) ? '' : 'locked'}" style="background:${st.col}">${st.icon} ${have.has(st.id) ? st.label : '???'}</span><small>${st.how}</small></div>`).join('')}</div>
    <div class="row"><button class="btn primary" id="mClose">Close</button></div>`);
  document.querySelectorAll('.light[data-l]').forEach(b => b.onclick = () => { save.cosmetics.light = b.dataset.l; persist(); applyAccess(); sfx.ui(); lockerModal(); });
  $('#mClose').onclick = () => { closeModal(); if (mode === 'title') renderLocker(); };
}
function unlockToasts() {
  const fresh = checkUnlocks(save); if (!fresh.length) return; persist();
  toast(`Unlocked: ${fresh.map(f => f.name).join(', ')}. See your locker.`, 4200); if (mode === 'title') renderLocker();
}

/* ------------------------------------------------------------ menus */
function pauseMenu() {
  if (!run) return; P8.gameplay(false); endColdOpen(true);
  modal(`<h2>Paused</h2><p>Streak ${run.streak}/8 · ${run.misses} misses${run.pass ? ' · 🎫 hall pass' : ''}</p><div class="row col"><button class="btn primary" id="mResume">Resume</button><button class="btn" id="mRestart">Restart run</button><button class="btn" id="mSet">Settings</button><button class="btn" id="mTitle">Home</button></div>`, { cls: 'pause' });
  $('#mResume').onclick = resume; $('#mSet').onclick = settings; $('#mTitle').onclick = () => { snapshotRun(); title(); };
  $('#mRestart').onclick = () => { closeModal(); save.run = null; persist(); startRun(); };
}
function resume() { closeModal(); sfx.pauseAudio(false); }
// Auto-pause on blur / tab switch (intros plan): pause menu in a run, frozen timer in clip mode, audio suspended.
function autoPause() {
  snapshotRun(); sfx.pauseAudio(true); P8.gameplay(false);
  if (mode === 'hud' && run && !busy && $('#modal').hidden) pauseMenu();
  if (mode === 'clip' && clip?.running && !clip.paused) { clip.pause(); modal(`<h2>Paused</h2><div class="row col"><button class="btn primary" id="mResume">Resume</button></div>`); $('#mResume').onclick = () => { closeModal(); clip.resume(); }; }
}
addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); else if ($('#modal').hidden || mode !== 'hud') sfx.pauseAudio(false); });
addEventListener('focus', () => { if (!document.hidden && !$('#modal').querySelector('#mResume')) sfx.pauseAudio(false); });
function settings() {
  const s = save.settings, ia = iapInfo(), ad = adsInfo();
  modal(`<h2>Settings</h2>
    <label class="tog"><span>Sound</span><input type="checkbox" id="sSound" ${s.sound ? 'checked' : ''}></label>
    <label class="tog"><span>Jump scares</span><select id="sScare"><option value="full">Full</option><option value="soft">Gentle</option></select></label>
    <label class="tog"><span>Music</span><input type="range" id="sMusic" min="0" max="1" step="0.05" value="${s.music}"></label>
    <label class="tog"><span>Sound effects</span><input type="range" id="sSfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
    <label class="tog"><span>Reduce flashing</span><input type="checkbox" id="sFlash" ${s.reduceFlash ? 'checked' : ''}></label>
    <label class="tog"><span>Vibration</span><input type="checkbox" id="sHap" ${s.haptics ? 'checked' : ''}></label>
    <label class="tog"><span>Share anonymous gameplay stats</span><input type="checkbox" id="sStats" ${s.analytics !== false ? 'checked' : ''}></label>
    ${ia.enabled ? `<button class="btn" id="sIap">Remove ads · ${ia.price}</button>` : ''}
    ${ad.privacyRequired ? '<button class="btn" id="sPriv">Privacy options</button>' : ''}
    <a class="btn" href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy policy</a>
    <button class="btn danger" id="sReset">Reset progress</button>
    <p class="dim">Period 8 v0.1.0 · Diddlerrr · Rewarded ads only, never forced.</p>
    <div class="row"><button class="btn primary" id="mClose">Done</button></div>`);
  $('#sScare').value = s.scares;
  $('#sSound').onchange = e => { s.sound = e.target.checked; sfx.setMuted(!s.sound); persist(); };
  $('#sScare').onchange = e => { s.scares = e.target.value; persist(); };
  $('#sMusic').oninput = e => { s.music = +e.target.value; applyAccess(); persist(); };
  $('#sSfx').oninput = e => { s.sfx = +e.target.value; applyAccess(); persist(); };
  $('#sFlash').onchange = e => { s.reduceFlash = e.target.checked; applyAccess(); persist(); };
  $('#sHap').onchange = e => { s.haptics = e.target.checked; setHaptics(s.haptics); persist(); };
  if ($('#sIap')) track('remove_ads_shown');
  if ($('#sIap')) $('#sIap').onclick = async () => { const r = await buyRemoveAds(save); if (r.ok) track('iap_purchase'); toast(r.ok ? 'Ads removed. Thank you!' : r.why); persist(); };
  $('#sStats').onchange = e => { s.analytics = e.target.checked; persist(); applyAnalyticsChoice(); };
  if ($('#sPriv')) $('#sPriv').onclick = async () => { await showPrivacyOptions(); applyAnalyticsChoice(); };
  $('#sReset').onclick = () => { if (confirm('Erase all progress, endings and the anomaly journal?')) { localStorage.removeItem(G.SAVE_KEY); location.reload(); } };
  $('#mClose').onclick = () => { if (mode === 'hud' && run && !busy) pauseMenu(); else closeModal(); };
}
function applyAccess() {
  const s = save.settings; fx.reduceFlash = !!s.reduceFlash; document.documentElement.classList.toggle('reduce-flash', fx.reduceFlash);
  sfx.setVolumes({ music: s.music, sfx: s.sfx }); const f = flashlight(save); document.documentElement.style.setProperty('--light', f.color);
  view.light = [1, 3, 5].map(i => parseInt(f.color.slice(i, i + 2), 16));
}
function shotMenu() {
  modal(`<h2>Screenshot</h2><p>Saves exactly what you see (no buttons) with a small PERIOD 8 tag.</p><div class="row col"><button class="btn primary" id="shFull">Save view</button><button class="btn" id="shTall">Save 9:16 for Shorts/TikTok</button><button class="btn" id="shCancel">Cancel</button></div>`);
  $('#shCancel').onclick = closeModal;
  const go = async vertical => { closeModal(); await sleep(60); const c = view.capture({ vertical }); const f = $('#flash'); if (!save.settings.reduceFlash) { f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 180); } const r = await saveImage(c); track('screenshot', { vertical }); if (r.ok) toast(r.shared ? 'Shared' : 'Screenshot saved'); };
  $('#shFull').onclick = () => go(false); $('#shTall').onclick = () => go(true);
}

/* ------------------------------------------------------------ clip mode */
let clip = null;
function openClip() {
  show('#clip'); view.enabled = false; sfx.ambience('class');
  clip = clip || new Clip($('#clip'), { save }); clip.onSaveData = () => { persist(); unlockToasts(); }; clip.start(); track('clip_start');
}
$('#clipExit').onclick = () => { closeModal(); clip.stop(); $('#clip .clip-result').hidden = true; title(); };
$('#clipAgain').onclick = () => { sfx.ui(); clip.again(); P8.gameplay(true); };
$('#clipSave').onclick = async () => { const r = await saveImage(clip.resultCard(), 'period8-clip'); if (r.ok) toast('Saved result card'); };
addEventListener('resize', () => { if (mode === 'clip') clip?.resize(); });

/* ------------------------------------------------------------ main loop */
let lastT = performance.now();
function frame(t) {
  runClock(t);
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (mode !== 'clip') view.frame(dt);
  if (mode === 'hud' && view.S) {
    compass();
    const sec = Math.floor(view.t); if (sec !== lastSec) { lastSec = sec; if (view.S.scene === 'class' || Math.abs(((view.camX % 4000) + 4000) % 4000 - 1620) < 700) sfx.tick(view.S.scene === 'hall' && view.S.clock === 'back'); }
    if (view.S.flicker) sfx.buzzLevel(Math.sin(view.t * 23) + Math.sin(view.t * 7.1) * 0.8 > 0.6 || (view.t % 2.3) > 1.4 ? 1 : 0);
    sfx.ambientTick(view.S.scene, run ? run.streak / G.GOAL : 0);
  }
  if (mode === 'title') { view.camX = 1640 + Math.sin(t / 1000 * 0.18) * 70; }
  requestAnimationFrame(frame);
}
// Keyboard (web): ←/→ or A/D look, ↑/Enter/W keep going, ↓/Backspace/S turn back, H hint, Esc/P pause.
addEventListener('keydown', e => {
  if (e.repeat) return; const k = e.key, m = !$('#modal').hidden;
  if (m) { if (k === 'Escape') { const r = $('#mResume') || $('#mClose') || $('#mNo'); r?.click(); } return; }
  if (mode === 'title' && k === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) { ($('#btnContinue').hidden ? $('#btnStart') : $('#btnContinue')).click(); return; }
  if (mode !== 'hud' || !run) return;
  if (coActive && (k === 'Enter' || k === ' ')) { endColdOpen(); return; }
  if (coActive) return;
  if (['ArrowUp', 'Enter', 'w', 'W'].includes(k)) { e.preventDefault(); choose('forward'); }
  else if (['ArrowDown', 'Backspace', 's', 'S'].includes(k)) { e.preventDefault(); choose('back'); }
  else if (k === 'h' || k === 'H') hint();
  else if (k === 'Escape' || k === 'p' || k === 'P') pauseMenu();
});
// Portal events: gameplayStart on the first input of actual play (and again after a pause / menu).
const firstInput = () => {
  if ((mode === 'hud' || mode === 'clip') && $('#modal').hidden) P8.gameplay(true);
  if (coActive && !coBellRung) { sfx.unlockAudio(); sfx.bell(1.4); coBellRung = true; }
};
addEventListener('pointerdown', firstInput, true); addEventListener('keydown', firstInput, true);
window.__p8 = { get run() { return run; }, save, view, choose, G, byId, persist, title, openClip, settings, endingsModal, lockerModal, pauseMenu, autoPause, startRun, get coActive() { return coActive; }, get mode() { return mode; }, get clip() { return clip; } };
// first launch + day-N / D1 return (Firebase also logs first_open / session_start automatically on Android)
const DAY = 86400e3, firstOpen = !save.installedAt; if (firstOpen) save.installedAt = Date.now();
const day = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(save.installedAt).setHours(0, 0, 0, 0)) / DAY);
initAds().finally(applyAnalyticsChoice);
if (firstOpen) track('first_launch');
if (day > 0 && day !== save.lastDayLogged) { track('return_day', { day }); if (day === 1) track('d1_return'); save.lastDayLogged = day; }
track('session_begin', { day, endings_found: Object.keys(save.endings).length, best: save.best }); persist();
function applyAnalyticsChoice() { return setAnalyticsAllowed(save.settings.analytics !== false && consentAllowsAnalytics()); }
// First launch (and every portal first visit): skip the title and go straight into play (Poki/CrazyGames easy access).
if (!save.introSeen && !save.run) startRun(null, { coldOpen: true }); else title();
requestAnimationFrame(t => { frame(t); requestAnimationFrame(() => {
  const b = document.getElementById('boot'); if (b) b.remove(); window.__p8_ready = performance.now(); P8.loadingFinished();
}); });
