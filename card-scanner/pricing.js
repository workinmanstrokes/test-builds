// Card lookup + price adapters. Every price carries {source,date}. Never invents prices.
const today = () => new Date().toISOString().slice(0, 10);
const j = async (u, o) => { const r = await fetch(u, o); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
const P = (source, label, value, currency, date, url) => ({ source, label, value: +value, currency, date, url });
const proxy = () => (localStorage.getItem('proxyUrl') || '').replace(/\/$/, '');

const Adapters = {
  pokemon: {
    async search(q, num) {
      const list = await j(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(q)}&pagination:itemsPerPage=40`);
      let l = num ? list.filter(c => String(+c.localId) === String(+num) || c.localId === num) : list;
      if (!l.length) l = list;
      return l.slice(0, 20).map(c => ({ game: 'pokemon', id: c.id, name: c.name, number: c.localId, img: c.image ? c.image + '/low.webp' : '', set: c.id.split('-')[0] }));
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
      return data.slice(0, 20).map(c => ({ game: 'magic', id: c.id, name: c.name, number: c.collector_number, set: c.set_name, rarity: c.rarity,
        img: c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '', variant: (c.finishes || []).join(', '), _raw: c }));
    },
    async detail(c) {
      const d = c._raw || await j(`https://api.scryfall.com/cards/${c.id}`), pr = [], dt = today();
      const map = { usd: ['nonfoil', 'USD'], usd_foil: ['foil', 'USD'], usd_etched: ['etched', 'USD'], eur: ['nonfoil', 'EUR'], eur_foil: ['foil', 'EUR'] };
      for (const [k, [lab, cur]] of Object.entries(map)) if (d.prices?.[k]) pr.push(P('Scryfall (TCGplayer/Cardmarket, daily)', lab, d.prices[k], cur, dt + ' (fetched)', d.purchase_uris?.tcgplayer));
      const { _raw, ...rest } = c; return { ...rest, prices: pr };
    }
  },
  yugioh: {
    async search(q) {
      const d = await j(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(q)}&num=20&offset=0`);
      const out = [];
      for (const c of d.data) { const sets = c.card_sets?.length ? c.card_sets : [{}];
        for (const s of sets.slice(0, 6)) out.push({ game: 'yugioh', id: c.id + '|' + (s.set_code || ''), name: c.name, number: s.set_code || '', set: s.set_name || '', rarity: s.set_rarity || '', variant: s.set_rarity || '',
          img: c.card_images?.[0]?.image_url_small || '', _raw: c, _set: s }); }
      return out.slice(0, 20);
    },
    async detail(c) {
      const d = c._raw, pr = [], dt = today(), cp = d.card_prices?.[0] || {};
      if (c._set?.set_price && +c._set.set_price > 0) pr.push(P('YGOPRODeck (set print)', c._set.set_code + ' ' + (c._set.set_rarity || ''), c._set.set_price, 'USD', dt + ' (fetched)'));
      for (const [k, lab] of [['tcgplayer_price', 'TCGplayer'], ['cardmarket_price', 'Cardmarket'], ['ebay_price', 'eBay']])
        if (+cp[k] > 0) pr.push(P('YGOPRODeck → ' + lab, 'lowest print', cp[k], k === 'cardmarket_price' ? 'EUR' : 'USD', dt + ' (fetched)'));
      const { _raw, _set, ...rest } = c; return { ...rest, img: d.card_images?.[0]?.image_url || c.img, prices: pr };
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
function bestPrice(card) { const ps = (card.prices || []).filter(p => p.currency === 'USD' && p.value > 0); return ps.length ? ps[0] : null; }
