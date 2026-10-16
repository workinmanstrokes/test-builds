// +1 Aura UI shell: input, render loop, HUD, modals, ads + analytics wiring.
import * as G from './game.js';
import { GAME, PRIVACY_URL } from './config.js';
import { getSkin } from './skins/index.js';
import { createFx } from './fx.js';
import { unlockAudio, sfx, setSkinAudio, setSound } from './audio.js';
import { buzz, setVibe } from './haptics.js';
import { initAds, showRewarded, rewardGate, adsInfo, showPrivacyOptions } from './ads.js';
import { initAnalytics, track, analyticsMode } from './analytics.js';

const $ = id => document.getElementById(id);
const VERSION = '0.1.0';
let now = Date.now();

// ---------- load ----------
let s = G.deserialize(localStorage.getItem(G.SAVE_KEY) || 'null', now);
const firstOpen = !localStorage.getItem(G.SAVE_KEY);
let skin = getSkin(s.skin || GAME.skin);
const fx = createFx($('stage'));
function applySkin() {
  const st = skin.stages[s.curStage]; const r = document.documentElement.style;
  r.setProperty('--accent', st.accent); r.setProperty('--glow', st.glow); r.setProperty('--text', st.text);
  document.querySelector('meta[name=theme-color]').content = st.bg[1];
  setSkinAudio(skin, st.root);
  $('cur').textContent = skin.text.currency; $('rateLbl').textContent = skin.text.perSec; $('tapHint').textContent = skin.text.tapHint;
  buildShop();
}
setSound(s.settings.sound); setVibe(s.settings.vibe);
const save = () => { try { localStorage.setItem(G.SAVE_KEY, G.serialize(s, Date.now())); } catch {} };

// ---------- analytics: first open + D1/Dn retention ----------
initAnalytics();
if (firstOpen) track('first_launch', { skin: skin.id });
const day = G.dayIndex(s, now);
if (day > 0 && day !== s.lastDayLogged) { track('return_day', { day }); if (day === 1) track('d1_return'); s.lastDayLogged = day; }
track('session_begin', { day, stage: s.stage, level: s.level });

// ---------- input ----------
const canvas = $('stage');
canvas.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); doTap(e.clientX, e.clientY); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => { if ((e.code === 'Space' || e.code === 'Enter') && $('modal').hidden) { e.preventDefault(); unlockAudio(); const t = fx.target(); doTap(t.x + (Math.random() - .5) * t.r, t.y - t.r * .5); } });

let hinted = s.taps > 30;
function doTap(x, y) {
  if (!$('modal').hidden) return;
  now = Date.now();
  const r = G.tap(s, now);
  const st = skin.stages[s.curStage];
  if (r.locked) { fx.float(x, y, '🔥', '#ff6a5a', 24); return; }
  if (!hinted && s.taps > 12) { hinted = true; $('tapHint').classList.add('gone'); }
  const onTarget = fx.hitTest(x, y);
  fx.kick(onTarget ? 0.9 : 0.4, 0.6);
  fx.float(x + (Math.random() - .5) * 24, y - 20, `+${G.fmt(r.value)}`, r.crit ? '#fff' : st.text, r.crit ? 40 : 26 + Math.min(10, r.mult * 2));
  fx.burst(x, y, st.colors, r.crit ? 26 : 5 + Math.min(8, r.combo / 6), r.crit ? 420 : 200, r.crit ? 6 : 3.5);
  if (r.combo % 10 === 0) fx.ring(st.accent, 0.6 + r.mult * 0.15);
  sfx('tap', r.combo); buzz('tap');
  if (r.crit) { fx.float(fx.target().x, fx.target().y - fx.target().r * 1.5, skin.text.burst, '#fff', 30, { life: 1.3, vy: -60 }); fx.ring('#fff', 1.6); fx.shake(0.5); fx.flash(st.glow, .8); sfx('burst'); buzz('heavy'); }
  bumpTotal();
  handle(r.events);
}

// ---------- events ----------
function handle(events) {
  for (const e of events) {
    const st = skin.stages[s.curStage];
    if (e.type === 'bank') {
      const t = fx.target(); fx.float(t.x, t.y - t.r * 1.4, `${skin.text.streak} +${G.fmt(e.value)}`, st.accent, 28, { life: 1.2, vy: -70 }); fx.burst(t.x, t.y, st.colors, 18, 300, 4); fx.ring(st.accent, 1.2); sfx('bank'); buzz('success'); bumpTotal();
    } else if (e.type === 'overheat') {
      fx.shake(1); fx.flash('#ff2a1a', 1); sfx('overheat'); buzz('error'); track('overheat', { lost: e.lost, stage: s.stage });
      if (e.lost > 0) showOverheat(e.lost); else toast('Overheated! Cool down…');
    } else if (e.type === 'level_up') {
      sfx('levelUp'); fx.ring('#fff', 1); banner(skin.text.levelUp(e.level)); track('level_up', { level: e.level });
    } else if (e.type === 'stage_unlock') {
      applySkin(); const nm = skin.stages[e.stage].name; banner(skin.text.stageUnlock(nm)); sfx('unlock'); buzz('success');
      const t = fx.target(); fx.burst(t.x, t.y, skin.stages[e.stage].colors, 60, 520, 6); fx.flash('#fff', 1); fx.shake(.6);
      track('stage_unlock', { stage: e.stage, stage_name: nm, via: e.via, seconds_played: Math.round((Date.now() - s.installedAt) / 1000) }); save();
    }
  }
}

// ---------- shop ----------
const UP_IDS = ['power', 'auto', 'combo', 'cool', 'crit'];
function buildShop() {
  $('shop').innerHTML = UP_IDS.map(id => `<button class="up" data-id="${id}"><span class="l"></span><div class="n">${skin.text.upgrades[id][0]}</div><div class="d">${skin.text.upgrades[id][1]}</div><div class="c"></div></button>`).join('');
  $('shop').querySelectorAll('.up').forEach(b => b.addEventListener('click', () => { unlockAudio(); const id = b.dataset.id; if (G.buy(s, id)) { sfx('buy'); buzz('tap'); const r = b.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top, skin.stages[s.curStage].colors, 12, 220, 3); track('upgrade_buy', { id, level: s.up[id] }); save(); } else toast(s.up[id] >= G.UPGRADES[id].max ? 'Maxed out' : `Need more ${skin.text.currency}`); refreshShop(); }));
  refreshShop();
}
function refreshShop() {
  $('shop').querySelectorAll('.up').forEach(b => {
    const id = b.dataset.id, lvl = s.up[id], max = lvl >= G.UPGRADES[id].max, cost = G.upgradeCost(id, lvl);
    b.querySelector('.l').textContent = `Lv ${lvl}`; b.querySelector('.c').textContent = max ? 'MAX' : `✦ ${G.fmt(cost)}`;
    b.classList.toggle('ok', !max && s.aura >= cost); b.classList.toggle('no', !max && s.aura < cost); b.classList.toggle('max', max);
  });
}

// ---------- rewarded placements ----------
async function reward(placement, apply) {
  const g = rewardGate(s, placement); if (!g.ok) { toast(g.why); return false; }
  const ok = await showRewarded(s, placement);
  if (ok) { apply(); save(); } else toast('No reward this time');
  return ok;
}
$('btnBoost').addEventListener('click', () => { unlockAudio(); reward('boost', () => { G.addBoost(s, Date.now(), GAME.boostMs, GAME.boostCapMs); banner('2x AURA!'); sfx('unlock'); fx.flash('#7dffb0', .7); }); });
$('btnSkip').addEventListener('click', () => { unlockAudio(); if (!G.canSkip(s, GAME.skipMinProgress)) return; reward('skip', () => { const e = G.skipStage(s); if (e) handle([e]); }); });

function showOverheat(lost) {
  const until = Date.now() + GAME.reviveWindowMs;
  modal(`<h2>${skin.text.overheat}</h2><p>${skin.text.mascot} burned out and dropped your streak of <b>+${G.fmt(lost)}</b> ${skin.text.currency}.</p>
    <div class="countdown" id="cd"></div><div class="row"><button class="btn primary" id="mRevive"><span class="tv">AD</span>${skin.text.reward.revive}</button><button class="btn" id="mClose">Cool down</button></div>`);
  const tick = setInterval(() => { const k = (until - Date.now()) / GAME.reviveWindowMs; const cd = $('cd'); if (!cd) return clearInterval(tick); cd.style.transform = `scaleX(${Math.max(0, k)})`; if (k <= 0) { clearInterval(tick); closeModal(); } }, 50);
  $('mRevive').onclick = async () => { clearInterval(tick); $('mRevive').disabled = true; const ok = await reward('revive', () => { const r = G.revive(s, Date.now()); fx.float(fx.target().x, fx.target().y - 120, `+${G.fmt(r.refund)} SAVED!`, '#7dffb0', 30, { life: 1.4 }); sfx('bank'); handle(r.events); }); closeModal(); if (!ok) {} };
  $('mClose').onclick = () => { clearInterval(tick); closeModal(); };
}

// ---------- banner / toast ----------
function banner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
let toastT = 0;
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

// ---------- modals ----------
function modal(html) { $('modalCard').innerHTML = html; $('modal').hidden = false; }
function closeModal() { $('modal').hidden = true; $('modalCard').innerHTML = ''; }
$('modal').addEventListener('click', e => { if (e.target === $('modal') && !$('mRevive')) closeModal(); });

$('stageChip').addEventListener('click', () => {
  const rows = skin.stages.map((st, i) => {
    const locked = i > s.stage;
    return `<button class="stg ${i === s.curStage ? 'cur' : ''}" data-i="${i}" ${locked ? 'disabled' : ''} style="background:linear-gradient(120deg,${st.bg[0]},${st.glow}55);color:${st.text}">${locked ? '🔒 ' : ''}${st.name}<small>${locked ? `Unlocks at ${G.fmt(G.STAGE_THRESHOLDS[i])} lifetime ${skin.text.currency}` : `x${G.STAGE_MULT[i]} per tap`}</small></button>`;
  }).join('');
  modal(`<h2>Stages</h2><div class="stages">${rows}</div><button class="btn" id="mClose">Close</button>`);
  $('modalCard').querySelectorAll('.stg:not([disabled])').forEach(b => b.onclick = () => { s.curStage = +b.dataset.i; applySkin(); save(); closeModal(); });
  $('mClose').onclick = closeModal;
});

$('btnSettings').addEventListener('click', () => {
  const tg = (id, on) => `<button class="tog ${on ? 'on' : ''}" id="${id}" aria-pressed="${on}"></button>`;
  modal(`<h2>Settings</h2>
    <div class="set">Sound ${tg('tSound', s.settings.sound)}</div>
    <div class="set">Vibration ${tg('tVibe', s.settings.vibe)}</div>
    ${adsInfo().privacyRequired ? '<div class="set">Ad privacy <button class="btn" id="mPriv">Manage</button></div>' : ''}
    <div class="set">Privacy policy <a href="${PRIVACY_URL}" target="_blank" rel="noopener">Open</a></div>
    <div class="set" style="font-size:12px;opacity:.7">Total taps ${G.fmt(s.taps)} · Best streak ${s.best.combo} · v${VERSION} · analytics ${analyticsMode()}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="mClose">Close</button></div>`);
  $('tSound').onclick = e => { s.settings.sound = !s.settings.sound; setSound(s.settings.sound); e.target.classList.toggle('on', s.settings.sound); save(); };
  $('tVibe').onclick = e => { s.settings.vibe = !s.settings.vibe; setVibe(s.settings.vibe); e.target.classList.toggle('on', s.settings.vibe); save(); };
  $('mPriv') && ($('mPriv').onclick = showPrivacyOptions);
  $('mClose').onclick = closeModal;
});

// ---------- offline progress ----------
function offline() {
  const g = G.offlineGain(s, Date.now(), GAME.offlineCapHours, GAME.offlineEfficiency);
  if (g.secs < 60 || g.value <= 0) return;
  const mins = Math.round(g.secs / 60), t = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  s.lastSeen = Date.now(); // don't double count if the modal is reopened
  modal(`<h2>Welcome back!</h2><p>Your wisps gathered <b>+${G.fmt(g.value)}</b> ${skin.text.currency} in ${t}.</p><div class="row"><button class="btn primary" id="mDouble"><span class="tv">AD</span>${skin.text.reward.offline} (+${G.fmt(g.value * 2)})</button><button class="btn" id="mClose">Collect</button></div>`);
  const collect = n => { handle(G.grant(s, n)); bumpTotal(); fx.burst(innerWidth / 2, innerHeight * .2, skin.stages[s.curStage].colors, 30, 300, 4); sfx('bank'); save(); closeModal(); };
  $('mClose').onclick = () => collect(g.value);
  $('mDouble').onclick = async () => { $('mDouble').disabled = true; const ok = await showRewarded(s, 'offline'); collect(ok ? g.value * 2 : g.value); };
}

// ---------- HUD ----------
let shownAura = s.aura;
function bumpTotal() { const el = $('aura'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function hud() {
  shownAura += (s.aura - shownAura) * 0.35; if (Math.abs(s.aura - shownAura) < 1) shownAura = s.aura;
  $('aura').textContent = G.fmt(shownAura);
  $('rate').textContent = G.fmt(G.autoPerSec(s, now));
  $('lvl').textContent = `LV ${s.level}`;
  const a = s.level > 1 ? G.levelNeed(s.level - 1) : 0, b = G.levelNeed(s.level);
  $('lvlbar').style.width = `${Math.min(100, (s.lifetime - a) / (b - a) * 100)}%`;
  $('stageName').textContent = skin.stages[s.curStage].name;
  const last = s.stage >= G.STAGE_THRESHOLDS.length - 1;
  $('stagebar').style.width = `${G.nextStageProgress(s) * 100}%`;
  $('stageNext').textContent = last ? 'All stages unlocked' : `Next: ${skin.stages[s.stage + 1].name} at ${G.fmt(G.STAGE_THRESHOLDS[s.stage + 1])}`;
  const rt = s.rt; $('heatbar').style.width = `${rt.heat}%`; $('heatbar').parentElement.parentElement.classList.toggle('hot', rt.heat > 75 || now < rt.lockUntil);
  $('streak').innerHTML = now < rt.lockUntil ? `🔥 ${skin.text.overheat} ${Math.ceil((rt.lockUntil - now) / 1000)}s` : rt.combo >= 10 ? `x${G.comboMult(s)} ${skin.text.streak}<small>+${G.fmt(rt.pot)}</small>` : '';
  const boostLeft = s.boostUntil - now, bb = $('btnBoost');
  bb.classList.toggle('active', boostLeft > 0);
  const gate = rewardGate(s, 'boost', now);
  bb.classList.toggle('off', boostLeft <= 0 && !gate.ok);
  $('boostLbl').textContent = boostLeft > 0 ? `${Math.floor(boostLeft / 60000)}:${String(Math.floor(boostLeft / 1000) % 60).padStart(2, '0')}` : 'Boost';
  $('btnSkip').hidden = !G.canSkip(s, GAME.skipMinProgress);
}

// ---------- loop ----------
let last = performance.now(), acc = 0, saveT = 0;
function loop(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t; now = Date.now();
  handle(G.update(s, dt, now)); s.lastSeen = now;
  fx.frame(skin, s.curStage, t / 1000, dt, { heat: s.rt.heat, locked: now < s.rt.lockUntil });
  acc += dt; if (acc > 0.1) { acc = 0; hud(); refreshShop(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { offline(); } });
window.addEventListener('pagehide', save);

applySkin(); hud();
offline();
requestAnimationFrame(loop);
initAds();
// test hook (harmless in production): lets the Playwright smoke test inspect state
window.__aura = { get state() { return s; }, G, save };
