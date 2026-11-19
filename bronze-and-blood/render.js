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
  const p = iso(GATE.x, GATE.y - 2.6);
  cam.z = cam.tz = (W < 500 ? 0.86 : (H < 500 ? 0.8 : 1.1));
  cam.x = cam.tx = W / 2 - p.x * cam.z;
  cam.y = cam.ty = H * 0.47 - p.y * cam.z;
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
    if (u.kind === 'warlord') return { cloth: '#3a1430', armor: '#1c1c24', accent: '#e8c56b', skin: '#b8906a' };
    if (u.kind === 'reaver') return { cloth: '#5a1c1c', armor: '#3a2a2a', accent: '#e07a5a', skin: '#c4a07a' };
    if (u.kind === 'marauder') return { cloth: '#24303c', armor: '#4a5560', accent: '#8aa0b4', skin: '#c4a07a' };
    if (u.kind === 'slinger') return { cloth: '#6a5a34', armor: '#4a4028', accent: '#d8c890', skin: '#c4a07a' };
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
  if (u.sheltered) return;
  if (u.faction === 'sea' && !u.icon && !isSeen(u)) return;
  c.save();
  if (!u.alive) c.globalAlpha = clamp(1 - (u._dead || 0) / 0.4, 0, 1);
  drawUnitBody(c, u);
  c.restore();
}

function drawUnitBody(c, u) {
  const t = tileAt(Math.round(u.x), Math.round(u.y));
  const h = t ? t.h : 0;
  const p = iso(u.x, u.y);
  const x = p.x, y = p.y - h - 6 + Math.sin(u.bob) * (u.path ? 1.2 : 0.6);
  const col = teamColor(u);
  const s = u.kind === 'warlord' ? 1.6 : u.kind === 'chariot' ? 1.15 : u.kind === 'champion' ? 1.2
    : u.kind === 'shield' || u.kind === 'marauder' ? 1.1 : u.kind === 'reaver' || u.kind === 'slinger' ? 0.92 : 1;

  // shadow
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(p.x, p.y - h + 6, 12 * s, 6 * s, 0, 0, Math.PI * 2); c.fill();

  if (!u.icon && group.includes(u)) {
    c.strokeStyle = '#e8c56b'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(p.x, p.y - h + 6, 16 * s, 8 * s, 0, 0, Math.PI * 2); c.stroke();
    if (u.path && group.length <= 3) {
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

  if (u.kind === 'ram') {
    // covered battering ram: hide roof, log with a bronze head, two wheels
    c.fillStyle = '#3a2616';
    c.beginPath(); c.moveTo(x - 17, y + 6); c.lineTo(x + 17, y + 6); c.lineTo(x + 13, y - 12); c.lineTo(x - 13, y - 12); c.closePath(); c.fill();
    c.fillStyle = '#6a4a2a';
    c.beginPath(); c.moveTo(x - 15, y - 10); c.lineTo(x + 15, y - 10); c.lineTo(x, y - 24); c.closePath(); c.fill();
    c.strokeStyle = '#2a1a10'; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = '#8a6a40'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 12 * flip, y - 2); c.lineTo(x + 20 * flip, y - 2); c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = '#c49a42';
    c.beginPath(); c.arc(x + 21 * flip, y - 2, 4.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1a100a'; c.lineWidth = 2.2;
    c.beginPath(); c.arc(x - 10, y + 8, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x + 10, y + 8, 5, 0, Math.PI * 2); c.stroke();
  } else if (u.kind === 'chariot') {
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
    if (u.kind === 'warlord') {
      // horned helm and crest
      c.strokeStyle = '#e8dcc0'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 4 * s, y - 21 * s); c.quadraticCurveTo(x - 9 * s, y - 24 * s, x - 8 * s, y - 29 * s); c.stroke();
      c.beginPath(); c.moveTo(x + 4 * s, y - 21 * s); c.quadraticCurveTo(x + 9 * s, y - 24 * s, x + 8 * s, y - 29 * s); c.stroke();
      c.fillStyle = '#8e1d1d';
      c.fillRect(x - 1.5, y - 29 * s, 3, 7 * s);
    }
    // weapons / shield
    if (u.kind === 'shield' || u.kind === 'champion' || u.kind === 'warlord' || u.kind === 'marauder') {
      c.fillStyle = col.accent;
      c.beginPath(); c.ellipse(x - 9 * s * flip, y - 6 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2a1a10'; c.lineWidth = 1; c.stroke();
    }
    if (u.kind === 'reaver') {
      c.strokeStyle = '#d8dce0'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(x + 6 * s * flip, y - 4 * s); c.lineTo(x + 13 * s * flip, y - 13 * s); c.stroke();
      c.beginPath(); c.moveTo(x - 6 * s * flip, y - 3 * s); c.lineTo(x - 11 * s * flip, y - 10 * s); c.stroke();
    }
    if (u.kind === 'slinger') {
      c.strokeStyle = '#d8c890'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x + 6 * s * flip, y - 8 * s); c.quadraticCurveTo(x + 16 * s * flip, y - 22 * s, x + 12 * s * flip, y - 26 * s); c.stroke();
      c.fillStyle = '#9a9aa0';
      c.beginPath(); c.arc(x + 12 * s * flip, y - 26 * s, 2.2, 0, Math.PI * 2); c.fill();
    }
    if (u.kind === 'spearman' || u.kind === 'raider' || u.kind === 'marauder' || u.kind === 'champion' || u.kind === 'warlord') {
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

  // Hit flash. A canvas `filter` here (the previous approach) is rasterized
  // per fill on Android WebView and froze the frame during big melees.
  if (u.flash > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.min(1, u.flash / 0.12) * 0.7;
    c.fillStyle = '#fff2c8';
    c.beginPath(); c.ellipse(x, y - 8 * s, 15 * s, 17 * s, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // health bar
  if (!u.icon && u.alive && (u.hp < u.maxHp || group.includes(u))) {
    const bw = u.kind === 'warlord' ? 40 : u.big ? 26 : 18, bh = u.kind === 'warlord' ? 4 : 3;
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.fillRect(x - bw / 2 - 1, y - 32 * s - 1, bw + 2, bh + 2);
    c.fillStyle = u.faction === 'player' ? (u.isBronze ? '#e8c56b' : '#6aaa4a') : '#c4392a';
    c.fillRect(x - bw / 2, y - 32 * s, bw * clamp(u.hp / u.maxHp, 0, 1), bh);
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
  const sh = shake > 0 ? shake * 14 : 0;
  ctx.translate(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh);
  ctx.scale(cam.z, cam.z);

  drawTerrain(ctx);
  drawBoats(ctx);
  for (const m of markers) {
    const t = tileAt(Math.round(m.x), Math.round(m.y));
    const q = iso(m.x, m.y);
    const k = 1 - m.life / m.max;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = m.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(q.x, q.y - (t ? t.h : 0), 8 + k * 22, 4 + k * 11, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // depth-sorted movers
  const sprites = [];
  for (const u of units) sprites.push({ k: u.x + u.y, u });
  sprites.sort((a, b) => a.k - b.k);
  for (const s of sprites) drawUnit(ctx, s.u);
  if (state === 'playing' || state === 'paused' || state === 'tech') drawFog(ctx);
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
    ctx.font = '700 13px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(10,6,4,.9)'; ctx.lineJoin = 'round';
    ctx.strokeText(f.text, q.x, q.y - (t ? t.h : 0) - f.z);
    ctx.fillText(f.text, q.x, q.y - (t ? t.h : 0) - f.z);
    ctx.globalAlpha = 1;
  }

  // hover tile
  if (hover && state === 'playing') {
    const t = tileAt(hover.x, hover.y);
    if (t && t.explored) {
      const p = iso(hover.x, hover.y);
      drawDiamond(ctx, p.x, p.y - (t.h || 0) - 1, TILE_W, TILE_H, 'rgba(232,197,107,.18)', 'rgba(232,197,107,.8)');
    }
  }

  ctx.restore();

  if (state === 'playing' || state === 'paused') drawThreatArrows(ctx);

  // cinematic vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// Longships: they row in while the next wave counts down and sit at the shore while it lands
function drawBoats(c) {
  if (state !== 'playing' && state !== 'paused' && state !== 'tech') return;
  const landing = waveActive && spawnQueue.length > 0;
  if (!landing && !(waveEta > 0 && waveEta < 14)) return;
  const approach = landing ? 1 : clamp(1 - waveEta / 14, 0, 1);
  for (const z of nextZones) {
    for (const off of [-1.6, 1.4]) {
      const bx = ZONES[z] + off, by = lerp(-3.2, 1.1, approach) + (off > 0 ? 0.35 : 0);
      const p = iso(bx, by);
      const y = p.y + 6 + Math.sin(waterPhase * 1.3 + bx) * 1.5;
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath(); c.ellipse(p.x, y + 6, 24, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a1c14';
      c.beginPath();
      c.moveTo(p.x - 26, y - 4); c.quadraticCurveTo(p.x, y + 12, p.x + 26, y - 4);
      c.lineTo(p.x + 30, y - 12); c.quadraticCurveTo(p.x, y + 2, p.x - 30, y - 12); c.closePath(); c.fill();
      c.strokeStyle = '#5a3a22'; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = '#3a2616'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(p.x, y - 2); c.lineTo(p.x, y - 34); c.stroke();
      c.fillStyle = '#8e1d1d';
      c.beginPath(); c.moveTo(p.x - 14, y - 32); c.lineTo(p.x + 14, y - 32); c.lineTo(p.x + 11, y - 12); c.lineTo(p.x - 11, y - 12); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x - 12, y - 22); c.lineTo(p.x + 12, y - 22); c.stroke();
    }
  }
}

// Red chevrons on the screen edge pointing at enemies that are out of view
function drawThreatArrows(c) {
  const top = 150, bottom = H - 118, pad = 16;
  let n = 0;
  for (const u of units) {
    if (!u.alive || u.faction !== 'sea') continue;
    const t = tileAt(Math.round(u.x), Math.round(u.y));
    const p = worldToScreen(u.x, u.y, (t ? t.h : 0) + 12);
    if (p.x >= 0 && p.x <= W && p.y >= top - 20 && p.y <= bottom + 20) continue;
    if (++n > 10) break;
    const x = clamp(p.x, pad, W - pad), y = clamp(p.y, top, bottom);
    const ang = Math.atan2(p.y - y, p.x - x);
    c.save();
    c.translate(x, y); c.rotate(ang);
    c.fillStyle = u.kind === 'warlord' ? '#e8c56b' : '#e0483a';
    c.strokeStyle = 'rgba(10,6,4,.8)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -7); c.lineTo(-1, 0); c.lineTo(-5, 7); c.closePath();
    c.fill(); c.stroke();
    c.restore();
  }
}
