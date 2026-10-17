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

const $ = s => document.querySelector(s);
const save = G.loadSave(localStorage); const persist = () => G.writeSave(localStorage, save);
let run = null, busy = false, mode = 'title';
const view = new View($('#view'), { onTap });
setHaptics(save.settings.haptics); sfx.setMuted(!save.settings.sound);

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
  show('#title'); view.enabled = false; closeModal();
  view.setScene(G.stateFor({ scene: 'hall', anomaly: null }), { camX: 500 }); view.dim = 0.6;
  $('#btnContinue').hidden = !save.run; $('#endingCount').textContent = `${Object.keys(save.endings).length}/3 endings · ${Object.keys(save.seen).length}/45 anomalies found`;
  sfx.ambience('menu');
}
$('#btnStart').onclick = () => { sfx.unlockAudio(); sfx.ui(); if (save.run) { modal(`<h2>Start over?</h2><p>Your current run (${save.run.streak}/8) will be lost.</p><div class="row"><button class="btn" id="mNo">Cancel</button><button class="btn primary" id="mYes">New run</button></div>`); $('#mNo').onclick = closeModal; $('#mYes').onclick = () => { closeModal(); startRun(); }; } else startRun(); };
$('#btnContinue').onclick = () => { sfx.unlockAudio(); sfx.ui(); startRun(save.run); };
$('#btnClip').onclick = () => { sfx.unlockAudio(); sfx.ui(); openClip(); };
$('#btnEndings').onclick = () => { sfx.unlockAudio(); sfx.ui(); endingsModal(); };
$('#btnTitleSettings').onclick = () => { sfx.unlockAudio(); settings(); };

/* ------------------------------------------------------------ run flow */
async function startRun(resume = null) {
  run = G.newRun(); if (resume) Object.assign(run, { streak: resume.streak, loops: resume.loops, misses: resume.misses, pass: resume.pass, log: Array.isArray(resume.log) ? resume.log : [], startedAt: Date.now() - (resume.playedMs || 0) });
  save.runsStarted = (save.runsStarted || 0) + 1; track(resume ? 'run_resume' : 'run_start');
  show('#hud'); view.dim = 0;
  if (!resume && !save.introSeen) { await intro(); save.introSeen = true; persist(); }
  beginLoop();
}
function intro() {
  return new Promise(res => { modal(`<h2>Period 8</h2><p>You stayed after school. The last bell never rang, and the hallway outside Room 8 keeps <b>repeating</b>.</p>
    <ul class="rules"><li>Drag to look around. Pinch or double-tap to zoom. Tap things to inspect.</li><li>If <b>everything is normal</b>, keep going.</li><li>If <b>anything is different</b>, turn back.</li><li>Get <b>8 in a row</b> and the final bell rings.</li></ul>
    <div class="row"><button class="btn primary" id="mGo">I'm ready</button></div>`, { cls: 'intro' }); $('#mGo').onclick = () => { sfx.ui(); closeModal(); res(); }; });
}
// The snapshot keeps the loop log + play time so a resumed run's ending stats (anomalies spotted, minutes) stay correct.
function snapshotRun() { save.run = run && !run.ending ? { streak: run.streak, loops: run.loops, misses: run.misses, pass: run.pass, log: run.log.map(({ scene, anomaly, correct }) => ({ scene, anomaly, correct })), playedMs: Date.now() - run.startedAt } : null; persist(); }

function beginLoop() {
  const cur = G.nextLoop(run, save), S = G.stateFor(cur);
  view.setScene(S, { camX: cur.scene === 'hall' ? 500 : 500 }); view.enabled = true; view.fade = 1; view.walk = 0;
  sfx.ambience(cur.scene); sfx.stopLoops(); if (S.flicker) sfx.buzz(true); if (S.fountain) sfx.water(true);
  hud(); busy = false; track('loop_start', { loop: run.loops, scene: cur.scene, anomaly: cur.anomaly || 'none' });
  animate(600, k => { view.fade = 1 - k; });
  const tip = run.loops === 0 ? 'The hallway outside Room 8. Look around and remember everything.' : run.loops === 1 ? 'Room 8. Remember this room too.' : run.loops === 2 ? 'Now: anything different? Turn back. All normal? Keep going.' : '';
  if (tip) toast(tip, 4200);
}
function hud() {
  const pips = $('#pips'); pips.innerHTML = ''; for (let i = 0; i < G.GOAL; i++) { const b = document.createElement('i'); if (i < run.streak) b.className = 'on'; pips.appendChild(b); }
  $('#loopNum').textContent = `${run.streak}/${G.GOAL}`; $('#misses').textContent = run.misses ? `${run.misses}/${G.MAX_MISSES} misses` : '';
  $('#passIcon').hidden = !run.pass; $('#btnHint').classList.toggle('used', !!run.hintUsed);
  $('#btnBack').textContent = run.current.scene === 'hall' ? '↩ Turn back' : '↩ Leave';
  $('#btnFwd').textContent = run.current.scene === 'hall' ? 'Keep going →' : 'Next period →';
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
  if (choice === 'back') { sfx.turn(); const from = view.camX; await animate(520, k => { view.camX = from + ease(k) * 2000; view.fade = k * 0.3; }); }
  if (res.kind === 'missed') { sfx.stopLoops(); thud(); await scare(); return reveal(res); }
  for (let i = 0; i < 4; i++) setTimeout(() => sfx.step(i), i * 210);
  await animate(850, k => { view.walk = ease(k); view.fade = 0.3 + k * 0.7; });
  sfx.stopLoops();
  if (res.kind === 'false_alarm') { sfx.falseAlarm(); buzzPhone(80); return reveal(res); }
  sfx.correct(run.streak); buzzPhone(20);
  if (res.ending) return ending(res.ending);
  snapshotRun(); await bigText(`${run.streak}`, run.streak === G.GOAL - 1 ? 'one more…' : 'in a row'); beginLoop();
}
async function bigText(n, sub) { const el = $('#big'); el.innerHTML = `<b>${n}</b><small>${sub}</small>`; el.classList.add('on'); await sleep(900); el.classList.remove('on'); await sleep(150); }
async function scare() { sfx.scare(save.settings.scares === 'soft'); await playScare($('#scare'), save.settings.scares === 'soft'); }
async function reveal(res) {
  $('#toast').classList.remove('on'); view.fade = 0; view.walk = 0; view.enabled = true;
  if (res.anomaly) { view.reveal = res.anomaly; const [x, y, w, h] = res.anomaly.region; view.lookAt(x + w / 2, y + h / 2); }
  const lost = run.lostStreak, canKeep = G.canKeepStreak(run), gate = rewardGate(save, 'keep');
  const head = res.kind === 'missed' ? `You missed it.` : `Nothing was wrong.`;
  const body = res.kind === 'missed' ? `<p class="miss">${res.anomaly.name}.</p>` : `<p>That loop was perfectly normal. Trust what you remember.</p>`;
  if (res.ending) { snapshotRun(); await sleep(400); return ending(res.ending); }
  const card = modal(`<h2>${head}</h2>${body}<p class="dim">The count resets. ${run.misses}/${G.MAX_MISSES} misses.</p>
    <div class="row col">${canKeep ? `<button class="btn reward" id="mKeep" ${gate.ok ? '' : 'disabled'}><span class="tv">▶</span> Keep my ${lost}-loop streak${gate.ok ? '' : ` (${gate.why})`}</button>` : ''}
    <button class="btn primary" id="mNext">Try again</button></div>`, { cls: 'reveal' });
  card.parentElement.classList.add('low');
  const go = () => { card.parentElement.classList.remove('low'); closeModal(); view.reveal = null; view.enabled = false; snapshotRun(); animate(400, k => { view.fade = k; }).then(beginLoop); };
  $('#mNext').onclick = () => { sfx.ui(); go(); };
  if (canKeep) $('#mKeep').onclick = async () => { const ok = await showRewarded(save, 'keep'); persist(); if (ok && G.keepStreak(run)) { toast(`Streak kept: ${run.streak}/8`); track('streak_kept', { streak: run.streak }); go(); } else toast('No reward this time.'); };
}
async function hint() {
  if (!run || busy) return; if (run.hintUsed) return toast('One hint per loop.');
  const g = rewardGate(save, 'hint'); if (!g.ok) return toast(g.why);
  modal(`<h2>Need a hint?</h2><p>Watch a short video and your gut will point you to the spot that feels wrong, or tell you all is well.</p><div class="row"><button class="btn" id="mNo">No thanks</button><button class="btn reward primary" id="mYes"><span class="tv">▶</span> Watch</button></div>`);
  $('#mNo').onclick = closeModal;
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
  save.run = null; persist(); track('ending_reached', { ending: id, loops: run.loops, misses: run.misses, minutes: Math.round((Date.now() - run.startedAt) / 60000), pass: run.pass ? 1 : 0, endings_found: Object.keys(save.endings).length });
  view.enabled = false; sfx.stopLoops();
  if (id !== 'bad') { sfx.bell(); view.fade = 1; await sleep(1400); }
  else { sfx.falseAlarm(); await sleep(900); }
  const E = G.ENDINGS[id], mins = Math.max(1, Math.round((Date.now() - run.startedAt) / 60000)), spotted = run.log.filter(l => l.anomaly && l.correct).length;
  show('#ending'); drawEnding($('#endArt'), id);
  $('#endTitle').textContent = E.title; $('#endBlurb').textContent = E.blurb;
  $('#endStats').textContent = `${run.loops} loops · ${spotted} ${spotted === 1 ? 'anomaly' : 'anomalies'} spotted · ${run.misses} ${run.misses === 1 ? 'miss' : 'misses'} · ${mins} min`;
  $('#endTag').textContent = `Ending ${Object.keys(save.endings).length}/3 found`;
}
$('#btnEndAgain').onclick = () => { sfx.ui(); startRun(); };
$('#btnEndTitle').onclick = () => { sfx.ui(); title(); };
$('#btnEndShot').onclick = async () => { const r = await saveImage($('#endArt'), 'period8-ending'); if (r.ok) toast('Saved'); };
function endingsModal() {
  const hints = { normal: 'Reach 8 in a row.', secret: 'Something golden is hiding in the hallway…', bad: 'Miss too many times.' };
  const seen = Object.keys(save.seen).map(id => byId[id]?.name).filter(Boolean);
  modal(`<h2>Endings</h2><div class="ends">${Object.values(G.ENDINGS).map(e => save.endings[e.id] ? `<div class="end on"><b>${e.title}</b><small>${e.blurb}</small></div>` : `<div class="end"><b>???</b><small>${hints[e.id]}</small></div>`).join('')}</div>
    <h3>Anomaly journal · ${seen.length}/45</h3><ul class="journal">${seen.map(n => `<li>${n}</li>`).join('') || '<li class="dim">Nothing yet.</li>'}</ul>
    <p class="dim">Best streak ${save.best}/8 · Clip mode best ${save.clipBest}/10</p><div class="row"><button class="btn primary" id="mClose">Close</button></div>`);
  $('#mClose').onclick = closeModal;
}

/* ------------------------------------------------------------ menus */
function pauseMenu() {
  modal(`<h2>Paused</h2><p>Streak ${run.streak}/8 · ${run.misses} misses${run.pass ? ' · 🎫 hall pass' : ''}</p><div class="row col"><button class="btn primary" id="mResume">Resume</button><button class="btn" id="mSet">Settings</button><button class="btn" id="mTitle">Quit to title</button></div>`);
  $('#mResume').onclick = closeModal; $('#mSet').onclick = settings; $('#mTitle').onclick = () => { snapshotRun(); title(); };
}
function settings() {
  const s = save.settings, ia = iapInfo(), ad = adsInfo();
  modal(`<h2>Settings</h2>
    <label class="tog"><span>Sound</span><input type="checkbox" id="sSound" ${s.sound ? 'checked' : ''}></label>
    <label class="tog"><span>Jump scares</span><select id="sScare"><option value="full">Full</option><option value="soft">Gentle</option></select></label>
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
  $('#sHap').onchange = e => { s.haptics = e.target.checked; setHaptics(s.haptics); persist(); };
  if ($('#sIap')) $('#sIap').onclick = async () => { const r = await buyRemoveAds(save); toast(r.ok ? 'Ads removed. Thank you!' : r.why); persist(); };
  $('#sStats').onchange = e => { s.analytics = e.target.checked; persist(); applyAnalyticsChoice(); };
  if ($('#sPriv')) $('#sPriv').onclick = async () => { await showPrivacyOptions(); applyAnalyticsChoice(); };
  $('#sReset').onclick = () => { if (confirm('Erase all progress, endings and the anomaly journal?')) { localStorage.removeItem(G.SAVE_KEY); location.reload(); } };
  $('#mClose').onclick = closeModal;
}
function shotMenu() {
  modal(`<h2>Screenshot</h2><p>Saves exactly what you see (no buttons) with a small PERIOD 8 tag.</p><div class="row col"><button class="btn primary" id="shFull">Save view</button><button class="btn" id="shTall">Save 9:16 for Shorts/TikTok</button><button class="btn" id="shCancel">Cancel</button></div>`);
  $('#shCancel').onclick = closeModal;
  const go = async vertical => { closeModal(); await sleep(60); const c = view.capture({ vertical }); const f = $('#flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 180); const r = await saveImage(c); track('screenshot', { vertical }); if (r.ok) toast(r.shared ? 'Shared' : 'Screenshot saved'); };
  $('#shFull').onclick = () => go(false); $('#shTall').onclick = () => go(true);
}

/* ------------------------------------------------------------ clip mode */
let clip = null;
function openClip() {
  show('#clip'); view.enabled = false; sfx.ambience('class');
  clip = clip || new Clip($('#clip'), { save }); clip.onSaveData = persist; clip.start(); track('clip_start');
}
$('#clipExit').onclick = () => { clip.stop(); $('#clip .clip-result').hidden = true; title(); };
$('#clipAgain').onclick = () => { sfx.ui(); clip.again(); };
$('#clipSave').onclick = async () => { const r = await saveImage(clip.resultCard(), 'period8-clip'); if (r.ok) toast('Saved result card'); };
addEventListener('resize', () => { if (mode === 'clip') clip?.resize(); });

/* ------------------------------------------------------------ main loop */
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (mode !== 'clip') view.frame(dt);
  if (mode === 'hud' && view.S) {
    compass();
    const sec = Math.floor(view.t); if (sec !== lastSec) { lastSec = sec; if (view.S.scene === 'class' || Math.abs(((view.camX % 4000) + 4000) % 4000 - 1620) < 700) sfx.tick(view.S.scene === 'hall' && view.S.clock === 'back'); }
    if (view.S.flicker) sfx.buzzLevel(Math.sin(view.t * 23) + Math.sin(view.t * 7.1) * 0.8 > 0.6 || (view.t % 2.3) > 1.4 ? 1 : 0);
    sfx.ambientTick(view.S.scene, run ? run.streak / G.GOAL : 0);
  }
  if (mode === 'title') { view.camX += dt * 12; }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { snapshotRun(); } });
window.__p8 = { get run() { return run; }, save, view, choose, G, byId, persist, title, openClip, settings, endingsModal, get clip() { return clip; } };
// first launch + day-N / D1 return (Firebase also logs first_open / session_start automatically on Android)
const DAY = 86400e3, firstOpen = !save.installedAt; if (firstOpen) save.installedAt = Date.now();
const day = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(save.installedAt).setHours(0, 0, 0, 0)) / DAY);
initAds().finally(applyAnalyticsChoice);
if (firstOpen) track('first_launch');
if (day > 0 && day !== save.lastDayLogged) { track('return_day', { day }); if (day === 1) track('d1_return'); save.lastDayLogged = day; }
track('session_begin', { day, endings_found: Object.keys(save.endings).length, best: save.best }); persist();
function applyAnalyticsChoice() { return setAnalyticsAllowed(save.settings.analytics !== false && consentAllowsAnalytics()); }
title(); requestAnimationFrame(frame);
