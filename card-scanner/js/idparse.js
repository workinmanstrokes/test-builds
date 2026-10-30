/* Card text parsing + price mapping for Scan & Price. Pure functions (no network, no DOM) so Node tests can load them.
 * OCR input: lines = [{ text, x, y, w, h }] with x/y/w/h normalized 0..1 on the straightened card. */
(function (root) {
  'use strict';
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  function lev(a, b) { if (a === b) return 0; const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1])); prev = cur; } return prev[n]; }
  // 0..1 similarity, tolerant of OCR noise around the real name ("Pikachu ex 120HP" vs "Pikachu ex")
  function sim(a, b) { a = norm(a); b = norm(b); if (!a || !b) return 0; if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.6 + 0.4 * Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return Math.max(0, 1 - lev(a, b) / Math.max(a.length, b.length)); }
  const text = lines => lines.map(l => l.text).join('\n');
  const band = (lines, y0, y1) => lines.filter(l => l.y + l.h / 2 >= y0 && l.y + l.h / 2 <= y1);

  // ---------- which game? ----------
  const SPORTS = /\b(Panini|Topps|Upper Deck|Bowman|Donruss|Prizm|Mosaic|Select|Optic|Rookie|NFL|NBA|MLB|NHL|NCAA|WNBA|MLBPA|NFLPA)\b/i;
  function guessGame(lines) {
    const t = text(lines), s = { pokemon: 0, magic: 0, sports: 0 };
    if (/\bHP\s?\d{2,3}\b|\b\d{2,3}\s?HP\b|weakness|resistance|retreat|pok[eé]mon|\bstage\s?[12]\b|evolves from|\btrainer\b|\bsupporter\b/i.test(t)) s.pokemon += 2;
    if (/\bBASIC\b/.test(t)) s.pokemon += 1;
    if (/creature\s*[—–-]|\binstant\b|\bsorcery\b|\benchantment\b|\bartifact\b|planeswalker|legendary|wizards of the coast|\billus\.|\{T\}|\bEN\b\s*$/im.test(t)) s.magic += 2;
    if (/[•·]\s*EN\b/.test(t)) s.magic += 1;
    if (SPORTS.test(t)) s.sports += 2;
    const best = Object.entries(s).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : null;
  }

  // ---------- Pokémon ----------
  const PK_STOP = /^(basic|stage|stage1|stage2|evolves|from|pokemon|pokémon|trainer|item|supporter|stadium|tool|energy|hp|ex|v|vmax|vstar|gx|put|this|card|ability|weakness|resistance|retreat|illus|tera)$/i;
  function cleanName(s) { return s.replace(/[^A-Za-zÀ-ÿ'’.\- &:]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function parsePokemon(lines) {
    const names = [];
    for (const l of band(lines, 0, 0.16).sort((a, b) => b.h - a.h || a.y - b.y)) {
      let s = l.text.replace(/\bHP\s*\d+|\d+\s*HP\b/ig, ' ').replace(/^(BASIC|STAGE\s*[12]|STAGE)\b/i, ' ').replace(/Evolves from.*$/i, ' ');
      s = cleanName(s); const keep = s.split(' ').filter(w => w.length > 1 || /^[VX]$/i.test(w));
      while (keep.length && PK_STOP.test(keep[0])) keep.shift();
      const n = keep.join(' ').trim(); if (n.length >= 3 && !/^(evolves|put|ability)/i.test(n)) names.push(n);
    }
    let number = '', total = '';
    const bottom = band(lines, 0.8, 1).map(l => l.text).join('\n') + '\n' + text(lines);
    const m = bottom.match(/\b([A-Z]{0,3}\d{1,3}[a-z]?)\s*[\/|]\s*([A-Z]{0,3}\d{1,3})\b/);
    if (m) { number = m[1].replace(/^0+(?=\d)/, ''); total = m[2].replace(/^0+(?=\d)/, ''); }
    return { names: [...new Set(names)].slice(0, 4), number, total };
  }

  // ---------- Magic ----------
  function parseMagic(lines) {
    const names = band(lines, 0, 0.11).sort((a, b) => a.x - b.x || a.y - b.y).map(l => cleanName(l.text.replace(/\{[^}]*\}/g, ' ')))
      .map(s => s.replace(/(\s+[A-Z0-9]{1,2})+$/, '').trim()).filter(s => s.length >= 3);
    const bt = band(lines, 0.86, 1).map(l => l.text).join('\n');
    let number = '', setCode = '';
    const s = bt.match(/\b([A-Z0-9]{3,5})\s*[•·.*\-]\s*(EN|ES|FR|DE|IT|JP|JA|PT|KO|RU|ZHS|ZHT)\b/); if (s) setCode = s[1].toLowerCase();
    const n = bt.match(/\b(\d{1,4})\s*\/\s*\d{2,4}\b/) || bt.match(/(?:^|\n)\s*(?:[CURMLST]\s+)?0*(\d{1,4})\s*(?:[CURMLST])?\s*(?:\n|$)/) || bt.match(/\b0*(\d{2,4})\s+[CURMLST]\b/);
    if (n) number = String(+n[1]);
    return { names: [...new Set(names)].slice(0, 3), number, setCode };
  }

  // ---------- Sports (ported from the Card Scanner M1 sports reader) ----------
  const BR = ['Panini Prizm', 'Panini Phoenix', 'Donruss Optic', 'Topps Chrome', 'Topps Finest', 'Topps Update', 'Topps Heritage', 'Bowman Chrome', 'Bowman Draft', 'Stadium Club', 'National Treasures', 'Upper Deck', 'Young Guns', 'Allen & Ginter', 'Gypsy Queen',
    'Prizm', 'Phoenix', 'Mosaic', 'Select', 'Optic', 'Donruss', 'Contenders', 'Chronicles', 'Absolute', 'Origins', 'Spectra', 'Obsidian', 'Flawless', 'Immaculate', 'Hoops', 'Revolution', 'Certified', 'Prestige', 'Score', 'Fleer', 'Leaf', 'Bowman', 'Topps', 'Panini', 'Chrome'];
  const MAKERS = ['Panini', 'Topps', 'Upper Deck', 'Bowman', 'Leaf', 'Fleer', 'Donruss'];
  const STOP = new Set(['ROOKIE', 'CARD', 'RC', 'PANINI', 'TOPPS', 'NFL', 'NBA', 'MLB', 'NHL', 'NCAA', 'AMERICA', 'LICENSED', 'OFFICIALLY', 'PLAYERS', 'ASSOCIATION', 'COLLEGIATE', 'UNIVERSITY', 'HOLO', 'REFRACTOR', 'PARALLEL', 'INSERT', 'AUTOGRAPH', 'AUTO', 'PATCH', 'TEAM', 'DRAFT', 'PICK', 'ROUND', 'SERIES', 'EDITION', 'BASE', 'SET', 'RATED', 'PRIZM', 'MOSAIC', 'SELECT', 'OPTIC']);
  const TEAMS = /Tar Heels|Crimson Tide|Buckeyes|Longhorns|Tigers|Bulldogs|Wolverines|Ducks|Gators|Seminoles|Buffaloes|Blue Devils|Bears|Packers|Chiefs|Eagles|Cowboys|Commanders|Chargers|Spurs|Lakers|Celtics|Warriors|Fever|Sky|Angels|Dodgers|Yankees|Pirates|Mets|Cubs|Blackhawks|Oilers|Maple Leafs|Penguins|Bruins|Rangers|Giants|Jets|Raiders|Ravens|Steelers|Bills|Lions|Vikings|Texans|Broncos|Colts|Saints|Rams|49ers|Seahawks|Falcons|Panthers|Bengals|Browns|Dolphins|Patriots|Titans|Jaguars|Cardinals|Buccaneers/i;
  function parseSports(lines) {
    const t = text(lines).replace(/[|_~]/g, ' '), flat = t.replace(/\s+/g, ' ');
    const years = (flat.match(/\b(19[5-9]\d|20[0-3]\d)\b/g) || []).map(Number).filter(y => y <= new Date().getFullYear() + 1), year = years.length ? String(Math.max(...years)) : '';
    const brands = BR.filter(b => new RegExp('\\b' + b.replace('&', '&?').replace(' ', '\\s*') + '\\b', 'i').test(flat));
    const maker = MAKERS.find(m => brands.some(b => b.startsWith(m))) || '', product = (brands.find(b => !MAKERS.includes(b)) || '').replace(new RegExp('^(' + MAKERS.join('|') + ')\\s+'), '');
    const rc = /\bR\s?C\b|\bROOKIE\b/i.test(flat), team = (flat.match(TEAMS) || [])[0] || '';
    const number = (flat.match(/(?:No\.?|#)\s*([A-Z]{0,4}-?\d{1,4})\b/i) || [])[1] || '', serial = (flat.match(/\b\d{1,3}\s*\/\s*\d{1,4}\b/) || [])[0] || '';
    const names = new Map();
    for (const line0 of t.split('\n')) { const line = line0.toUpperCase();
      for (const m of line.matchAll(/\b([A-Z][A-Za-z'.-]{1,14})(?:\s+([A-Z][A-Za-z'.-]{1,14}))(?:\s+([A-Z][A-Za-z'.-]{1,14}))?\b/g)) {
        const ws = m.slice(1).filter(Boolean).filter(x => !STOP.has(x.toUpperCase()) && !BR.some(b => b.toUpperCase() === x.toUpperCase()));
        if (ws.length < 2) continue; const n = ws.slice(0, 3).map(x => x[0] + x.slice(1).toLowerCase()).join(' ');
        if (TEAMS.test(n) || n.length < 7) continue; names.set(n, (names.get(n) || 0) + 1 + (line0.trim().toUpperCase() === line0.trim() ? 0.5 : 0)); } }
    return { year, maker, product, brand: [maker, product].filter(Boolean).join(' '), rc, team, number, serial: serial.replace(/\s+/g, ''),
      names: [...names.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 5) };
  }
  const ATH = /player|football|basketball|baseball|hockey|quarterback|running back|wide receiver|tight end|pitcher|shortstop|outfielder|infielder|catcher|guard|forward|linebacker|cornerback|safety|defensive|athlete/i;
  // Wikipedia search hit -> verified athlete name, or null
  function pickAthlete(cand, hits) { let best = null;
    for (const h of hits || []) { const title = h.title.replace(/ \(.*\)$/, ''); if (title.split(' ').length < 2) continue;
      const sc = sim(title, cand), ath = ATH.test(h.snippet + ' ' + h.title); if ((ath && sc >= 0.75 || sc >= 0.92 && ath) && (!best || sc > best.sc)) best = { name: title, sc, ath }; }
    return best; }

  // ---------- eBay sold search (link only) ----------
  function salesQuery(c) {
    if (!c) return '';
    if (c.game === 'pokemon') return [c.name, c.number && (c.total ? `${c.number}/${c.total}` : c.number), c.set].filter(Boolean).join(' ');
    if (c.game === 'magic') return [c.name, c.set, c.number && '#' + c.number, c.finish === 'foil' ? 'foil' : ''].filter(Boolean).join(' ');
    return [c.year, c.brand, c.name, c.number && '#' + c.number, c.parallel, c.serial].filter(Boolean).join(' ');
  }
  const ebaySoldUrl = c => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(salesQuery(c))}&LH_Sold=1&LH_Complete=1&_sop=13`;

  // ---------- prices (every row keeps its source + date; nothing estimated) ----------
  const day = s => (s ? String(s).slice(0, 10) : '');
  const TCGP_LABEL = { normal: 'Normal', holofoil: 'Holofoil', 'reverse-holofoil': 'Reverse holo', '1st-edition': '1st Edition', '1st-edition-holofoil': '1st Ed. holofoil', unlimited: 'Unlimited', 'unlimited-holofoil': 'Unlimited holofoil' };
  function tcgdexPrices(card) {
    const p = card && card.pricing || {}, out = [], tp = p.tcgplayer, cm = p.cardmarket;
    if (tp) for (const [k, v] of Object.entries(tp)) if (v && typeof v === 'object' && v.marketPrice != null)
      out.push({ source: 'TCGplayer', via: 'TCGdex', label: TCGP_LABEL[k] || k.replace(/-/g, ' '), kind: 'Market', value: +v.marketPrice, low: v.lowPrice ?? null, high: v.midPrice ?? null, currency: tp.unit || 'USD', date: day(tp.updated), url: v.productId ? `https://www.tcgplayer.com/product/${v.productId}` : '' });
    if (cm) { const u = cm.unit || 'EUR', d = day(cm.updated), url = cm.idProduct ? `https://www.cardmarket.com/en/Pokemon/Products?idProduct=${cm.idProduct}` : '';
      if (cm.trend != null && cm.trend > 0) out.push({ source: 'Cardmarket', via: 'TCGdex', label: 'Normal', kind: 'Trend', value: +cm.trend, low: cm.low ?? null, currency: u, date: d, url });
      if (cm.avg30 != null && cm.avg30 > 0) out.push({ source: 'Cardmarket', via: 'TCGdex', label: 'Normal', kind: '30-day avg', value: +cm.avg30, currency: u, date: d, url });
      if (cm['trend-holo'] != null && cm['trend-holo'] > 0) out.push({ source: 'Cardmarket', via: 'TCGdex', label: 'Holo', kind: 'Trend', value: +cm['trend-holo'], low: cm['low-holo'] ?? null, currency: u, date: d, url }); }
    return out;
  }
  function scryfallPrices(card, fetchedDate) {
    const p = card && card.prices || {}, out = [], tcg = card && card.purchase_uris && card.purchase_uris.tcgplayer || '', cmu = card && card.purchase_uris && card.purchase_uris.cardmarket || '';
    for (const [k, label, src, cur, url] of [['usd', 'Non-foil', 'TCGplayer', 'USD', tcg], ['usd_foil', 'Foil', 'TCGplayer', 'USD', tcg], ['usd_etched', 'Etched foil', 'TCGplayer', 'USD', tcg], ['eur', 'Non-foil', 'Cardmarket', 'EUR', cmu], ['eur_foil', 'Foil', 'Cardmarket', 'EUR', cmu]])
      if (p[k] != null && +p[k] > 0) out.push({ source: src, via: 'Scryfall', label, kind: 'Market', value: +p[k], currency: cur, date: fetchedDate, dateNote: 'Scryfall daily price, fetched', url });
    return out;
  }
  // Headline = first USD market price (the most common way US collectors price singles)
  const headline = prices => (prices || []).find(p => p.currency === 'USD' && p.kind === 'Market') || (prices || [])[0] || null;
  function money(v, cur) { const s = cur === 'EUR' ? '€' : cur === 'USD' ? '$' : ''; return s + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)) + (s ? '' : ' ' + cur); }

  const api = { norm, sim, lev, guessGame, parsePokemon, parseMagic, parseSports, pickAthlete, salesQuery, ebaySoldUrl, tcgdexPrices, scryfallPrices, headline, money, looksSports: lines => SPORTS.test(text(lines)) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IdParse = api;
})(typeof self !== 'undefined' ? self : this);
