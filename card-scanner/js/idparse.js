/* Card text parsing + price mapping for Scan & Price. Pure functions (no network, no DOM) so Node tests can load them.
 * OCR input: lines = [{ text, x, y, w, h }] with x/y/w/h normalized 0..1 on the straightened card.
 * Full identity: pokemonFullId / magicFullId map the whole API record (set, year, variant/parallel,
 * edition, finish, artist/illustrator, legalities) and unsureFor lists what the photo did NOT
 * confirm, instead of guessing. salesSummary turns CardSight completed auctions into the
 * sports price (there is no free sports price guide). */
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
    const parallel = detectParallel(flat), insert = detectInsert(flat);
    const names = new Map();
    for (const line0 of t.split('\n')) { const line = line0.toUpperCase();
      for (const m of line.matchAll(/\b([A-Z][A-Za-z'.-]{1,14})(?:\s+([A-Z][A-Za-z'.-]{1,14}))(?:\s+([A-Z][A-Za-z'.-]{1,14}))?\b/g)) {
        const ws = m.slice(1).filter(Boolean).filter(x => !STOP.has(x.toUpperCase()) && !BR.some(b => b.toUpperCase() === x.toUpperCase()));
        if (ws.length < 2) continue; const n = ws.slice(0, 3).map(x => x[0] + x.slice(1).toLowerCase()).join(' ');
        if (TEAMS.test(n) || n.length < 7) continue; names.set(n, (names.get(n) || 0) + 1 + (line0.trim().toUpperCase() === line0.trim() ? 0.5 : 0)); } }
    return { year, maker, product, brand: [maker, product].filter(Boolean).join(' '), rc, team, number, serial: serial.replace(/\s+/g, ''), parallel, insert,
      names: [...names.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 5) };
  }
  // Parallel / insert words printed on the card. A colour only counts as a parallel when the card
  // is a parallel product (Prizm / Mosaic / Optic / Refractor / …) — otherwise it is usually a team name.
  const PAR_COLORS = ['Silver', 'Blue', 'Red', 'Green', 'Gold', 'Purple', 'Orange', 'Pink', 'Black', 'White', 'Mojo', 'Cracked Ice', 'Hyper', 'Scope', 'Disco', 'Wave', 'Pulsar', 'Camo', 'Tiger', 'Zebra', 'Nebula', 'No Huddle'];
  const INSERTS = ['Kaboom', 'Downtown', 'Color Blast', 'Stained Glass', 'Rated Rookie', 'Short Print', 'Case Hit', 'Micro Mosaic'];
  const PAR_PRODUCT = /\b(Prizm|Refractor|Parallel|Holo|Mosaic|Select|Optic|Spectra|Obsidian)\b/i;
  function detectParallel(flat) {
    if (!PAR_PRODUCT.test(flat)) return '';
    const found = PAR_COLORS.filter(c => new RegExp('\\b' + c.replace(' ', '\\s+') + '\\b', 'i').test(flat));
    return found.map(c => c === 'Silver' && /\bPrizm\b/i.test(flat) ? 'Silver Prizm' : c).join(' ');
  }
  function detectInsert(flat) { return INSERTS.filter(c => new RegExp('\\b' + c.replace(' ', '\\s+') + '\\b', 'i').test(flat)).join(' '); }
  const ATH = /player|football|basketball|baseball|hockey|quarterback|running back|wide receiver|tight end|pitcher|shortstop|outfielder|infielder|catcher|guard|forward|linebacker|cornerback|safety|defensive|athlete/i;
  // Wikipedia search hit -> verified athlete name, or null
  function pickAthlete(cand, hits) { let best = null;
    for (const h of hits || []) { const title = h.title.replace(/ \(.*\)$/, ''); if (title.split(' ').length < 2) continue;
      const sc = sim(title, cand), ath = ATH.test(h.snippet + ' ' + h.title); if ((ath && sc >= 0.75 || sc >= 0.92 && ath) && (!best || sc > best.sc)) best = { name: title, sc, ath }; }
    return best; }

  // ---------- eBay sold search (link only) ----------
  function salesQuery(c) {
    if (!c) return '';
    if (c.game === 'pokemon') { const v = c.variants && c.variants.length === 1 && c.variants[0] !== 'Normal' ? c.variants[0] : ''; return [c.name, c.number && (c.total ? `${c.number}/${c.total}` : c.number), c.set, v].filter(Boolean).join(' '); }
    if (c.game === 'magic') return [c.name, c.set, c.number && '#' + c.number, c.finish === 'foil' ? 'foil' : ''].filter(Boolean).join(' ');
    return [c.year, c.brand, c.name, c.number && '#' + c.number, c.parallel, c.insert, c.serial].filter(Boolean).join(' ');
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
    // Some prints only carry prices on their variants; use the first variant that has any.
    if (!out.length && Array.isArray(card.variants_detailed)) for (const vd of card.variants_detailed) { const sub = tcgdexPrices({ pricing: vd.pricing }); if (sub.length) { out.push(...sub); break; } }
    return out;
  }
  function scryfallPrices(card, fetchedDate) {
    const p = card && card.prices || {}, out = [], tcg = card && card.purchase_uris && card.purchase_uris.tcgplayer || '', cmu = card && card.purchase_uris && card.purchase_uris.cardmarket || '';
    for (const [k, label, src, cur, url] of [['usd', 'Non-foil', 'TCGplayer', 'USD', tcg], ['usd_foil', 'Foil', 'TCGplayer', 'USD', tcg], ['usd_etched', 'Etched foil', 'TCGplayer', 'USD', tcg], ['eur', 'Non-foil', 'Cardmarket', 'EUR', cmu], ['eur_foil', 'Foil', 'Cardmarket', 'EUR', cmu]])
      if (p[k] != null && +p[k] > 0) out.push({ source: src, via: 'Scryfall', label, kind: 'Market', value: +p[k], currency: cur, date: fetchedDate, dateNote: 'Scryfall daily price, fetched', url });
    return out;
  }
  // ---------- full card identity (detail mapping) ----------
  // TCGdex card detail -> the complete record the app shows. Every field comes from the API
  // response; anything the source doesn't carry is '' or [] — never guessed.
  const VARIANT_LABEL = { normal: 'Normal', holo: 'Holo', reverse: 'Reverse holo', firstEdition: '1st Edition', wPromo: 'W Promo', pokeball: 'Poké Ball', masterball: 'Master Ball' };
  const variantLabel = k => VARIANT_LABEL[k] || String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  function pokemonVariants(d) { const v = d && d.variants || {}; return Object.keys(v).filter(k => v[k]).map(variantLabel); }
  function pokemonFullId(d, setInfo) {
    const s = d.set || {}, cc = s.cardCount || {}, yr = setInfo && setInfo.releaseDate ? String(setInfo.releaseDate).slice(0, 4) : '';
    const variants = pokemonVariants(d);
    return { game: 'pokemon', id: d.id, name: d.name, set: s.name || '', setId: s.id || '', number: d.localId || '', total: cc.official ? String(cc.official) : '', totalAll: cc.total ? String(cc.total) : '',
      rarity: d.rarity || '', year: yr, illustrator: d.illustrator || '', hp: d.hp != null ? d.hp : '', types: d.types || [], stage: d.stage || '', suffix: d.suffix || '',
      dexId: d.dexId || [], regulationMark: d.regulationMark || '', legal: d.legal || {},
      variants, edition: variants.includes('1st Edition') ? '1st Edition' : '',
      img: d.image ? d.image + '/high.webp' : '', thumb: d.image ? d.image + '/low.webp' : '', prices: tcgdexPrices(d), db: 'TCGdex', dbUrl: 'https://tcgdex.dev' };
  }
  // Scryfall card -> the complete record. Finishes, promo, art variations and legalities all
  // come from the record; the photo cannot tell them apart, so unsureFor flags them.
  const FINISH_LABEL = { nonfoil: 'Non-foil', foil: 'Foil', etched: 'Etched foil' };
  function magicFullId(c, fetchedDate) {
    const finishes = (c.finishes || []).map(f => FINISH_LABEL[f] || f);
    const legal = Object.keys(c.legalities || {}).filter(k => c.legalities[k] === 'legal').map(k => k[0].toUpperCase() + k.slice(1));
    return { game: 'magic', id: c.id, name: c.name, set: c.set_name || '', setCode: c.set || '', setType: c.set_type || '', number: c.collector_number || '',
      rarity: c.rarity ? c.rarity[0].toUpperCase() + c.rarity.slice(1) : '', year: c.released_at ? String(c.released_at).slice(0, 4) : '',
      artist: c.artist || '', finishes, finish: c.finishes && !c.finishes.includes('nonfoil') ? 'foil' : '',
      promo: !!c.promo, promoTypes: c.promo_types || [], fullArt: !!c.full_art, textless: !!c.textless, borderColor: c.border_color || '',
      reprint: !!c.reprint, variation: !!c.variation, reserved: !!c.reserved, legal,
      img: (c.image_uris || (c.card_faces && c.card_faces[0].image_uris) || {}).normal || '', thumb: (c.image_uris || (c.card_faces && c.card_faces[0].image_uris) || {}).small || '',
      prices: scryfallPrices(c, fetchedDate), db: 'Scryfall', dbUrl: c.scryfall_uri || 'https://scryfall.com' };
  }

  // ---------- what we could NOT confirm ----------
  // Plain-language "unsure about X" items. The app shows these next to the card instead of guessing.
  function unsureFor(game, card, parsed, alts) {
    const p = parsed || {}, out = [], a = alts || [];
    if (game === 'pokemon') {
      if (!p.number && !card.number) out.push('Card number not read from the photo — matched by name only');
      if ((card.variants || []).length > 1) out.push('Variant not confirmed from the photo — check holo, reverse holo or 1st edition before listing');
      if (a.some(x => x.name === card.name && x.number === card.number && x.set !== card.setId)) out.push('This card exists in more than one set — check the set symbol');
      if (!card.year) out.push('Release year not confirmed from the set data');
    } else if (game === 'magic') {
      if (!p.number && !card.number) out.push('Collector number not read from the photo — matched by name only');
      if (!p.setCode && !card.setCode) out.push('Set not read from the bottom line — matched by name and number');
      if ((card.finishes || []).length > 1) out.push('Finish not confirmed from the photo — foil, non-foil and etched prints share this number');
      if (card.variation) out.push('This print has art variations — check the art against the picture');
      if (card.promo) out.push('Promo print — check the promo stamp');
    } else if (game === 'sports') {
      if (!card.verified) out.push('Player not verified against Wikipedia — check the name');
      if (!card.number) out.push('Card number not read — check the back of the card');
      if (!card.year) out.push('Year not read from the card');
      if (!card.brand) out.push('Set / brand not read from the card');
      if (!card.parallel && !card.insert) out.push('Parallel not read — base vs parallel changes the price a lot');
    }
    return out;
  }

  // ---------- match confidence, 0..100 (kept next to the high/medium/low label) ----------
  function scoreConf(game, m) {
    if (!m) return 0;
    if (game === 'pokemon') return Math.round(100 * Math.max(0, Math.min(1, (m.nm || 0) * 0.55 + (m.num ? 0.3 : 0) + (m.tot ? 0.15 : 0))));
    if (game === 'magic') { const s = m.score || 0; return s >= 2 ? 95 : s >= 1.6 ? 85 : s >= 1.4 ? 75 : s >= 1 ? 65 : 55; }
    if (game === 'sports') return !m.name ? 0 : m.verified ? (m.year && m.brand && m.number ? 92 : 82) : 55;
    return 0;
  }

  // ---------- recent-sales summary (the sports price) ----------
  // CardSight completed auctions -> median / low / high. Grouped by the currency most sales
  // used; sales in other currencies are left out and counted, never converted or invented.
  function median(a) { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  // Parallel names are compared loosely: "Red White Blue Prizm", "red white & blue prizm
  // rc" and "RWB Prizm" all mean the same parallel. The brand word and RC/Rookie tags
  // are stripped; the remaining words must match exactly (so Silver Prizm never
  // matches Red White Blue Prizm). Returns '' for no parallel (a base card).
  function normalizeParallel(p) {
    return String(p || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter(w => w && w !== 'and' && w !== 'prizm' && w !== 'rc' && w !== 'rookie' && w !== 'card' && w !== 'parallel').join(' ');
  }
  function summarizeGroup(list, period) {
    const byCur = {}; list.forEach(x => { const c = x.currency || 'USD'; (byCur[c] = byCur[c] || []).push(x); });
    const cur = Object.keys(byCur).sort((a, b) => byCur[b].length - byCur[a].length)[0], g = byCur[cur];
    const vals = g.map(x => +x.price), dates = g.map(x => x.date).filter(Boolean).sort();
    return { count: g.length, total: list.length, currency: cur, median: median(vals), low: Math.min(...vals), high: Math.max(...vals),
      graded: g.filter(x => x.grade).length, period: period || '', asOf: dates.length ? dates[dates.length - 1].slice(0, 10) : '' };
  }
  // When a parallel is known, prefer sales of that exact parallel. If none exist,
  // fall back to all sales but mark the result base: true so the UI labels it as
  // base-version sales instead of passing it off as the parallel's price. Never
  // invents a price: no sales at all still returns null.
  function salesSummary(sales, period, parallel) {
    const list = (sales || []).filter(x => x && Number.isFinite(+x.price) && +x.price > 0);
    if (!list.length) return null;
    if (parallel) {
      const np = normalizeParallel(parallel);
      const exact = list.filter(x => x.parallel && normalizeParallel(x.parallel) === np);
      if (exact.length) return { ...summarizeGroup(exact, period), parallel, base: false };
      return { ...summarizeGroup(list, period), parallel, base: true };
    }
    return { ...summarizeGroup(list, period), base: false };
  }
  // Consensus of CardSight's own matched_card (name + number + set year) across the sales.
  // Returns null unless at least half the sales with a match agree on the same card.
  // Also returns the consensus parallel: the most common parallel among the sales that
  // match the consensus card, only when it holds a strict majority of ALL of those
  // sales — a split, or a majority of base (no parallel) sales, gives ''.
  function salesMatch(sales) {
    const ms = (sales || []).map(x => x && x.matched).filter(m => m && m.name && m.number);
    if (!ms.length) return null;
    const key = m => [m.name, m.number, m.year || '', m.set || ''].join('|'), counts = {};
    ms.forEach(m => { const k = key(m); counts[k] = (counts[k] || 0) + 1; });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best[1] <= ms.length / 2) return null; // strict majority: a split is no consensus
    const m = ms.find(x => key(x) === best[0]);
    const pars = (sales || []).filter(x => x && x.matched && key(x.matched) === best[0] && x.parallel)
      .map(x => ({ raw: x.parallel, n: normalizeParallel(x.parallel) })).filter(x => x.n);
    let parallel = '';
    if (pars.length) {
      const pc = {}; pars.forEach(p => { pc[p.n] = (pc[p.n] || 0) + 1; });
      const top = Object.entries(pc).sort((a, b) => b[1] - a[1])[0];
      // Strict majority of ALL consensus-card sales, not just the ones carrying a
      // parallel: two base sales and one Silver sale is a base consensus, not Silver.
      if (top[1] > best[1] / 2) parallel = (pars.find(p => p.n === top[0]) || {}).raw || '';
    }
    return { name: m.name, number: m.number, set: m.set || '', year: m.year || '', release: m.release || '', count: best[1], total: ms.length, parallel };
  }

  // Headline = first USD market price (the most common way US collectors price singles)
  const headline = prices => (prices || []).find(p => p.currency === 'USD' && p.kind === 'Market') || (prices || [])[0] || null;
  function money(v, cur) { const s = cur === 'EUR' ? '€' : cur === 'USD' ? '$' : ''; return s + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)) + (s ? '' : ' ' + cur); }

  const api = { norm, sim, lev, guessGame, parsePokemon, parseMagic, parseSports, pickAthlete, salesQuery, ebaySoldUrl, tcgdexPrices, scryfallPrices, headline, money,
    pokemonVariants, pokemonFullId, magicFullId, unsureFor, scoreConf, salesSummary, salesMatch, normalizeParallel, median, looksSports: lines => SPORTS.test(text(lines)) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IdParse = api;
})(typeof self !== 'undefined' ? self : this);
