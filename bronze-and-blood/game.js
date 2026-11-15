'use strict';

const TILE_W = 72, TILE_H = 36;
const COLS = 20, ROWS = 22;
const WAVES = 8;
const CITY_MAX = 420;

const COSTS = {
  worker:    { g: 40,  c: 0,  t: 0, label: 'Worker' },
  spearman:  { g: 80,  c: 0,  t: 0, label: 'Spearman' },
  shield:    { g: 100, c: 15, t: 0, label: 'Shield' },
  archer:    { g: 90,  c: 0,  t: 0, label: 'Archer' },
  chariot:   { g: 150, c: 40, t: 20, label: 'Chariot' },
  bronze:    { g: 0,   c: 30, t: 30, label: 'Bronze' }
};

const STATS = {
  worker:   { hp: 60,  spd: 3.2, dmg: 4,  range: 1.15, cd: 1.1, vis: 4 },
  spearman: { hp: 100, spd: 3.0, dmg: 11, range: 1.25, cd: 0.95, vis: 5 },
  shield:   { hp: 165, spd: 2.35,dmg: 8,  range: 1.2,  cd: 1.05, vis: 5 },
  archer:   { hp: 70,  spd: 3.05,dmg: 9,  range: 4.6,  cd: 1.05, vis: 6 },
  chariot:  { hp: 125, spd: 5.1, dmg: 16, range: 1.4,  cd: 0.8,  vis: 6 },
  raider:   { hp: 80,  spd: 2.75,dmg: 8,  range: 1.2,  cd: 1.0,  vis: 5 },
  seaArcher:{ hp: 60,  spd: 2.65,dmg: 7,  range: 4.2,  cd: 1.15, vis: 6 },
  champion: { hp: 190, spd: 2.45,dmg: 15, range: 1.3,  cd: 0.95, vis: 5 }
};

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let W = 0, H = 0, dpr = 1;
let state = 'menu';
let last = 0, time = 0;
let tiles, path, units, projectiles, particles, floats;
let cityTiles, cityHp, palace;
let res, wave, waveEta, waveActive, influenceAcc, upkeepAcc;
let selected = null, hover = null;
let cam, pointers, lastPinch, lastTap;
let terrainCache, terrainDirty, waterPhase = 0;
let toastTimer = 0;

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
  const p = invIso((sx - cam.x) / cam.z, (sy - cam.y) / cam.z);
  return p;
}
function inBounds(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
function tileAt(x, y) { return inBounds(x, y) ? tiles[y | 0][x | 0] : null; }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function irand(a, b) { return (a + Math.random() * (b - a + 1)) | 0; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }

/* ---------- A* (four-directional, matches the C# Pathfinding) ---------- */
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
    const heur = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
    const push = (x, y, g, f) => {
      open.push({ x, y, g, f });
      // simple insertion by f
      for (let i = open.length - 1; i > 0; i--) {
        if (open[i].f < open[i - 1].f) { const t = open[i]; open[i] = open[i - 1]; open[i - 1] = t; }
        else break;
      }
    };
    gScore.set(key(sx, sy), 0);
    push(sx, sy, 0, heur(sx, sy));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (open.length) {
      const cur = open.shift();
      const ck = key(cur.x, cur.y);
      if (closed.has(ck)) continue;
      if (cur.x === gx && cur.y === gy) {
        const path = [{ x: cur.x, y: cur.y }];
        let k = ck;
        while (came.has(k)) {
          const p = came.get(k);
          path.push({ x: p.x, y: p.y });
          k = key(p.x, p.y);
        }
        path.reverse();
        return path;
      }
      closed.add(ck);
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.isWalkable(nx, ny)) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const g = cur.g + 1;
        if (gScore.has(nk) && g >= gScore.get(nk)) continue;
        gScore.set(nk, g);
        came.set(nk, { x: cur.x, y: cur.y });
        push(nx, ny, g, g + heur(nx, ny));
      }
    }
    return null;
  }
}

/* ---------- Resources (mirrors ResourceManager) ---------- */
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
  syncHud();
}

function syncHud() {
  const set = (id, v) => { const el = $(id).querySelector('b'); if (el) el.textContent = String(v | 0); };
  set('res-grain', res.grain);
  set('res-copper', res.copper);
  set('res-tin', res.tin);
  set('res-inf', res.influence);
  $('wave-num').textContent = `Wave ${Math.min(wave, WAVES)} / ${WAVES}`;
  const fill = $('cityfill');
  fill.style.transform = `scaleX(${clamp(cityHp / CITY_MAX, 0, 1)})`;
  refreshTrain();
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
  palace = { x: 10, y: 15, hp: CITY_MAX };

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
      tiles[y][x] = { type, h, vis: 0, explored: false };
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

  // Starting vision around the city
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

function isResource(t) { return t && (t.type === 'field' || t.type === 'copper' || t.type === 'tin'); }
function resKind(t) { return t.type === 'field' ? 'grain' : t.type; }

/* ---------- Units ---------- */
let uid = 1;
function spawn(kind, x, y, faction) {
  const st = STATS[kind];
  const u = {
    id: uid++, kind, faction, x, y, tx: x, ty: y,
    hp: st.hp, maxHp: st.hp, dmg: st.dmg, range: st.range, spd: st.spd, cd: st.cd, vis: st.vis,
    cooldown: 0, stance: 'aggressive', isBronze: false, alive: true,
    path: null, pi: 0, target: null, gather: null, bob: Math.random() * Math.PI * 2,
    facing: faction === 'sea' ? 1 : -0.2
  };
  units.push(u);
  return u;
}

function upgradeBronze(u) {
  if (!u || u.isBronze || u.faction !== 'player') return false;
  const c = COSTS.bronze;
  if (!spend(c.g, c.c, c.t)) { toast('Need Copper and Tin for Bronze.'); return false; }
  u.isBronze = true;
  u.maxHp = Math.round(u.maxHp * 1.5);
  u.dmg = Math.round(u.dmg * 1.25);
  u.hp = Math.min(u.hp + (u.maxHp / 3 | 0), u.maxHp);
  burst(u.x, u.y, '#e8c56b', 14);
  toast(`${labelOf(u.kind)} forged in bronze.`);
  return true;
}

function labelOf(k) {
  return ({ worker: 'Worker', spearman: 'Spearman', shield: 'Shield-bearer', archer: 'Archer', chariot: 'Chariot',
    raider: 'Sea raider', seaArcher: 'Sea archer', champion: 'Champion' })[k] || k;
}

function nearestEnemy(u, maxR) {
  let best = null, bestD = maxR;
  for (const o of units) {
    if (o === u || !o.alive || o.faction === u.faction) continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function orderMove(u, gx, gy) {
  const sx = Math.round(u.x), sy = Math.round(u.y);
  let tx = clamp(Math.round(gx), 0, COLS - 1);
  let ty = clamp(Math.round(gy), 0, ROWS - 1);
  if (!path.isWalkable(tx, ty)) {
    // nearest walkable
    let found = false;
    for (let r = 1; r <= 3 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r; dx++) {
        if (path.isWalkable(tx + dx, ty + dy)) { tx += dx; ty += dy; found = true; break; }
      }
    }
    if (!found) { toast('No path to that ground.'); return; }
  }
  const p = path.findPath(sx, sy, tx, ty);
  if (!p) { toast('No path.'); return; }
  u.path = p; u.pi = 0; u.target = null;
  if (u.kind === 'worker' && isResource(tileAt(tx, ty))) u.gather = { x: tx, y: ty };
  else u.gather = null;
}

function dealDamage(u, amount) {
  if (!u.alive) return;
  u.hp = Math.max(0, u.hp - amount);
  floats.push({ x: u.x, y: u.y, z: 28, text: String(amount), life: 0.7, color: u.faction === 'player' ? '#f0a0a0' : '#f0d56a' });
  if (u.hp <= 0) {
    u.alive = false;
    burst(u.x, u.y, u.faction === 'player' ? '#8e1d1d' : '#4a6a4a', 16);
    if (selected && selected.id === u.id) { selected = null; hideWheel(); }
  }
}

function hitCity(amount) {
  cityHp = Math.max(0, cityHp - amount);
  floats.push({ x: palace.x, y: palace.y, z: 40, text: String(amount), life: 0.8, color: '#ff7070' });
  syncHud();
  if (cityHp <= 0 && state === 'playing') endGame(false);
}

function fireArrow(from, to) {
  projectiles.push({
    x: from.x, y: from.y, z: 18,
    tx: to.x, ty: to.y, tz: 12,
    speed: 9, dmg: from.dmg, fromId: from.id, faction: from.faction, life: 1.2
  });
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
function scheduleWave(delay) {
  waveEta = delay;
  waveActive = false;
  const next = wave + 1;
  $('wave-label').textContent = next > WAVES ? 'Last stand held' : `Wave ${next} marches in`;
}

function launchWave() {
  wave += 1;
  waveActive = true;
  waveEta = 0;
  $('wave-label').textContent = 'The Sea Peoples attack';
  $('wave-num').textContent = `Wave ${wave} / ${WAVES}`;
  toast(`Wave ${wave} of ${WAVES}`);

  const beach = [];
  for (let x = 1; x < COLS - 1; x++) {
    for (let y = 2; y <= 5; y++) if (path.isWalkable(x, y)) { beach.push({ x, y }); break; }
  }
  const pick = () => beach[irand(0, beach.length - 1)] || { x: 10, y: 3 };

  const nRaiders = 2 + wave;
  const nArchers = Math.max(0, wave - 2);
  const nChamp = wave >= 5 ? (wave >= 7 ? 2 : 1) : 0;
  const spawnAt = (kind) => {
    const p = pick();
    const u = spawn(kind, p.x + rand(-0.3, 0.3), p.y + rand(-0.3, 0.3), 'sea');
    u.stance = 'aggressive';
    return u;
  };
  for (let i = 0; i < nRaiders; i++) spawnAt('raider');
  for (let i = 0; i < nArchers; i++) spawnAt('seaArcher');
  for (let i = 0; i < nChamp; i++) spawnAt('champion');
}

function checkWaveClear() {
  if (!waveActive) return;
  const alive = units.some((u) => u.alive && u.faction === 'sea');
  if (alive) return;
  waveActive = false;
  if (wave >= WAVES) { endGame(true); return; }
  toast('Wave broken. The sea falls quiet…');
  scheduleWave(14);
}

/* ---------- Simulation ---------- */
function updateUnits(dt) {
  for (const u of units) {
    if (!u.alive) continue;
    u.bob += dt * 6;
    u.cooldown = Math.max(0, u.cooldown - dt);

    if (u.target && (!u.target.alive)) u.target = null;

    if (!u.target && u.stance === 'aggressive') {
      u.target = nearestEnemy(u, u.faction === 'sea' ? 10 : 8);
    }

    // Sea peoples press the palace if no one is close
    if (u.faction === 'sea' && !u.target) {
      const d = dist(u.x, u.y, palace.x, palace.y);
      if (d <= 1.6) {
        if (u.cooldown <= 0) {
          u.cooldown = u.cd;
          hitCity(u.dmg);
        }
        continue;
      }
      if (!u.path) orderMove(u, palace.x + (u.id % 3) - 1, palace.y - 2);
    }

    if (u.target) {
      const d = dist(u.x, u.y, u.target.x, u.target.y);
      u.facing = Math.atan2(u.target.y - u.y, u.target.x - u.x);
      if (d <= u.range) {
        u.path = null;
        if (u.cooldown <= 0) {
          u.cooldown = u.cd;
          if (u.kind === 'archer' || u.kind === 'seaArcher') fireArrow(u, u.target);
          else {
            dealDamage(u.target, u.dmg);
            burst((u.x + u.target.x) / 2, (u.y + u.target.y) / 2, '#c4392a', 6);
          }
        }
      } else if (!u.path) {
        orderMove(u, u.target.x, u.target.y);
      }
    }

    if (u.path) {
      if (u.pi >= u.path.length) { u.path = null; continue; }
      const step = u.path[u.pi];
      const dx = step.x - u.x, dy = step.y - u.y;
      const d = Math.hypot(dx, dy);
      const stepLen = u.spd * dt * 0.85;
      if (d < 0.06 || d <= stepLen) {
        u.x = step.x; u.y = step.y; u.pi++;
        if (u.pi >= u.path.length) {
          u.path = null;
          if (u.gather && Math.round(u.x) === u.gather.x && Math.round(u.y) === u.gather.y) {
            /* stay and gather */
          }
        }
      } else {
        u.x += (dx / d) * stepLen;
        u.y += (dy / d) * stepLen;
        u.facing = Math.atan2(dy, dx);
      }
    }

    // Worker gathering
    if (u.kind === 'worker' && u.gather && !u.path && !u.target) {
      const t = tileAt(u.gather.x, u.gather.y);
      if (isResource(t)) {
        u._gacc = (u._gacc || 0) + dt;
        if (u._gacc >= 1.6) {
          u._gacc = 0;
          const k = resKind(t);
          addRes(k, k === 'grain' ? 8 : 5);
          floats.push({ x: u.x, y: u.y, z: 24, text: k === 'grain' ? '+8 grain' : `+5 ${k}`, life: 0.9, color: '#e8c56b' });
        }
      }
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
      // hit nearest enemy of opposing faction near target
      let best = null, bestD = 0.7;
      for (const u of units) {
        if (!u.alive || u.faction === p.faction) continue;
        const dd = dist(p.tx, p.ty, u.x, u.y);
        if (dd < bestD) { bestD = dd; best = u; }
      }
      if (best) dealDamage(best, p.dmg);
      else if (dist(p.tx, p.ty, palace.x, palace.y) < 1.4 && p.faction === 'sea') hitCity(p.dmg);
      burst(p.tx, p.ty, '#e8c56b', 5);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      p.z += (dz / d) * step + Math.sin((d) * 0.8) * 2 * dt;
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
}

function tickEconomy(dt) {
  // Palace generates a trickle of Influence
  influenceAcc += dt;
  if (influenceAcc >= 8) {
    influenceAcc = 0;
    addRes('influence', 1);
  }
  // Grain upkeep: 1 per 5 living player units every 10s
  upkeepAcc += dt;
  if (upkeepAcc >= 10) {
    upkeepAcc = 0;
    const pop = units.filter((u) => u.alive && u.faction === 'player').length;
    const cost = Math.max(0, Math.floor(pop / 5));
    if (cost) {
      res.grain = Math.max(0, res.grain - cost);
      syncHud();
      if (res.grain <= 0) toast('The granaries are empty.');
    }
  }
}

function update(dt) {
  if (state !== 'playing') {
    waterPhase += dt * 1.2;
    return;
  }
  time += dt;
  waterPhase += dt * 1.6;
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').hidden = true;
  }
  if (waveEta > 0) {
    waveEta -= dt;
    const next = wave + 1;
    $('wave-label').textContent = `Wave ${next} in ${Math.ceil(waveEta)}s`;
    if (waveEta <= 0) launchWave();
  }
  updateUnits(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  tickEconomy(dt);
  refreshVision();
  checkWaveClear();
}

/* ---------- Rendering ---------- */
const PAL = {
  water:  ['#16384a', '#1d4e63', '#2a6a80'],
  shoal:  ['#3d6a66', '#5c8a74', '#c2b48a'],
  sand:   ['#c9a36a', '#e0c08a', '#a98452'],
  dirt:   ['#8a6a42', '#b08958', '#6a4e2c'],
  grass:  ['#4a6a32', '#6a8a44', '#2f4a22'],
  field:  ['#c4a24a', '#e0c868', '#8a7a30'],
  copper: ['#8a4a28', '#c46a38', '#5a2e18'],
  tin:    ['#6a6a70', '#9a9aa0', '#3e3e44'],
  grove:  ['#3d5a28', '#5a7a38', '#2a3e1a'],
  road:   ['#9a7a52', '#c4a074', '#6e5434'],
  court:  ['#b08958', '#d4b07a', '#7a5a34'],
  wall:   ['#6a4e36', '#8a6a4a', '#3e2a1c'],
  gate:   ['#8a5a2a', '#c48a40', '#4a2e14'],
  palace: ['#7a4e28', '#c4a060', '#4a2c16']
};

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  terrainDirty = true;
}

function focusCity() {
  const p = iso(palace.x, palace.y);
  cam.z = cam.tz = (W < 500 ? 1.18 : (H < 500 ? 1.05 : 1.22));
  cam.x = cam.tx = W / 2 - p.x * cam.z;
  cam.y = cam.ty = H * (W < 500 ? 0.50 : 0.52) - p.y * cam.z;
}

function drawDiamond(c, x, y, w, h, fill, stroke) {
  c.beginPath();
  c.moveTo(x, y - h / 2);
  c.lineTo(x + w / 2, y);
  c.lineTo(x, y + h / 2);
  c.lineTo(x - w / 2, y);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.7; c.stroke(); }
}

function tileColors(t, x, y) {
  const pal = PAL[t.type] || PAL.dirt;
  const n = noise(x * 0.7, y * 0.7);
  const shade = 0.85 + n * 0.2;
  const col = (hex, s) => {
    const v = parseInt(hex.slice(1), 16);
    let r = ((v >> 16) & 255) * s, g = ((v >> 8) & 255) * s, b = (v & 255) * s;
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  return { top: col(pal[1], shade), left: pal[2], right: pal[0], edge: 'rgba(0,0,0,.18)' };
}

function drawTileMesh(c, x, y, t, tw, th) {
  const p = iso(x, y);
  const h = t.h || 0;
  const cols = tileColors(t, x, y);
  if (h > 0) {
    // left face
    c.beginPath();
    c.moveTo(p.x - tw / 2, p.y);
    c.lineTo(p.x, p.y + th / 2);
    c.lineTo(p.x, p.y + th / 2 - h);
    c.lineTo(p.x - tw / 2, p.y - h);
    c.closePath();
    c.fillStyle = cols.left;
    c.fill();
    // right face
    c.beginPath();
    c.moveTo(p.x + tw / 2, p.y);
    c.lineTo(p.x, p.y + th / 2);
    c.lineTo(p.x, p.y + th / 2 - h);
    c.lineTo(p.x + tw / 2, p.y - h);
    c.closePath();
    c.fillStyle = cols.right;
    c.fill();
  }
  let top = cols.top;
  if (t.type === 'water') {
    const w = 0.5 + 0.5 * Math.sin(waterPhase + x * 0.7 + y * 0.5);
    top = w > 0.55 ? PAL.water[2] : PAL.water[1];
  }
  drawDiamond(c, p.x, p.y - h, tw - 0.4, th - 0.2, top, 'rgba(20,10,0,.2)');

  // surface detail
  if (t.type === 'field') {
    c.strokeStyle = 'rgba(80,60,10,.28)';
    c.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(p.x - 16 + i * 3, p.y - h - 2);
      c.lineTo(p.x + 16 + i * 3, p.y - h + 4);
      c.stroke();
    }
  }
  if (t.type === 'road') {
    drawDiamond(c, p.x, p.y - h, tw * 0.45, th * 0.45, 'rgba(160,120,70,.45)');
  }
  if (t.type === 'copper' || t.type === 'tin') {
    c.fillStyle = t.type === 'copper' ? '#d4783a' : '#c0c4cc';
    for (let i = 0; i < 3; i++) {
      const ox = (hash(x + i, y) - 0.5) * 16;
      const oy = (hash(y, x + i) - 0.5) * 8;
      c.beginPath();
      c.ellipse(p.x + ox, p.y - h - 4 + oy, 5, 3, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (t.type === 'grove') {
    drawTree(c, p.x, p.y - h, 1);
  }
}

function drawTree(c, x, y, s) {
  c.fillStyle = '#3a2414';
  c.fillRect(x - 2 * s, y - 10 * s, 4 * s, 10 * s);
  c.fillStyle = '#2f4a1c';
  c.beginPath(); c.ellipse(x, y - 16 * s, 12 * s, 9 * s, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#4a6a2c';
  c.beginPath(); c.ellipse(x - 3 * s, y - 18 * s, 8 * s, 6 * s, 0, 0, Math.PI * 2); c.fill();
}

function prism(c, x, y, w, d, h, left, right, top, stroke) {
  // isometric box centered on iso point (x,y) ground
  const hw = w / 2, hd = d / 2;
  const pN = { x: x, y: y - hd };
  const pE = { x: x + hw, y: y };
  const pS = { x: x, y: y + hd };
  const pW = { x: x - hw, y: y };
  // left (SW) face
  c.beginPath();
  c.moveTo(pW.x, pW.y); c.lineTo(pS.x, pS.y); c.lineTo(pS.x, pS.y - h); c.lineTo(pW.x, pW.y - h);
  c.closePath(); c.fillStyle = left; c.fill();
  // right (SE) face
  c.beginPath();
  c.moveTo(pE.x, pE.y); c.lineTo(pS.x, pS.y); c.lineTo(pS.x, pS.y - h); c.lineTo(pE.x, pE.y - h);
  c.closePath(); c.fillStyle = right; c.fill();
  // top
  c.beginPath();
  c.moveTo(pN.x, pN.y - h); c.lineTo(pE.x, pE.y - h); c.lineTo(pS.x, pS.y - h); c.lineTo(pW.x, pW.y - h);
  c.closePath(); c.fillStyle = top; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.8; c.stroke(); }
}

function drawPalace(c, x, y) {
  const p = iso(x, y);
  const gx = p.x, gy = p.y;
  // raised courtyard podium under the keep
  prism(c, gx, gy + 4, 150, 78, 8, '#6a4a2c', '#4a3018', '#c4a06a', '#3e2a16');
  // main hall
  prism(c, gx, gy - 2, 96, 52, 26, '#8a5a32', '#5a381c', '#d4b07a', '#3e2a16');
  // terracotta roof (peaked diamond sitting above hall)
  const rh = 26 + 8;
  const by = gy - 2 - rh;
  c.beginPath();
  c.moveTo(gx, by - 28);
  c.lineTo(gx + 58, by + 10);
  c.lineTo(gx, by + 22);
  c.lineTo(gx - 58, by + 10);
  c.closePath();
  c.fillStyle = '#c44a28'; c.fill();
  c.strokeStyle = '#6a2414'; c.lineWidth = 1.2; c.stroke();
  // roof ridge highlight
  c.strokeStyle = '#e87848'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(gx, by - 28); c.lineTo(gx, by + 22); c.stroke();
  // upper watch room
  prism(c, gx, gy - 18, 42, 24, 16, '#9a6a3a', '#6a4422', '#e0c080', '#3e2a16');
  c.beginPath();
  c.moveTo(gx, gy - 18 - 16 - 16);
  c.lineTo(gx + 26, gy - 18 - 16 + 2);
  c.lineTo(gx, gy - 18 - 16 + 10);
  c.lineTo(gx - 26, gy - 18 - 16 + 2);
  c.closePath();
  c.fillStyle = '#a83820'; c.fill();
  // door
  c.fillStyle = '#1c1008';
  c.beginPath();
  c.moveTo(gx - 7, gy + 18); c.lineTo(gx + 7, gy + 18); c.lineTo(gx + 7, gy + 4);
  c.quadraticCurveTo(gx, gy - 4, gx - 7, gy + 4); c.closePath(); c.fill();
  c.strokeStyle = '#e8c56b'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(gx - 9, gy + 4); c.lineTo(gx + 9, gy + 4); c.stroke();
  // glowing windows
  c.fillStyle = '#f6d878';
  c.fillRect(gx - 28, gy - 8, 6, 7);
  c.fillRect(gx + 22, gy - 8, 6, 7);
  c.fillRect(gx - 3, gy - 28, 6, 6);
  // bronze standard
  c.strokeStyle = '#c49a42'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(gx + 18, gy - 36); c.lineTo(gx + 18, gy - 62); c.stroke();
  c.fillStyle = '#8e1d1d';
  c.beginPath(); c.moveTo(gx + 18, gy - 62); c.lineTo(gx + 34, gy - 56); c.lineTo(gx + 18, gy - 50); c.fill();
}

function drawWallSeg(c, x, y, gate) {
  const p = iso(x, y);
  const tw = TILE_W, th = TILE_H;
  const h = gate ? 14 : 28;
  const left = gate ? '#8a5a2a' : '#5c4028';
  const right = gate ? '#6a3e18' : '#3a2818';
  const top = gate ? '#d4a04a' : '#a07a52';
  // left face
  c.beginPath();
  c.moveTo(p.x - tw / 2, p.y);
  c.lineTo(p.x, p.y + th / 2);
  c.lineTo(p.x, p.y + th / 2 - h);
  c.lineTo(p.x - tw / 2, p.y - h);
  c.closePath(); c.fillStyle = left; c.fill();
  // right face
  c.beginPath();
  c.moveTo(p.x + tw / 2, p.y);
  c.lineTo(p.x, p.y + th / 2);
  c.lineTo(p.x, p.y + th / 2 - h);
  c.lineTo(p.x + tw / 2, p.y - h);
  c.closePath(); c.fillStyle = right; c.fill();
  drawDiamond(c, p.x, p.y - h, tw - 0.2, th - 0.2, top, 'rgba(20,10,0,.35)');
  if (gate) {
    // open arch
    c.fillStyle = '#120c08';
    c.beginPath();
    c.moveTo(p.x - 10, p.y + 4);
    c.lineTo(p.x + 10, p.y + 4);
    c.lineTo(p.x + 10, p.y - 10);
    c.quadraticCurveTo(p.x, p.y - 22, p.x - 10, p.y - 10);
    c.closePath(); c.fill();
    c.strokeStyle = '#e8c56b'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(p.x - 11, p.y - 10); c.quadraticCurveTo(p.x, p.y - 23, p.x + 11, p.y - 10); c.stroke();
  } else {
    // merlons
    const mer = 5;
    c.fillStyle = '#c4a070';
    c.fillRect(p.x - 16, p.y - h - mer, 7, mer + 1);
    c.fillRect(p.x - 3, p.y - h - mer, 7, mer + 1);
    c.fillRect(p.x + 9, p.y - h - mer, 7, mer + 1);
    c.fillStyle = '#3a2818';
    c.fillRect(p.x - 16, p.y - h - mer, 7, 2);
  }
}

function buildTerrain() {
  const pad = 80;
  const origin = iso(0, ROWS);
  const corner = iso(COLS, 0);
  const far = iso(COLS, ROWS);
  const near = iso(0, 0);
  const minX = origin.x - TILE_W, maxX = corner.x + TILE_W;
  const minY = near.y - 80, maxY = far.y + 80;
  const cw = Math.ceil(maxX - minX + pad * 2);
  const ch = Math.ceil(maxY - minY + pad * 2 + 40);
  const off = { x: -minX + pad, y: -minY + pad };
  const g = document.createElement('canvas');
  g.width = Math.ceil(cw * 1.25); // extra for heights
  g.height = Math.ceil(ch * 1.25);
  const c = g.getContext('2d');
  c.translate(off.x, off.y);

  // sea backdrop beyond the map
  const seaGrad = c.createLinearGradient(0, iso(0, 0).y - 200, 0, iso(0, 4).y);
  seaGrad.addColorStop(0, '#0b2430');
  seaGrad.addColorStop(1, '#16384a');
  c.fillStyle = seaGrad;
  c.fillRect(-800, -600, 2800, 1200);

  const order = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) order.push({ x, y, k: x + y });
  order.sort((a, b) => a.k - b.k);
  for (const { x, y } of order) {
    const t = tiles[y][x];
    if (t.type === 'palace' || t.type === 'wall' || t.type === 'gate') {
      drawTileMesh(c, x, y, { type: 'court', h: 4 }, TILE_W, TILE_H);
    } else {
      drawTileMesh(c, x, y, t, TILE_W, TILE_H);
    }
  }
  // structures in depth order
  for (const { x, y } of order) {
    const t = tiles[y][x];
    if (t.type === 'wall' || t.type === 'gate') drawWallSeg(c, x, y, t.type === 'gate');
  }
  drawPalace(c, palace.x, palace.y);

  terrainCache = { canvas: g, off };
  terrainDirty = false;
}

function drawTerrain(ctx) {
  if (!terrainCache || terrainDirty) buildTerrain();
  // Water shimmer: redraw water tiles live
  ctx.drawImage(terrainCache.canvas, terrainCache.off.x * -1, terrainCache.off.y * -1);
  for (let y = 0; y <= 3; y++) for (let x = 0; x < COLS; x++) {
    const t = tiles[y][x];
    if (t.type !== 'water' && t.type !== 'shoal') continue;
    const p = iso(x, y);
    const w = 0.5 + 0.5 * Math.sin(waterPhase * 1.4 + x * 0.8 + y);
    const col = t.type === 'water'
      ? (w > 0.6 ? 'rgba(120,200,210,.16)' : 'rgba(20,60,80,.12)')
      : 'rgba(200,190,150,.08)';
    drawDiamond(ctx, p.x, p.y - (t.h || 0), TILE_W - 0.4, TILE_H - 0.2, col);
  }
}

function drawFog(ctx) {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = tiles[y][x];
    let a = 0;
    if (!t.explored) a = 0.72;
    else a = 0.55 * (1 - clamp(t.vis, 0, 1));
    if (a < 0.03) continue;
    const p = iso(x, y);
    drawDiamond(ctx, p.x, p.y - (t.h || 0) - 1, TILE_W + 2.4, TILE_H + 1.4, `rgba(10,7,6,${a})`);
  }
}

function teamColor(u) {
  if (u.faction === 'sea') {
    if (u.kind === 'champion') return { cloth: '#1e3a3a', armor: '#2a4a3a', accent: '#7ab89a', skin: '#c4a07a' };
    if (u.kind === 'seaArcher') return { cloth: '#234040', armor: '#3a5a4a', accent: '#9ad0b0', skin: '#c4a07a' };
    return { cloth: '#1c3338', armor: '#2a4440', accent: '#6aa090', skin: '#c4a07a' };
  }
  const bronze = u.isBronze;
  const armor = bronze ? '#c49a42' : '#8a6a48';
  if (u.kind === 'worker') return { cloth: '#6a5438', armor: '#8a6a48', accent: '#e8c56b', skin: '#e0b894' };
  if (u.kind === 'shield') return { cloth: '#5a2a1a', armor, accent: '#e8c56b', skin: '#e0b894' };
  if (u.kind === 'archer') return { cloth: '#3a4a28', armor, accent: '#c4d480', skin: '#e0b894' };
  if (u.kind === 'chariot') return { cloth: '#4a2a16', armor, accent: '#e8c56b', skin: '#e0b894' };
  return { cloth: '#5a3020', armor, accent: '#e8c56b', skin: '#e0b894' };
}

function drawUnit(c, u) {
  const t = tileAt(Math.round(u.x), Math.round(u.y));
  const h = t ? t.h : 0;
  const p = iso(u.x, u.y);
  const x = p.x, y = p.y - h - 6 + Math.sin(u.bob) * (u.path ? 1.2 : 0.6);
  const col = teamColor(u);
  const s = u.kind === 'chariot' ? 1.15 : u.kind === 'champion' ? 1.2 : u.kind === 'shield' ? 1.08 : 1;

  // shadow
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(p.x, p.y - h + 6, 12 * s, 6 * s, 0, 0, Math.PI * 2); c.fill();

  if (selected && selected.id === u.id) {
    c.strokeStyle = '#e8c56b'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(p.x, p.y - h + 6, 16, 8, 0, 0, Math.PI * 2); c.stroke();
    if (u.path) {
      c.strokeStyle = 'rgba(232,197,107,.55)'; c.lineWidth = 1.4; c.setLineDash([4, 4]);
      c.beginPath();
      const a = iso(u.x, u.y);
      c.moveTo(a.x, a.y - h + 4);
      for (let i = u.pi; i < u.path.length; i++) {
        const q = iso(u.path[i].x, u.path[i].y);
        const th = (tileAt(u.path[i].x, u.path[i].y) || {}).h || 0;
        c.lineTo(q.x, q.y - th + 4);
      }
      c.stroke(); c.setLineDash([]);
    }
  }

  const flip = Math.cos(u.facing) < 0 ? -1 : 1;

  if (u.kind === 'chariot') {
    // two horses + box
    c.fillStyle = '#3a2a1a';
    c.beginPath(); c.ellipse(x - 10, y + 4, 10, 6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + 8, y + 5, 10, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6a4a28';
    c.fillRect(x - 8, y - 10, 16, 12);
    c.strokeStyle = col.armor; c.lineWidth = 2; c.strokeRect(x - 8, y - 10, 16, 12);
    // driver
    c.fillStyle = col.skin; c.beginPath(); c.arc(x, y - 16, 4.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.cloth; c.fillRect(x - 4, y - 12, 8, 8);
    // wheels
    c.strokeStyle = '#2a1a10'; c.lineWidth = 2;
    c.beginPath(); c.arc(x - 8, y + 8, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x + 8, y + 8, 5, 0, Math.PI * 2); c.stroke();
  } else {
    // legs
    c.strokeStyle = '#2a1a10'; c.lineWidth = 2.2 * s;
    c.beginPath(); c.moveTo(x - 3 * s, y + 2); c.lineTo(x - 5 * s, y + 11 * s); c.stroke();
    c.beginPath(); c.moveTo(x + 3 * s, y + 2); c.lineTo(x + 4 * s, y + 11 * s); c.stroke();
    // body
    c.fillStyle = col.cloth;
    c.beginPath();
    c.moveTo(x, y - 16 * s);
    c.lineTo(x + 7 * s * flip, y - 4 * s);
    c.lineTo(x + 5 * s, y + 4 * s);
    c.lineTo(x - 5 * s, y + 4 * s);
    c.lineTo(x - 6 * s * flip, y - 4 * s);
    c.closePath(); c.fill();
    // armor plate
    c.fillStyle = col.armor;
    c.beginPath();
    c.moveTo(x, y - 14 * s);
    c.lineTo(x + 5 * s, y - 5 * s);
    c.lineTo(x, y + 1 * s);
    c.lineTo(x - 5 * s, y - 5 * s);
    c.closePath(); c.fill();
    if (u.isBronze) {
      c.strokeStyle = '#f0e0a0'; c.lineWidth = 1;
      c.stroke();
    }
    // head
    c.fillStyle = col.skin;
    c.beginPath(); c.arc(x, y - 18 * s, 4.4 * s, 0, Math.PI * 2); c.fill();
    // helmet
    c.fillStyle = col.armor;
    c.beginPath(); c.arc(x, y - 19 * s, 4.6 * s, Math.PI, Math.PI * 2); c.fill();
    if (u.kind === 'champion' || u.kind === 'spearman' || u.kind === 'shield') {
      c.fillStyle = col.accent;
      c.fillRect(x - 1, y - 26 * s, 2, 6 * s);
    }
    // weapons / shield
    if (u.kind === 'shield' || u.kind === 'champion') {
      c.fillStyle = col.accent;
      c.beginPath(); c.ellipse(x - 9 * s * flip, y - 6 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2a1a10'; c.lineWidth = 1; c.stroke();
    }
    if (u.kind === 'spearman' || u.kind === 'raider' || u.kind === 'champion') {
      c.strokeStyle = '#d4b07a'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x + 8 * s * flip, y + 10 * s); c.lineTo(x + 10 * s * flip, y - 24 * s); c.stroke();
      c.fillStyle = '#c0c8d0';
      c.beginPath();
      c.moveTo(x + 10 * s * flip, y - 26 * s);
      c.lineTo(x + 14 * s * flip, y - 20 * s);
      c.lineTo(x + 6 * s * flip, y - 20 * s);
      c.fill();
    }
    if (u.kind === 'archer' || u.kind === 'seaArcher') {
      c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x + 8 * s * flip, y - 8 * s, 8 * s, -0.8, 0.8); c.stroke();
    }
    if (u.kind === 'worker') {
      c.strokeStyle = '#8a6a40'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x + 6 * s, y - 2); c.lineTo(x + 10 * s, y + 10); c.stroke();
    }
  }

  // health bar
  if (u.hp < u.maxHp || (selected && selected.id === u.id)) {
    const bw = 18, bh = 3;
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.fillRect(x - bw / 2, y - 30 * s, bw, bh);
    c.fillStyle = u.faction === 'player' ? (u.isBronze ? '#e8c56b' : '#6aaa4a') : '#c4392a';
    c.fillRect(x - bw / 2, y - 30 * s, bw * clamp(u.hp / u.maxHp, 0, 1), bh);
  }
}

function drawProjectile(c, p) {
  const t = tileAt(Math.round(p.x), Math.round(p.y));
  const q = iso(p.x, p.y);
  const x = q.x, y = q.y - (t ? t.h : 0) - p.z;
  c.strokeStyle = '#f0e0b0'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(x - 4, y - 2); c.lineTo(x + 4, y + 2); c.stroke();
  c.fillStyle = '#8a3a12';
  c.beginPath(); c.arc(x + 4, y + 2, 1.6, 0, Math.PI * 2); c.fill();
}

function drawWorld() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // dusk sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1814');
  g.addColorStop(0.35, '#5a2a1c');
  g.addColorStop(0.55, '#8a4a28');
  g.addColorStop(1, '#1a1410');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun
  const sun = ctx.createRadialGradient(W * 0.72, H * 0.18, 10, W * 0.72, H * 0.18, W * 0.5);
  sun.addColorStop(0, 'rgba(255,200,90,.85)');
  sun.addColorStop(0.15, 'rgba(220,80,30,.35)');
  sun.addColorStop(1, 'rgba(20,8,6,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.z, cam.z);

  drawTerrain(ctx);

  // depth-sorted movers
  const sprites = [];
  for (const u of units) sprites.push({ k: u.x + u.y, u });
  sprites.sort((a, b) => a.k - b.k);
  for (const s of sprites) drawUnit(ctx, s.u);
  for (const p of projectiles) drawProjectile(ctx, p);
  for (const p of particles) {
    const t = tileAt(Math.round(p.x), Math.round(p.y));
    const q = iso(p.x, p.y);
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(q.x, q.y - (t ? t.h : 0) - p.z, p.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const f of floats) {
    const t = tileAt(Math.round(f.x), Math.round(f.y));
    const q = iso(f.x, f.y);
    ctx.globalAlpha = clamp(f.life * 1.6, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, q.x, q.y - (t ? t.h : 0) - f.z);
    ctx.globalAlpha = 1;
  }

  if (state === 'playing' || state === 'paused') drawFog(ctx);

  // hover tile
  if (hover && state === 'playing') {
    const t = tileAt(hover.x, hover.y);
    if (t && t.explored) {
      const p = iso(hover.x, hover.y);
      drawDiamond(ctx, p.x, p.y - (t.h || 0) - 1, TILE_W, TILE_H, 'rgba(232,197,107,.18)', 'rgba(232,197,107,.8)');
    }
  }

  ctx.restore();

  // cinematic vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/* ---------- Camera / input ---------- */
function setupInput() {
  pointers = new Map();
  lastPinch = 0;
  lastTap = 0;

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
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
    hover = { x: Math.round(w.x), y: Math.round(w.y) };
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
      cam.tx = cam.x; cam.ty = cam.y;
    }
    rec.x = p.x; rec.y = p.y;
  });
  const up = (e) => {
    const rec = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
    if (!rec || state !== 'playing') return;
    const distm = Math.hypot((e.clientX && 0) + rec.x - rec.sx, rec.y - rec.sy);
    const dt = performance.now() - rec.t;
    if (distm < 8 && dt < 500) onTap(rec.sx, rec.sy);
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

  // prevent pinch-zoom on the page itself
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

function unitAtScreen(sx, sy) {
  let best = null, bestD = 28;
  for (const u of units) {
    if (!u.alive) continue;
    const t = tileAt(Math.round(u.x), Math.round(u.y));
    const p = worldToScreen(u.x, u.y, (t ? t.h : 0) + 16);
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

function onTap(sx, sy) {
  const u = unitAtScreen(sx, sy);
  if (u && u.faction === 'player') {
    selected = u;
    showWheel();
    return;
  }
  if (u && u.faction === 'sea' && selected) {
    selected.target = u;
    selected.gather = null;
    hideWheel();
    return;
  }
  const w = screenToWorld(sx, sy);
  const tx = Math.round(w.x), ty = Math.round(w.y);
  if (selected && inBounds(tx, ty)) {
    const t = tileAt(tx, ty);
    if (t && t.explored) orderMove(selected, tx, ty);
    hideWheel();
    return;
  }
  selected = null;
  hideWheel();
}

function showWheel() {
  const el = $('wheel');
  if (!selected) { el.hidden = true; return; }
  const t = tileAt(Math.round(selected.x), Math.round(selected.y));
  const p = worldToScreen(selected.x, selected.y, (t ? t.h : 0) + 36);
  el.style.left = `${p.x - 80}px`;
  el.style.top = `${p.y - 110}px`;
  const btns = [];
  btns.push(`<button type="button" data-act="stance">${selected.stance === 'aggressive' ? 'Hold' : 'Aggressive'}</button>`);
  if (!selected.isBronze) btns.push(`<button type="button" data-act="bronze">Bronze</button>`);
  if (selected.kind === 'worker') btns.push(`<button type="button" data-act="gather">Gather</button>`);
  btns.push(`<button type="button" data-act="repair">Repair</button>`);
  el.innerHTML = btns.map((b, i) => {
    const ang = -Math.PI / 2 + (i * (Math.PI * 2)) / btns.length;
    const x = 80 + Math.cos(ang) * 52 - 28;
    const y = 80 + Math.sin(ang) * 52 - 22;
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
    toast(selected.stance === 'aggressive' ? 'Aggressive stance' : 'Hold position');
    showWheel();
  } else if (act === 'bronze') {
    upgradeBronze(selected);
    showWheel();
  } else if (act === 'gather') {
    // gather nearest resource
    let best = null, bestD = 8;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!isResource(tiles[y][x])) continue;
      const d = dist(selected.x, selected.y, x, y);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    if (best) { orderMove(selected, best.x, best.y); hideWheel(); }
    else toast('No fields or mines in reach.');
  } else if (act === 'repair') {
    const c = { g: 40, c: 0, t: 0, i: 2 };
    if (cityHp >= CITY_MAX) { toast('The palace stands firm.'); return; }
    if (!spend(c.g, c.c, c.t, c.i)) { toast('Repair costs 40 Grain and 2 Influence.'); return; }
    cityHp = Math.min(CITY_MAX, cityHp + 80);
    syncHud();
    burst(palace.x, palace.y, '#e8c56b', 12);
    toast('Masons shore up the palace.');
    hideWheel();
  }
});

/* ---------- Train dock ---------- */
function refreshTrain() {
  const el = $('train');
  const kinds = ['worker', 'spearman', 'shield', 'archer', 'chariot'];
  const swatch = {
    worker: '#6a5438', spearman: '#5a3020', shield: '#8a2a1a', archer: '#3a4a28', chariot: '#c49a42'
  };
  el.innerHTML = kinds.map((k) => {
    const c = COSTS[k];
    const ok = canAfford(c.g, c.c, c.t);
    const cost = [c.g ? `${c.g}g` : '', c.c ? `${c.c}c` : '', c.t ? `${c.t}t` : ''].filter(Boolean).join(' · ');
    return `<button class="card" data-kind="${k}" ${ok ? '' : 'disabled'} type="button">
      <span class="swatch" style="background:${swatch[k]}"></span>
      <span class="nm">${c.label}</span>
      <span class="cost">${cost}</span>
    </button>`;
  }).join('');
}
$('train').addEventListener('click', (e) => {
  const btn = e.target.closest('.card');
  if (!btn || state !== 'playing') return;
  const kind = btn.dataset.kind;
  const c = COSTS[kind];
  if (!spend(c.g, c.c, c.t)) { toast('Not enough resources.'); return; }
  // spawn just north of the gate, avoiding occupied tiles
  const occupied = new Set(units.filter((u) => u.alive).map((u) => `${Math.round(u.x)},${Math.round(u.y)}`));
  const spots = [];
  for (let y = 10; y <= 12; y++) for (let x = 8; x <= 13; x++) spots.push({ x, y });
  const spot = spots.find((s) => path.isWalkable(s.x, s.y) && !occupied.has(`${s.x},${s.y}`)) || { x: 10, y: 12 };
  const u = spawn(kind, spot.x, spot.y, 'player');
  selected = u;
  showWheel();
  toast(`${c.label} trained.`);
  burst(u.x, u.y, '#e8c56b', 8);
});

/* ---------- Game flow ---------- */
function resetGame() {
  res = { grain: 500, copper: 200, tin: 200, influence: 0 };
  units = []; projectiles = []; particles = []; floats = [];
  selected = null; hideWheel();
  cityHp = CITY_MAX;
  wave = 0; waveEta = 0; waveActive = false;
  influenceAcc = 0; upkeepAcc = 0; time = 0;
  makeMap();
  terrainDirty = true;
  // starting garrison
  spawn('spearman', 10, 12, 'player');
  spawn('worker', 6, 15, 'player');
  spawn('worker', 16, 12, 'player');
  refreshVision();
  focusCity();
  syncHud();
  $('wave-label').textContent = 'The calm before';
}

function startGame() {
  resetGame();
  state = 'playing';
  $('menu').hidden = true;
  $('end').hidden = true;
  $('pause').hidden = true;
  $('hud').hidden = false;
  scheduleWave(18);
  toast('A spearman and two workers stand ready.');
}

function endGame(win) {
  state = win ? 'victory' : 'defeat';
  hideWheel();
  $('hud').hidden = false;
  $('end').hidden = false;
  $('end-kicker').textContent = win ? 'The trade routes hold' : 'The city falls';
  $('end-title').innerHTML = win ? 'Victory' : 'Defeat';
  $('end-tag').textContent = win
    ? 'Eight waves broken. The Basileus still rules these walls.'
    : 'The palace is ash. The Sea Peoples take the coast.';
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  update(dt);
  // gentle camera ease only when not dragging
  if (pointers.size === 0) {
    cam.x = lerp(cam.x, cam.tx, 0.12);
    cam.y = lerp(cam.y, cam.ty, 0.12);
    cam.z = lerp(cam.z, cam.tz, 0.12);
  }
  drawWorld();
  // keep action wheel pinned
  if (selected && !$('wheel').hidden && state === 'playing') {
    const t = tileAt(Math.round(selected.x), Math.round(selected.y));
    const p = worldToScreen(selected.x, selected.y, (t ? t.h : 0) + 36);
    $('wheel').style.left = `${p.x - 80}px`;
    $('wheel').style.top = `${p.y - 110}px`;
  }
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
window.addEventListener('resize', () => { resize(); if (palace) focusCity(); });
$('btn-start').addEventListener('click', startGame);
$('btn-again').addEventListener('click', startGame);
$('btn-pause').addEventListener('click', () => {
  if (state !== 'playing') return;
  state = 'paused';
  $('pause').hidden = false;
});
$('btn-resume').addEventListener('click', () => {
  if (state !== 'paused') return;
  state = 'playing';
  $('pause').hidden = true;
});
$('btn-menu').addEventListener('click', () => {
  state = 'menu';
  $('pause').hidden = true;
  $('hud').hidden = true;
  $('end').hidden = true;
  $('menu').hidden = false;
});

resize();
resetGame();
state = 'menu';
$('hud').hidden = true;
setupInput();
requestAnimationFrame(frame);
