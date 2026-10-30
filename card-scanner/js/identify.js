/* Scan & Price: OCR the straightened card -> guess the game -> look it up in free databases -> prices with source + date.
 * Pokémon: TCGdex (free, no key; TCGplayer + Cardmarket prices). Magic: Scryfall (free, no key; daily TCGplayer/Cardmarket).
 * Sports: OCR + Wikipedia athlete check + editable fields, no prices (there is no free sports price source).
 * Recent sales: the optional Worker (CardSight completed auctions) or an eBay sold-listings link. Nothing is estimated. */
const Identify = (() => {
  const P = IdParse, TCGDEX = 'https://api.tcgdex.net/v2/en', SCRY = 'https://api.scryfall.com';
  const today = () => new Date().toISOString().slice(0, 10);
  const enc = encodeURIComponent;

  // ---------- OCR: whole card + an upscaled bottom strip for small collector numbers ----------
  function strip(card, y0, y1, scale) { const c = document.createElement('canvas'), h = (y1 - y0) * card.height; c.width = card.width * scale; c.height = h * scale; c.getContext('2d').drawImage(card, 0, y0 * card.height, card.width, h, 0, 0, c.width, c.height); return c; }
  async function readCard(card, step) {
    step('Reading the card text');
    const full = await OCR.read(card), top = await OCR.read(strip(card, 0, 0.14, 2)), bot = await OCR.read(strip(card, 0.84, 1, 2));
    const lines = full.lines.concat(top.lines.map(l => ({ ...l, y: l.y * 0.14, h: l.h * 0.14, strip: true })), bot.lines.map(l => ({ ...l, y: 0.84 + l.y * 0.16, h: l.h * 0.16, strip: true })));
    return { engine: full.engine, lines };
  }

  // ---------- Pokémon via TCGdex ----------
  let setsP = null; const sets = () => setsP || (setsP = Net.json(`${TCGDEX}/sets`, { ttl: 7 * 864e5 }).catch(e => { setsP = null; throw e; }));
  const setOf = id => id.slice(0, id.lastIndexOf('-'));
  async function pokemonCandidates(p) {
    const out = new Map(), add = l => (l || []).forEach(c => !out.has(c.id) && !/^(A\d|P-A|B\d)/.test(c.id) && out.set(c.id, c)); // skip TCG Pocket (digital only)
    for (const n of p.names.slice(0, 3)) {
      const longest = n.split(' ').sort((a, b) => b.length - a.length)[0] || n;
      for (const q of [n, longest, longest.slice(0, 5)]) { if (q.length < 3) continue; try { add(await Net.json(`${TCGDEX}/cards?name=${enc(q)}`)); } catch {} if (out.size && [...out.values()].some(c => P.sim(c.name, n) > 0.8)) break; }
      if (out.size > 300) break;
    }
    if (p.number && (out.size === 0 || ![...out.values()].some(c => c.localId.replace(/^0+(?=\d)/, '') === p.number))) try { add(await Net.json(`${TCGDEX}/cards?localId=${enc(p.number)}`)); } catch {}
    let totals = null; if (p.total) try { totals = new Map((await sets()).map(s => [s.id, s.cardCount])); } catch {}
    const ranked = [...out.values()].map(c => {
      const nm = Math.max(0, ...p.names.map(n => P.sim(n, c.name))), num = p.number && c.localId.replace(/^0+(?=\d)/, '') === p.number ? 1 : 0;
      const cc = totals && totals.get(setOf(c.id)), tot = cc && p.total && String(cc.official) === p.total ? 1 : 0;
      return { c, score: nm * 0.55 + num * 0.3 + tot * 0.15, nm, num, tot };
    }).filter(x => x.nm >= 0.5 || x.num && x.tot).sort((a, b) => b.score - a.score);
    return ranked.slice(0, 12);
  }
  async function pokemonDetail(id) {
    const d = await Net.json(`${TCGDEX}/cards/${enc(id)}`, { ttl: 6 * 3600e3 });
    return { game: 'pokemon', id: d.id, name: d.name, set: d.set && d.set.name, number: d.localId, total: d.set && d.set.cardCount && d.set.cardCount.official ? String(d.set.cardCount.official) : '', rarity: d.rarity || '',
      img: d.image ? d.image + '/high.webp' : '', thumb: d.image ? d.image + '/low.webp' : '', prices: P.tcgdexPrices(d), db: 'TCGdex', dbUrl: `https://tcgdex.dev` };
  }

  // ---------- Magic via Scryfall ----------
  const mtgCard = (c, fetched) => ({ game: 'magic', id: c.id, name: c.name, set: c.set_name, setCode: c.set, number: c.collector_number, rarity: c.rarity ? c.rarity[0].toUpperCase() + c.rarity.slice(1) : '',
    img: (c.image_uris || (c.card_faces && c.card_faces[0].image_uris) || {}).normal || '', thumb: (c.image_uris || (c.card_faces && c.card_faces[0].image_uris) || {}).small || '',
    finish: c.finishes && !c.finishes.includes('nonfoil') ? 'foil' : '', prices: P.scryfallPrices(c, fetched), db: 'Scryfall', dbUrl: c.scryfall_uri || 'https://scryfall.com' });
  async function magicCandidates(p) {
    const out = new Map(), add = (c, s) => { if (c && c.id && (!out.has(c.id) || out.get(c.id).score < s)) out.set(c.id, { c, score: s }); };
    if (p.setCode && p.number) try { add(await Net.json(`${SCRY}/cards/${enc(p.setCode)}/${enc(p.number)}`), 2); } catch {}
    let name = '';
    for (const n of p.names) { try { const c = await Net.json(`${SCRY}/cards/named?fuzzy=${enc(n)}`); name = c.name; add(c, 1 + (p.number && c.collector_number === p.number ? 0.6 : 0)); break; } catch {} }
    if (!name && out.size) name = [...out.values()][0].c.name;
    if (name) try { const r = await Net.json(`${SCRY}/cards/search?unique=prints&order=released&q=${enc(`!"${name}"`)}`);
      (r.data || []).slice(0, 60).forEach(c => add(c, 0.8 + (p.number && c.collector_number === p.number ? 0.6 : 0) + (p.setCode && c.set === p.setCode ? 0.6 : 0))); } catch {}
    return [...out.values()].sort((a, b) => b.score - a.score).slice(0, 12).map(x => ({ c: x.c, score: x.score, num: p.number && x.c.collector_number === p.number ? 1 : 0, nm: 1 }));
  }

  // ---------- Sports: Wikipedia athlete check (free, no key) ----------
  async function wikiAthlete(cands) {
    let best = null;
    await Promise.all(cands.slice(0, 4).map(async c => { try {
      const r = await Net.json(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(c + ' player')}&srlimit=5&srprop=snippet&format=json&origin=*`, { ttl: 30 * 864e5 });
      const hit = P.pickAthlete(c, (r.query && r.query.search || []).map(h => ({ title: h.title, snippet: h.snippet.replace(/<[^>]+>/g, '') })));
      if (hit && (!best || hit.sc > best.sc)) best = hit; } catch {} }));
    return best;
  }
  async function sports(lines) {
    const s = P.parseSports(lines), ath = await wikiAthlete(s.names);
    return { game: 'sports', id: 'sp-' + Date.now(), name: ath ? ath.name : s.names[0] || '', verified: !!ath, year: s.year, brand: s.brand, number: s.number, parallel: [s.rc ? 'RC' : ''].filter(Boolean).join(' '), serial: s.serial, team: s.team, prices: [], db: ath ? 'Wikipedia' : '' };
  }

  // ---------- main ----------
  // Returns { status:'ok'|'pick'|'none', game, card, alts:[{id,name,set,number,thumb}], read:{engine, text} }
  async function identify(card, { game = 'auto', step = () => {} } = {}) {
    const rd = await readCard(card, step), text = rd.lines.map(l => l.text).join('\n'), read = { engine: rd.engine, text: text.slice(0, 600) };
    let g = game === 'auto' ? P.guessGame(rd.lines) : game;
    if (!g) return { status: 'none', read };
    if (g === 'sports') { step('Checking the player'); const c = await sports(rd.lines); return { status: c.name ? 'ok' : 'none', game: g, card: c, alts: [], read, conf: c.verified ? 'high' : 'low' }; }
    step(g === 'pokemon' ? 'Searching TCGdex' : 'Searching Scryfall');
    const p = g === 'pokemon' ? P.parsePokemon(rd.lines) : P.parseMagic(rd.lines);
    if (!p.names.length && !p.number) return { status: 'none', game: g, read };
    const ranked = g === 'pokemon' ? await pokemonCandidates(p) : await magicCandidates(p);
    if (!ranked.length) return { status: 'none', game: g, read, parsed: p };
    step('Fetching market prices');
    const top = ranked[0], cardOut = g === 'pokemon' ? await pokemonDetail(top.c.id) : mtgCard(top.c, today());
    const alts = ranked.slice(1, 10).map(x => g === 'pokemon' ? { id: x.c.id, name: x.c.name, number: x.c.localId, set: setOf(x.c.id), thumb: x.c.image ? x.c.image + '/low.webp' : '' } : { id: x.c.id, name: x.c.name, number: x.c.collector_number, set: x.c.set_name, thumb: (x.c.image_uris || (x.c.card_faces && x.c.card_faces[0].image_uris) || {}).small || '' });
    const conf = g === 'pokemon' ? (top.nm > 0.8 && top.num ? 'high' : top.nm > 0.8 || top.num && top.tot ? 'medium' : 'low') : (top.num ? 'high' : 'medium');
    return { status: 'ok', game: g, card: cardOut, alts, read, conf, parsed: p };
  }
  async function byId(game, id) { return game === 'pokemon' ? pokemonDetail(id) : mtgCard(await Net.json(`${SCRY}/cards/${enc(id)}`), today()); }
  // Manual search by name (and optional number)
  async function search(game, q) {
    if (game === 'pokemon') { const l = await Net.json(`${TCGDEX}/cards?name=${enc(q)}`); return l.filter(c => !/^(A\d|P-A|B\d)/.test(c.id)).slice(0, 40).map(c => ({ id: c.id, name: c.name, number: c.localId, set: setOf(c.id), thumb: c.image ? c.image + '/low.webp' : '' })); }
    let name = q; try { name = (await Net.json(`${SCRY}/cards/named?fuzzy=${enc(q)}`)).name; } catch {}
    const r = await Net.json(`${SCRY}/cards/search?unique=prints&order=released&q=${enc(`!"${name}"`)}`).catch(() => Net.json(`${SCRY}/cards/search?unique=prints&q=${enc(q)}`));
    return (r.data || []).slice(0, 40).map(c => ({ id: c.id, name: c.name, number: c.collector_number, set: c.set_name, thumb: (c.image_uris || (c.card_faces && c.card_faces[0].image_uris) || {}).small || '' }));
  }

  // ---------- recent sales (Worker -> CardSight) with eBay link fallback ----------
  function deviceId() { let d = localStorage.getItem('cpg.device'); if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem('cpg.device', d); } return d; }
  async function recentSales(c) {
    const api = (window.CPG_CONFIG && CPG_CONFIG.SALES_API || '').replace(/\/$/, ''), q = P.salesQuery(c), link = P.ebaySoldUrl(c);
    if (!api || q.length < 3) return { ok: false, fallback: true, reason: api ? 'query' : 'not_configured', link };
    const k = 'cpg.sales:' + q.toLowerCase();
    try { const h = JSON.parse(localStorage.getItem(k) || 'null'); if (h && Date.now() - h.t < 864e5) return { ...h.v, link }; } catch {}
    try {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
      const r = await fetch(`${api}/v1/sales?q=${enc(q)}`, { headers: { 'X-Device-Id': deviceId() }, signal: ac.signal }).finally(() => clearTimeout(t));
      const v = await r.json(); if (!v.ok) return { ok: false, fallback: true, reason: v.reason || 'error', link };
      try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch {}
      return { ...v, link };
    } catch { return { ok: false, fallback: true, reason: 'network', link }; }
  }
  // ---------- listed now (Worker -> eBay Browse): active Buy It Now ASKING prices, never sales ----------
  const ebayActiveUrl = c => `https://www.ebay.com/sch/i.html?_nkw=${enc(P.salesQuery(c))}&LH_BIN=1`;
  async function listedNow(c) {
    const api = (window.CPG_CONFIG && CPG_CONFIG.SALES_API || '').replace(/\/$/, ''), q = P.salesQuery(c), link = ebayActiveUrl(c);
    if (!api || q.length < 3) return { ok: false, fallback: true, reason: 'not_configured', link };
    const k = 'cpg.listed:' + q.toLowerCase();
    try { const h = JSON.parse(localStorage.getItem(k) || 'null'); if (h && Date.now() - h.t < 3600e3) return { ...h.v, link }; } catch {}
    try {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
      const r = await fetch(`${api}/v1/listings?cat=${c.game === 'sports' ? 'sports' : 'tcg'}&q=${enc(q)}`, { headers: { 'X-Device-Id': deviceId() }, signal: ac.signal }).finally(() => clearTimeout(t));
      const v = await r.json(); if (!v.ok) return { ok: false, fallback: true, reason: v.reason || 'error', link };
      try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch {}
      return { ...v, link };
    } catch { return { ok: false, fallback: true, reason: 'network', link }; }
  }
  return { identify, byId, search, recentSales, listedNow, ebayActiveUrl, salesQuery: P.salesQuery, ebaySoldUrl: P.ebaySoldUrl };
})();
