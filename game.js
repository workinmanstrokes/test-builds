// Hydraulic Press & Foundry — custom-order press shop
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { ITEMS, CUSTOMERS, LINES } from './data.js';

// ============================================================
// 1. CONFIG
// ============================================================
const SAVE_KEY = 'hpf_save_v1';
const STAR_REP = [0, 10, 32, 70, 130, 220];          // rep needed for 0..5 stars
const PRECISION_TOL = [0.05, 0.035, 0.025, 0.015, 0.01]; // tolerance per servo level needed
const MAX_SQUASH = 0.95;

const UPGRADES = [
  { id: 'psi',    icon: '🔩', name: 'Hydraulic Cylinder', base: 140, max: 10, desc: l => `${maxPsiAt(l)} PSI max force${l < 10 ? ` → ${maxPsiAt(l + 1)}` : ''}` },
  { id: 'servo',  icon: '🎛️', name: 'Servo Valve',        base: 220, max: 5,  desc: l => `Precision ${l}: ram stops faster, unlocks ±${pct(PRECISION_TOL[Math.min(4, l)] ?? 0.01, 1)} jobs` },
  { id: 'sensor', icon: '📈', name: 'Strain Sensors',     base: 200, max: 4,  desc: l => ['Listen and watch only', 'Rough stress meter', 'Accurate stress meter', 'Exact stress readout'][l - 1] + (l < 4 ? ' → better' : '') },
  { id: 'dies',   icon: '💎', name: 'Carbide Dies',       base: 160, max: 8,  desc: l => `+${(l - 1) * 25}% scrap, ingots worth ${money(ingotPriceAt(l))}` },
  { id: 'coils',  icon: '⚡', name: 'Induction Coils',    base: 120, max: 8,  desc: l => `Smelts ${smeltRateAt(l)}%/sec` },
  { id: 'sign',   icon: '🪧', name: 'Neon Shop Sign',     base: 300, max: 5,  desc: l => `+${(l - 1) * 12}% pay${l < 3 ? ' · 4th order slot at Lv 3' : ' · 4 order slots'}` },
];

function maxPsiAt(l) { return 120 + 85 * (l - 1); }
function ingotPriceAt(l) { return 35 + 9 * (l - 1); }
function smeltRateAt(l) { return 25 + 15 * (l - 1); }
function upgCost(u, l) { return Math.round(u.base * 1.5 * Math.pow(1.85, l - 1) / 5) * 5; }

// ============================================================
// 2. STATE
// ============================================================
const DEFAULT_SAVE = () => ({
  cash: 150, scrap: 0, ingots: 0, smelt: 0, rep: 0,
  lv: { psi: 1, servo: 1, sensor: 1, dies: 1, coils: 1, sign: 1 },
  orders: [], nextOrderId: 1,
  stats: { jobs: 0, perfect: 0, failed: 0, crushed: 0, earned: 0, crates: 0 },
  sfx: true, haptics: true, firstRun: true,
});
let S = DEFAULT_SAVE();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) S = deepMerge(DEFAULT_SAVE(), JSON.parse(raw)); } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function deepMerge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

let job = null;            // active job on the press
let holding = false, fine = false;
let curRate = 0, coastDecay = 0;
let refillTimers = [];      // seconds until next customer per missing slot
let timeScale = 1;
let log = [];               // event log for playtesting

const maxPsi = () => maxPsiAt(S.lv.psi);
const stars = () => STAR_REP.reduce((n, r, i) => (S.rep >= r ? i : n), 0);
const itemById = id => ITEMS.find(i => i.id === id);
const slots = () => (S.lv.sign >= 3 ? 4 : 3);
const payMult = () => 1 + (S.lv.sign - 1) * 0.12;

// ============================================================
// 3. HELPERS
// ============================================================
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function money(n) { return '$' + Math.round(n).toLocaleString(); }
function pct(f, d = 0) { return (f * 100).toFixed(d) + '%'; }
const $ = id => document.getElementById(id);
function record(type, data = {}) { log.push({ t: +simTime.toFixed(1), ...data, ev: type }); if (log.length > 4000) log.shift(); }

// ============================================================
// 4. AUDIO (synthesized) + HAPTICS
// ============================================================
let AC = null, humGain = null, humOsc = null, hissGain = null;
function audio() {
  if (!S.sfx) return null;
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      // hydraulic hum + hiss bed, gain driven by ram speed
      humOsc = AC.createOscillator(); humOsc.type = 'sawtooth'; humOsc.frequency.value = 48;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      humGain = AC.createGain(); humGain.gain.value = 0;
      humOsc.connect(lp); lp.connect(humGain); humGain.connect(AC.destination); humOsc.start();
      const nb = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const ns = AC.createBufferSource(); ns.buffer = nb; ns.loop = true;
      const hp = AC.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 0.7;
      hissGain = AC.createGain(); hissGain.gain.value = 0;
      ns.connect(hp); hp.connect(hissGain); hissGain.connect(AC.destination); ns.start();
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function noiseBurst(dur, freq, type, vol, decay) {
  const ctx = audio(); if (!ctx) return;
  const n = ctx.sampleRate * dur, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(ctx.destination); s.start();
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  const ctx = audio(); if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  contact() { tone('sine', 120, 40, 0.3, 0.45); noiseBurst(0.12, 900, 'bandpass', 0.25, 0.03); },
  creak(i) { tone('sawtooth', rand(70, 110), rand(40, 60), 0.18 + i * 0.15, 0.05 + i * 0.12); noiseBurst(0.1, rand(300, 700), 'bandpass', 0.05 + i * 0.1, 0.05); },
  crack() { noiseBurst(0.25, 3200, 'highpass', 0.55, 0.04); tone('square', 1800, 600, 0.08, 0.08); },
  rupture() { noiseBurst(0.6, 700, 'lowpass', 0.8, 0.16); tone('sine', 110, 26, 0.6, 0.6); noiseBurst(0.3, 4000, 'highpass', 0.3, 0.05); },
  cash() { tone('triangle', 880, 880, 0.12, 0.18); tone('triangle', 1320, 1320, 0.22, 0.16, 0.09); },
  perfect() { [660, 880, 1320, 1760].forEach((f, i) => tone('triangle', f, f, 0.18, 0.14, i * 0.07)); },
  fail() { tone('sawtooth', 220, 90, 0.45, 0.18); },
  click() { tone('square', 900, 700, 0.04, 0.05); },
  ingot() { tone('triangle', 1180, 1170, 0.4, 0.12); tone('sine', 2360, 2300, 0.3, 0.04); },
  boom() { noiseBurst(1.0, 400, 'lowpass', 1.0, 0.3); tone('sine', 80, 20, 0.9, 0.7); },
};
function buzz(p) { if (S.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

// ============================================================
// 5. ORDERS
// ============================================================
function makeOrder(forceEasy = false) {
  const st = stars();
  let pool = ITEMS.filter(i => i.tier <= st + 1);
  if (forceEasy) pool = ITEMS.filter(i => i.id === 'can');
  // favour the newest unlocked tiers a bit
  const weighted = [];
  for (const it of pool) { const w = it.tier === st + 1 ? 1 : it.tier >= st - 1 ? 3 : 1.5; for (let k = 0; k < w * 2; k++) weighted.push(it); }
  const item = pick(weighted);
  const cust = pick(CUSTOMERS);
  const o = { id: S.nextOrderId++, itemId: item.id, cust: cust.name, biz: cust.biz };
  if (item.kind === 'crack') {
    o.type = 'crack';
    o.req = item.windowMin >= 0.05 ? Math.min(2, st + 1) : item.windowMin >= 0.03 ? 3 : 4;
    o.pay = item.pay;
  } else if (item.kind === 'crate') {
    o.type = 'crate'; o.req = 1; o.pay = 0;
  } else if (!forceEasy && Math.random() < 0.28) {
    o.type = 'scrap'; o.req = 1; o.pay = item.pay * 0.45;
  } else {
    o.type = 'flatten';
    o.req = forceEasy ? 1 : clamp(1 + Math.floor(Math.random() * Math.min(5, st + 2)), 1, 5);
    o.tol = PRECISION_TOL[o.req - 1];
    const hi = item.breakMin - o.tol - 0.015;
    o.target = Math.round(rand(0.22, Math.max(0.24, hi)) * 100) / 100;
    o.pay = item.pay * (1 + (o.req - 1) * 0.4);
  }
  o.pay = Math.round(o.pay * payMult() * rand(0.9, 1.15) / 5) * 5;
  const t = LINES[o.type];
  o.line = pick(t).replace('{item}', item.name.toLowerCase()).replace('{target}', o.target != null ? pct(o.target) : '').replace('{tol}', o.tol ? '±' + pct(o.tol, 1) : '');
  return o;
}
function feasibility(o) {
  const it = itemById(o.itemId);
  const psiOk = maxPsi() >= it.reqPsi, servoOk = S.lv.servo >= o.req;
  return { ok: psiOk && servoOk, psiOk, servoOk, it };
}
function fillBoard(initial = false) {
  while (S.orders.length + refillTimers.length < slots()) {
    if (initial) S.orders.push(makeOrder(S.firstRun && S.orders.length === 0));
    else refillTimers.push(rand(2.5, 5));
  }
}

function acceptOrder(id) {
  if (job) return toast('Finish the job on the press first.');
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const f = feasibility(o);
  if (!f.ok) return toast(!f.psiOk ? `Your press can't dent this. Needs ${f.it.reqPsi} PSI.` : `Too precise for your valve. Needs Servo Lv ${o.req}.`);
  const it = f.it;
  job = {
    order: o, item: it, s: 0, gap: 1, contact: false, cracked: false, ruptured: false, resolved: false,
    breakPt: it.kind === 'crack' ? 9 : rand(it.breakMin, it.breakMax),
    crackPt: it.kind === 'crack' ? rand(it.crackMin, it.crackMax) : 9,
    creakT: 0, peakWarn: 0,
  };
  if (it.kind === 'crack') job.shatterPt = job.crackPt + rand(it.windowMin, it.windowMax);
  curRate = 0;
  SFX.click();
  record('accept', { item: it.id, type: o.type, target: o.target, tol: o.tol, req: o.req, pay: o.pay });
  spawnSpecimen(it);
  renderOrders(); renderJobCard();
  switchTab('orders');
}
function declineOrder(id) {
  const i = S.orders.findIndex(x => x.id === id); if (i < 0) return;
  record('decline', { item: S.orders[i].itemId });
  S.orders.splice(i, 1); SFX.click(); fillBoard(); renderOrders(); persist();
}

// ============================================================
// 6. JOB SIMULATION
// ============================================================
function closeTime() { return 0.24 * Math.pow(0.74, S.lv.servo - 1); }
function targetRate() {
  if (!job) return 0;
  const ratio = clamp(maxPsi() / job.item.reqPsi, 0, 5);
  return 0.2 * Math.sqrt(ratio) * (1 - 0.55 * job.s) * (fine ? 0.18 : 1);
}

function stepJob(dt) {
  if (!job || job.resolved) { curRate = Math.max(0, curRate - dt * 2); return; }
  // ram approach
  if (!job.contact) {
    if (holding) {
      job.gap = Math.max(0, job.gap - dt * (fine ? 1.2 : 3.2));
      if (job.gap === 0) { job.contact = true; SFX.contact(); buzz(30); shake(); record('contact'); renderJobCard(); }
    }
    return;
  }
  if (job.ruptured) return;
  if (holding) {
    const tr = targetRate();
    curRate += (tr - curRate) * Math.min(1, dt / 0.07);
    coastDecay = 0;
  } else if (curRate > 0) {
    if (!coastDecay) coastDecay = curRate / (closeTime() * rand(0.75, 1.25));
    curRate = Math.max(0, curRate - coastDecay * dt);
  }
  job.s = Math.min(MAX_SQUASH, job.s + curRate * dt);

  // events
  const it = job.item;
  if (it.kind === 'crack') {
    if (!job.cracked && job.s >= job.crackPt) {
      job.cracked = true; SFX.crack(); buzz([20, 30, 60]); shake(); banner('CRACKED — STOP!', 'warn', 900);
      sparks(26, '#e8d5ff'); setCrackFx(true); record('crack', { s: job.s });
    }
    if (job.cracked && job.s >= job.shatterPt) return rupture();
  } else if (job.s >= job.breakPt) {
    return rupture();
  }

  // warning signs — creaks, glow, sparks
  const w = warnLevel();
  job.peakWarn = Math.max(job.peakWarn, w);
  if (w > 0 && curRate > 0.002) {
    job.creakT -= dt;
    if (job.creakT <= 0) {
      SFX.creak(w); buzz(Math.round(8 + w * 30));
      job.creakT = lerp(0.85, 0.12, w);
      if (w > 0.5) sparks(Math.round(3 + w * 8), it.kind === 'crack' ? '#d9c8ff' : '#ffd27a');
    }
  }
  if (curRate > 0.01 && Math.random() < dt * 8) sparks(2, '#ffcf7a');
}

// 0 = safe, 1 = about to go
function warnLevel() {
  if (!job) return 0;
  if (job.item.kind === 'crack') {
    if (!job.cracked) return clamp(1 - (job.crackPt - job.s) / 0.05, 0, 1) * 0.7;
    return clamp(0.4 + 0.6 * (job.s - job.crackPt) / (job.shatterPt - job.crackPt), 0, 1);
  }
  return clamp(1 - (job.breakPt - job.s) / 0.12, 0, 1);
}
function stressValue() {
  if (!job) return 0;
  if (job.item.kind === 'crack') return job.cracked ? 0.6 + 0.4 * (job.s - job.crackPt) / (job.shatterPt - job.crackPt) : 0.6 * job.s / job.crackPt;
  return job.s / job.breakPt;
}

function rupture() {
  job.ruptured = true; curRate = 0;
  const it = job.item;
  SFX.rupture(); buzz([60, 40, 120]); shake(true);
  explode(it); removeSpecimen(); sparks(70, '#ffd27a'); shockwave(job.order.type === 'scrap' || job.order.type === 'crate' ? '#ffb02e' : '#ff4d5e');
  record('rupture', { s: +job.s.toFixed(3), type: job.order.type });
  const t = job.order.type;
  setTimeout(() => resolve(t === 'scrap' || t === 'crate' ? 'crushed' : 'ruined'), 650);
}

function canDeliver() {
  return job && !job.resolved && !job.ruptured && job.contact && curRate < 0.0015 && !holding &&
    (job.order.type === 'flatten' || job.order.type === 'crack') && job.s > 0.01;
}
function deliver() {
  if (!canDeliver()) return;
  const o = job.order;
  if (o.type === 'flatten') {
    const err = job.s - o.target;
    if (Math.abs(err) <= o.tol) resolve(Math.abs(err) <= o.tol * 0.25 ? 'perfect' : 'good', err);
    else if (err < 0) { toast(`Not flat enough — ${pct(job.s, 1)} of ${pct(o.target)}. Keep pressing.`); return; }
    else if (err <= o.tol * 2) resolve('close', err);
    else resolve('over', err);
  } else if (o.type === 'crack') {
    if (!job.cracked) { toast('It hasn\'t cracked yet. Press a little more — carefully.'); return; }
    resolve((job.s - job.crackPt) <= (job.shatterPt - job.crackPt) * 0.35 ? 'perfect' : 'good');
  }
}

function resolve(result, err = 0) {
  if (!job || job.resolved) return;
  job.resolved = true;
  const o = job.order, it = job.item;
  const scrapGain = Math.round(it.scrap * (1 + (S.lv.dies - 1) * 0.25) * (job.ruptured ? 1 : 0.4));
  let pay = 0, repDelta = 0, msg = '', cls = 'good';
  const custLine = (ok) => pick(ok ? LINES.success : LINES.fail);

  if (result === 'perfect') {
    pay = o.pay * 1.35; repDelta = 2; msg = 'PERFECT!'; cls = 'great'; S.stats.perfect++; SFX.perfect(); buzz([20, 40, 20, 40, 60]);
  } else if (result === 'good') {
    const acc = o.type === 'flatten' ? 1 - Math.abs(err) / o.tol : 0.6;
    pay = o.pay * (0.85 + 0.25 * acc); repDelta = 1; msg = 'DELIVERED'; SFX.cash();
  } else if (result === 'crushed') {
    if (o.type === 'crate') { crateLoot(it); pay = 0; repDelta = 0; msg = ''; }
    else { pay = o.pay; repDelta = 1; msg = 'CRUSHED!'; cls = 'great'; SFX.cash(); }
  } else if (result === 'close') {
    pay = o.pay * 0.4; repDelta = 0; msg = 'CLOSE ENOUGH'; cls = 'warn'; SFX.click(); toast(`${o.cust} knocked 60% off — a bit too flat.`);
  } else if (result === 'over') {
    pay = 0; repDelta = -1; msg = 'TOO FLAT'; cls = 'bad'; S.stats.failed++; SFX.fail();
  } else {
    pay = 0; repDelta = -2; msg = it.kind === 'crack' ? 'SHATTERED' : 'RUPTURED'; cls = 'bad'; S.stats.failed++; SFX.fail();
  }
  pay = Math.round(pay);
  const prevStars = stars();
  S.cash += pay; S.stats.earned += pay; S.rep = Math.max(0, S.rep + repDelta); S.scrap += scrapGain;
  S.stats.jobs++; if (job.ruptured) S.stats.crushed++;
  if (msg) banner(msg, cls, 1100);
  if (pay > 0) pop('+' + money(pay), 'var(--green)');
  if (scrapGain > 0) setTimeout(() => pop(`+${scrapGain} kg scrap`, 'var(--orange)'), 250);
  if (o.type !== 'crate' && result !== 'close') toast(`${o.cust}: “${custLine(pay > 0)}”` + (repDelta ? `  (${repDelta > 0 ? '+' : ''}${repDelta} rep)` : ''));
  if (stars() > prevStars) setTimeout(() => { banner(`${'★'.repeat(stars())} SHOP RATING UP`, 'great', 1600); SFX.perfect(); toast('Pickier customers with bigger jobs are on their way.'); }, 1200);
  record('resolve', { result, item: it.id, type: o.type, s: +job.s.toFixed(3), target: o.target, err: +err.toFixed(4), pay, rep: S.rep, scrap: scrapGain, peakWarn: +job.peakWarn.toFixed(2) });

  S.orders = S.orders.filter(x => x.id !== o.id);
  S.firstRun = false;
  fillBoard();
  const done = job;
  setTimeout(() => { if (job === done) { job = null; removeSpecimen(); setCrackFx(false); renderJobCard(); } }, job.ruptured ? 50 : 700);
  persist(); renderAll();
}

function crateLoot(it) {
  S.stats.crates++;
  const st = Math.max(1, stars());
  const r = Math.random();
  if (r < 0.14) {
    const lost = Math.round(S.scrap * 0.2); S.scrap -= lost;
    SFX.boom(); buzz([100, 50, 200]); shake(true); shockwave('#ff3d1f');
    banner('💣 IT WAS A BOMB', 'bad', 1400); toast(`Boom. The blast scattered ${lost} kg of your scrap.`);
    record('loot', { kind: 'bomb', lost });
  } else if (r < 0.48) {
    const c = Math.round(rand(60, 180) * st / 5) * 5; S.cash += c; SFX.cash();
    banner('💰 CASH INSIDE', 'great', 1200); pop('+' + money(c), 'var(--green)'); record('loot', { kind: 'cash', c });
  } else if (r < 0.72) {
    const k = Math.round(rand(12, 35) * st); S.scrap += k; SFX.ingot();
    banner('🔧 SCRAP HAUL', 'good', 1200); pop(`+${k} kg`, 'var(--orange)'); record('loot', { kind: 'scrap', k });
  } else if (r < 0.92) {
    const n = Math.round(rand(2, 5)); S.ingots += n; SFX.ingot();
    banner(`🥇 ${n} INGOTS`, 'great', 1200); record('loot', { kind: 'ingots', n });
  } else {
    const c = 500 * st; S.cash += c; SFX.perfect(); buzz([30, 30, 30, 30, 120]);
    banner('🎰 JACKPOT', 'great', 1600); pop('+' + money(c), 'var(--green)'); record('loot', { kind: 'jackpot', c });
  }
}

// ============================================================
// 7. FURNACE + SHOP
// ============================================================
function stepFurnace(dt) {
  if (S.scrap >= 5) {
    S.smelt += smeltRateAt(S.lv.coils) * dt;
    if (S.smelt >= 100) { S.smelt = 0; S.scrap -= 5; S.ingots++; if (Math.random() < 0.5) SFX.ingot(); persist(); }
  } else S.smelt = 0;
}
function sellIngots() {
  if (S.ingots <= 0) return toast('No ingots yet — every job leaves scrap for the furnace.');
  const v = S.ingots * ingotPriceAt(S.lv.dies);
  record('sell', { n: S.ingots, v });
  S.cash += v; S.stats.earned += v; S.ingots = 0; SFX.cash(); pop('+' + money(v), 'var(--green)');
  persist(); renderAll();
}
function buy(id) {
  const u = UPGRADES.find(x => x.id === id), l = S.lv[id];
  if (l >= u.max) return;
  const c = upgCost(u, l);
  if (S.cash < c) return toast(`Need ${money(c)} for that.`);
  S.cash -= c; S.lv[id]++; SFX.ingot(); buzz(25);
  record('buy', { id, lv: S.lv[id], cost: c });
  toast(`${u.name} → Lv ${S.lv[id]}`);
  fillBoard(); persist(); renderAll();
}

// ============================================================
// 8. THREE.JS SCENE
// ============================================================
const ANVIL_TOP = -0.9, RAM_IDLE = ANVIL_TOP + 2.5;
let renderer, scene, camera, ram, specimen = null, specMeshes = [], specMats = [], specH = 1;
let contactLight, seamMesh = null, innerLight = null, fragments = [];
let fragGeo;
const stage = $('stage'), glCanvas = $('gl'), fx = $('fx'), fctx = fx.getContext('2d');

function initScene() {
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070605);
  scene.fog = new THREE.Fog(0x070605, 7, 16);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);

  scene.add(new THREE.HemisphereLight(0xffe2c0, 0x120c08, 0.35));
  const key = new THREE.SpotLight(0xfff1dc, 60, 0, Math.PI / 5, 0.6, 1.2);
  key.position.set(3.2, 6, 4.5); key.target.position.set(0, -0.4, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6cb8ff, 1.1); rim.position.set(-4, 3, -3); scene.add(rim);
  const warm = new THREE.PointLight(0xff7a2a, 6, 7, 1.5); warm.position.set(-2.4, -0.4, 1.8); scene.add(warm);
  contactLight = new THREE.PointLight(0xff4a14, 0, 4, 1.6); contactLight.position.set(0, ANVIL_TOP + 0.3, 0.9); scene.add(contactLight);

  // floor
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.85, metalness: 0.2, map: plateTexture() });
  floorMat.map.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.62; floor.receiveShadow = true; scene.add(floor);

  // frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.45 });
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xd9861c, metalness: 0.3, roughness: 0.42 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 1, roughness: 0.08 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b6068, metalness: 0.9, roughness: 0.3 });
  for (const x of [-2.2, 2.2]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.6, 1.0), paintMat); col.position.set(x, 1.6, -0.25); col.castShadow = col.receiveShadow = true; scene.add(col);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.2, 24), chrome); rod.position.set(x * 0.74, 1.5, 0.15); scene.add(rod);
  }
  const crown = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.9, 1.3), paintMat); crown.position.set(0, 4.6, -0.1); crown.castShadow = true; scene.add(crown);
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.7, 1.9), frameMat); base.position.set(0, -1.27, 0); base.castShadow = base.receiveShadow = true; scene.add(base);
  const bolster = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.22, 64), steel); bolster.position.set(0, ANVIL_TOP - 0.11, 0); bolster.receiveShadow = true; scene.add(bolster);
  const hz = new THREE.MeshStandardMaterial({ map: hazardTexture(), metalness: 0.2, roughness: 0.6 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(5.22, 0.16, 1.92), hz); strip.position.set(0, -0.98, 0); scene.add(strip);

  // ram
  ram = new THREE.Group();
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 48), chrome); piston.position.y = 2.95; piston.castShadow = true; ram.add(piston);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.38, 0.8), paintMat); cross.position.y = 0.52; cross.castShadow = true; ram.add(cross);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 48), hz); collar.position.y = 0.2; ram.add(collar);
  const platen = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.35, 0.14, 64), steel); platen.position.y = 0.07; platen.castShadow = true; ram.add(platen);
  ram.position.y = RAM_IDLE;
  scene.add(ram);

  fragGeo = new THREE.DodecahedronGeometry(0.1, 0);
  resize();
  new ResizeObserver(resize).observe(stage);
}

function plateTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1c1915'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = '#0b0a08'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
  g.fillStyle = '#2a251f';
  for (let y = 16; y < 256; y += 32) for (let x = 16 + ((y / 32) % 2) * 16; x < 256; x += 32) { g.beginPath(); g.ellipse(x, y, 6, 2, Math.PI / 4, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hazardTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#f2b01e'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#141210';
  for (let x = -32; x < 288; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x, 32); g.lineTo(x - 16, 32); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let y = 0; y < 128; y += 32) {
    g.fillStyle = ['#8a5a2b', '#7a4e24', '#94622f', '#83552a'][y / 32]; g.fillRect(0, y, 128, 31);
    for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(40,20,5,.25)'; g.beginPath(); const yy = y + Math.random() * 31; g.moveTo(0, yy); g.bezierCurveTo(40, yy + 3, 80, yy - 3, 128, yy); g.stroke(); }
    g.fillStyle = '#2a1a0c'; g.fillRect(0, y + 31, 128, 1);
  }
  g.fillStyle = '#3a3a3a'; [[8, 8], [120, 8], [8, 120], [120, 120]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  fx.width = w * dpr; fx.height = h * dpr; fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.aspect = w / h;
  // pull back on tall/narrow screens so the whole press fits
  const narrow = clamp(1.2 / camera.aspect, 1, 1.75);
  camera.position.set(1.1 * narrow, 1.0, 5.9 * narrow);
  camera.lookAt(0, -0.15, 0);
  camera.updateProjectionMatrix();
}

// ---- specimens ----
function spawnSpecimen(it) {
  removeSpecimen();
  specimen = new THREE.Group(); specMeshes = []; specMats = [];
  const main = new THREE.MeshPhysicalMaterial({ color: it.color, metalness: it.metal, roughness: it.rough, clearcoat: it.metal > 0.5 ? 0.4 : 0.1, clearcoatRoughness: 0.2 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.8 });
  specMats.push(main, trim, dark);
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = m.receiveShadow = true; specimen.add(m); specMeshes.push(m); return m;
  };
  switch (it.shape) {
    case 'can': {
      add(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 40, 24), main, 0, 0.65);
      add(new THREE.CylinderGeometry(0.36, 0.42, 0.06, 40, 2), trim, 0, 1.28);
      add(new THREE.CylinderGeometry(0.42, 0.36, 0.06, 40, 2), trim, 0, 0.03);
      break;
    }
    case 'box': {
      add(new THREE.BoxGeometry(1.5, 0.8, 0.8, 16, 12, 10), main, 0, 0.4);
      add(new THREE.BoxGeometry(1.52, 0.06, 0.82, 16, 1, 10), trim, 0, 0.62);
      add(new THREE.TorusGeometry(0.22, 0.04, 10, 24, Math.PI), trim, 0, 0.82);
      break;
    }
    case 'crate': {
      main.map = woodTexture(); main.color.set(0xffffff); main.metalness = 0; main.roughness = 0.85;
      add(new THREE.BoxGeometry(1.2, 1.2, 1.2, 10, 14, 10), main, 0, 0.6);
      const q = add(new THREE.BoxGeometry(1.24, 0.1, 0.12, 10, 1, 1), dark, 0, 0.6, 0.6, 0, 0, Math.PI / 4); q.material = trim;
      break;
    }
    case 'ball': {
      add(new THREE.SphereGeometry(0.72, 48, 36), main, 0, 0.72);
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16), dark, -0.14, 1.27, 0.38, 0.75);
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16), dark, 0.14, 1.27, 0.38, 0.75);
      add(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 16), dark, 0, 1.06, 0.6, 1.1);
      break;
    }
    case 'geode': {
      const g = new THREE.IcosahedronGeometry(0.7, 4); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        const n = 1 + 0.09 * Math.sin(v.x * 7.1) * Math.cos(v.y * 6.3) + 0.06 * Math.sin(v.z * 11 + v.x * 3) ;
        v.multiplyScalar(n); v.y *= 0.92; p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      add(g, main, 0, 0.66);
      break;
    }
    case 'bar': {
      const g = new THREE.CylinderGeometry(0.62, 0.86, 0.42, 4, 6); g.rotateY(Math.PI / 4); g.scale(1.25, 1, 0.62);
      add(g, main, 0, 0.21);
      break;
    }
    case 'safe': {
      add(new THREE.BoxGeometry(1.25, 1.35, 1.15, 14, 16, 12), main, 0, 0.675);
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 32), trim, 0, 0.8, 0.6, Math.PI / 2);
      add(new THREE.BoxGeometry(0.06, 0.5, 0.08), trim, 0.42, 0.6, 0.6);
      for (const y of [0.3, 1.05]) add(new THREE.BoxGeometry(0.08, 0.18, 0.08), dark, -0.6, y, 0.55);
      break;
    }
    case 'engine': {
      add(new THREE.BoxGeometry(1.2, 0.8, 1.3, 12, 10, 12), main, 0, 0.4);
      add(new THREE.BoxGeometry(0.5, 0.45, 1.25, 6, 6, 8), trim, -0.42, 0.95, 0, 0, 0, 0.5);
      add(new THREE.BoxGeometry(0.5, 0.45, 1.25, 6, 6, 8), trim, 0.42, 0.95, 0, 0, 0, -0.5);
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 32), dark, 0, 0.45, 0.72, Math.PI / 2);
      break;
    }
    case 'core': {
      main.emissive = new THREE.Color(0x10b981); main.emissiveIntensity = 0.6;
      add(new THREE.OctahedronGeometry(0.62, 3), main, 0, 0.7);
      add(new THREE.TorusGeometry(0.78, 0.06, 16, 64), trim, 0, 0.7, 0, Math.PI / 2.6, 0.4);
      add(new THREE.TorusGeometry(0.78, 0.06, 16, 64), trim, 0, 0.7, 0, -Math.PI / 2.6, -0.4);
      break;
    }
  }
  // bake each mesh's local transform into deformation data (group space, y=0 at anvil)
  const box = new THREE.Box3().setFromObject(specimen); specH = box.max.y;
  for (const m of specMeshes) {
    m.updateMatrix();
    m.userData.mat = m.matrix.clone(); m.userData.inv = m.matrix.clone().invert();
    m.userData.orig = Float32Array.from(m.geometry.attributes.position.array);
  }
  specimen.position.y = ANVIL_TOP;
  specimen.rotation.y = it.shape === 'bar' ? 0 : -0.35;
  scene.add(specimen);
  // geode inner glow
  if (it.kind === 'crack') {
    seamMesh = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 10, 72), new THREE.MeshBasicMaterial({ color: it.inner, transparent: true, opacity: 0 }));
    seamMesh.rotation.x = Math.PI / 2; seamMesh.position.y = 0.66; specimen.add(seamMesh);
    innerLight = new THREE.PointLight(it.inner, 0, 3, 1.5); innerLight.position.set(0, 0.7, 0.4); specimen.add(innerLight);
  }
  ram.position.y = RAM_IDLE;
  deform(0);
}
function removeSpecimen() {
  if (!specimen) return;
  scene.remove(specimen);
  specimen.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  for (const m of specMats) { if (m.map) m.map.dispose(); m.dispose(); }
  if (seamMesh) seamMesh.material.dispose();
  specimen = null; specMeshes = []; specMats = []; seamMesh = null; innerLight = null;
}
function setCrackFx(on) { if (seamMesh) seamMesh.material.opacity = on ? 1 : 0; if (innerLight) innerLight.intensity = on ? 4 : 0; }

const _v = new THREE.Vector3();
function deform(s) {
  if (!specimen) return;
  const H = specH, sq = 1 - s, bulge = s * 1.15;
  for (const m of specMeshes) {
    const pos = m.geometry.attributes.position, a = pos.array, o = m.userData.orig, M = m.userData.mat, I = m.userData.inv;
    for (let i = 0; i < o.length; i += 3) {
      _v.set(o[i], o[i + 1], o[i + 2]).applyMatrix4(M);       // to group space
      const yn = clamp(_v.y / H, 0, 1);
      const prof = Math.sin(Math.PI * yn);                    // barreling: middle bulges most
      const wrinkle = 1 + Math.sin(_v.y * 13 + _v.x * 7 + _v.z * 5) * s * 0.07;
      const spread = (1 + bulge * (0.35 + 0.65 * prof)) * wrinkle;
      _v.x *= spread; _v.z *= spread; _v.y *= sq;
      _v.applyMatrix4(I);
      a[i] = _v.x; a[i + 1] = _v.y; a[i + 2] = _v.z;
    }
    pos.needsUpdate = true; m.geometry.computeVertexNormals();
  }
  if (seamMesh) { seamMesh.position.y = 0.66 * sq; seamMesh.scale.set(1 + bulge * 1.15, 1 + bulge * 1.15, 1); }
}

function explode(it) {
  for (let i = 0; i < 34; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: it.color, metalness: it.metal, roughness: 0.4, emissive: it.kind === 'crack' ? it.inner : 0xff5a10, emissiveIntensity: rand(0.4, 1.2) });
    const m = new THREE.Mesh(fragGeo, mat);
    m.position.set(rand(-0.4, 0.4), ANVIL_TOP + rand(0.05, 0.4), rand(-0.4, 0.4));
    m.scale.set(rand(0.8, 2.2), rand(0.4, 1.2), rand(0.8, 2));
    m.castShadow = true;
    const a = rand(0, Math.PI * 2), sp = rand(2.5, 7);
    fragments.push({ m, vx: Math.cos(a) * sp, vy: rand(2, 6), vz: Math.sin(a) * sp, rx: rand(-14, 14), ry: rand(-14, 14), life: 1.6 });
    scene.add(m);
  }
}
function stepFragments(dt) {
  for (let i = fragments.length - 1; i >= 0; i--) {
    const f = fragments[i];
    f.vy -= 12 * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
    if (f.m.position.y < -1.58 && f.vy < 0) { f.m.position.y = -1.58; f.vy *= -0.35; f.vx *= 0.6; f.vz *= 0.6; f.rx *= 0.5; f.ry *= 0.5; }
    f.m.rotation.x += f.rx * dt; f.m.rotation.y += f.ry * dt;
    f.m.material.emissiveIntensity = Math.max(0, f.m.material.emissiveIntensity - dt * 0.8);
    f.life -= dt;
    if (f.life < 0.4) f.m.scale.multiplyScalar(0.9);
    if (f.life <= 0) { scene.remove(f.m); f.m.material.dispose(); fragments.splice(i, 1); }
  }
}

function updateScene(dt, t) {
  // ram height
  let target = RAM_IDLE;
  if (job && specimen && !job.resolved && !job.ruptured) {
    const contactY = ANVIL_TOP + specH * (1 - job.s);
    target = job.contact ? contactY : lerp(contactY, RAM_IDLE, job.gap);
    ram.position.y = job.contact ? contactY : lerp(ram.position.y, target, 1 - Math.exp(-dt * 18));
  } else {
    ram.position.y = lerp(ram.position.y, RAM_IDLE, 1 - Math.exp(-dt * 4));
  }
  if (specimen && job) {
    deform(job.s);
    // heat glow from work-hardening + warning glow
    const w = warnLevel(), heat = job.item.metal > 0.3 ? clamp(job.s * 1.1, 0, 1) : 0;
    const main = specMats[0];
    if (job.item.shape !== 'core') {
      main.emissive.setRGB(Math.min(1, heat * 1.4 + w * 0.6), heat * 0.35 + w * 0.15, w * 0.05);
      main.emissiveIntensity = heat * 0.55 + w * (0.4 + 0.4 * Math.sin(t * 22));
    } else main.emissiveIntensity = 0.6 + w * 1.5 + 0.2 * Math.sin(t * 6);
    contactLight.intensity = (heat * 2 + w * 6) * (job.contact ? 1 : 0);
    if (!job.contact) specimen.rotation.y += dt * 0.35;
    const jit = curRate > 0.005 ? 0.006 + w * 0.02 : 0;
    specimen.position.x = rand(-jit, jit); specimen.position.z = rand(-jit, jit);
    if (job.cracked && seamMesh) seamMesh.material.opacity = 0.75 + 0.25 * Math.sin(t * 10);
  } else contactLight.intensity = 0;
  stepFragments(dt);
  renderer.render(scene, camera);
}

// ---- 2D fx overlay ----
let sparkList = [], waves = [];
function contactScreen() {
  const y = job ? ANVIL_TOP + specH * (1 - job.s) * 0.5 : ANVIL_TOP + 0.3;
  _v.set(0, y, 0.6).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * stage.clientWidth, y: (-_v.y * 0.5 + 0.5) * stage.clientHeight };
}
function sparks(n, color) {
  const c = contactScreen();
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0), sp = rand(2, 7.5);
    sparkList.push({ x: c.x + rand(-50, 50), y: c.y + rand(-15, 25), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 1, c: Math.random() < 0.6 ? '#fff4c2' : color });
  }
}
function shockwave(color) { const c = contactScreen(); waves.push({ x: c.x, y: c.y, r: 10, a: 0.9, c: color }); }
function drawFx(dt) {
  const w = stage.clientWidth, h = stage.clientHeight, k = dt * 60;
  fctx.clearRect(0, 0, w, h);
  fctx.globalCompositeOperation = 'lighter';
  for (let i = sparkList.length - 1; i >= 0; i--) {
    const p = sparkList[i], px = p.x, py = p.y;
    p.x += p.vx * k; p.y += p.vy * k; p.vy += 0.42 * k; p.life -= 0.028 * k;
    if (p.y > h * 0.9 && p.vy > 0) { p.vy *= -0.4; p.vx *= 0.7; }
    if (p.life <= 0) { sparkList.splice(i, 1); continue; }
    fctx.globalAlpha = p.life; fctx.strokeStyle = p.c; fctx.lineWidth = 2;
    fctx.beginPath(); fctx.moveTo(px, py); fctx.lineTo(p.x, p.y); fctx.stroke();
  }
  fctx.globalCompositeOperation = 'source-over';
  for (let i = waves.length - 1; i >= 0; i--) {
    const s = waves[i]; s.r += (260 - s.r) * 0.12 * k; s.a -= 0.035 * k;
    if (s.a <= 0) { waves.splice(i, 1); continue; }
    fctx.globalAlpha = s.a; fctx.strokeStyle = s.c; fctx.lineWidth = 4;
    fctx.beginPath(); fctx.ellipse(s.x, s.y, s.r, s.r * 0.35, 0, 0, Math.PI * 2); fctx.stroke();
  }
  fctx.globalAlpha = 1;
}

// ============================================================
// 9. UI
// ============================================================
function shake(big) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); if (big) buzz(80); }
let bannerT = 0;
function banner(text, cls, ms) {
  const b = $('banner'); b.textContent = text; b.className = 'banner show ' + cls;
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), ms);
}
function pop(text, color) {
  const el = document.createElement('div'); el.className = 'pop'; el.style.color = color; el.textContent = text;
  $('pops').appendChild(el); setTimeout(() => el.remove(), 1200);
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

function renderStars() {
  const n = stars();
  $('stars').innerHTML = '★'.repeat(n) + `<span class="off">${'★'.repeat(5 - n)}</span>`;
  const next = STAR_REP[n + 1];
  $('repText').textContent = next != null ? `Rep ${S.rep} · next ★ at ${next}` : `Rep ${S.rep} · max rating`;
}

function orderGoal(o, it) {
  if (o.type === 'flatten') return `Flatten to <b>${pct(o.target)}</b> <span>±${pct(o.tol, 1)}</span>`;
  if (o.type === 'crack') return `Crack it open — <b>don't shatter it</b>`;
  if (o.type === 'scrap') return `Crush it <b>all the way</b>`;
  return `Crush it and see what's inside`;
}

function renderOrders() {
  const list = $('orderList');
  if (!S.orders.length) { list.innerHTML = `<div class="empty">Waiting for customers…</div>`; $('ordersBadge').textContent = ''; return; }
  list.innerHTML = S.orders.map(o => {
    const f = feasibility(o), it = f.it, active = job && job.order.id === o.id;
    const tags = [
      `<span class="tag type">${o.type.toUpperCase()}</span>`,
      `<span class="tag ${f.psiOk ? 'ok' : 'no'}">${it.reqPsi} PSI</span>`,
      o.type === 'flatten' ? `<span class="tag">${pct(o.target)} ±${pct(o.tol, 1)}</span>` : '',
      o.req > 1 ? `<span class="tag ${f.servoOk ? 'ok' : 'no'}">Servo ${o.req}</span>` : '',
      it.kind === 'crack' ? `<span class="tag">Fragile ${'◆'.repeat(o.req)}</span>` : '',
    ].join('');
    return `<div class="order ${f.ok ? '' : 'locked'} ${active ? 'active' : ''}">
      <div class="o-head"><div class="o-icon">${it.icon}</div>
        <div class="o-who"><b>${it.name}</b><small>${o.cust} · ${o.biz}</small></div>
        <div class="o-pay">${o.type === 'crate' ? '???' : money(o.pay)}</div></div>
      <div class="o-line">“${o.line}”</div>
      <div class="o-tags">${tags}</div>
      <div class="o-actions">${active ? `<button class="btn" disabled>On the press</button>` :
        `<button class="btn primary" data-accept="${o.id}" ${job || !f.ok ? 'disabled' : ''}>${f.ok ? 'Take job' : 'Can\'t do it yet'}</button>
         <button class="btn" data-decline="${o.id}" ${active ? 'disabled' : ''}>Decline</button>`}</div>
    </div>`;
  }).join('');
  $('ordersBadge').textContent = job ? '' : S.orders.filter(o => feasibility(o).ok).length || '';
}

function renderJobCard() {
  if (!job) {
    $('jcType').textContent = 'IDLE'; $('jcPay').textContent = '';
    $('jcTitle').textContent = 'No job on the press';
    $('jcGoal').innerHTML = 'Take an order from the board to get started.';
    $('gTarget').style.display = 'none';
    return;
  }
  const o = job.order, it = job.item;
  $('jcType').textContent = o.type.toUpperCase();
  $('jcPay').textContent = o.type === 'crate' ? 'loot' : money(o.pay);
  $('jcTitle').textContent = `${it.icon} ${it.name}`;
  $('jcGoal').innerHTML = orderGoal(o, it) + (job.contact ? '' : `<br>Hold <b>PRESS</b> to bring the ram down.`);
  const gt = $('gTarget');
  if (o.type === 'flatten') {
    gt.style.display = 'block';
    gt.style.top = ((o.target - o.tol) / MAX_SQUASH * 100) + '%';
    gt.style.height = ((o.tol * 2) / MAX_SQUASH * 100) + '%';
  } else gt.style.display = 'none';
}

function renderUpgrades() {
  $('upgList').innerHTML = UPGRADES.map(u => {
    const l = S.lv[u.id], c = upgCost(u, l), maxed = l >= u.max;
    return `<div class="upg"><div class="u-icon">${u.icon}</div><div class="u-body">
      <b>${u.name}</b><span class="lv">LV ${l}${maxed ? ' · MAX' : ''}</span><p>${u.desc(l)}</p>
      <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="pip ${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
      <button class="btn primary" data-buy="${u.id}" ${maxed || S.cash < c ? 'disabled' : ''}>${maxed ? 'Maxed' : money(c)}</button></div>`;
  }).join('');
}

function renderAll() {
  renderStars(); renderOrders(); renderUpgrades(); renderJobCard();
  $('ingotPrice').textContent = money(ingotPriceAt(S.lv.dies));
  $('furnaceTemp').textContent = (1450 + (S.lv.coils - 1) * 180).toLocaleString() + ' °C';
  $('psiMax').textContent = maxPsi();
}

let lastCash = -1, uiT = 0;
function updateHud(dt) {
  const s = job ? job.s : 0;
  $('gFill').style.height = (s / MAX_SQUASH * 100) + '%';
  $('gNeedle').style.top = (s / MAX_SQUASH * 100) + '%';
  $('gVal').textContent = pct(s, 1);
  const working = job && job.contact && !job.ruptured;
  const psiNow = working ? Math.round(Math.min(maxPsi(), job.item.reqPsi * (0.35 + job.s) + (curRate > 0.001 ? maxPsi() * 0.25 * (curRate / 0.2) : 0))) : 0;
  $('psiNow').textContent = psiNow;
  // stress meter (sensors)
  const sb = $('stressBox');
  if (S.lv.sensor >= 2 && job && job.contact) {
    sb.style.display = 'block';
    let v = clamp(stressValue(), 0, 1);
    if (S.lv.sensor === 2) v = Math.round((v + rand(-0.06, 0.06)) * 5) / 5;
    else if (S.lv.sensor === 3) v = Math.round(v * 10) / 10;
    $('sFill').style.width = (clamp(v, 0, 1) * 100) + '%';
  } else sb.style.display = 'none';

  $('deliverBtn').disabled = !canDeliver();
  // hum
  if (AC && humGain) { const k = curRate / 0.2; humGain.gain.setTargetAtTime(Math.min(0.12, k * 0.12), AC.currentTime, 0.05); hissGain.gain.setTargetAtTime(Math.min(0.05, k * 0.05) + (holding && job && !job.contact ? 0.03 : 0), AC.currentTime, 0.05); humOsc.frequency.setTargetAtTime(45 + k * 30, AC.currentTime, 0.1); }

  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.1;
    if (S.cash !== lastCash) { $('cash').textContent = money(S.cash); lastCash = S.cash; renderUpgrades(); }
    $('scrapKg').textContent = S.scrap + ' kg';
    $('ingots').textContent = S.ingots;
    $('smeltFill').style.width = S.smelt + '%';
    $('smeltPct').textContent = Math.round(S.smelt) + '%';
    $('crucibleGlow').style.opacity = S.scrap >= 5 ? 0.6 : 0.2;
    $('sellBtn').textContent = S.ingots ? `Sell ${S.ingots} for ${money(S.ingots * ingotPriceAt(S.lv.dies))}` : 'Sell ingots';
  }
}

// ============================================================
// 10. INPUT
// ============================================================
function setHold(on, isFine = false) {
  if (on && !job) { if (!setHold._warned || performance.now() - setHold._warned > 2500) { toast('Take a job from the Order Board first.'); setHold._warned = performance.now(); } switchTab('orders'); return; }
  audio();
  holding = on; fine = on && isFine;
  $('pressBtn').classList.toggle('held', on && !isFine);
  $('fineBtn').classList.toggle('held', on && isFine);
  if (on && job && job.contact && !job.ruptured) renderJobCard();
  if (!on && job && !job.contact) renderJobCard();
}
function bindHold(el, isFine) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); setHold(true, isFine); });
  const up = () => { if (holding && fine === isFine || (holding && !isFine)) setHold(false); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
bindHold($('pressBtn'), false);
bindHold($('fineBtn'), true);
stage.addEventListener('pointerdown', e => { e.preventDefault(); stage.setPointerCapture?.(e.pointerId); setHold(true, e.shiftKey); });
stage.addEventListener('pointerup', () => setHold(false));
stage.addEventListener('pointercancel', () => setHold(false));
document.addEventListener('contextmenu', e => e.preventDefault());
$('deliverBtn').addEventListener('click', deliver);

const keys = new Set();
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.key === 'Shift') { e.preventDefault(); keys.add(e.code === 'Space' ? 'space' : 'shift'); setHold(true, keys.has('shift')); }
  if (e.key === 'Enter') { e.preventDefault(); deliver(); }
});
addEventListener('keyup', e => {
  if (e.code === 'Space') keys.delete('space');
  if (e.key === 'Shift') keys.delete('shift');
  if (keys.size === 0) setHold(false); else setHold(true, keys.has('shift'));
});
addEventListener('blur', () => { keys.clear(); setHold(false); });

document.querySelector('.tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) { switchTab(t.dataset.tab); SFX.click(); } });
$('orderList').addEventListener('click', e => {
  const a = e.target.closest('[data-accept]'), d = e.target.closest('[data-decline]');
  if (a) acceptOrder(+a.dataset.accept); if (d) declineOrder(+d.dataset.decline);
});
$('upgList').addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b) buy(b.dataset.buy); });
$('sellBtn').addEventListener('click', sellIngots);
$('menuBtn').addEventListener('click', () => {
  const st = S.stats;
  $('menuStats').innerHTML = `Jobs done: ${st.jobs}<br>Perfect: ${st.perfect}<br>Ruined: ${st.failed}<br>Crates opened: ${st.crates}<br>Total earned: ${money(st.earned)}`;
  $('sfxToggle').checked = S.sfx; $('hapticToggle').checked = S.haptics;
  $('menu').showModal();
});
$('sfxToggle').addEventListener('change', e => { S.sfx = e.target.checked; if (!S.sfx && humGain) { humGain.gain.value = 0; hissGain.gain.value = 0; } persist(); });
$('hapticToggle').addEventListener('change', e => { S.haptics = e.target.checked; persist(); });
$('resetBtn').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to wipe everything'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Reset save'; }, 3000); return; }
  delete b.dataset.armed; b.textContent = 'Reset save';
  S = DEFAULT_SAVE(); job = null; refillTimers = []; removeSpecimen(); persist(); fillBoard(true); renderAll(); $('menu').close(); toast('Fresh start. Good luck.');
});

// ============================================================
// 11. LOOP
// ============================================================
let last = performance.now(), elapsed = 0, simTime = 0;
function step(dt) {
  simTime += dt;
  if (window.__botStep) window.__botStep(dt);
  stepJob(dt);
  stepFurnace(dt);
  for (let i = refillTimers.length - 1; i >= 0; i--) {
    refillTimers[i] -= dt;
    if (refillTimers[i] <= 0) { refillTimers.splice(i, 1); S.orders.push(makeOrder()); renderOrders(); persist(); }
  }
}
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  let dt = real * timeScale;
  while (dt > 0) { const d = Math.min(dt, 1 / 60); step(d); dt -= d; }
  elapsed += real;
  updateScene(real, elapsed);
  drawFx(real);
  updateHud(real);
  requestAnimationFrame(frame);
}

initScene();
if (!S.orders.length) fillBoard(true); else fillBoard();
renderAll();
requestAnimationFrame(frame);
if (S.firstRun) setTimeout(() => toast('Welcome! Take the soda can job, then hold PRESS. Use FINE to sneak up on the target.'), 600);

// ============================================================
// 12. PLAYTEST HOOK — used by tools/playtest.mjs and the tester bots
// ============================================================
window.__game = {
  get save() { return S; },
  get job() { return job && { type: job.order.type, item: job.item.id, s: job.s, target: job.order.target, tol: job.order.tol, contact: job.contact, cracked: job.cracked, ruptured: job.ruptured, resolved: job.resolved, warn: warnLevel(), rate: curRate }; },
  get orders() { return S.orders.map(o => ({ ...o, feasible: feasibility(o).ok })); },
  get log() { return log; },
  get simTime() { return simTime; },
  canDeliver, accept: acceptOrder, decline: declineOrder, deliver, buy, sell: sellIngots,
  hold: (on, isFine = false) => setHold(on, isFine),
  setTimeScale: v => { timeScale = v; },
  stars, maxPsi, upgradeCost: id => { const u = UPGRADES.find(x => x.id === id); return S.lv[id] >= u.max ? Infinity : upgCost(u, S.lv[id]); },
  reset: () => { S = DEFAULT_SAVE(); S.sfx = false; S.haptics = false; job = null; refillTimers = []; log = []; removeSpecimen(); fillBoard(true); renderAll(); },
};
