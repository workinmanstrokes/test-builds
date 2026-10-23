// +1 Aura UI shell: boot, live title, input, render loop, HUD, tower, shop, pause, modals, ads + analytics wiring.
// Design: docs/DESIGN.md (deepthinker plans: upgrades §3.1, intros/title/menus, level & sprite checklist).
import * as G from './game.js';
import { GAME, PRIVACY_URL } from './config.js';
import { getSkin, skinList } from './skins/index.js';
import { createFx } from './fx.js';
import * as R from './runner.js';
import { createEscapeView } from './escape.js';
import { unlockAudio, sfx, setSkinAudio, setSound, setVolumes, suspendAudio } from './audio.js';
import { buzz, setVibe } from './haptics.js';
import { initAds, showRewarded, rewardGate, adsInfo, showPrivacyOptions } from './ads.js';
import { initAnalytics, track, analyticsMode, setAnalyticsOptIn, analyticsStatus } from './analytics.js';
import { initPortal, gameplayStart, gameplayStop, isPortal } from './portal.js';
import * as SOC from './social.js';
import * as SC from './social-core.js';
import { initBilling, billingAvailable, buyRemoveAds, restoreRemoveAds, removeAdsPrice } from './billing.js';

const $ = id => document.getElementById(id);
const VERSION = '0.2.0';
const bootT0 = performance.now();
const bootbar = p => { const b = $('bootbar'); if (b) b.style.width = `${p}%`; };
bootbar(60);
let now = Date.now();

// ---------- load ----------
let saved = null; try { saved = localStorage.getItem(G.SAVE_KEY); } catch {}
let s = G.deserialize(saved || 'null', now);
const firstOpen = !saved;
let skin = getSkin(s.skin || GAME.skin);
const fx = createFx($('stage'));
function applySkin() {
  const st = skin.stages[s.curStage]; const r = document.documentElement.style;
  r.setProperty('--accent', st.accent); r.setProperty('--glow', st.glow); r.setProperty('--text', st.text);
  document.querySelector('meta[name=theme-color]').content = st.bg?.[1] || st.water?.[1] || '#0b0716';
  setSkinAudio(skin, st.root, s.curStage); G.setTuning(s, skin.tuning);
  $('heatLbl').textContent = skin.text.heat || 'HEAT';
  $('cur').textContent = skin.text.currency; $('rateLbl').textContent = skin.text.perSec; $('tapHint').textContent = skin.text.tapHint;
  $('tName').textContent = skin.text.title.toUpperCase(); $('tSub').textContent = skin.text.subtitle.toUpperCase();
  buildShop(); buildTower();
}
function applySettings() {
  setSound(s.settings.sound); setVibe(s.settings.vibe); setVolumes(s.settings.sfx, s.settings.music ?? 0.5);
  fx.setReduced(s.settings.reduceMotion);
  document.body.classList.toggle('reduce-motion', !!s.settings.reduceMotion);
  document.body.classList.toggle('big-text', !!s.settings.bigText);
}
applySettings();
const save = () => { try { localStorage.setItem(G.SAVE_KEY, G.serialize(s, Date.now())); } catch {} };

// ---------- analytics: first open + D1/Dn retention ----------
initAnalytics(s.settings.analytics);
if (firstOpen) track('first_launch', { skin: skin.id });
const day = G.dayIndex(s, now);
if (day > 0 && day !== s.lastDayLogged) { track('return_day', { day }); if (day === 1) track('d1_return'); s.lastDayLogged = day; }
track('session_begin', { day, stage: s.stage, floor: s.floor, level: s.level });

// ---------- screens: title / play / pause ----------
// Portals: first-time players skip the title entirely (Poki "easy access", CrazyGames 1-click rule).
let screen = 'title', paused = false;
function showTitle() {
  exitEscape();
  screen = 'title'; refreshEscBest(); document.body.classList.add('on-title'); $('title').hidden = false; gameplayStop();
}
function startPlay(via) {
  if (screen === 'play') return;
  exitEscape();
  screen = 'play'; document.body.classList.remove('on-title'); $('title').hidden = true;
  track('title_play', { via }); unlockAudio(); gameplayStart();
}
function pause(why) {
  if (paused || (screen !== 'play' && screen !== 'escape') || !$('modal').hidden) return;
  paused = true; $('pause').hidden = false; gameplayStop(); suspendAudio(true); save(); track('pause', { why });
}
function resume() {
  if (!paused) return; paused = false; $('pause').hidden = true; suspendAudio(false); unlockAudio(); gameplayStart();
}
$('tPlay').addEventListener('click', () => { startPlay('button'); fx.hop(); });
$('btnPause').addEventListener('click', () => pause('button'));
$('escPause').addEventListener('click', () => pause('button'));
$('tEscape').addEventListener('click', () => startEscape('title'));
$('pEscape').addEventListener('click', () => { $('pause').hidden = true; paused = false; suspendAudio(false); startEscape('pause'); });
$('pResume').addEventListener('click', resume);
$('pHome').addEventListener('click', () => { paused = false; $('pause').hidden = true; suspendAudio(false); showTitle(); });
$('pSettings').addEventListener('click', () => { $('pause').hidden = true; paused = false; openSettings(); });
$('pSkins').addEventListener('click', () => { $('pause').hidden = true; paused = false; openSkins(); });
$('pDaily').addEventListener('click', () => { $('pause').hidden = true; paused = false; openDaily(); });
$('tSettings').addEventListener('click', () => openSettings());
$('tSkins').addEventListener('click', () => openSkins());
$('tDaily').addEventListener('click', () => openDaily());
$('tRanks').addEventListener('click', () => openRanks());
$('pRanks').addEventListener('click', () => { $('pause').hidden = true; paused = false; openRanks(); });
// auto-pause on blur / tab switch (resume is always the player's tap)
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause('hidden'); save(); } else { offline(); } });
window.addEventListener('blur', () => pause('blur'));
window.addEventListener('pagehide', save);

// ---------- input ----------
const canvas = $('stage');
canvas.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); if (screen !== 'escape') doTap(e.clientX, e.clientY); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (paused) resume(); else pause('key'); return; }
  if (screen === 'escape') { const d = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[e.code]; if (d) { e.preventDefault(); escMove(d); } return; }
  if ((e.code === 'Space' || e.code === 'Enter') && $('modal').hidden && !paused && (document.activeElement === document.body || screen === 'title')) {
    e.preventDefault(); unlockAudio(); const t = fx.target(); doTap(t.x + (Math.random() - .5) * t.r, t.y - t.r * .5);
  }
});

let hinted = s.taps > 30, wisp = null, nextWispAt = 0;
const pulsePhase = t => (t % G.PULSE_PERIOD) / G.PULSE_PERIOD;       // 0..1, beat at 0/1
const onBeat = t => { const ph = (t % G.PULSE_PERIOD); return Math.min(ph, G.PULSE_PERIOD - ph) < G.PULSE_WINDOW; };
function doTap(x, y) {
  if (!$('modal').hidden || paused) return;
  if (screen === 'title') { startPlay('tap'); fx.hop(); }   // the first tap is the first jump
  now = Date.now();
  if (wisp && Math.hypot(x - wisp.x, y - wisp.y) < 44) return catchWisp();
  const r = G.tap(s, now, Math.random, { perfect: G.hasTwist(s, 'pulse') && onBeat(performance.now() / 1000) }); gameplayStart();
  const st = skin.stages[s.curStage];
  if (r.locked) { fx.float(x, y, '🔥', '#ff6a5a', 24); return; }
  if (!hinted && s.taps > 12) { hinted = true; $('tapHint').classList.add('gone'); }
  const onTarget = fx.hitTest(x, y);
  fx.kick(onTarget ? 0.9 : 0.4, 0.6);
  fx.float(x + (Math.random() - .5) * 24, y - 20, `+${G.fmt(r.value)}`, r.crit || r.perfect ? '#fff' : st.text, r.crit ? 40 : r.perfect ? 34 : 26 + Math.min(10, r.mult * 2));
  fx.burst(x, y, st.colors, r.crit ? 26 : 5 + Math.min(8, r.combo / 6), r.crit ? 420 : 200, r.crit ? 6 : 3.5);
  if (r.combo % 10 === 0) fx.ring(st.accent, 0.6 + r.mult * 0.15);
  sfx('tap', r.combo); buzz('tap');
  if (r.perfect) { fx.float(fx.target().x, fx.target().y - fx.target().r * 1.9, 'PERFECT x3', '#fff', 26, { life: 1 }); fx.ring('#fff', 1.2); }
  if (r.crit) { fx.float(fx.target().x, fx.target().y - fx.target().r * 1.5, skin.text.burst, '#fff', 30, { life: 1.3, vy: -60 }); fx.ring('#fff', 1.6); fx.shake(0.5); fx.flash(st.glow, .8); sfx('burst'); buzz('heavy'); }
  bumpTotal();
  handle(r.events);
}
// floor-3 twist: golden wisps drift across; catching one pays a few seconds of income
function catchWisp() {
  const v = Math.max(10, Math.round(GAME.wispValueSec * (3 * G.basePerTap(s, now) + G.autoPerSec(s, now))));
  const e = G.grant(s, v); fx.float(wisp.x, wisp.y - 20, `WISP +${G.fmt(v)}`, '#ffd23f', 28, { life: 1.2 }); fx.burst(wisp.x, wisp.y, ['#ffd23f', '#fff'], 18, 260, 4);
  sfx('bank'); buzz('success'); track('wisp_catch', { floor: s.floor }); wisp = null; bumpTotal(); handle(e);
}
function tickWisp(dt, t) {
  if (!G.hasTwist(s, 'wisps') || screen !== 'play') { wisp = null; return; }
  if (!wisp && t > nextWispAt) {
    if (nextWispAt) { const { w, h } = fx.size(); const left = Math.random() < .5; wisp = { x: left ? -30 : w + 30, y: h * (0.25 + Math.random() * 0.3), vx: (left ? 1 : -1) * (70 + Math.random() * 40), t0: t }; }
    nextWispAt = t + GAME.wispEverySec[0] + Math.random() * (GAME.wispEverySec[1] - GAME.wispEverySec[0]);
  }
  if (wisp) { wisp.x += wisp.vx * dt; wisp.y += Math.sin((t - wisp.t0) * 3) * 0.6; const { w } = fx.size(); if (wisp.x < -60 || wisp.x > w + 60) wisp = null; }
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
    } else if (e.type === 'chain') {
      const t = fx.target(); fx.float(t.x, t.y - t.r * 2.4, `${skin.text.chain ? skin.text.chain(e.n) : 'CHAIN!'} +${G.fmt(e.value)}`, st.accent, 24, { life: 1, vy: -50 }); sfx('chain');
    } else if (e.type === 'level_up') {
      sfx('levelUp'); fx.ring('#fff', 1); track('level_up', { level: e.level });
    } else if (e.type === 'floor_up') {
      fx.hop(); fx.ring('#fff', 1.3); sfx('levelUp'); buzz('success'); buildTower();
      if (themeChange(events)) {} else banner(`FLOOR ${e.floor + 1}`);
      track('floor_up', { floor: e.floor, via: e.via, seconds_played: Math.round((Date.now() - s.installedAt) / 1000) }); save(); syncScores(true);
    } else if (e.type === 'stage_unlock') {
      applySkin(); const nm = skin.stages[e.stage].name; banner(skin.text.stageUnlock(nm)); sfx('unlock'); buzz('success');
      const t = fx.target(); fx.burst(t.x, t.y, skin.stages[e.stage].colors, 60, 520, 6); fx.flash('#fff', 1); fx.shake(.6);
      track('stage_unlock', { stage: e.stage, stage_name: nm, via: e.via, seconds_played: Math.round((Date.now() - s.installedAt) / 1000) }); save();
    } else if (e.type === 'twist') {
      setTimeout(() => toast(e.twist === 'wisps' ? 'NEW: catch the golden wisps!' : 'NEW: tap as the ring lands for PERFECT x3'), 2300);
      if (e.twist === 'wisps') nextWispAt = performance.now() / 1000 + 4;
    }
  }
}
const themeChange = evs => evs.some(x => x.type === 'stage_unlock');

// ---------- tower (walls show their aura requirement) ----------
function buildTower() {
  const el = $('tower'); if (!el) return;
  el.innerHTML = G.FLOOR_REQ.map((req, i) => `<div class="fl ${i < s.floor ? 'done' : i === s.floor ? 'cur' : ''} ${i % 3 === 0 ? 'theme' : ''}"><span>${i === s.floor + 1 ? `🧱 ${G.fmt(req)}` : i + 1}</span></div>`).reverse().join('');
}

// ---------- shop (hidden until the first upgrade is affordable: no shop popup on first launch) ----------
function buildShop() {
  const ups = G.UP_IDS.map(id => `<button class="up" data-id="${id}"><span class="l"></span><div class="n">${skin.text.upgrades[id][0]}</div><div class="d">${skin.text.upgrades[id][1]}</div><div class="c"></div></button>`).join('');
  $('shop').innerHTML = `<button class="up free" id="btnFree" hidden><span class="tv">AD</span><div class="n">Free upgrade</div><div class="d" id="freeD">Next cheapest upgrade, on us</div><div class="c">▶ Watch</div></button>${ups}<button class="up ascend" id="btnAscend" hidden><div class="n">Ascend ✨</div><div class="d" id="ascD"></div><div class="c" id="ascC"></div></button>`;
  $('shop').querySelectorAll('.up[data-id]').forEach(b => b.addEventListener('click', () => {
    unlockAudio(); const id = b.dataset.id;
    if (G.buy(s, id)) { sfx('buy'); buzz('tap'); squash(b); const r = b.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top, skin.stages[s.curStage].colors, 12, 220, 3); fx.ring('#fff', .5); track('upgrade_buy', { id, level: s.up[id] }); save(); }
    else toast(s.up[id] >= G.UPGRADES[id].max ? 'Maxed out' : `Need more ${skin.text.currency}`);
    refreshShop();
  }));
  $('btnFree').addEventListener('click', () => { unlockAudio(); reward('free', () => { const id = G.freeUpgrade(s); if (id) { banner(`FREE ${skin.text.upgrades[id][0].toUpperCase()}!`); sfx('unlock'); track('upgrade_buy', { id, level: s.up[id], free: true }); } refreshShop(); }); });
  $('btnAscend').addEventListener('click', openAscend);
  refreshShop();
}
const squash = el => { el.classList.remove('squash'); void el.offsetWidth; el.classList.add('squash'); };
function refreshShop() {
  if (!s.flags.shop && (s.aura >= G.upgradeCost('tap', 0) || G.UP_IDS.some(id => s.up[id] > 0))) { s.flags.shop = true; document.body.classList.add('shop-new'); setTimeout(() => document.body.classList.remove('shop-new'), 2500); }
  document.body.classList.toggle('no-shop', !s.flags.shop);
  $('shop').querySelectorAll('.up[data-id]').forEach(b => {
    const id = b.dataset.id, lvl = s.up[id], max = lvl >= G.UPGRADES[id].max, cost = G.upgradeCost(id, lvl), ok = !max && s.aura >= cost;
    b.querySelector('.l').textContent = `Lv ${lvl}`; b.querySelector('.c').textContent = max ? 'MAX' : `${ok ? '▲ ' : ''}✦ ${G.fmt(cost)}`;
    b.classList.toggle('ok', ok); b.classList.toggle('no', !max && !ok); b.classList.toggle('max', max);
  });
  const fg = rewardGate(s, 'free', now); $('btnFree').hidden = !fg.ok || !s.flags.shop;
  const ph = G.pendingHalos(s), showAsc = ph >= 1 || s.halos > 0 || s.floor >= G.FLOORS - 1;
  $('btnAscend').hidden = !showAsc;
  if (showAsc) { $('ascD').textContent = ph >= 1 ? `Reset for +${ph} Halo${ph > 1 ? 's' : ''} (+${ph * 10}% all aura forever)` : `First Halo at ${G.fmt(G.HALO_UNIT * Math.pow(G.halosFor(s.ever) + 1, 2))} lifetime`; $('ascC').textContent = ph >= 1 ? `+${ph} 😇` : `${G.fmt(s.ever)}`; $('btnAscend').classList.toggle('ok', ph >= 1); }
}
function openAscend() {
  const ph = G.pendingHalos(s);
  if (ph < 1) { toast('Not enough lifetime aura for a Halo yet'); return; }
  modal(`<h2>Ascend?</h2><p>Reset your ${skin.text.currency}, upgrades and the tower to earn <b>+${ph} Halo${ph > 1 ? 's' : ''}</b>.<br>Each Halo is <b>+10% all ${skin.text.currency}</b>, forever. Skins and settings stay.</p><div class="row"><button class="btn primary" id="mAsc">Ascend (+${ph} 😇)</button><button class="btn" id="mClose">Not yet</button></div>`);
  $('mAsc').onclick = () => { const n = G.ascend(s); closeModal(); applySkin(); banner(`ASCENDED! +${n} HALO`); fx.flash('#fff', 1); fx.hop(); sfx('unlock'); track('ascend', { halos: s.halos, gained: n }); save(); };
  $('mClose').onclick = closeModal;
}

// ---------- rewarded placements (always the player's choice) ----------
async function reward(placement, apply) {
  const g = rewardGate(s, placement); if (!g.ok) { toast(g.why); return false; }
  const ok = await showRewarded(s, placement);
  if (ok) { apply(); save(); } else toast('No ad available right now, try again soon');
  return ok;
}
$('btnBoost').addEventListener('click', () => { unlockAudio(); reward('boost', () => { G.addBoost(s, Date.now(), GAME.boostMs, GAME.boostCapMs); banner('2x AURA · 2 MIN!'); sfx('unlock'); fx.flash('#7dffb0', .7); }); });
$('btnSkip').addEventListener('click', () => { unlockAudio(); if (!G.canSkip(s, GAME.skipMinProgress)) return; reward('skip', () => handle(G.skipFloor(s))); });

function showOverheat(lost) {
  const until = Date.now() + GAME.reviveWindowMs;
  modal(`<h2>${skin.text.overheat}</h2><p>${skin.text.overheatMsg(G.fmt(lost), skin.text.currency)}</p>
    <div class="countdown" id="cd"></div><div class="row"><button class="btn primary" id="mRevive"><span class="tv">AD</span>${skin.text.reward.revive}</button><button class="btn" id="mClose">Cool down</button></div>`);
  const tick = setInterval(() => { const k = (until - Date.now()) / GAME.reviveWindowMs; const cd = $('cd'); if (!cd) return clearInterval(tick); cd.style.transform = `scaleX(${Math.max(0, k)})`; if (k <= 0) { clearInterval(tick); closeModal(); } }, 50);
  $('mRevive').onclick = async () => { clearInterval(tick); $('mRevive').disabled = true; await reward('revive', () => { const r = G.revive(s, Date.now()); fx.float(fx.target().x, fx.target().y - 120, `+${G.fmt(r.refund)} SAVED!`, '#7dffb0', 30, { life: 1.4 }); sfx('bank'); handle(r.events); }); closeModal(); };
  $('mClose').onclick = () => { clearInterval(tick); closeModal(); };
}

// remove-ads owners see no "AD" badges (same cooldowns and caps; no extra power for money)
function refreshAdButtons() { document.body.classList.toggle('no-ads', !!s.noAds); }
refreshAdButtons();

// ---------- banner / toast ----------
function banner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
let toastT = 0;
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

// ---------- modals ----------
let lastFocus = null;
function modal(html) { lastFocus = document.activeElement; $('modalCard').innerHTML = html; $('modal').hidden = false; gameplayStop(); setTimeout(() => $('modalCard').querySelector('button')?.focus({ preventScroll: true }), 30); }
function closeModal() { $('modal').hidden = true; $('modalCard').innerHTML = ''; if ((screen === 'play' || (screen === 'escape' && run?.alive)) && !paused) gameplayStart(); lastFocus?.focus?.({ preventScroll: true }); }
$('modal').addEventListener('click', e => { if (e.target === $('modal') && !$('mRevive') && !$('escOver')) closeModal(); });

$('stageChip').addEventListener('click', () => {
  const rows = skin.stages.map((st, i) => {
    const locked = i > s.stage, f = i * G.FLOORS_PER_THEME;
    return `<button class="stg ${i === s.curStage ? 'cur' : ''}" data-i="${i}" ${locked ? 'disabled' : ''} style="background:linear-gradient(120deg,${st.bg?.[0] || st.sky?.[0]},${st.glow}55);color:${st.text}">${locked ? '🔒 ' : ''}${st.name}<small>Floors ${f + 1}-${f + 3}${locked ? ` · reach ${G.fmt(G.FLOOR_REQ[f])} lifetime ${skin.text.currency}` : ' · tap to view'}</small></button>`;
  }).join('');
  modal(`<h2>The Tower</h2><p style="margin:0 0 10px">Floor ${s.floor + 1} of ${G.FLOORS}${s.halos ? ` · ${s.halos} Halo${s.halos > 1 ? 's' : ''}` : ''}</p><div class="stages">${rows}</div><button class="btn" id="mClose">Close</button>`);
  $('modalCard').querySelectorAll('.stg:not([disabled])').forEach(b => b.onclick = () => { s.curStage = +b.dataset.i; applySkin(); save(); closeModal(); });
  $('mClose').onclick = closeModal;
});

function openSkins() {
  const rows = skinList().map(k => { const st = k.stages[0]; return `<button class="stg ${k.id === skin.id ? 'cur' : ''}" data-id="${k.id}" style="background:linear-gradient(120deg,${st.bg?.[0] || st.sky?.[0]},${st.glow}66);color:${st.text}">${k.name}<small>${k.blurb} · ${k.stages.map(x => x.name).join(' → ')}</small></button>`; }).join('');
  modal(`<h2>Skins</h2><p style="margin-top:0">Your progress carries over. Each skin plays a little differently.</p><div class="stages">${rows}</div><button class="btn" id="mClose">Close</button>`);
  $('modalCard').querySelectorAll('.stg').forEach(b => b.onclick = () => { if (b.dataset.id !== skin.id) { skin = getSkin(b.dataset.id); s.skin = skin.id; applySkin(); track('skin_select', { skin: skin.id }); banner(skin.name); sfx('unlock'); save(); } closeModal(); });
  $('mClose').onclick = closeModal;
}

function openDaily() {
  if (!G.canClaimDaily(s, Date.now())) { modal(`<h2>Daily gift</h2><p>Already claimed today. Come back tomorrow!</p><button class="btn" id="mClose">OK</button>`); $('mClose').onclick = closeModal; return; }
  const v = G.dailyValue(s, Date.now());
  modal(`<h2>Daily gift 🎁</h2><p>A minute of your ${skin.text.currency}: <b>+${G.fmt(v)}</b></p><div class="row"><button class="btn primary" id="mDDouble"><span class="tv">AD</span>Double it (+${G.fmt(v * 2)})</button><button class="btn" id="mDClaim">Claim</button></div>`);
  const done = m => { const r = G.claimDaily(s, Date.now(), m); if (r) { handle(r.events); bumpTotal(); sfx('bank'); fx.burst(innerWidth / 2, innerHeight * .3, skin.stages[s.curStage].colors, 30, 300, 4); track('daily_claim', { value: r.value, doubled: m > 1 }); save(); } closeModal(); };
  $('mDClaim').onclick = () => done(1);
  $('mDDouble').onclick = async () => { $('mDDouble').disabled = true; const g = rewardGate(s, 'daily'); const ok = g.ok && await showRewarded(s, 'daily'); done(ok ? 2 : 1); };
}

function openSettings() {
  const tg = (id, on) => `<button class="tog ${on ? 'on' : ''}" id="${id}" aria-pressed="${on}" aria-label="${id.slice(1)}"></button>`;
  const sl = (id, v) => `<input type="range" id="${id}" min="0" max="100" step="5" value="${Math.round(v * 100)}" aria-label="${id.slice(1)} volume">`;
  modal(`<h2>Settings</h2>
    <div class="set">Sound ${tg('tSound', s.settings.sound)}</div>
    <div class="set">Music ${sl('rMusic', s.settings.music ?? 0.5)}</div>
    <div class="set">Sound effects ${sl('rSfx', s.settings.sfx ?? 0.8)}</div>
    <div class="set">Vibration ${tg('tVibe', s.settings.vibe)}</div>
    <div class="set">Reduce motion &amp; flashes ${tg('tMotion', s.settings.reduceMotion)}</div>
    <div class="set">Large text ${tg('tBig', s.settings.bigText)}</div>
    ${analyticsMode() !== 'off' ? `<div class="set"><span>Share anonymous analytics<br><small style="opacity:.7;font-weight:600">Helps improve the game${analyticsStatus.consent === 'denied' ? ' · off: not consented' : ''}</small></span> ${tg('tAnalytics', s.settings.analytics)}</div>` : ''}
    ${adsInfo().privacyRequired ? '<div class="set">Privacy options <button class="btn" id="mPriv">Manage</button></div>' : ''}
    ${billingAvailable() ? (s.noAds ? '<div class="set">Ads removed ✓ <span style="font-size:12px;opacity:.7">bonuses skip the video</span></div>' : `<div class="set">Remove ads <button class="btn primary" id="mBuy">${removeAdsPrice()}</button></div><div class="set">Already bought? <button class="btn" id="mRestore">Restore</button></div>`) : ''}
    ${isPortal ? '' : `<div class="set">Privacy policy <a href="${PRIVACY_URL}" target="_blank" rel="noopener">Open</a></div>`}
    <div class="set" style="font-size:12px;opacity:.7">Language: English · Total taps ${G.fmt(s.taps)} · Best streak ${s.best.combo} · Halos ${s.halos} · v${VERSION} · analytics ${analyticsMode()}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="mClose">Close</button></div>`);
  const flip = (id, key, after) => { $(id).onclick = e => { s.settings[key] = !s.settings[key]; e.target.classList.toggle('on', s.settings[key]); e.target.setAttribute('aria-pressed', s.settings[key]); applySettings(); after?.(); save(); }; };
  flip('tSound', 'sound'); flip('tVibe', 'vibe'); flip('tMotion', 'reduceMotion'); flip('tBig', 'bigText');
  $('rMusic').oninput = e => { s.settings.music = e.target.value / 100; applySettings(); save(); };
  $('rSfx').oninput = e => { s.settings.sfx = e.target.value / 100; applySettings(); save(); };
  $('rSfx').onchange = () => { unlockAudio(); sfx('buy'); };
  $('tAnalytics') && ($('tAnalytics').onclick = e => { s.settings.analytics = !s.settings.analytics; setAnalyticsOptIn(s.settings.analytics); e.target.classList.toggle('on', s.settings.analytics); track('analytics_opt', { on: s.settings.analytics }); save(); });
  $('mPriv') && ($('mPriv').onclick = async () => { await showPrivacyOptions(); toast('Privacy choices updated'); });
  $('mBuy') && ($('mBuy').onclick = async () => { $('mBuy').disabled = true; if (await buyRemoveAds(s)) { save(); banner('ADS REMOVED!'); sfx('unlock'); closeModal(); refreshAdButtons(); } else { toast('Purchase not completed'); $('mBuy').disabled = false; } });
  $('mRestore') && ($('mRestore').onclick = async () => { const ok = await restoreRemoveAds(s); save(); toast(ok ? 'Purchase restored' : 'No purchase found'); if (ok) { closeModal(); refreshAdButtons(); } });
  $('mClose').onclick = closeModal;
}
$('btnSettings').addEventListener('click', openSettings);

// ---------- offline progress ----------
function offline() {
  const g = G.offlineGain(s, Date.now(), GAME.offlineCapHours, GAME.offlineEfficiency);
  if (g.secs < 60 || g.value <= 0) return;
  const mins = Math.round(g.secs / 60), t = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  s.lastSeen = Date.now(); // don't double count if the modal is reopened
  if (paused) { paused = false; $('pause').hidden = true; suspendAudio(false); }
  modal(`<h2>Welcome back!</h2><p>Your aura farm gathered <b>+${G.fmt(g.value)}</b> ${skin.text.currency} in ${t}.</p><div class="row"><button class="btn primary" id="mDouble"><span class="tv">AD</span>${skin.text.reward.offline} (+${G.fmt(g.value * 2)})</button><button class="btn" id="mClose">Collect</button></div>`);
  const collect = n => { handle(G.grant(s, n)); bumpTotal(); fx.burst(innerWidth / 2, innerHeight * .2, skin.stages[s.curStage].colors, 30, 300, 4); sfx('bank'); save(); closeModal(); };
  $('mClose').onclick = () => collect(g.value);
  $('mDouble').onclick = async () => { $('mDouble').disabled = true; const ok = await showRewarded(s, 'offline'); collect(ok ? g.value * 2 : g.value); };
}

// ---------- +1 Speed Escape (runner mode; logic in runner.js, art in escape.js) ----------
// Cosmetic tie-ins only: current skin + stage, aura ring tier and halos are drawn on the runner. Aura earned is paid into
// the main game (scaled by the value of one tap). Nothing bought or upgraded changes speed, hitboxes or revives.
const escView = createEscapeView(canvas, fx);
let run = null, escHud = { d: -1, spd: -1, w: -1 };
escView.bindInput(() => (screen === 'escape' && run?.alive && !paused && $('modal').hidden ? run : null), d => escMove(d));
function escMove(d) { if (!run?.alive || paused || !$('modal').hidden) return; if (R.move(run, d)) { sfx('buy'); buzz('tap'); if (!$('escHint').classList.contains('gone') && run.t > 1.5) $('escHint').classList.add('gone'); } }
function refreshEscBest() { $('tEscBest').textContent = s.escape.best > 0 ? `BEST ${s.escape.best} m · TOP SPEED ${s.escape.bestSpeed}` : 'speed +1 every second · dodge the walls'; }
function startEscape(via) {
  if (!$('modal').hidden) closeModal();
  if (screen === 'play') gameplayStop();
  screen = 'escape'; document.body.classList.remove('on-title'); document.body.classList.add('on-escape');
  $('title').hidden = true; $('esc').hidden = false; $('escHint').classList.remove('gone');
  run = R.newRun(); escHud = { d: -1, spd: -1, w: -1 }; $('escBest').textContent = `${s.escape.best} m`;
  track('escape_start', { via, best: s.escape.best, runs: s.escape.runs }); unlockAudio(); gameplayStart(); save();
}
function exitEscape() {
  if (screen !== 'escape') return;
  run = null; document.body.classList.remove('on-escape'); $('esc').hidden = true; gameplayStop();
}
function escEvents(evs) {
  const st = skin.stages[s.curStage], g = escView.geom(), px = g.laneCx(R.laneX(run));
  for (const e of evs) {
    if (e.type === 'speed') {
      const p = $('escPlus'); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop');
      sfx('tap', Math.min(38, e.speed - R.RUN.startSpeed));
      if (e.speed % 10 === 0) { banner(`SPEED ${e.speed}!`); fx.flash(st.glow, .5); buzz('success'); }
    } else if (e.type === 'wisp') {
      fx.burst(px, g.py, st.colors, 12, 220, 3.5); fx.float(px, g.py - 50, '+1 ✦', st.accent, 24); sfx('levelUp'); buzz('tap');
    } else if (e.type === 'dead') {
      fx.shake(1); fx.flash('#ff2a1a', 1); fx.burst(px, g.py, ['#ff6a5a', '#fff', st.accent], 30, 360, 5); sfx('overheat'); buzz('error');
      track('escape_crash', { dist: Math.floor(e.dist), speed: e.speed, revived: run.revived });
      setTimeout(() => { if (screen === 'escape' && run && !run.alive) escOver(); }, 450);
    }
  }
}
function escOver() {
  const d = Math.floor(run.dist), canRev = R.canRevive(run) && rewardGate(s, 'escape_revive').ok;
  if (!canRev) return escResults();
  const until = Date.now() + GAME.reviveWindowMs;
  modal(`<div id="escOver"></div><h2>CAUGHT!</h2><p class="esc-res"><b>${d} m</b>speed ${run.speed}${d > s.escape.best ? ' · <span class="esc-new">NEW BEST!</span>' : ` · best ${s.escape.best} m`}</p>
    <div class="countdown" id="cd"></div><div class="row"><button class="btn primary" id="mERevive"><span class="tv">AD</span>Revive &amp; keep speed</button><button class="btn" id="mENo">No thanks</button></div>`);
  const tick = setInterval(() => { const k = (until - Date.now()) / GAME.reviveWindowMs; const cd = $('cd'); if (!cd) return clearInterval(tick); cd.style.transform = `scaleX(${Math.max(0, k)})`; if (k <= 0) { clearInterval(tick); escResults(); } }, 50);
  $('mERevive').onclick = async () => {
    clearInterval(tick); $('mERevive').disabled = true;
    const ok = await reward('escape_revive', () => { R.revive(run); track('escape_revive', { dist: d, speed: run.speed }); });
    if (ok && run?.alive) { closeModal(); banner('REVIVED! GO GO GO'); sfx('unlock'); fx.flash('#7dffb0', .7); } else escResults();
  };
  $('mENo').onclick = () => { clearInterval(tick); escResults(); };
}
function escResults() {
  if (!run || run.alive || run.paid) return; run.paid = true;
  const d = Math.floor(run.dist), { newBest } = R.recordRun(s.escape, run), v = R.runAura(run, G.basePerTap(s, Date.now()));
  const evs = G.grant(s, v); bumpTotal();
  track('escape_end', { dist: d, speed: run.speed, wisps: run.wisps, revived: run.revived, aura: v, new_best: newBest });
  modal(`<div id="escOver"></div><h2>${newBest ? 'NEW BEST! 🏆' : 'RUN OVER'}</h2><p class="esc-res"><b>${d} m</b>top speed ${run.speed} · ✦ ${run.wisps} wisps<br>Best ${s.escape.best} m</p>
    <p>+${G.fmt(v)} ${skin.text.currency}</p><div class="row"><button class="btn primary" id="mEAgain">⚡ Run again</button><button class="btn" id="mETap">Tap mode</button><button class="btn" id="mEHome">Home</button></div><div class="row"><button class="btn" id="mEShare">📤 Share · Beat my score</button></div>`);
  if (newBest) { sfx('unlock'); fx.flash('#ffe27a', .6); } else sfx('bank');
  handle(evs); save();
  $('mEAgain').onclick = () => { closeModal(); run = null; screen = 'title'; startEscape('again'); };
  $('mETap').onclick = () => { closeModal(); startPlay('escape'); };
  $('mEHome').onclick = () => { closeModal(); showTitle(); };
  $('mEShare').onclick = () => shareScore('escape', d);
  syncScores(true);
}
function escHudTick() {
  const d = Math.floor(run.dist); if (d !== escHud.d) { escHud.d = d; $('escDist').textContent = `${d} m`; }
  if (run.speed !== escHud.spd) { escHud.spd = run.speed; $('escSpd').textContent = run.speed; }
  if (run.wisps !== escHud.w) { escHud.w = run.wisps; $('escWisps').textContent = `✦ ${run.wisps}`; }
  if (d > s.escape.best && s.escape.best > 0) $('escBest').textContent = `${d} m`;
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
  $('lvlbar').style.width = `${Math.min(100, (s.ever - a) / (b - a) * 100)}%`;
  $('stageName').textContent = `Floor ${s.floor + 1} · ${skin.stages[s.curStage].name}`;
  const wall = G.nextWall(s);
  $('stagebar').style.width = `${G.nextFloorProgress(s) * 100}%`;
  $('stageNext').textContent = wall == null ? (G.canAscend(s) ? 'Top of the tower! Ascend for Halos ✨' : 'Top of the tower!') : `🧱 Next wall: ${G.fmt(wall)} ${skin.text.currency} (${G.fmt(Math.max(0, wall - s.lifetime))} to go)`;
  const rt = s.rt; $('heatbar').style.width = `${rt.heat}%`; $('heatbar').parentElement.parentElement.classList.toggle('hot', rt.heat > 75 || now < rt.lockUntil);
  $('streak').innerHTML = now < rt.lockUntil ? `🔥 ${skin.text.overheat} ${Math.ceil((rt.lockUntil - now) / 1000)}s` : rt.combo >= 10 ? `${G.comboMult(s) > 1 ? `x${G.comboMult(s)} ` : ''}${skin.text.streak} ${rt.combo}${rt.pot ? `<small>+${G.fmt(rt.pot)}</small>` : ''}` : '';
  const boostLeft = s.boostUntil - now, bb = $('btnBoost');
  bb.classList.toggle('active', boostLeft > 0);
  const gate = rewardGate(s, 'boost', now);
  bb.classList.toggle('off', boostLeft <= 0 && !gate.ok);
  $('boostLbl').textContent = boostLeft > 0 ? `${Math.floor(boostLeft / 60000)}:${String(Math.floor(boostLeft / 1000) % 60).padStart(2, '0')}` : gate.ok ? 'Boost' : (gate.why || '').replace('Ready in ', '');
  $('btnSkip').hidden = s.floor < GAME.skipFromFloor || !G.canSkip(s, GAME.skipMinProgress);
}

// ---------- loop ----------
let last = performance.now(), acc = 0, saveT = 0;
function loop(tms) {
  const dt = Math.min(0.1, (tms - last) / 1000); last = tms; now = Date.now(); const t = tms / 1000;
  if (!paused) { handle(G.update(s, dt, now)); s.lastSeen = now; tickWisp(dt, t); }
  if (screen === 'escape' && run) {
    if (!paused && $('modal').hidden && run.alive) escEvents(R.step(run, dt));
    escView.frame(run, skin, s.curStage, t, paused ? 0 : dt, { tier: G.auraTier(s), halos: s.halos, best: s.escape.best, reduced: s.settings.reduceMotion });
    escHudTick(); saveT += dt; if (saveT > 5) { saveT = 0; save(); }
    return requestAnimationFrame(loop);
  }
  fx.frame(skin, s.curStage, t, paused ? 0 : dt, { heat: s.rt.heat, locked: now < s.rt.lockUntil, tier: G.auraTier(s), halos: s.halos, wisp, pulse: G.hasTwist(s, 'pulse') && screen === 'play' ? pulsePhase(t) : null });
  acc += dt; if (acc > 0.1) { acc = 0; hud(); refreshShop(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(loop);
}

// ---------- social: leaderboards, profile, friends, share card, challenge links (docs/SOCIAL.md) ----------
const syncScores = (force) => { if (isPortal) return; SOC.submitScores(s, isPortal, !!force).catch(() => {}); };
setInterval(() => syncScores(false), 120e3);
let rk = { mode: 'aura', scope: 'all' };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function openRanks(mode = rk.mode, scope = rk.scope) {
  rk = { mode, scope }; const p = SOC.profile();
  const tabs = (list, cur, key) => `<div class="tabs">${list.map(([id, lbl]) => `<button data-${key}="${id}" class="${id === cur ? 'on' : ''}">${lbl}</button>`).join('')}</div>`;
  modal(`<h2>🏆 Ranks</h2>${tabs(SC.MODE_IDS.map(m => [m, SC.MODES[m].icon + ' ' + SC.MODES[m].label]), mode, 'm')}${tabs([['all', 'Global'], ['week', 'This week'], ['friends', 'Friends']], scope, 's')}
    <ul class="lb" id="lb"><li><span></span><span></span><span>Loading…</span><span></span></li></ul><p class="soc-note" id="lbNote"></p>
    <div class="row"><button class="btn" id="mProf">${p.avatar} ${esc(p.name)}</button><button class="btn" id="mFriends">👥 Friends</button><button class="btn primary" id="mShare">📤 Share</button></div><div class="row"><button class="btn" id="mClose">Close</button></div>`);
  $('modalCard').querySelectorAll('[data-m]').forEach(b => b.onclick = () => openRanks(b.dataset.m, rk.scope));
  $('modalCard').querySelectorAll('[data-s]').forEach(b => b.onclick = () => openRanks(rk.mode, b.dataset.s));
  $('mProf').onclick = openProfile; $('mFriends').onclick = openFriends; $('mClose').onclick = closeModal;
  $('mShare').onclick = () => shareScore(mode, SC.scoresFrom(s)[mode]);
  syncScores(true);
  const r = await SOC.fetchBoard(mode, scope, s, isPortal);
  if (!$('lb') || rk.mode !== mode || rk.scope !== scope) return;
  $('lb').innerHTML = r.rows.length ? r.rows.map((x, i) => `<li class="${x.me ? 'me' : ''}"><span class="rk">${x.rank || i + 1}</span><span>${esc(x.avatar || '😇')}</span><span>${esc(x.name)}</span><span class="sc">${SC.fmtScore(mode, x.score)}</span></li>`).join('') : '<li><span></span><span></span><span>No scores yet. Be the first!</span><span></span></li>';
  $('lbNote').textContent = r.online ? (scope === 'week' ? `Resets every Monday (UTC) · ${SC.weekId()}` : scope === 'friends' ? 'You and the friends you added by code' : 'Top 50 players') : 'Offline mode: showing your best. Online ranks are coming soon. Share your score to challenge friends!';
}
function openProfile() {
  const p = SOC.profile(); let av = p.avatar;
  modal(`<h2>Your profile</h2><input id="pName" class="soc-in" maxlength="16" value="${esc(p.name)}" aria-label="Player name"><div class="avs">${SC.AVATARS.map(a => `<button data-a="${a}" class="${a === av ? 'on' : ''}">${a}</button>`).join('')}</div>
    <p class="soc-note" id="pWhy">Shown on leaderboards. No real names please.</p><div class="row"><button class="btn primary" id="pSave">Save</button><button class="btn" id="pBack">Back</button></div>`);
  $('modalCard').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { av = b.dataset.a; $('modalCard').querySelectorAll('[data-a]').forEach(x => x.classList.toggle('on', x === b)); });
  $('pSave').onclick = async () => { const r = await SOC.setProfile($('pName').value, av); if (!r.ok) { $('pWhy').textContent = r.why; return; } toast('Profile saved'); track('profile_set'); syncScores(true); openRanks(); };
  $('pBack').onclick = () => openRanks();
}
function openFriends() {
  const p = SOC.profile();
  modal(`<h2>👥 Friends</h2><p>Your friend code</p><div class="soc-code" id="fMine">${p.code}</div>
    <div class="row"><button class="btn" id="fShareCode">📤 Send my code</button></div>
    <input id="fCode" class="soc-in" maxlength="7" placeholder="Enter a friend's code" aria-label="Friend code" autocapitalize="characters"><p class="soc-note" id="fWhy">${p.friends.length} friend${p.friends.length === 1 ? '' : 's'}${SOC.isOnline() ? '' : ' · friends need the online leaderboard'}</p>
    <div class="row"><button class="btn primary" id="fAdd">Add friend</button><button class="btn" id="fBack">Back</button></div>`);
  $('fShareCode').onclick = () => SOC.share({ text: `Add me on +1 Aura! My friend code: ${p.code}`, url: SC.challengeUrl({ code: p.code, name: p.name, mode: 'aura', score: SC.scoresFrom(s).aura }) }).then(r => r === 'copied' && toast('Copied!'));
  $('fAdd').onclick = async () => { $('fAdd').disabled = true; const r = await SOC.addFriend($('fCode').value); $('fAdd').disabled = false; $('fWhy').textContent = r.ok ? `Added ${r.name}!` : r.why; if (r.ok) { track('friend_add'); sfx('unlock'); } };
  $('fBack').onclick = () => openRanks(rk.mode, 'friends');
}
async function shareScore(mode, score) {
  const p = SOC.profile(); const st = skin.stages[s.curStage];
  const c = { code: p.code, name: p.name, mode, score }, url = SC.challengeUrl(c);
  const canvas = SOC.drawCard(null, { mode, score, name: p.name, avatar: p.avatar, accent: st.accent?.startsWith('#') && st.accent.length === 7 ? st.accent : '#ffb347' });
  window.__aura_card = canvas;
  const r = await SOC.share({ text: SC.challengeText(c, url), url, canvas }); track('share_score', { mode, how: r });
  if (r === 'copied') toast('Challenge link copied!'); else if (r === 'failed') toast('Sharing not available');
}
// incoming "beat my score" link
const challenge = SC.parseChallenge(location.search);
if (challenge && !isPortal) {
  const mine = SC.scoresFrom(s)[challenge.mode];
  const el = document.createElement('button'); el.className = 'challenge'; el.id = 'challenge';
  el.textContent = `${challenge.name} challenges you: beat ${SC.fmtScore(challenge.mode, challenge.score)} in ${SC.MODES[challenge.mode].label}!${mine > challenge.score ? ' (you already did ✓)' : ''}`;
  el.onclick = () => { el.remove(); if (challenge.mode === 'escape') startEscape('challenge'); else startPlay('challenge'); };
  document.body.appendChild(el); setTimeout(() => el.remove(), 12000);
  track('challenge_open', { mode: challenge.mode });
  if (challenge.code) SOC.connect(isPortal).then(ok => ok && SOC.addFriend(challenge.code)).catch(() => {});
}

applySkin(); hud();
if (isPortal && firstOpen) { screen = 'play'; document.body.classList.remove('on-title'); } else showTitle();
offline();
requestAnimationFrame(loop);
// boot done: drop the loading bar as soon as the first frame can take input (target < 3 s)
bootbar(100);
requestAnimationFrame(() => { const b = $('boot'); if (b) { b.classList.add('done'); setTimeout(() => b.remove(), 250); } window.__aura_ready_ms = Math.round(performance.now()); track('boot_ready', { ms: Math.round(performance.now() - bootT0), total_ms: Math.round(performance.now()) }); });
initAds();
initPortal();
initBilling(s, () => { save(); refreshAdButtons(); });
// test hook (harmless in production): lets the Playwright smoke test inspect state
window.__aura = { get state() { return s; }, G, save, get screen() { return screen; }, get paused() { return paused; }, pause, resume, R, get run() { return run; }, startEscape, openRanks, shareScore, SOC };
