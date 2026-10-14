// Card lookup + price adapters. Every price carries {source,date}. Never invents prices.
const today = () => new Date().toISOString().slice(0, 10);
const j = u => Net.json(u);
const P = (source, label, value, currency, date, url) => ({ source, label, value: +value, currency, date, url });
const proxy = () => (localStorage.getItem('proxyUrl') || '').replace(/\/$/, '');

const Adapters = {
  pokemon: {
    async search(q, num) {
      const list = await j(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(q)}&pagination:itemsPerPage=120`);
      let l = num ? list.filter(c => String(+c.localId) === String(+num) || c.localId === num) : list;
      if (!l.length) l = list;
      return l.slice(0, 120).map(c => ({ game: 'pokemon', id: c.id, name: c.name, number: c.localId, img: c.image ? c.image + '/low.webp' : '', set: c.id.split('-')[0] }));
    },
    async detail(c) {
      const d = await j(`https://api.tcgdex.net/v2/en/cards/${c.id}`);
      const pr = [], p = d.pricing || {};
      if (p.tcgplayer) for (const [k, v] of Object.entries(p.tcgplayer)) if (v && typeof v === 'object' && v.marketPrice != null)
        pr.push(P('TCGplayer via TCGdex', `${k} market`, v.marketPrice, p.tcgplayer.unit || 'USD', (p.tcgplayer.updated || '').slice(0, 10), `https://www.tcgplayer.com/product/${v.productId}`));
      if (p.cardmarket && p.cardmarket.trend != null) pr.push(P('Cardmarket via TCGdex', 'trend', p.cardmarket.trend, p.cardmarket.unit || 'EUR', (p.cardmarket.updated || '').slice(0, 10)));
      if (p.cardmarket && p.cardmarket['trend-holo'] != null) pr.push(P('Cardmarket via TCGdex', 'holo trend', p.cardmarket['trend-holo'], p.cardmarket.unit || 'EUR', (p.cardmarket.updated || '').slice(0, 10)));
      return { ...c, set: d.set?.name, setTotal: d.set?.cardCount?.official, rarity: d.rarity, variant: Object.entries(d.variants || {}).filter(e => e[1]).map(e => e[0]).join(', '), img: d.image ? d.image + '/high.webp' : c.img, prices: pr };
    }
  },
  magic: {
    async search(q, num) {
      const qq = `!"${q}"` + (num ? ` cn:${num}` : '');
      let d; try { d = await j(`https://api.scryfall.com/cards/search?unique=prints&q=${encodeURIComponent(qq)}`); }
      catch { d = await j(`https://api.scryfall.com/cards/search?unique=prints&q=${encodeURIComponent(q)}`); }
      const data = d.data.sort((a, b) => (b.name.toLowerCase() === q.toLowerCase()) - (a.name.toLowerCase() === q.toLowerCase()));
      return data.slice(0, 40).map(this.map);
    },
    map: c => ({ game: 'magic', id: c.id, name: c.name, number: c.collector_number, set: c.set_name, setCode: c.set, rarity: c.rarity,
        img: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || '', imgLarge: c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '', variant: (c.finishes || []).join(', '), _raw: c }),
    async detail(c) {
      const d = c._raw || await j(`https://api.scryfall.com/cards/${c.id}`), pr = [], dt = today();
      const map = { usd: ['nonfoil', 'USD'], usd_foil: ['foil', 'USD'], usd_etched: ['etched', 'USD'], eur: ['nonfoil', 'EUR'], eur_foil: ['foil', 'EUR'] };
      for (const [k, [lab, cur]] of Object.entries(map)) if (d.prices?.[k]) pr.push(P('Scryfall (TCGplayer/Cardmarket, daily)', lab, d.prices[k], cur, dt + ' (fetched)', d.purchase_uris?.tcgplayer));
      const { _raw, ...rest } = c; return { ...rest, img: c.imgLarge || c.img, setCode: d.set, prices: pr };
    }
  },
  yugioh: {
    async search(q) {
      const d = await j(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(q)}&num=12&offset=0`);
      const out = [];
      for (const c of d.data) { const sets = c.card_sets?.length ? c.card_sets : [{}];
        for (const s of sets.slice(0, 12)) out.push({ game: 'yugioh', id: c.id + '|' + (s.set_code || ''), name: c.name, number: s.set_code || '', set: s.set_name || '', rarity: s.set_rarity || '', variant: s.set_rarity || '',
          img: c.card_images?.[0]?.image_url_small || '', _raw: c, _set: s }); }
      return out.slice(0, 60);
    },
    async detail(c) {
      const d = c._raw || (await j(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${String(c.id).split('|')[0]}`)).data[0], pr = [], dt = today(), cp = d.card_prices?.[0] || {};
      if (!c._set && c.number) c._set = (d.card_sets || []).find(s => s.set_code === c.number);
      if (c._set?.set_price && +c._set.set_price > 0) pr.push(P('YGOPRODeck (set print)', c._set.set_code + ' ' + (c._set.set_rarity || ''), c._set.set_price, 'USD', dt + ' (fetched)'));
      for (const [k, lab] of [['tcgplayer_price', 'TCGplayer'], ['cardmarket_price', 'Cardmarket'], ['ebay_price', 'eBay']])
        if (+cp[k] > 0) pr.push(P('YGOPRODeck → ' + lab, 'lowest print', cp[k], k === 'cardmarket_price' ? 'EUR' : 'USD', dt + ' (fetched)'));
      const { _raw, _set, ...rest } = c; return { ...rest, img: d.card_images?.[0]?.image_url || c.img, prices: pr };
    }
  },
  lorcana: {
    async search(q, num) {
      const d = await j(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(q)}`);
      let l = d.results || []; if (num) { const f = l.filter(c => String(c.collector_number) === String(+num)); if (f.length) l = f; }
      return l.slice(0, 20).map(c => ({ game: 'lorcana', id: c.id, name: c.name + (c.version ? ' – ' + c.version : ''), number: c.collector_number, set: c.set?.name, setCode: c.set?.code, rarity: c.rarity, img: c.image_uris?.digital?.small || '', _raw: c }));
    },
    async detail(c) {
      const d = c._raw || await j(`https://api.lorcast.com/v0/cards/${c.id}`), pr = [], dt = today();
      if (d.prices?.usd) pr.push(P('Lorcast (TCGplayer)', 'normal', d.prices.usd, 'USD', dt + ' (fetched)'));
      if (d.prices?.usd_foil) pr.push(P('Lorcast (TCGplayer)', 'foil', d.prices.usd_foil, 'USD', dt + ' (fetched)'));
      const { _raw, ...rest } = c; return { ...rest, img: d.image_uris?.digital?.normal || c.img, prices: pr };
    }
  },
  sports: {
    // No free sports-card database or price API exists; card details come from vision or manual fields.
    async search(q, num, f = {}) {
      return [{ game: 'sports', id: 'sp-' + Date.now(), name: q, number: num || '', set: [f.year, f.brand].filter(Boolean).join(' '), variant: f.parallel || '', grade: f.grade || '', img: '' }];
    },
    async detail(c) {
      const pr = [], px = proxy(), qs = new URLSearchParams({ q: sportsQuery(c) });
      if (px) for (const src of ['sportscardspro', 'ebay']) {
        try { const r = await j(`${px}/api/price?source=${src}&${qs}`); (r.prices || []).forEach(p => pr.push(p)); } catch (e) { /* source not configured */ }
      }
      return { ...c, prices: pr, links: sportsLinks(c) };
    }
  }
};
function sportsQuery(c) { return [c.set, c.name, c.number && '#' + c.number, c.variant, c.grade].filter(Boolean).join(' '); }
function sportsLinks(c) { const q = encodeURIComponent(sportsQuery(c));
  return [['eBay sold listings', `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`], ['130point sales', `https://130point.com/sales/?q=${q}`], ['SportsCardsPro', `https://www.sportscardspro.com/search-products?q=${q}&type=prices`]]; }
function bestPrice(card) { const ps = (card.prices || []).filter(p => p.value > 0); const u = ps.find(p => p.currency === 'USD');
  if (u) return u; const e = ps.find(p => p.currency === 'EUR'), r = FX.rate('EUR');
  return e && r ? { ...e, value: e.value * r, currency: 'USD', label: e.label + ` (€${e.value.toFixed(2)} → USD @${r.toFixed(3)})` } : null; }
// Free FX (open.er-api.com, no key), cached 24h
const FX = { d: JSON.parse(localStorage.getItem('fx') || 'null'),
  async load() { if (this.d && Date.now() - this.d.t < 864e5) return; try { const r = await j('https://open.er-api.com/v6/latest/USD'); this.d = { t: Date.now(), rates: r.rates, date: r.time_last_update_utc }; localStorage.setItem('fx', JSON.stringify(this.d)); } catch {} },
  rate(cur) { return this.d?.rates?.[cur] ? 1 / this.d.rates[cur] : null; } };
// Set size for completion tracking (free APIs), cached
async function setTotal(c) { const k = 'set:' + c.game + ':' + (c.setCode || c.set); const hit = localStorage.getItem(k); if (hit) return +hit; let n = null;
  try { if (c.game === 'pokemon') n = (await j(`https://api.tcgdex.net/v2/en/sets/${c.id.split('-').slice(0, -1).join('-')}`)).cardCount.official;
    else if (c.game === 'magic' && c.setCode) n = (await j(`https://api.scryfall.com/sets/${c.setCode}`)).card_count;
    else if (c.game === 'yugioh') n = ((await j('https://db.ygoprodeck.com/api/v7/cardsets.php')).find(s => s.set_name === c.set) || {}).num_of_cards; } catch {}
  if (n) localStorage.setItem(k, n); return n; }
