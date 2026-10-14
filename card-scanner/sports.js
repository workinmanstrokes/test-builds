// Free on-device sports-card reader: glare-robust multi-pass OCR → player/brand/year/RC → Wikipedia player check (free, no key).
const Sports = (() => {
  const BR = ['Panini Prizm', 'Panini Phoenix', 'Donruss Optic', 'Topps Chrome', 'Topps Finest', 'Topps Update', 'Topps Heritage', 'Bowman Chrome', 'Bowman Draft', 'Stadium Club', 'National Treasures', 'Upper Deck', 'Young Guns', 'Allen & Ginter', 'Gypsy Queen',
    'Prizm', 'Phoenix', 'Mosaic', 'Select', 'Optic', 'Donruss', 'Contenders', 'Chronicles', 'Absolute', 'Origins', 'Spectra', 'Obsidian', 'Flawless', 'Immaculate', 'Hoops', 'Revolution', 'Certified', 'Prestige', 'Score', 'Fleer', 'Leaf', 'Bowman', 'Topps', 'Panini', 'Chrome'];
  const MAKERS = ['Panini', 'Topps', 'Upper Deck', 'Bowman', 'Leaf', 'Fleer', 'Donruss'];
  const STOP = new Set(['ROOKIE', 'CARD', 'RC', 'PANINI', 'TOPPS', 'NFL', 'NBA', 'MLB', 'NHL', 'NCAA', 'AMERICA', 'LICENSED', 'OFFICIALLY', 'PLAYERS', 'ASSOCIATION', 'COLLEGIATE', 'UNIVERSITY', 'HOLO', 'REFRACTOR', 'PARALLEL', 'INSERT', 'AUTOGRAPH', 'AUTO', 'PATCH', 'TEAM', 'DRAFT', 'PICK', 'ROUND', 'SERIES', 'EDITION', 'BASE', 'SET']);
  const TEAMS = /Tar Heels|Crimson Tide|Buckeyes|Longhorns|Tigers|Bulldogs|Wolverines|Ducks|Gators|Seminoles|Buffaloes|Blue Devils|Duke|Bears|Packers|Chiefs|Eagles|Cowboys|Commanders|Chargers|Spurs|Lakers|Celtics|Warriors|Fever|Sky|Angels|Dodgers|Yankees|Pirates|Mets|Cubs|Blackhawks|Oilers|Maple Leafs|Penguins|Bruins|Rangers|Giants|Jets|Raiders|Ravens|Steelers|Bills|Lions|Vikings|Texans|Broncos|Colts|Saints|Rams|49ers|Seahawks|Falcons|Panthers|Bengals|Browns|Dolphins|Patriots|Titans|Jaguars|Cardinals|Buccaneers/i;
  // canvas helpers
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function crop(src, [x, y, w, h], scale = 1, filter = '') { const c = cv(Math.round(src.width * w * scale), Math.round(src.height * h * scale)), g = c.getContext('2d'); g.filter = filter; g.drawImage(src, src.width * x, src.height * y, src.width * w, src.height * h, 0, 0, c.width, c.height); return c; }
  // Local contrast normalisation (CLAHE-like): each pixel vs. mean/std of its neighbourhood → removes broad glare gradients.
  function localNorm(src, R = 24) {
    const W = src.width, H = src.height, g = src.getContext('2d', { willReadFrequently: true }), im = g.getImageData(0, 0, W, H), d = im.data, L = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const S = new Float64Array((W + 1) * (H + 1)), Q = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let s = 0, q = 0; for (let x = 0; x < W; x++) { const v = L[y * W + x]; s += v; q += v * v; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + s; Q[(y + 1) * (W + 1) + x + 1] = Q[y * (W + 1) + x + 1] + q; } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1), n = (x1 - x0) * (y1 - y0);
      const box = (A) => A[y1 * (W + 1) + x1] - A[y0 * (W + 1) + x1] - A[y1 * (W + 1) + x0] + A[y0 * (W + 1) + x0];
      const m = box(S) / n, sd = Math.sqrt(Math.max(1, box(Q) / n - m * m)), v = Math.max(0, Math.min(255, 128 + (L[y * W + x] - m) / sd * 60)), i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(im, 0, 0); return src;
  }
  // regions where sports cards print name/brand/year; each read with several preprocessings
  const REG = [[0, 0.72, 1, 0.28], [0, 0, 1, 0.22], [0, 0, 1, 1], [0, 0.55, 1, 0.45]];
  async function readAll(card, step = () => {}, budgetMs = 9000) {
    const w = await ocrWorker(), t0 = performance.now(), texts = [];
    const base = card.width > 900 ? crop(card, [0, 0, 1, 1], 900 / card.width) : card;
    const passes = [];
    for (const r of REG) { const sc = Math.min(3, 1200 / (base.width * r[2]));
      passes.push(() => crop(base, r, sc, 'grayscale(1) contrast(1.8)'), () => localNorm(crop(base, r, sc)), () => crop(base, r, sc, 'grayscale(1) invert(1) contrast(1.8)')); }
    for (const [k, mk] of passes.entries()) { if (performance.now() - t0 > budgetMs) break; step(`Reading the card text (${k + 1}/${passes.length})…`);
      try { texts.push((await w.recognize(mk().toDataURL('image/png'))).data.text); } catch {} }
    return texts.join('\n');
  }
  function parse(text) {
    const t = text.replace(/[|_~]/g, ' '), flat = t.replace(/\s+/g, ' ');
    const years = (flat.match(/\b(19[5-9]\d|20[0-3]\d)\b/g) || []).map(Number), year = years.length ? String(Math.max(...years.filter(y => y <= new Date().getFullYear() + 1))) : '';
    const brands = BR.filter(b => new RegExp('\\b' + b.replace('&', '&?').replace(' ', '\\s*') + '\\b', 'i').test(flat));
    const maker = MAKERS.find(m => brands.some(b => b.startsWith(m))) || '', product = (brands.find(b => !MAKERS.includes(b)) || '').replace(new RegExp('^(' + MAKERS.join('|') + ')\\s+'), '');
    const rc = /\bR\s?C\b|\bROOKIE\b/i.test(flat), team = (flat.match(TEAMS) || [])[0] || '';
    const num = (flat.match(/(?:No\.?|#)\s*([A-Z]{0,4}-?\d{1,4})\b/i) || [])[1] || '', serial = (flat.match(/\b\d{1,3}\s*\/\s*(\d{1,4})\b/) || [])[0] || '';
    // name candidates: 2–3 word lines, ALL CAPS or Title Case, not brands/teams
    const names = new Map();
    for (const line of t.split('\n')) for (const m of line.matchAll(/\b([A-Z][A-Za-z'.-]{1,14})(?:\s+([A-Z][A-Za-z'.-]{1,14}))(?:\s+([A-Z][A-Za-z'.-]{1,14}))?\b/g)) {
      const ws = m.slice(1).filter(Boolean).filter(x => !STOP.has(x.toUpperCase()) && !BR.some(b => b.toUpperCase() === x.toUpperCase()));
      if (ws.length < 2) continue; const n = ws.slice(0, 3).map(x => x[0] + x.slice(1).toLowerCase()).join(' ');
      if (TEAMS.test(n) || n.length < 7) continue; names.set(n, (names.get(n) || 0) + 1 + (line.trim().toUpperCase() === line.trim() ? 0.5 : 0)); }
    return { year, maker, product, brand: [maker, product].filter(Boolean).join(' '), rc, team, number: num, serial, names: [...names.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 6) };
  }
  const lev = (a, b) => { const m = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] !== b[j - 1])); return m[a.length][b.length]; };
  const sim = (a, b) => { a = a.toLowerCase().replace(/[^a-z ]/g, ''); b = b.toLowerCase().replace(/[^a-z ]/g, ''); return 1 - lev(a, b) / Math.max(a.length, b.length, 1); };
  const ATH = /player|football|basketball|baseball|hockey|quarterback|running back|wide receiver|pitcher|shortstop|outfielder|guard|forward|center|linebacker|athlete/i;
  async function wiki(cands) { // fuzzy-match OCR name candidates to real athletes on Wikipedia (free, CORS-enabled, no key)
    let best = null;
    for (const q of cands.slice(0, 4).flatMap(c => [[c, c + ' player'], [c, c.split(' ').map(w => w + '~').join(' ') + ' player']])) { const c = q[0]; if (best?.sc >= 0.9) break; try {
      const r = await (await Net.raw(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q[1])}&srlimit=5&srprop=snippet&format=json&origin=*`, {}, 1)).json();
      for (const h of r.query?.search || []) { const title = h.title.replace(/ \(.*\)$/, ''); if (title.split(' ').length < 2) continue;
        const sc = sim(title, c); if ((sc >= 0.85 || ATH.test(h.snippet + ' ' + h.title) && sc >= 0.7) && (!best || sc > best.sc)) best = { name: title, cand: c, desc: h.snippet.replace(/<[^>]+>/g, ''), sc }; }
      if (best?.sc >= 0.9) break; } catch {} }
    return best ? [best] : [];
  }
  async function identify(card, step, budgetMs) {
    const text = await readAll(card, step, budgetMs), p = parse(text); step('Looking up the player…');
    const w = p.names.length ? await wiki(p.names) : [], player = w[0]?.name || p.names[0] || '';
    const set = [p.year, p.brand].filter(Boolean).join(' '), variant = [p.rc && 'RC', p.serial].filter(Boolean).join(' ');
    const mk = (name, s, extra = {}) => ({ game: 'sports', id: 'sp-' + (name + '|' + s).toLowerCase().replace(/[^a-z0-9|]/g, ''), name, number: p.number, set: s, variant, team: p.team, img: '', ...extra });
    const ranked = player ? [mk(player, set, { verified: !!w[0] })] : [];
    if (player) { if (p.year && p.maker && p.product) ranked.push(mk(player, `${p.year} ${p.maker}`)); if (p.brand) ranked.push(mk(player, p.brand)); }
    p.names.filter(n => n !== player && n !== w[0]?.cand).slice(0, 3).forEach(n => ranked.push(mk(n, set)));
    const conf = !player ? 0 : (w[0] ? 0.55 : 0.25) + (p.year ? 0.1 : 0) + (p.brand ? 0.1 : 0) + (p.rc ? 0.05 : 0);
    return { game: 'sports', ranked: ranked.filter((c, i, a) => a.findIndex(x => x.id === c.id) === i), conf: Math.min(0.9, conf), parsed: { ...p, player, verified: !!w[0] }, text };
  }
  const looksSports = text => /\b(Panini|Topps|Upper Deck|Bowman|Donruss|Prizm|Rookie|NFL|NBA|MLB|NHL|NCAA)\b/i.test(text) || TEAMS.test(text);
  return { identify, parse, readAll, localNorm, looksSports, wiki };
})();
