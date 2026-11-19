'use strict';

const TRAIN_KINDS = ['worker', 'spearman', 'shield', 'archer', 'chariot'];
const HINTS = [
  { t: 1.5, msg: 'Workers gather on their own. Train more from the dock below.' },
  { t: 8,   msg: 'Tap Army to select every soldier, then tap the ground to march.' },
  { t: 15,  msg: 'Spend Influence in the Council for upgrades that last all battle.' },
  { t: 22,  msg: 'Wounded troops heal while resting beside the gate.' }
];
let hintIdx = 0, lastEta = -1;
const iconCache = {};

/* ---------- Selection ---------- */
function setSelection(list) {
  group = list.filter((u) => u.alive);
  selected = group[0] || null;
  if (group.length === 1) showWheel(); else hideWheel();
  refreshSelInfo();
}

function refreshSelInfo() {
  const el = $('selinfo');
  if (group.length < 2) { el.hidden = true; return; }
  const counts = {};
  for (const u of group) counts[u.kind] = (counts[u.kind] || 0) + 1;
  const txt = Object.keys(counts).map((k) => `${counts[k]} ${COSTS[k].label}`).join(' · ');
  const soldiers = group.filter((u) => u.kind !== 'worker');
  const plain = soldiers.filter((u) => !u.isBronze).length;
  const hold = soldiers.length && soldiers.every((u) => u.stance === 'hold');
  el.innerHTML = `<span class="seltxt">${txt}</span>`
    + (soldiers.length ? `<button type="button" data-act="stance">${hold ? 'Attack' : 'Hold'}</button>` : '')
    + (plain ? `<button type="button" data-act="bronze">Bronze ×${plain}</button>` : '')
    + '<button type="button" data-act="clear" aria-label="Deselect">✕</button>';
  el.hidden = false;
}

$('selinfo').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  const soldiers = group.filter((u) => u.kind !== 'worker');
  if (act === 'clear') { setSelection([]); SFX.play('tap'); return; }
  if (act === 'stance') {
    const to = soldiers.every((u) => u.stance === 'hold') ? 'aggressive' : 'hold';
    for (const u of soldiers) { u.stance = to; if (to === 'hold') u.target = null; }
    toast(to === 'hold' ? 'Holding position.' : 'Free to attack.');
    SFX.play('order');
  } else if (act === 'bronze') {
    let n = 0;
    for (const u of soldiers) if (!u.isBronze && upgradeBronze(u, true)) n++;
    if (n) toast(`${n} forged in bronze.`);
    else { const c = bronzeCost(); toast(`Bronze needs ${c.c} Copper and ${c.t} Tin each.`); SFX.play('deny'); }
  }
  refreshSelInfo();
});

/* ---------- Camera / input ---------- */
function setupInput() {
  pointers = new Map();
  lastPinch = 0;
  lastTap = { t: 0, id: 0 };

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    SFX.unlock();
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now() });
    if (pointers.size === 2) {
      const arr = [...pointers.values()];
      lastPinch = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    const rec = pointers.get(e.pointerId);
    const w = screenToWorld(p.x, p.y);
    hover = e.pointerType === 'mouse' ? { x: Math.round(w.x), y: Math.round(w.y) } : null;
    if (!rec) return;
    if (pointers.size === 2) {
      const arr = [...pointers.values()];
      const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      if (lastPinch) {
        const midX = (arr[0].x + arr[1].x) / 2, midY = (arr[0].y + arr[1].y) / 2;
        const before = screenToWorld(midX, midY);
        cam.z = cam.tz = clamp(cam.z * (d / lastPinch), 0.55, 2.1);
        const after = worldToScreen(before.x, before.y);
        cam.x += midX - after.x;
        cam.y += midY - after.y;
        cam.tx = cam.x; cam.ty = cam.y;
      }
      lastPinch = d;
      rec.x = p.x; rec.y = p.y;
      return;
    }
    const dx = p.x - rec.x, dy = p.y - rec.y;
    if (Math.hypot(p.x - rec.sx, p.y - rec.sy) > 6) {
      cam.x += dx; cam.y += dy;
      clampCamera();
      cam.tx = cam.x; cam.ty = cam.y;
    }
    rec.x = p.x; rec.y = p.y;
  });
  const up = (e) => {
    const rec = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
    if (!rec || state !== 'playing') return;
    const moved = Math.hypot(rec.x - rec.sx, rec.y - rec.sy);
    if (moved < 8 && performance.now() - rec.t < 500) onTap(rec.sx, rec.sy);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const before = screenToWorld(mx, my);
    cam.z = cam.tz = clamp(cam.z * (e.deltaY > 0 ? 0.92 : 1.08), 0.55, 2.1);
    const after = worldToScreen(before.x, before.y);
    cam.x += mx - after.x; cam.y += my - after.y;
    cam.tx = cam.x; cam.ty = cam.y;
  }, { passive: false });

  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    // Android sends no pointercancel when the app is backgrounded mid-touch;
    // a stale entry would make every later touch count as a pinch.
    pointers.clear(); lastPinch = 0;
    if (state === 'playing') pauseGame();
  });
}

// Keep some part of the map under the middle of the screen
function clampCamera() {
  const c = screenToWorld(W / 2, H / 2);
  const cx = clamp(c.x, 0, COLS - 1), cy = clamp(c.y, 0, ROWS - 1);
  if (cx === c.x && cy === c.y) return;
  const p = iso(cx, cy);
  cam.x = W / 2 - p.x * cam.z;
  cam.y = H / 2 - p.y * cam.z;
}

function unitAtScreen(sx, sy) {
  let best = null, bestD = 30;
  for (const u of units) {
    if (!u.alive || u.sheltered) continue;
    if (u.faction === 'sea' && !isSeen(u)) continue;
    const t = tileAt(Math.round(u.x), Math.round(u.y));
    const p = worldToScreen(u.x, u.y, (t ? t.h : 0) + 16);
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

function onTap(sx, sy) {
  const u = unitAtScreen(sx, sy);
  const now = performance.now();
  if (u && u.faction === 'player') {
    if (lastTap.id === u.id && now - lastTap.t < 380) {
      setSelection(units.filter((o) => o.alive && o.faction === 'player' && o.kind === u.kind));
      toast(`All ${COSTS[u.kind].label.toLowerCase()}s selected.`);
    } else {
      setSelection([u]);
    }
    lastTap = { t: now, id: u.id };
    SFX.play('select');
    return;
  }
  if (u && u.faction === 'sea' && group.length) {
    const fighters = group.filter((o) => o.kind !== 'worker');
    for (const o of fighters) { o.target = u; o.forced = false; o.path = null; o.repath = 0; }
    if (fighters.length) {
      markers.push({ x: u.x, y: u.y, life: 0.6, max: 0.6, color: '#ff5a48' });
      SFX.play('order');
    }
    hideWheel();
    return;
  }
  const w = screenToWorld(sx, sy);
  const tx = Math.round(w.x), ty = Math.round(w.y);
  if (group.length && inBounds(tx, ty)) {
    const t = tileAt(tx, ty);
    if (t && t.explored) {
      if (orderGroup(group, tx, ty)) {
        markers.push({ x: tx, y: ty, life: 0.6, max: 0.6, color: '#e8c56b' });
        SFX.play('order');
      } else { toast('No path to that ground.'); SFX.play('deny'); }
    }
    hideWheel();
    return;
  }
  setSelection([]);
}

/* ---------- Single-unit action wheel ---------- */
function showWheel() {
  const el = $('wheel');
  if (!selected || group.length !== 1) { el.hidden = true; return; }
  const btns = [];
  if (selected.kind === 'worker') {
    btns.push('<button type="button" data-act="gather">Gather</button>');
  } else {
    btns.push(`<button type="button" data-act="stance">${selected.stance === 'aggressive' ? 'Hold' : 'Attack'}</button>`);
    if (!selected.isBronze) btns.push('<button type="button" data-act="bronze">Bronze</button>');
  }
  el.innerHTML = btns.map((b, i) => {
    const ang = -Math.PI / 2 + (i - (btns.length - 1) / 2) * 1.15;
    const x = 80 + Math.cos(ang) * 54 - 30;
    const y = 80 + Math.sin(ang) * 54 - 22;
    return b.replace('<button', `<button style="left:${x}px;top:${y}px"`);
  }).join('');
  el.hidden = false;
}
function hideWheel() { $('wheel').hidden = true; }

$('wheel').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || !selected) return;
  const act = btn.dataset.act;
  if (act === 'stance') {
    selected.stance = selected.stance === 'aggressive' ? 'hold' : 'aggressive';
    if (selected.stance === 'hold') selected.target = null;
    toast(selected.stance === 'aggressive' ? 'Free to attack.' : 'Holding position.');
    SFX.play('order');
    showWheel();
  } else if (act === 'bronze') {
    upgradeBronze(selected);
    showWheel();
  } else if (act === 'gather') {
    selected.flee = false; selected.forced = false;
    releaseTile(selected);
    if (assignGather(selected)) { SFX.play('order'); hideWheel(); }
    else toast('Every field and mine is already worked.');
  }
});

/* ---------- HUD ---------- */
function unitIcon(kind) {
  if (iconCache[kind]) return iconCache[kind];
  const g = document.createElement('canvas');
  g.width = g.height = 112;
  const c = g.getContext('2d');
  const t = tileAt(0, 0);
  c.scale(2, 2);
  c.translate(28, 40 + (t ? t.h : 0));
  const sea = !COSTS[kind];
  drawUnit(c, {
    id: -1, kind, faction: sea ? 'sea' : 'player', x: 0, y: 0, hp: 1, maxHp: 1, isBronze: false,
    bob: 0, path: null, facing: sea ? 2.6 : -0.2, flash: 0, alive: true, big: !!STATS[kind].big, icon: true
  });
  iconCache[kind] = g.toDataURL();
  return iconCache[kind];
}

function buildTrain() {
  $('train').innerHTML = TRAIN_KINDS.map((k) => {
    const c = COSTS[k];
    const cost = (c.g ? `<b class="g">${c.g}</b>` : '') + (c.c ? `<b class="c">${c.c}</b>` : '') + (c.t ? `<b class="t">${c.t}</b>` : '');
    return `<button class="card" data-kind="${k}" type="button">
      <i class="cnt"></i>
      <img src="${unitIcon(k)}" alt="" draggable="false">
      <span class="nm">${c.label}</span>
      <span class="cost">${cost}</span>
    </button>`;
  }).join('');
}

function refreshTrain() {
  const counts = {};
  for (const u of units) if (u.alive && u.faction === 'player') counts[u.kind] = (counts[u.kind] || 0) + 1;
  const room = popCap() - popUsed();
  for (const card of $('train').children) {
    const k = card.dataset.kind, c = COSTS[k];
    card.disabled = !canAfford(c.g, c.c, c.t) || room < c.pop;
    card.querySelector('.cnt').textContent = counts[k] || '';
  }
}

function syncHud() {
  const set = (id, v) => { $(id).querySelector('b').textContent = String(v); };
  set('res-grain', res.grain | 0);
  set('res-copper', res.copper | 0);
  set('res-tin', res.tin | 0);
  set('res-inf', res.influence | 0);
  set('res-pop', `${popUsed()}/${popCap()}`);
  $('cityfill').style.transform = `scaleX(${clamp(cityHp / cityMax(), 0, 1)})`;
  $('citynum').textContent = `${Math.ceil(cityHp)} / ${cityMax()}`;
  $('btn-repair').disabled = cityHp >= cityMax() || !canAfford(40, 0, 0, 1);
  $('citybar').classList.toggle('low', cityHp < cityMax() * 0.35);
  const ready = TECHS.filter((t) => !owned.has(t.id) && res.influence >= t.cost).length;
  $('tech-badge').textContent = ready || '';
  $('tech-badge').hidden = !ready;
  refreshTrain();
}

function refreshWaveStrip() {
  const next = wave + 1;
  const fighting = waveActive;
  const info = WAVE_INFO[(fighting ? wave : next) - 1];
  $('wave-num').textContent = info ? info.title : 'The coast is held';
  $('wave-label').textContent = fighting
    ? `Wave ${wave} of ${WAVES} · under attack`
    : `Wave ${next} of ${WAVES} · lands in ${Math.max(0, Math.ceil(waveEta))}s`;
  $('btn-call').hidden = fighting || waveEta <= 3;
  if (!fighting) $('call-bonus').textContent = `+${Math.ceil(waveEta) * 3}`;
  const comp = nextComp || {};
  $('wave-preview').innerHTML = fighting ? '' : Object.keys(comp).map((k) =>
    `<span class="pv" title="${labelOf(k)}"><img src="${unitIcon(k)}" alt="${labelOf(k)}">${comp[k]}</span>`).join('');
  $('wave-preview').hidden = fighting;
}

function showBanner(kicker, title, line, secs, counsel) {
  const el = $('banner');
  el.querySelector('small').textContent = kicker;
  el.querySelector('b').textContent = title;
  el.querySelector('p').textContent = line;
  el.querySelector('em').textContent = counsel ? `Vizier: “${counsel}”` : '';
  el.hidden = false;
  el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  bannerTimer = secs;
}

$('btn-call').addEventListener('click', () => {
  if (state !== 'playing' || waveActive || waveEta <= 3) return;
  launchWave(true);
});

$('btn-repair').addEventListener('click', () => {
  if (state !== 'playing') return;
  if (cityHp >= cityMax()) { toast('The palace stands firm.'); return; }
  if (!spend(40, 0, 0, 1)) { toast('Repair costs 40 Grain and 1 Influence.'); SFX.play('deny'); return; }
  cityHp = Math.min(cityMax(), cityHp + 90);
  burst(GATE.x, GATE.y, '#e8c56b', 12);
  SFX.play('repair');
  toast('Masons shore up the walls.');
  syncHud();
});

$('btn-army').addEventListener('click', () => {
  if (state !== 'playing') return;
  const army = units.filter((u) => u.alive && u.faction === 'player' && u.kind !== 'worker');
  if (!army.length) { toast('You have no soldiers. Train some below.'); SFX.play('deny'); return; }
  setSelection(army);
  SFX.play('select');
  toast(`${army.length} soldiers ready. Tap the ground or an enemy.`);
});

$('btn-speed').addEventListener('click', () => {
  speed = speed === 1 ? 2 : 1;
  $('btn-speed').textContent = speed === 1 ? '1×' : '2×';
  $('btn-speed').classList.toggle('on', speed === 2);
  SFX.play('tap');
});

$('btn-mute').addEventListener('click', () => {
  save.muted = !save.muted;
  SFX.setMuted(save.muted);
  $('btn-mute').classList.toggle('off', save.muted);
  writeSave();
  SFX.play('tap');
});

/* ---------- Train dock ---------- */
$('train').addEventListener('click', (e) => {
  const btn = e.target.closest('.card');
  if (!btn || state !== 'playing') return;
  const kind = btn.dataset.kind;
  const c = COSTS[kind];
  if (popCap() - popUsed() < c.pop) { toast('The city cannot feed more. Adopt the Levy in the Council.'); SFX.play('deny'); return; }
  if (!spend(c.g, c.c, c.t)) { toast('Not enough resources.'); SFX.play('deny'); return; }
  const occupied = new Set(units.filter((u) => u.alive).map((u) => `${Math.round(u.x)},${Math.round(u.y)}`));
  const spots = [];
  for (let y = 12; y >= 10; y--) for (let x = 8; x <= 13; x++) spots.push({ x, y });
  const spot = spots.find((s) => path.isWalkable(s.x, s.y) && !occupied.has(`${s.x},${s.y}`)) || { x: 10, y: 12 };
  const u = spawn(kind, spot.x, spot.y, 'player');
  stats.trained += 1;
  burst(u.x, u.y, '#e8c56b', 8);
  SFX.play('train');
  if (kind === 'worker') assignGather(u);
  if (!save.seen) save.seen = {};
  if (!save.seen[kind]) { save.seen[kind] = true; writeSave(); toast(c.role, 4200); }
  syncHud();
});

/* ---------- Council (technology) ---------- */
function renderTech() {
  $('tech-inf').textContent = String(res.influence | 0);
  $('tech-list').innerHTML = TECHS.map((t) => {
    const has = owned.has(t.id);
    const can = res.influence >= t.cost;
    return `<li class="${has ? 'owned' : ''}">
      <div><b>${t.name}</b><span>${t.desc}</span></div>
      <button type="button" data-tech="${t.id}" ${has || !can ? 'disabled' : ''}>${has ? 'Adopted' : `<i class="ic inf"></i>${t.cost}`}</button>
    </li>`;
  }).join('');
}
$('btn-tech').addEventListener('click', () => {
  if (state !== 'playing') return;
  state = 'tech';
  $('banner').hidden = true;
  renderTech();
  $('tech').hidden = false;
  SFX.play('tap');
});
$('btn-tech-close').addEventListener('click', () => {
  if (state !== 'tech') return;
  state = 'playing';
  $('tech').hidden = true;
});
$('tech-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tech]');
  if (!btn) return;
  buyTech(btn.dataset.tech);
  renderTech();
});

/* ---------- Game flow ---------- */
function resetGame() {
  res = { grain: 300, copper: 60, tin: 40, influence: 2 };
  units = []; projectiles = []; particles = []; floats = []; markers = []; spawnQueue = [];
  owned = new Set();
  recomputeMods();
  stats = { kills: 0, lost: 0, time: 0, grain: 0, techs: 0, trained: 0 };
  group = []; selected = null; hideWheel(); $('selinfo').hidden = true;
  cityHp = cityMax();
  wave = 0; waveEta = 0; waveActive = false; nextComp = null; nextZones = [];
  influenceAcc = 0; upkeepAcc = 0; towerCd = 0; time = 0; shake = 0;
  hintIdx = 0; lastEta = -1;
  makeMap();
  terrainDirty = true;
  spawn('spearman', 10, 11, 'player');
  spawn('spearman', 11, 11, 'player');
  for (const p of [[7, 14], [7, 16], [14, 13]]) assignGather(spawn('worker', p[0], p[1], 'player'));
  refreshVision();
  focusCity();
  if (!$('train').children.length) buildTrain();
  syncHud();
}

function startGame() {
  SFX.unlock();
  difficulty = save.difficulty;
  resetGame();
  state = 'playing';
  speed = 1;
  $('btn-speed').textContent = '1×';
  $('btn-speed').classList.remove('on');
  for (const id of ['menu', 'end', 'pause', 'tech']) $(id).hidden = true;
  $('hud').hidden = false;
  scheduleWave(26);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  $('pause').hidden = false;
}

function endGame(win) {
  state = win ? 'victory' : 'defeat';
  setSelection([]);
  SFX.play(win ? 'victory' : 'defeat');
  const d = DIFFICULTY[difficulty];
  const hpPct = cityHp / cityMax();
  const stars = win ? (hpPct >= 0.7 ? 3 : hpPct >= 0.35 ? 2 : 1) : 0;
  const cleared = win ? WAVES : Math.max(0, wave - 1);
  const score = Math.round((cleared * 100 + stats.kills * 10 + (win ? 500 + cityHp : 0) - stats.lost * 5) * d.score);
  const best = save.best[difficulty] || { score: 0, wave: 0, stars: 0 };
  const isBest = score > best.score;
  save.best[difficulty] = { score: Math.max(score, best.score), wave: Math.max(cleared, best.wave), stars: Math.max(stars, best.stars) };
  writeSave();

  const mm = Math.floor(stats.time / 60), ss = String(Math.floor(stats.time % 60)).padStart(2, '0');
  $('end-kicker').textContent = win ? 'The trade routes hold' : `The city falls on wave ${wave}`;
  $('end-title').textContent = win ? 'Victory' : 'Defeat';
  $('end-tag').textContent = win
    ? 'Eight waves broken. The Basileus still rules these walls.'
    : 'The palace is ash. The Sea Peoples take the coast.';
  $('end-stars').textContent = win ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('end-stats').innerHTML = [
    ['Waves broken', `${cleared} / ${WAVES}`], ['Raiders slain', stats.kills], ['Soldiers lost', stats.lost],
    ['Grain gathered', stats.grain], ['Time', `${mm}:${ss}`], ['Difficulty', d.label]
  ].map((r) => `<div><small>${r[0]}</small><b>${r[1]}</b></div>`).join('');
  $('end-score').textContent = `Score ${score}${isBest ? ' · new best' : ` · best ${save.best[difficulty].score}`}`;
  $('hud').hidden = true;
  $('end').hidden = false;
}

function showMenu() {
  state = 'menu';
  for (const id of ['pause', 'hud', 'end', 'tech']) $(id).hidden = true;
  $('menu').hidden = false;
  refreshMenu();
}

function refreshMenu() {
  for (const b of $('diffs').children) b.classList.toggle('on', b.dataset.diff === save.difficulty);
  const d = DIFFICULTY[save.difficulty];
  const best = save.best[save.difficulty];
  $('best-line').textContent = best && best.score
    ? `${d.hint} · best ${best.score}${best.stars ? ' ' + '★'.repeat(best.stars) : ` (wave ${best.wave})`}`
    : d.hint;
}

let pausedFrameDrawn = false, lastFrameError = '';

function frame(ts) {
  try {
    frameBody(ts);
  } catch (e) {
    // One bad frame must not stop the loop for good; that looked like a hang.
    const msg = String(e && e.message || e);
    if (msg !== lastFrameError) { lastFrameError = msg; console.error(e); toast('Something went wrong: ' + msg, 5000); }
  }
  requestAnimationFrame(frame);
}

function frameBody(ts) {
  const real = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  for (let i = 0; i < speed; i++) update(real);

  if (toastTimer > 0) { toastTimer -= real; if (toastTimer <= 0) $('toast').hidden = true; }
  if (bannerTimer > 0) { bannerTimer -= real; if (bannerTimer <= 0) $('banner').hidden = true; }
  if (state === 'playing') {
    const eta = waveActive ? -1 : Math.ceil(waveEta);
    if (eta !== lastEta) { lastEta = eta; refreshWaveStrip(); }
    if (!save.tutorialDone && hintIdx < HINTS.length && time >= HINTS[hintIdx].t) {
      toast(HINTS[hintIdx].msg, 4200);
      if (++hintIdx >= HINTS.length) { save.tutorialDone = true; writeSave(); }
    }
  }

  if (pointers.size === 0) {
    cam.x = lerp(cam.x, cam.tx, 0.12);
    cam.y = lerp(cam.y, cam.ty, 0.12);
    cam.z = lerp(cam.z, cam.tz, 0.12);
  }
  // While paused the board does not change; redrawing it every frame under
  // the pause overlay made Resume feel dead on phones.
  if (state === 'paused') {
    if (!pausedFrameDrawn) { drawWorld(); pausedFrameDrawn = true; }
  } else {
    pausedFrameDrawn = false;
    drawWorld();
  }
  if (selected && !$('wheel').hidden && state === 'playing') {
    const t = tileAt(Math.round(selected.x), Math.round(selected.y));
    const p = worldToScreen(selected.x, selected.y, (t ? t.h : 0) + 36);
    $('wheel').style.left = `${p.x - 80}px`;
    $('wheel').style.top = `${p.y - 112}px`;
  }
}

/* ---------- boot ---------- */
cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
window.addEventListener('resize', () => { resize(); if (palace) focusCity(); });
$('btn-start').addEventListener('click', startGame);
$('btn-again').addEventListener('click', startGame);
$('btn-end-menu').addEventListener('click', showMenu);
$('btn-pause').addEventListener('click', pauseGame);
$('btn-resume').addEventListener('click', () => {
  if (state !== 'paused') return;
  SFX.unlock(); // Android suspends the AudioContext while the app is in the background
  state = 'playing';
  $('pause').hidden = true;
});
$('btn-menu').addEventListener('click', showMenu);
$('diffs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-diff]');
  if (!b) return;
  SFX.unlock();
  save.difficulty = b.dataset.diff;
  writeSave();
  refreshMenu();
  SFX.play('tap');
});

if (!DIFFICULTY[save.difficulty]) save.difficulty = 'normal';
difficulty = save.difficulty;
SFX.setMuted(save.muted);
$('btn-mute').classList.toggle('off', save.muted);
resize();
resetGame();
state = 'menu';
$('hud').hidden = true;
refreshMenu();
setupInput();
requestAnimationFrame(frame);
