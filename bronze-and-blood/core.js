'use strict';

const TILE_W = 72, TILE_H = 36;
const COLS = 20, ROWS = 22;
const WAVES = 8;
const CITY_BASE = 420;
const POP_BASE = 12;
const GATE = { x: 10.5, y: 13 };
const SAVE_KEY = 'bab_save_v2';

const COSTS = {
  worker:   { g: 50,  c: 0,  t: 0,  pop: 1, label: 'Worker',   role: 'Gathers on its own. Shelters in the gate when raiders come near.' },
  spearman: { g: 80,  c: 0,  t: 0,  pop: 1, label: 'Spearman', role: 'Spearman: half again as deadly against champions, rams and warlords.' },
  shield:   { g: 100, c: 15, t: 0,  pop: 1, label: 'Shield',   role: 'Shield-bearer: shrugs off most arrow damage. Put him in front.' },
  archer:   { g: 90,  c: 0,  t: 0,  pop: 1, label: 'Archer',   role: 'Archer: strikes from range. Keep him behind the line.' },
  chariot:  { g: 150, c: 40, t: 20, pop: 2, label: 'Chariot',  role: 'Chariot: double damage on the charge after a run. Counts as two men.' },
  bronze:   { g: 0,   c: 30, t: 30, label: 'Bronze' }
};

const STATS = {
  worker:   { hp: 60,  spd: 3.2,  dmg: 0,  range: 1.15, cd: 1.1,  vis: 4 },
  spearman: { hp: 100, spd: 3.0,  dmg: 11, range: 1.25, cd: 0.95, vis: 5 },
  shield:   { hp: 165, spd: 2.35, dmg: 8,  range: 1.2,  cd: 1.05, vis: 5 },
  archer:   { hp: 70,  spd: 3.05, dmg: 9,  range: 4.6,  cd: 1.05, vis: 6, ranged: true },
  chariot:  { hp: 125, spd: 5.1,  dmg: 16, range: 1.4,  cd: 0.8,  vis: 6 },
  raider:   { hp: 80,  spd: 2.75, dmg: 8,  range: 1.2,  cd: 1.0,  vis: 5 },
  marauder: { hp: 130, spd: 2.3,  dmg: 12, range: 1.25, cd: 1.05, vis: 5 },
  seaArcher:{ hp: 60,  spd: 2.65, dmg: 7,  range: 4.2,  cd: 1.15, vis: 6, ranged: true },
  slinger:  { hp: 45,  spd: 3.2,  dmg: 7,  range: 6.0,  cd: 1.2,  vis: 7, ranged: true },
  reaver:   { hp: 55,  spd: 4.0,  dmg: 9,  range: 1.2,  cd: 0.8,  vis: 6 },
  champion: { hp: 190, spd: 2.45, dmg: 15, range: 1.3,  cd: 0.95, vis: 5, big: true },
  ram:      { hp: 280, spd: 1.7,  dmg: 0,  range: 1.3,  cd: 1.6,  vis: 4, big: true, cityDmg: 34 },
  warlord:  { hp: 900, spd: 2.2,  dmg: 26, range: 1.5,  cd: 0.9,  vis: 6, big: true, cityDmg: 30 }
};

const BOUNTY = {
  raider:    { g: 5 },
  marauder:  { g: 8, c: 2 },
  seaArcher: { g: 6 },
  slinger:   { g: 6, t: 2 },
  reaver:    { g: 5 },
  champion:  { g: 20, c: 6, t: 4, i: 1 },
  ram:       { g: 15, c: 8 },
  warlord:   { g: 100, i: 5 }
};

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let W = 0, H = 0, dpr = 1;
let state = 'menu';
let last = 0, time = 0, speed = 1;
let tiles, path, units, projectiles, particles, floats, markers;
let cityTiles, cityHp, palace;
let res, wave, waveEta, waveActive, influenceAcc, upkeepAcc, towerCd;
let nextComp, nextZones, spawnQueue;
let selected = null, group = [], hover = null;
let cam, pointers, lastPinch, lastTap;
let terrainCache, terrainDirty, waterPhase = 0;
let toastTimer = 0, bannerTimer = 0, shake = 0, palaceWarned = false;
let owned, mod, stats, difficulty = 'normal';
let save = loadSave();

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') return Object.assign({ best: {}, muted: false, difficulty: 'normal' }, s);
  } catch (e) { /* first run or storage blocked */ }
  return { best: {}, muted: false, difficulty: 'normal' };
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ }
}

function iso(x, y) {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
}
function invIso(sx, sy) {
  const x = sx / (TILE_W / 2), y = sy / (TILE_H / 2);
  return { x: (y + x) / 2, y: (y - x) / 2 };
}
function worldToScreen(x, y, z = 0) {
  const p = iso(x, y);
  return { x: p.x * cam.z + cam.x, y: (p.y - z) * cam.z + cam.y };
}
function screenToWorld(sx, sy) {
  return invIso((sx - cam.x) / cam.z, (sy - cam.y) / cam.z);
}
function inBounds(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
function tileAt(x, y) { return inBounds(x, y) ? tiles[y | 0][x | 0] : null; }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function irand(a, b) { return (a + Math.random() * (b - a + 1)) | 0; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

/* ---------- A* (eight-directional, no corner cutting) ---------- */
class Pathfinding {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.walk = Array.from({ length: h }, () => Array(w).fill(true));
  }
  setWalkable(x, y, v) { if (inBounds(x, y)) this.walk[y][x] = v; }
  isWalkable(x, y) { return inBounds(x, y) && this.walk[y][x]; }
  findPath(sx, sy, gx, gy) {
    sx |= 0; sy |= 0; gx |= 0; gy |= 0;
    if (!this.isWalkable(sx, sy) || !this.isWalkable(gx, gy)) return null;
    if (sx === gx && sy === gy) return [{ x: sx, y: sy }];
    const key = (x, y) => y * this.w + x;
    const open = [];
    const gScore = new Map();
    const came = new Map();
    const closed = new Set();
    const heur = (x, y) => {
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const push = (x, y, g, f) => {
      open.push({ x, y, g, f });
      for (let i = open.length - 1; i > 0; i--) {
        if (open[i].f < open[i - 1].f) { const t = open[i]; open[i] = open[i - 1]; open[i - 1] = t; }
        else break;
      }
    };
    gScore.set(key(sx, sy), 0);
    push(sx, sy, 0, heur(sx, sy));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.length) {
      const cur = open.shift();
      const ck = key(cur.x, cur.y);
      if (closed.has(ck)) continue;
      if (cur.x === gx && cur.y === gy) {
        const out = [{ x: cur.x, y: cur.y }];
        let k = ck;
        while (came.has(k)) {
          const p = came.get(k);
          out.push({ x: p.x, y: p.y });
          k = key(p.x, p.y);
        }
        out.reverse();
        return out;
      }
      closed.add(ck);
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.isWalkable(nx, ny)) continue;
        if (dx && dy && (!this.isWalkable(cur.x + dx, cur.y) || !this.isWalkable(cur.x, cur.y + dy))) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const g = cur.g + (dx && dy ? 1.414 : 1);
        if (gScore.has(nk) && g >= gScore.get(nk)) continue;
        gScore.set(nk, g);
        came.set(nk, { x: cur.x, y: cur.y });
        push(nx, ny, g, g + heur(nx, ny));
      }
    }
    return null;
  }
}

/* ---------- Resources, population, technology ---------- */
function canAfford(g, c, t, i = 0) {
  return res.grain >= g && res.copper >= c && res.tin >= t && res.influence >= i;
}
function spend(g, c, t, i = 0) {
  if (!canAfford(g, c, t, i)) return false;
  res.grain -= g; res.copper -= c; res.tin -= t; res.influence -= i;
  syncHud();
  return true;
}
function addRes(which, n) {
  res[which] = Math.max(0, res[which] + n);
  if (n > 0 && which === 'grain') stats.grain += n;
  syncHud();
}
function popUsed() {
  let n = 0;
  for (const u of units) if (u.alive && u.faction === 'player') n += COSTS[u.kind].pop;
  return n;
}
function popCap() { return POP_BASE + mod.popCap; }
function cityMax() { return CITY_BASE + mod.cityMax; }
function bronzeCost() {
  return { c: COSTS.bronze.c - mod.bronzeOff, t: COSTS.bronze.t - mod.bronzeOff };
}

function recomputeMods() {
  mod = { grain: 1, metal: 1, archRange: 0, archDmg: 1, bronzeOff: 0, popCap: 0, infRate: 1, towers: false, cityMax: 0, chariotSpd: 1, chargeDist: 3 };
  for (const t of TECHS) if (owned.has(t.id)) t.apply(mod);
}

function buyTech(id) {
  const t = TECHS.find((x) => x.id === id);
  if (!t || owned.has(id) || (state !== 'playing' && state !== 'tech')) return false;
  if (!spend(0, 0, 0, t.cost)) { toast(`${t.name} needs ${t.cost} Influence.`); SFX.play('deny'); return false; }
  const before = cityMax();
  owned.add(id);
  recomputeMods();
  if (cityMax() > before) cityHp += cityMax() - before;
  stats.techs += 1;
  SFX.play('tech');
  toast(`${t.name} adopted.`);
  burst(palace.x, palace.y, '#b89cf0', 18);
  syncHud();
  return true;
}

function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  toastTimer = ms / 1000;
}

/* ---------- Map ---------- */
function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}
function noise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function makeMap() {
  tiles = [];
  cityTiles = [];
  path = new Pathfinding(COLS, ROWS);
  palace = { x: 10, y: 15 };

  for (let y = 0; y < ROWS; y++) {
    tiles[y] = [];
    for (let x = 0; x < COLS; x++) {
      const n = noise(x * 0.18, y * 0.18);
      const n2 = noise(x * 0.45 + 9, y * 0.45);
      let type = 'dirt';
      let h = Math.round(n * 8);
      if (y <= 1 || (y === 2 && n > 0.35)) { type = 'water'; h = -6; }
      else if (y === 2 || (y === 3 && n < 0.55)) { type = 'shoal'; h = -2; }
      else if (y <= 5) { type = 'sand'; h = 0; }
      else if (n > 0.62 && y > 8) { type = 'grass'; h = 2 + (n2 * 6) | 0; }
      else { type = n2 > 0.7 ? 'grass' : 'dirt'; h = (n * 5) | 0; }
      tiles[y][x] = { type, h, vis: 0, explored: false, worker: 0 };
      path.setWalkable(x, y, type !== 'water');
    }
  }

  // Grain fields west of the city
  for (let y = 13; y <= 18; y++) for (let x = 2; x <= 6; x++) {
    if ((x + y) % 2 === 0 || hash(x, y) > 0.25) {
      tiles[y][x].type = 'field'; tiles[y][x].h = 1;
    }
  }
  // Copper hills east
  for (let y = 10; y <= 14; y++) for (let x = 15; x <= 18; x++) {
    if (hash(x, y + 3) > 0.3) { tiles[y][x].type = 'copper'; tiles[y][x].h = 10 + (hash(x, y) * 8) | 0; }
  }
  // Tin rocks south-east
  for (let y = 17; y <= 20; y++) for (let x = 14; x <= 18; x++) {
    if (hash(x * 2, y) > 0.28) { tiles[y][x].type = 'tin'; tiles[y][x].h = 8 + (hash(y, x) * 7) | 0; }
  }
  // Olive groves
  for (let y = 8; y <= 12; y++) for (let x = 3; x <= 7; x++) {
    if (hash(x, y) > 0.55) { tiles[y][x].type = 'grove'; tiles[y][x].h = 4; }
  }
  // Road from beach to palace
  for (let y = 5; y <= 15; y++) {
    const x = 10 + ((y % 5 === 0) ? 1 : 0);
    tiles[y][x].type = 'road'; tiles[y][x].h = 1;
    if (x + 1 < COLS) { tiles[y][x + 1].type = tiles[y][x + 1].type === 'water' ? tiles[y][x + 1].type : 'road'; tiles[y][x + 1].h = 1; }
  }

  // City court and walls
  for (let y = 13; y <= 18; y++) for (let x = 8; x <= 13; x++) {
    tiles[y][x].type = 'court'; tiles[y][x].h = 4;
    tiles[y][x].city = true;
    cityTiles.push({ x, y });
  }
  // Palace footprint (unwalkable)
  for (let y = 14; y <= 16; y++) for (let x = 9; x <= 11; x++) {
    tiles[y][x].type = 'palace'; tiles[y][x].h = 14;
    path.setWalkable(x, y, false);
  }
  // Walls around court
  const wall = (x, y, gate) => {
    tiles[y][x].type = gate ? 'gate' : 'wall';
    tiles[y][x].h = gate ? 8 : 16;
    path.setWalkable(x, y, !!gate);
  };
  for (let x = 8; x <= 13; x++) { wall(x, 13, x === 10 || x === 11); wall(x, 18, false); }
  for (let y = 14; y <= 17; y++) { wall(8, y, false); wall(13, y, false); }

  revealAround(10, 15, 9, 1);
}

function revealAround(cx, cy, r, amount) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!inBounds(x, y)) continue;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r2) {
        const v = clamp(1 - Math.sqrt(d2) / (r + 0.2), 0, 1) * amount;
        tiles[y][x].vis = Math.max(tiles[y][x].vis, v);
        if (tiles[y][x].vis > 0.15) tiles[y][x].explored = true;
      }
    }
  }
}

function refreshVision() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) tiles[y][x].vis = 0;
  revealAround(palace.x, palace.y, 8, 1);
  for (const u of units) {
    if (u.faction !== 'player' || !u.alive) continue;
    revealAround(u.x, u.y, u.vis, 1);
  }
}
function isSeen(u) {
  const t = tileAt(Math.round(u.x), Math.round(u.y));
  return !!t && t.vis > 0.08;
}

function isResource(t) { return t && (t.type === 'field' || t.type === 'copper' || t.type === 'tin'); }
function resKind(t) { return t.type === 'field' ? 'grain' : t.type; }

/* ---------- Units ---------- */
let uid = 1;
function spawn(kind, x, y, faction) {
  const st = STATS[kind];
  const d = DIFFICULTY[difficulty];
  const grow = faction === 'sea' ? 1 + 0.07 * Math.max(0, wave - 1) : 1;
  const hp = Math.round(st.hp * (faction === 'sea' ? d.hp * grow : 1));
  const u = {
    id: uid++, kind, faction, x, y,
    hp, maxHp: hp,
    dmg: Math.round(st.dmg * (faction === 'sea' ? d.dmg : 1)),
    cityDmg: Math.round((st.cityDmg || st.dmg) * (faction === 'sea' ? d.dmg : 1)),
    range: st.range, spd: st.spd, cd: st.cd, vis: st.vis, ranged: !!st.ranged, big: !!st.big,
    cooldown: 0, stance: 'aggressive', isBronze: false, alive: true,
    path: null, pi: 0, target: null, gather: null, forced: false, repath: 0,
    charge: 0, flash: 0, hurtAt: -99, sheltered: false, flee: false, fleeCalm: 0,
    bob: Math.random() * Math.PI * 2,
    facing: faction === 'sea' ? 1 : -0.2
  };
  units.push(u);
  return u;
}

function uRange(u) {
  return u.range + (u.kind === 'archer' ? mod.archRange : 0);
}
function uDmg(u, target) {
  let d = u.dmg;
  if (u.kind === 'archer') d *= mod.archDmg;
  if (u.kind === 'spearman' && target && target.big) d *= 1.5;
  return Math.round(d);
}

function upgradeBronze(u, quiet) {
  if (!u || u.isBronze || u.faction !== 'player' || u.kind === 'worker') return false;
  const c = bronzeCost();
  if (!spend(0, c.c, c.t)) {
    if (!quiet) { toast(`Bronze needs ${c.c} Copper and ${c.t} Tin.`); SFX.play('deny'); }
    return false;
  }
  u.isBronze = true;
  u.maxHp = Math.round(u.maxHp * 1.5);
  u.dmg = Math.round(u.dmg * 1.25);
  u.hp = Math.min(u.hp + (u.maxHp / 3 | 0), u.maxHp);
  burst(u.x, u.y, '#e8c56b', 14);
  SFX.play('bronze');
  if (!quiet) toast(`${labelOf(u.kind)} forged in bronze.`);
  return true;
}

function labelOf(k) {
  return ({ worker: 'Worker', spearman: 'Spearman', shield: 'Shield-bearer', archer: 'Archer', chariot: 'Chariot' })[k]
    || ENEMY_LABELS[k] || k;
}

function nearestEnemy(u, maxR, onlyKind) {
  let best = null, bestD = maxR;
  for (const o of units) {
    if (o === u || !o.alive || o.faction === u.faction || o.sheltered) continue;
    if (onlyKind && o.kind !== onlyKind) continue;
    if (u.faction === 'player' && !isSeen(o)) continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function nearestWalkable(tx, ty) {
  if (path.isWalkable(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (path.isWalkable(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
    }
  }
  return null;
}

// Low-level: path a unit to a tile. No side effects on its orders.
function setPath(u, gx, gy) {
  const goal = nearestWalkable(clamp(Math.round(gx), 0, COLS - 1), clamp(Math.round(gy), 0, ROWS - 1));
  if (!goal) return false;
  const p = path.findPath(Math.round(u.x), Math.round(u.y), goal.x, goal.y);
  if (!p) return false;
  u.path = p; u.pi = 0;
  return true;
}

function releaseTile(u) {
  if (!u.gather) return;
  const t = tileAt(u.gather.x, u.gather.y);
  if (t && t.worker === u.id) t.worker = 0;
  u.gather = null;
}
function claimTile(u, x, y) {
  releaseTile(u);
  u.gather = { x, y };
  tiles[y][x].worker = u.id;
}

// Send a worker to the free field or mine that the city needs most.
function assignGather(u) {
  const count = { grain: 0, copper: 0, tin: 0 };
  for (const o of units) {
    if (o.alive && o.kind === 'worker' && o.gather && o !== u) {
      const t = tileAt(o.gather.x, o.gather.y);
      if (isResource(t)) count[resKind(t)] += 1;
    }
  }
  const weight = { grain: 3, copper: 1, tin: 1 };
  const order = Object.keys(count).sort((a, b) => count[a] / weight[a] - count[b] / weight[b]);
  for (const kind of order) {
    let best = null, bestD = 99;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = tiles[y][x];
      if (!isResource(t) || resKind(t) !== kind || (t.worker && t.worker !== u.id)) continue;
      const d = dist(u.x, u.y, x, y);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    if (best && setPath(u, best.x, best.y)) { claimTile(u, best.x, best.y); return true; }
  }
  return false;
}

// Player order for one unit. Returns false when there is no path.
function orderMove(u, gx, gy) {
  if (!setPath(u, gx, gy)) return false;
  u.target = null; u.forced = true; u.flee = false;
  const end = u.path[u.path.length - 1];
  const t = tileAt(end.x, end.y);
  if (u.kind === 'worker') {
    if (isResource(t) && (!t.worker || t.worker === u.id)) claimTile(u, end.x, end.y);
    else releaseTile(u);
  }
  return true;
}

// Player order for a group: fan the units out over free tiles around the goal.
function orderGroup(list, gx, gy) {
  const taken = new Set();
  const spots = [];
  for (let r = 0; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = Math.round(gx) + dx, y = Math.round(gy) + dy;
      if (path.isWalkable(x, y)) spots.push({ x, y, d: Math.hypot(dx, dy) });
    }
  }
  spots.sort((a, b) => a.d - b.d);
  let moved = 0;
  for (const u of list) {
    const spot = spots.find((s) => !taken.has(s.x + ',' + s.y)) || { x: gx, y: gy };
    taken.add(spot.x + ',' + spot.y);
    if (orderMove(u, spot.x, spot.y)) moved++;
  }
  return moved;
}

function dealDamage(u, amount, opts = {}) {
  if (!u.alive) return;
  if (opts.arrow && u.kind === 'shield') amount = Math.max(1, Math.round(amount * 0.4));
  u.hp = Math.max(0, u.hp - amount);
  u.flash = 0.12;
  u.hurtAt = time;
  floats.push({ x: u.x, y: u.y, z: 28, text: String(amount), life: 0.7, color: u.faction === 'player' ? '#f0a0a0' : (opts.crit ? '#ffffff' : '#f0d56a') });
  if (u.hp > 0) return;

  u.alive = false;
  releaseTile(u);
  SFX.play('death');
  burst(u.x, u.y, u.faction === 'player' ? '#8e1d1d' : '#4a6a4a', 16);
  if (u.faction === 'sea') {
    stats.kills += 1;
    const b = BOUNTY[u.kind] || {};
    const k = DIFFICULTY[difficulty].bounty;
    const parts = [];
    if (b.g) { const n = Math.round(b.g * k); addRes('grain', n); parts.push(`+${n} grain`); }
    if (b.c) { addRes('copper', b.c); parts.push(`+${b.c} copper`); }
    if (b.t) { addRes('tin', b.t); parts.push(`+${b.t} tin`); }
    if (b.i) { addRes('influence', b.i); parts.push(`+${b.i} influence`); }
    if (parts.length) floats.push({ x: u.x, y: u.y, z: 40, text: parts.join('  '), life: 1.3, color: '#e8c56b' });
    if (u.kind === 'warlord') shake = 0.6;
  } else {
    stats.lost += 1;
    if (group.includes(u)) setSelection(group.filter((o) => o !== u));
  }
}

function hitCity(amount) {
  cityHp = Math.max(0, cityHp - amount);
  if (!palaceWarned && cityHp > 0 && cityHp < cityMax() * 0.4) {
    palaceWarned = true;
    toast(`Vizier: ${ADVISOR.palace[irand(0, ADVISOR.palace.length - 1)]}`, 4200);
  }
  floats.push({ x: GATE.x, y: GATE.y, z: 34, text: String(amount), life: 0.8, color: '#ff7070' });
  shake = Math.max(shake, 0.22);
  SFX.play('city');
  syncHud();
  if (cityHp <= 0 && state === 'playing') endGame(false);
}

function fireArrow(from, to, atCity) {
  projectiles.push({
    x: from.x, y: from.y, z: 18,
    tx: to.x, ty: to.y, tz: 12,
    speed: 9, dmg: atCity ? from.cityDmg : uDmg(from, to), faction: from.faction, life: 1.4, atCity: !!atCity
  });
  SFX.play('arrow');
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, z: 12 + Math.random() * 10,
      vx: rand(-1.2, 1.2), vy: rand(-1.2, 1.2), vz: rand(8, 22),
      life: rand(0.3, 0.7), max: 0.7, color, s: rand(1.5, 3.2)
    });
  }
}

/* ---------- Waves ---------- */
const ZONES = { west: 4, centre: 10, east: 16 };

function waveComp(n) {
  const k = DIFFICULTY[difficulty].count;
  const base = {
    raider: 3 + n,
    marauder: n >= 2 ? n >> 1 : 0,
    seaArcher: Math.min(4, Math.max(0, n - 2)),
    slinger: n >= 6 ? n - 5 : 0,
    reaver: n >= 3 ? 1 + ((n - 3) >> 1) : 0,
    champion: n >= 5 ? (n >= 7 ? 2 : 1) : 0,
    ram: n >= 4 ? 1 + ((n - 4) >> 1) : 0,
    warlord: n === WAVES ? 1 : 0
  };
  const out = {};
  for (const kind in base) {
    if (!base[kind]) continue;
    out[kind] = kind === 'warlord' ? 1 : Math.max(1, Math.round(base[kind] * k));
  }
  return out;
}

function scheduleWave(delay) {
  waveEta = delay;
  waveActive = false;
  const next = wave + 1;
  nextComp = waveComp(next);
  const names = Object.keys(ZONES);
  const first = names[irand(0, names.length - 1)];
  nextZones = [first];
  if (next >= 5) nextZones.push(names.filter((z) => z !== first)[irand(0, 1)]);
  const info = WAVE_INFO[next - 1];
  const counsel = ADVISOR.wave[next - 1];
  palaceWarned = false;
  showBanner(`Wave ${next} of ${WAVES}`, info.title, `${info.warn} They land ${nextZones.join(' and ')}.`, 5.5,
    counsel[irand(0, counsel.length - 1)]);
  refreshWaveStrip();
}

function beachTile(x) {
  for (let y = 2; y <= 5; y++) if (path.isWalkable(x, y)) return { x, y };
  return { x, y: 4 };
}

function launchWave(early) {
  if (early) {
    const bonus = Math.ceil(waveEta) * 3;
    addRes('grain', bonus);
    if (waveEta > 8) addRes('influence', 1);
    toast(`Bold. +${bonus} grain${waveEta > 8 ? ' and +1 influence' : ''}.`);
  }
  wave += 1;
  waveActive = true;
  waveEta = 0;
  SFX.play(wave === WAVES ? 'boss' : 'horn');

  // Light troops land first, heavy ones last
  const orderOf = ['reaver', 'raider', 'marauder', 'seaArcher', 'slinger', 'champion', 'ram', 'warlord'];
  const list = [];
  for (const kind of orderOf) for (let i = 0; i < (nextComp[kind] || 0); i++) list.push(kind);
  spawnQueue = list.map((kind, i) => {
    const zone = nextZones[i % nextZones.length];
    const p = beachTile(clamp(ZONES[zone] + irand(-2, 2), 1, COLS - 2));
    return { t: i * 0.55, kind, x: p.x, y: p.y };
  });
  refreshWaveStrip();
}

function updateSpawns(dt) {
  if (!spawnQueue.length) return;
  for (const s of spawnQueue) s.t -= dt;
  while (spawnQueue.length && spawnQueue[0].t <= 0) {
    const s = spawnQueue.shift();
    const u = spawn(s.kind, s.x + rand(-0.3, 0.3), s.y + rand(-0.3, 0.3), 'sea');
    if (s.kind === 'warlord') showBanner('He has landed', ENEMY_LABELS.warlord, 'Break him and the Sea Peoples break with him.', 4);
    burst(u.x, u.y, '#9ad0c8', 6);
  }
}

function checkWaveClear() {
  if (!waveActive || spawnQueue.length) return;
  if (units.some((u) => u.alive && u.faction === 'sea')) return;
  waveActive = false;
  if (wave >= WAVES) { endGame(true); return; }
  const grain = 20 + wave * 5;
  addRes('grain', grain);
  addRes('influence', 1);
  SFX.play('clear');
  toast(`Wave broken. +${grain} grain, +1 influence.`);
  scheduleWave(22);
}

/* ---------- Simulation ---------- */
function moveAlong(u, dt) {
  if (!u.path) return;
  if (u.pi >= u.path.length) { u.path = null; u.forced = false; return; }
  const step = u.path[u.pi];
  const dx = step.x - u.x, dy = step.y - u.y;
  const d = Math.hypot(dx, dy);
  const stepLen = u.spd * (u.kind === 'chariot' ? mod.chariotSpd : 1) * dt * 0.85;
  if (d < 0.06 || d <= stepLen) {
    u.x = step.x; u.y = step.y; u.pi++;
    u.charge += d;
    if (u.pi >= u.path.length) { u.path = null; u.forced = false; }
  } else {
    u.x += (dx / d) * stepLen;
    u.y += (dy / d) * stepLen;
    u.charge += stepLen;
    u.facing = Math.atan2(dy, dx);
  }
}

function updateWorker(u, dt) {
  if (u.sheltered) {
    if (nearestThreat(u, 6)) { u.fleeCalm = 0; return; }
    u.fleeCalm += dt;
    if (u.fleeCalm < 2.5) return;
    u.sheltered = false; u.flee = false;
    if (u.gather) setPath(u, u.gather.x, u.gather.y); else assignGather(u);
    return;
  }
  if (!u.forced && !u.flee && nearestThreat(u, 3.2)) {
    u.flee = true; u.fleeCalm = 0;
    setPath(u, 10 + (u.id % 2), 13);
  }
  if (u.flee) {
    if (!u.path) {
      if (dist(u.x, u.y, GATE.x, GATE.y) < 1.2) u.sheltered = true;
      else if (!setPath(u, 10 + (u.id % 2), 13)) u.flee = false;
    }
    return;
  }
  if (!u.gather || u.path) return;
  const t = tileAt(u.gather.x, u.gather.y);
  if (!isResource(t)) { releaseTile(u); return; }
  if (Math.round(u.x) !== u.gather.x || Math.round(u.y) !== u.gather.y) { setPath(u, u.gather.x, u.gather.y); return; }
  u._gacc = (u._gacc || 0) + dt;
  if (u._gacc < 2) return;
  u._gacc = 0;
  const k = resKind(t);
  const n = Math.round(k === 'grain' ? 4 * mod.grain : 3 * mod.metal);
  addRes(k, n);
  floats.push({ x: u.x, y: u.y, z: 24, text: `+${n} ${k}`, life: 0.9, color: '#e8c56b' });
  if (isSeen(u)) SFX.play('gather');
}
function nearestThreat(u, r) {
  for (const o of units) {
    if (o.alive && o.faction === 'sea' && dist(u.x, u.y, o.x, o.y) < r) return o;
  }
  return null;
}

function strike(u) {
  const tgt = u.target;
  u.cooldown = u.cd;
  if (u.ranged) { fireArrow(u, tgt); u.charge = 0; return; }
  let dmg = uDmg(u, tgt), crit = false;
  if (u.kind === 'chariot' && u.charge >= mod.chargeDist) {
    dmg *= 2; crit = true;
    floats.push({ x: u.x, y: u.y, z: 44, text: 'Charge!', life: 0.9, color: '#ffffff' });
  }
  u.charge = 0;
  dealDamage(tgt, dmg, { crit });
  burst((u.x + tgt.x) / 2, (u.y + tgt.y) / 2, '#c4392a', 6);
  if (isSeen(tgt)) SFX.play('hit');
}

function updateUnits(dt) {
  for (const u of units) {
    if (!u.alive) continue;
    u.bob += dt * 6;
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.flash = Math.max(0, u.flash - dt);
    u.repath -= dt;

    if (u.kind === 'worker') { updateWorker(u, dt); moveAlong(u, dt); continue; }

    if (u.target && (!u.target.alive || u.target.sheltered)) u.target = null;

    // Troops resting under the walls recover
    if (u.faction === 'player' && u.hp < u.maxHp && time - u.hurtAt > 4 && dist(u.x, u.y, GATE.x, GATE.y) < 2.6) {
      u.hp = Math.min(u.maxHp, u.hp + 5 * dt);
    }

    if (!u.target && !u.forced && u.kind !== 'ram') {
      if (u.kind === 'reaver') u.target = nearestEnemy(u, 9, 'worker') || nearestEnemy(u, 5);
      else if (u.stance === 'aggressive') u.target = nearestEnemy(u, u.faction === 'sea' ? 9 : 7.5);
      else u.target = nearestEnemy(u, uRange(u) + 0.15);
    }

    // With nobody to fight, the Sea Peoples assault the gate
    if (u.faction === 'sea' && !u.target) {
      const d = dist(u.x, u.y, GATE.x, GATE.y);
      const reach = u.ranged ? u.range : 1.9;
      if (d <= reach) {
        u.path = null;
        u.facing = Math.atan2(GATE.y - u.y, GATE.x - u.x);
        if (u.cooldown <= 0) {
          u.cooldown = u.cd;
          if (u.ranged) fireArrow(u, GATE, true);
          else { hitCity(u.cityDmg); burst(GATE.x, GATE.y - 0.4, '#c4a070', 5); }
        }
      } else if (!u.path) {
        setPath(u, 9 + (u.id % 4), 12);
      }
    }

    if (u.target) {
      const d = dist(u.x, u.y, u.target.x, u.target.y);
      u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
      if (d <= uRange(u)) {
        u.path = null; u.forced = false;
        if (u.cooldown <= 0) strike(u);
      } else if (u.faction === 'player' && u.stance === 'hold' && !u.forced) {
        u.target = null;
      } else if (!u.path || u.repath <= 0) {
        u.repath = 0.5;
        if (!setPath(u, u.target.x, u.target.y)) u.target = null;
      }
    }

    moveAlong(u, dt);
  }

  // Keep idle units from standing inside each other
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (!a.alive || a.path || a.sheltered) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (!b.alive || b.path || b.sheltered || a.faction !== b.faction) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 0.55) continue;
      const ang = d > 0.001 ? Math.atan2(dy, dx) : (a.id * 2.4);
      const push = (0.55 - d) * 0.5 * Math.min(1, dt * 6);
      const ax = a.x - Math.cos(ang) * push, ay = a.y - Math.sin(ang) * push;
      const bx = b.x + Math.cos(ang) * push, by = b.y + Math.sin(ang) * push;
      if (a.kind !== 'worker' && path.isWalkable(Math.round(ax), Math.round(ay))) { a.x = ax; a.y = ay; }
      if (b.kind !== 'worker' && path.isWalkable(Math.round(bx), Math.round(by))) { b.x = bx; b.y = by; }
    }
  }

  units = units.filter((u) => u.alive || (u._dead = (u._dead || 0) + dt) < 0.4);
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    const dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z;
    const d = Math.hypot(dx, dy) + 0.001;
    const step = p.speed * dt;
    if (d <= step) {
      p.life = 0;
      if (p.atCity) hitCity(p.dmg);
      else {
        let best = null, bestD = 0.8;
        for (const u of units) {
          if (!u.alive || u.faction === p.faction || u.sheltered) continue;
          const dd = dist(p.tx, p.ty, u.x, u.y);
          if (dd < bestD) { bestD = dd; best = u; }
        }
        if (best) dealDamage(best, p.dmg, { arrow: true });
      }
      burst(p.tx, p.ty, '#e8c56b', 4);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      p.z += (dz / d) * step + Math.sin(d * 0.8) * 2 * dt;
    }
    p.life -= dt;
  }
  projectiles = projectiles.filter((p) => p.life > 0);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vz -= 40 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const f of floats) { f.life -= dt; f.z += 18 * dt; }
  floats = floats.filter((f) => f.life > 0);
  for (const m of markers) m.life -= dt;
  markers = markers.filter((m) => m.life > 0);
}

function updateTowers(dt) {
  if (!mod.towers) return;
  towerCd -= dt;
  if (towerCd > 0) return;
  let best = null, bestD = 5.5;
  for (const u of units) {
    if (!u.alive || u.faction !== 'sea') continue;
    const d = dist(GATE.x, GATE.y, u.x, u.y);
    if (d < bestD) { bestD = d; best = u; }
  }
  if (!best) return;
  towerCd = 1.1;
  projectiles.push({ x: GATE.x, y: GATE.y, z: 34, tx: best.x, ty: best.y, tz: 12, speed: 10, dmg: 9, faction: 'player', life: 1.4, atCity: false });
  SFX.play('arrow');
}

function tickEconomy(dt) {
  influenceAcc += dt * mod.infRate;
  if (influenceAcc >= 10) {
    influenceAcc -= 10;
    addRes('influence', 1);
  }
  // Grain upkeep: 1 per 4 mouths every 10s; starving troops weaken
  upkeepAcc += dt;
  if (upkeepAcc >= 10) {
    upkeepAcc = 0;
    const cost = Math.floor(popUsed() / 4);
    if (!cost) return;
    if (res.grain >= cost) { res.grain -= cost; syncHud(); return; }
    res.grain = 0;
    syncHud();
    toast('The granaries are empty. Your troops go hungry.');
    for (const u of units) {
      if (u.alive && u.faction === 'player' && u.kind !== 'worker') { u.hp = Math.max(1, u.hp - 6); u.flash = 0.12; }
    }
  }
}

function update(dt) {
  if (state !== 'playing') {
    waterPhase += dt * 1.2;
    return;
  }
  time += dt;
  stats.time += dt;
  waterPhase += dt * 1.6;
  shake = Math.max(0, shake - dt);
  if (waveEta > 0) {
    waveEta -= dt;
    if (waveEta <= 0) launchWave(false);
  }
  updateSpawns(dt);
  updateUnits(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  updateTowers(dt);
  tickEconomy(dt);
  refreshVision();
  checkWaveClear();
}
