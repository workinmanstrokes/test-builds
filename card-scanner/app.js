const $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (v, c = 'USD') => (c === 'EUR' ? '€' : '$') + (+v).toFixed(2);
const store = { get: () => JSON.parse(localStorage.getItem('collection') || '[]'), set: v => { localStorage.setItem('collection', JSON.stringify(v)); renderCollection(); } };
let photo = null, current = null, stream = null;

// Tabs
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach(s => s.hidden = s.id !== 'tab-' + b.dataset.tab);
  if (b.dataset.tab === 'collection') renderCollection(); if (b.dataset.tab === 'wish') renderWish();
});
// Settings
$('settingsBtn').onclick = () => { $('proxyUrl').value = localStorage.getItem('proxyUrl') || ''; $('ocrOn').checked = localStorage.getItem('ocr') !== '0'; $('settings').showModal(); };
$('saveSettings').onclick = () => { localStorage.setItem('proxyUrl', $('proxyUrl').value.trim()); localStorage.setItem('ocr', $('ocrOn').checked ? '1' : '0'); };
$('game').onchange = () => { $('sportsFields').hidden = $('game').value !== 'sports'; $('q').placeholder = $('game').value === 'sports' ? 'Player name, e.g. Shohei Ohtani' : 'Card name, e.g. Charizard'; };

async function camera(videoEl) {
  try { stream = stream || await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }); videoEl.srcObject = stream; return true; }
  catch (e) { alert('Camera unavailable: ' + e.message + '. Use Upload instead.'); return false; }
}
function grab(videoEl, max = 1280) { const c = $('canvas'), s = Math.min(1, max / videoEl.videoWidth); c.width = videoEl.videoWidth * s; c.height = videoEl.videoHeight * s; c.getContext('2d').drawImage(videoEl, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .88); }
function readFile(f, max = 1280) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => { const i = new Image(); i.onload = () => { const c = $('canvas'), s = Math.min(1, max / Math.max(i.width, i.height)); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', .88)); }; i.src = fr.result; }; fr.readAsDataURL(f); }); }
const thumb = src => readFileFromUrl(src, 320);
async function readFileFromUrl(src, max) { const i = await loadImg(src), c = document.createElement('canvas'), s = Math.min(1, max / Math.max(i.width, i.height)); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .8); }
function setPhoto(src) { photo = src; $('shot').src = src; $('shot').hidden = false; $('video').hidden = true; $('idBtn').disabled = false; }

$('camBtn').onclick = async () => { $('video').hidden = false; $('shot').hidden = true; if (await camera($('video'))) $('snapBtn').disabled = false; };
$('snapBtn').onclick = () => setPhoto(grab($('video')));
$('fileIn').onchange = async e => e.target.files[0] && setPhoto(await readFile(e.target.files[0]));

// Identify: proxy vision (xAI) if configured, else free on-device OCR, then database check.
$('idBtn').onclick = async () => {
  const st = $('idStatus'), game = $('game').value, px = localStorage.getItem('proxyUrl');
  try {
    if (px) {
      st.textContent = 'Identifying with AI vision…';
      const r = await fetch(px.replace(/\/$/, '') + '/api/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: photo, gameHint: game }) });
      if (!r.ok) throw new Error('proxy ' + r.status); const v = await r.json();
      if (v.game && $('game').querySelector(`option[value=${v.game}]`)) $('game').value = v.game; $('game').onchange();
      $('q').value = v.name || ''; $('qnum').value = (v.number || '').split('/')[0];
      if (v.game === 'sports') { $('sYear').value = v.year || ''; $('sBrand').value = v.set || ''; $('sPar').value = v.variant || ''; }
      st.textContent = `AI read: ${[v.name, v.set, v.number, v.variant].filter(Boolean).join(' · ')} (confidence ${v.confidence ?? '?'}). Checking database…`;
      await doSearch(v);
    } else if (localStorage.getItem('ocr') !== '0') {
      st.textContent = 'Reading card text on-device (offline, free)…';
      const r = await readCard(photo);
      if (r.looksLikeBack) { photo = null; $('idBtn').disabled = true; st.textContent = 'This looks like the back of a card. Flip it and snap the front.'; buzz([30, 60, 30]); return; }
      const num = (r.text.match(/\b([A-Z]{0,4}-?\d{1,3})\s*\/\s*\d{1,3}\b/) || r.text.match(/\b([A-Z]{2,5}\d?-[A-Z]{0,2}\d{2,3})\b/) || [])[1] || '';
      let name = '';
      if (game === 'sports') {
        const g = sportsGuess(r.text); $('sYear').value = g.year; $('sBrand').value = g.brand; $('sPar').value = g.parallel;
        name = await wikiPlayer(g.nameCandidates) || g.nameCandidates[0] || ''; $('q').value = name; $('qnum').value = g.number;
        st.textContent = name ? `Read ${[g.year, g.brand, name, g.number && '#' + g.number, g.parallel].filter(Boolean).join(' ')}. Check fields, then Search.` : 'Could not read the player. Type it below.';
        if (name) await doSearch(); return;
      }
      const stop = /^(Evolves|Stage|Basic|Put|From|Pokemon|Pokémon|Trainer|Energy|Weakness|Resistance|Retreat|Illus|Length|Weight|Creature|Instant|Sorcery|Effect|Monster|Spell|Trap|Character|Action|Item)$/i;
      const cands = [...new Set([...r.nameLines, ...r.lines.slice(0, 4)].flatMap(l => l.match(/\b[A-Z][a-zé'\-]{2,}(?: [A-Z][a-zé'\-]+)*/g) || []).map(w => w.split(' ').filter(x => !stop.test(x)).join(' ')).filter(w => w.length > 3))];
      for (const c of cands.slice(0, 10)) { try { if ((await Adapters[game].search(c, num)).length) { name = c; break; } } catch {} }
      $('q').value = name; $('qnum').value = num.replace(/^0+(?=\d)/, '');
      st.textContent = name ? `Read "${name}"${num ? ' #' + num : ''}${r.cropped ? ' (auto-cropped)' : ''}. Pick the exact print below.` : 'Could not read the name. Type it below.';
      if (name) { buzz(20); await doSearch(); }
    } else st.textContent = 'AI identification is off (no proxy). Type the name below.';
  } catch (e) { st.textContent = 'Identify failed: ' + e.message + '. Use search below.'; }
};
$('searchBtn').onclick = () => doSearch();

async function doSearch(v = {}) {
  const game = $('game').value, q = $('q').value.trim(); if (!q) return;
  $('results').innerHTML = '<p class="muted">Searching…</p>'; $('detail').innerHTML = '';
  try {
    const list = await Adapters[game].search(q, $('qnum').value.trim(), { year: $('sYear').value, brand: $('sBrand').value, parallel: $('sPar').value, grade: $('sGrade').value });
    if (!list.length) { $('results').innerHTML = '<p class="muted">No matches.</p>'; return; }
    if (v.set) list.sort((a, b) => (b.set || '').toLowerCase().includes(v.set.toLowerCase()) - (a.set || '').toLowerCase().includes(v.set.toLowerCase()));
    window._list = list;
    $('results').innerHTML = `<p class="muted">${list.length} match${list.length > 1 ? 'es' : ''} — tap the exact print:</p>` + list.map((c, i) =>
      `<div class="card" data-i="${i}">${c.img ? `<img src="${esc(c.img)}" loading="lazy" alt="">` : ''}<div><b>${esc(c.name)}</b><span class="muted">${esc([c.set, c.number && '#' + c.number, c.rarity || c.variant].filter(Boolean).join(' · '))}</span></div></div>`).join('');
    $('results').querySelectorAll('.card').forEach(el => el.onclick = () => showDetail(list[+el.dataset.i]));
    if (list.length === 1) showDetail(list[0]);
  } catch (e) { $('results').innerHTML = `<p class="bad">Search failed: ${esc(e.message)}</p>`; }
}

function priceHtml(c) {
  const ps = c.prices || [];
  return (ps.length ? ps.map(p => `<div class="price"><b>${money(p.value, p.currency)}</b> ${esc(p.label)}<br><span class="muted">${esc(p.source)} · ${esc(p.date || 'date n/a')}${p.url ? ` · <a href="${esc(p.url)}" target="_blank">view</a>` : ''}</span></div>`).join('')
    : '<p class="muted">No price data from connected sources for this card.</p>')
    + (c.links ? '<p class="muted">Check real sales (free):</p><div class="btns">' + c.links.map(([t, u]) => `<a class="file" href="${u}" target="_blank">${t}</a>`).join('') + '</div>' : '');
}
async function showDetail(c) {
  $('detail').innerHTML = '<p class="muted">Loading prices…</p>';
  try { current = await Adapters[c.game].detail(c); } catch (e) { $('detail').innerHTML = `<p class="bad">${esc(e.message)}</p>`; return; }
  const d = current;
  $('detail').innerHTML = `<h2>${esc(d.name)}</h2>${d.img ? `<img class="big" src="${esc(d.img)}" alt="">` : ''}
    <p>${esc([d.set, d.number && '#' + d.number + (d.setTotal ? '/' + d.setTotal : ''), d.rarity].filter(Boolean).join(' · '))}${d.variant ? `<br><span class="muted">Variant/parallel: ${esc(d.variant)}</span>` : ''}</p>
    <div id="prices">${priceHtml(d)}</div>
    ${d.game === 'sports' ? `<details><summary>Add a sold comp you found</summary><div class="row"><input id="compVal" type="number" step="0.01" placeholder="Sold $"><input id="compSrc" placeholder="Source (e.g. eBay sold)"><input id="compDate" type="date"></div><button id="compAdd">Add comp</button></details>` : ''}
    <div class="btns"><button id="addBtn" class="primary">Add to collection</button><button id="wishBtn">♡ Wishlist</button></div>`;
  $('wishBtn').onclick = () => { const t = prompt('Alert me when price is at or below (USD, optional):', ''); const w = wish.get(); const bp = bestPrice(d);
    w.unshift({ uid: Date.now().toString(36), game: d.game, id: d.id, name: d.name, set: d.set, number: d.number, setCode: d.setCode, img: d.img, target: +t || null, last: bp ? +bp.value.toFixed(2) : null });
    wish.set(w); $('wishBtn').textContent = 'On wishlist ✓'; $('wishBtn').disabled = true; buzz(20); };
  if ($('compAdd')) $('compAdd').onclick = () => { const v = +$('compVal').value; if (!(v > 0) || !$('compSrc').value) return alert('Enter price and source');
    d.prices.unshift({ source: $('compSrc').value + ' (entered by you)', label: 'sold comp', value: v, currency: 'USD', date: $('compDate').value || today() }); $('prices').innerHTML = priceHtml(d); };
  $('addBtn').onclick = async () => { const col = store.get(), dup = col.find(x => x.game === d.game && x.id === d.id);
    if (dup) { dup.qty = (dup.qty || 1) + 1; store.set(col); $('addBtn').textContent = `Already owned – now ×${dup.qty}`; $('addBtn').disabled = true; buzz(20); return; }
    const bp = bestPrice(d); col.unshift({ ...d, uid: Date.now().toString(36), added: today(), photo: photo ? await thumb(photo) : '', grade: null, qty: 1, tags: [], history: bp ? [{ d: today(), v: +bp.value.toFixed(2) }] : [] }); buzz(20); store.set(col);
    photo = null; $('shot').hidden = true; $('idBtn').disabled = true; $('addBtn').textContent = 'Added ✓'; $('addBtn').disabled = true; };
}

const buzz = p => { try { navigator.vibrate?.(p); } catch {} };
const wish = { get: () => JSON.parse(localStorage.getItem('wishlist') || '[]'), set: v => { localStorage.setItem('wishlist', JSON.stringify(v)); renderWish(); } };
const trend = c => { const h = c.history || []; if (h.length < 2) return ''; const a = h[h.length - 2].v, b = h[h.length - 1].v, p = (b - a) / a * 100;
  return Math.abs(p) < 1 ? '<span class="muted">→</span>' : `<span class="${p > 0 ? 'good' : 'bad'}">${p > 0 ? '▲' : '▼'}${Math.abs(p).toFixed(0)}%</span>`; };
const GAMES = { pokemon: 'Pokémon', magic: 'Magic', yugioh: 'Yu-Gi-Oh', lorcana: 'Lorcana', sports: 'Sports' };
function renderCollection() {
  const all = store.get(), q = ($('colQ')?.value || '').toLowerCase(), gf = $('colGame')?.value || '', sort = $('colSort')?.value || 'added';
  $('colCount').textContent = all.length ? `(${all.length})` : '';
  let col = all.filter(c => (!gf || c.game === gf) && (!q || [c.name, c.set, c.number, c.variant, ...(c.tags || [])].join(' ').toLowerCase().includes(q)));
  const val = c => (bestPrice(c)?.value || 0) * (c.qty || 1);
  col.sort(sort === 'value' ? (a, b) => val(b) - val(a) : sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : sort === 'set' ? (a, b) => (a.set || '').localeCompare(b.set || '') || (parseInt(a.number) || 0) - (parseInt(b.number) || 0) : () => 0);
  let tot = 0, priced = 0, n = 0; col.forEach(c => { n += c.qty || 1; if (bestPrice(c)) { tot += val(c); priced++; } });
  $('total').textContent = money(tot); $('totalNote').textContent = `${n} cards (${priced}/${col.length} priced). EUR converted to USD at ${FX.d ? 'free daily rate (open.er-api.com)' : 'no rate yet'}.`;
  $('colList').innerHTML = col.length ? col.map(c => { const p = bestPrice(c);
    return `<div class="card">${c.photo || c.img ? `<img src="${esc(c.photo || c.img)}" alt="">` : ''}<div><b>${esc(c.name)}${c.qty > 1 ? ` ×${c.qty}` : ''}</b><span class="muted">${esc(GAMES[c.game] || '')} · ${esc([c.set, c.number && '#' + c.number, c.variant].filter(Boolean).join(' · '))}</span><br>
    ${p ? `<b class="good">${money(p.value)}</b> ${trend(c)} <span class="muted">${esc(p.source)} · ${esc(p.date)}</span>` : '<span class="muted">no price</span>'}
    ${c.grade ? `<br><span>Centering ${esc(c.grade.front.lr)} L/R · ${esc(c.grade.front.tb)} T/B · cap PSA ${c.grade.cap}</span>` : ''}
    ${(c.tags || []).length ? `<br>${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join(' ')}` : ''}<span class="setc" data-set="${c.uid}"></span></div>
    <div class="side"><button data-sell="${c.uid}">Sell</button><button data-share="${c.uid}">Share</button><button data-tag="${c.uid}">Tag</button><button data-del="${c.uid}">✕</button></div></div>`; }).join('') : `<p class="muted">${all.length ? 'No cards match.' : 'No cards yet. Scan one!'}</p>`;
  const on = (attr, fn) => $('colList').querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => fn(store.get().find(c => c.uid === b.dataset[attr])));
  on('del', c => { if (!confirm('Remove card?')) return; const l = store.get(); const x = l.find(y => y.uid === c.uid); if (x.qty > 1) x.qty--; else l.splice(l.indexOf(x), 1); store.set(l); });
  on('sell', draftListing); on('share', shareCard);
  on('tag', c => { const t = prompt('Tags (comma separated), e.g. binder, for trade, PC', (c.tags || []).join(', ')); if (t == null) return; store.set(store.get().map(x => x.uid === c.uid ? { ...x, tags: t.split(',').map(s => s.trim()).filter(Boolean) } : x)); });
  setCompletion(all);
}
async function setCompletion(all) {
  const groups = {}; all.forEach(c => { if (c.game === 'sports' || !c.set) return; (groups[c.game + '|' + c.set] ||= new Set()).add(c.number); });
  for (const el of $('colList').querySelectorAll('.setc')) { const c = all.find(x => x.uid === el.dataset.set); if (!c || c.game === 'sports' || c.game === 'lorcana') continue;
    const tot = await setTotal(c); if (tot) el.innerHTML = `<br><span class="muted">Set: ${groups[c.game + '|' + c.set].size}/${tot} owned</span>`; }
}
// Daily local price snapshots + wishlist alerts (runs on app open)
async function refreshPrices() {
  const day = today(); if (localStorage.getItem('lastRefresh') === day) return checkAlerts([]);
  const col = store.get(); for (const c of col) { if (c.game === 'sports') continue;
    try { const d = await Adapters[c.game].detail({ ...c }); const bp = bestPrice(d); c.prices = d.prices;
      if (bp) { c.history = (c.history || []).filter(h => h.d !== day); c.history.push({ d: day, v: +bp.value.toFixed(2) }); c.history = c.history.slice(-60); } } catch {} }
  store.set(col); const hits = [], w = wish.get();
  for (const x of w) { if (x.game === 'sports') continue; try { const bp = bestPrice(await Adapters[x.game].detail({ ...x })); if (bp) { x.last = +bp.value.toFixed(2); x.lastDate = bp.date; if (x.target && bp.value <= x.target) hits.push(x); } } catch {} }
  wish.set(w); localStorage.setItem('lastRefresh', day); checkAlerts(hits);
}
function checkAlerts(hits) { if (!hits.length) return; buzz([40, 40, 40]); $('alertBar').hidden = false; $('alertBar').innerHTML = '🔔 Price alert: ' + hits.map(x => `${esc(x.name)} is ${money(x.last)} (target ${money(x.target)})`).join('; '); }
function renderWish() {
  const w = wish.get(); $('wishList').innerHTML = w.length ? w.map(x => `<div class="card">${x.img ? `<img src="${esc(x.img)}" alt="">` : ''}<div><b>${esc(x.name)}</b><span class="muted">${esc([x.set, x.number && '#' + x.number].filter(Boolean).join(' · '))}</span><br>
    ${x.last != null ? `Now <b class="good">${money(x.last)}</b>` : '<span class="muted">no price</span>'} ${x.target ? `· alert ≤ ${money(x.target)} ${x.last != null && x.last <= x.target ? '🔔' : ''}` : ''}</div><div class="side"><button data-wdel="${x.uid}">✕</button></div></div>`).join('') : '<p class="muted">Nothing on your wishlist. Tap ♡ on a card to add it.</p>';
  $('wishList').querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => wish.set(wish.get().filter(x => x.uid !== b.dataset.wdel)));
}
['colQ', 'colGame', 'colSort'].forEach(id => $(id).oninput = renderCollection);
// Export / import
const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
$('exportBtn').onclick = () => dl('card-collection.json', JSON.stringify(store.get(), null, 1), 'application/json');
const CSV_COLS = ['game', 'name', 'set', 'number', 'variant', 'rarity', 'qty', 'tags', 'price_usd', 'price_source', 'price_date', 'id'];
const csvCell = v => /[",\n]/.test(v = String(v ?? '')) ? `"${v.replace(/"/g, '""')}"` : v;
$('csvBtn').onclick = () => dl('card-collection.csv', [CSV_COLS.join(','), ...store.get().map(c => { const p = bestPrice(c);
  return [c.game, c.name, c.set, c.number, c.variant, c.rarity, c.qty || 1, (c.tags || []).join(';'), p ? p.value.toFixed(2) : '', p?.source, p?.date, c.id].map(csvCell).join(','); })].join('\n'), 'text/csv');
function parseCSV(t) { const rows = []; let r = [], c = '', q = false; for (let i = 0; i < t.length; i++) { const ch = t[i];
  if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
  else if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); rows.push(r); r = []; c = ''; } else c += ch; }
  if (c || r.length) { r.push(c); rows.push(r); } return rows.filter(x => x.some(Boolean)); }
$('importIn').onchange = async e => { const f = e.target.files[0]; if (!f) return; const t = await f.text(); let items = [];
  if (f.name.endsWith('.json')) items = JSON.parse(t);
  else { const [h, ...rows] = parseCSV(t); items = rows.map(r => { const o = Object.fromEntries(h.map((k, i) => [k.trim(), r[i]]));
    return { game: o.game || 'sports', id: o.id || 'imp-' + Math.random().toString(36).slice(2), name: o.name, set: o.set, number: o.number, variant: o.variant, rarity: o.rarity, qty: +o.qty || 1, tags: (o.tags || '').split(';').filter(Boolean),
      prices: o.price_usd ? [{ source: (o.price_source || 'imported') + ' (imported)', label: 'imported', value: +o.price_usd, currency: 'USD', date: o.price_date || '' }] : [] }; }); }
  const col = store.get(); let added = 0, merged = 0;
  for (const it of items) { if (!it.name) continue; const d = col.find(x => x.game === it.game && x.id === it.id); if (d) { d.qty = (d.qty || 1) + (it.qty || 1); merged++; } else { col.push({ ...it, uid: it.uid || Date.now().toString(36) + Math.random().toString(36).slice(2, 5), added: it.added || today() }); added++; } }
  store.set(col); alert(`Imported ${added} new, merged ${merged} duplicates.`); e.target.value = ''; };
// Share a card image (Web Share API with file, fallback to download)
async function cardImage(c) { const W = 600, H = 860, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = '#0d1117'; x.fillRect(0, 0, W, H); const src = c.photo || c.img;
  if (src) try { const i = await loadImg(src); const s = Math.min(520 / i.width, 600 / i.height); x.drawImage(i, (W - i.width * s) / 2, 30, i.width * s, i.height * s); } catch {}
  const p = bestPrice(c); x.fillStyle = '#e6edf3'; x.font = 'bold 30px sans-serif'; x.fillText(c.name.slice(0, 32), 30, 680);
  x.font = '22px sans-serif'; x.fillStyle = '#8b949e'; x.fillText([c.set, c.number && '#' + c.number, c.variant].filter(Boolean).join(' · ').slice(0, 46), 30, 715);
  if (p) { x.fillStyle = '#3fb950'; x.font = 'bold 34px sans-serif'; x.fillText(money(p.value), 30, 765); x.fillStyle = '#8b949e'; x.font = '18px sans-serif'; x.fillText(`${p.source} · ${p.date}`.slice(0, 60), 30, 795); }
  if (c.grade) { x.fillStyle = '#e6edf3'; x.font = '20px sans-serif'; x.fillText(`Centering ${c.grade.front.lr} · ${c.grade.front.tb}`, 30, 830); }
  return new Promise(r => cv.toBlob(r, 'image/png')); }
async function shareCard(c) { const b = await cardImage(c), f = new File([b], 'card.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: c.name }); return; } catch {} }
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (c.name || 'card').replace(/\W+/g, '-') + '.png'; a.click(); }
// List for sale: copy-paste friendly eBay draft (real posting = M2)
function draftListing(c) {
  const p = bestPrice(c), title = [c.set, c.name, c.number && '#' + c.number, c.variant, c.grade && `Centering ${c.grade.front.lr}`].filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 80);
  const photos = [c.photo, ...(c.grade?.photos || [])].filter(Boolean);
  const specifics = [['Game', GAMES[c.game]], ['Card Name', c.name], ['Set', c.set], ['Card Number', c.number], ['Rarity', c.rarity], ['Parallel/Variety', c.variant], ['Graded', 'No'], ['Condition', 'Ungraded']].filter(x => x[1]);
  const desc = `${title}\n\n${specifics.map(([k, v]) => `${k}: ${v}`).join('\n')}${c.grade ? `\nMeasured centering (front): ${c.grade.front.lr} L/R, ${c.grade.front.tb} T/B` : ''}\n\nSee photos for exact condition. Ships in a penny sleeve + top loader in a bubble mailer.`;
  $('listBody').innerHTML = `<label>Title <span id="tc">(${title.length}/80)</span><input id="lt" maxlength="80" value="${esc(title)}"></label><button data-copy="lt">Copy title</button>
   <label>Price (USD)<input id="lp" type="number" step="0.01" value="${p ? p.value.toFixed(2) : ''}"></label><button data-copy="lp">Copy price</button>
   <p class="muted">${p ? `Suggested from ${esc(p.source)} (${esc(p.date)}). ` : 'No price data — set your own. '}Real eBay posting arrives in M2.</p>
   <label>Description + item specifics<textarea id="ld" rows="8">${esc(desc)}</textarea></label><button data-copy="ld">Copy description</button>
   <div class="preview-row">${photos.map((s, i) => `<a href="${esc(s)}" download="photo-${i + 1}.jpg"><img src="${esc(s)}" alt=""></a>`).join('') || '<span class="muted">No photos saved</span>'}</div>
   ${photos.length ? '<p class="muted">Tap a photo to save it, then add it in the eBay app.</p>' : ''}`;
  $('lt').oninput = () => $('tc').textContent = `(${$('lt').value.length}/80)`;
  $('listBody').querySelectorAll('[data-copy]').forEach(b => b.onclick = e => { e.preventDefault(); navigator.clipboard?.writeText($(b.dataset.copy).value); b.textContent = 'Copied ✓'; buzz(15); });
  $('copyList').onclick = e => { e.preventDefault(); navigator.clipboard?.writeText(`${$('lt').value}\n$${$('lp').value}\n\n${$('ld').value}`); e.target.textContent = 'Copied ✓'; };
  $('listDlg').showModal();
}

// Pre-Grade (from Phase 1 base): 6 guided photos + real centering measurement, attachable to a collection card
const steps = ['Front of card', 'Back of card', 'Top-left corner', 'Top-right corner', 'Bottom-left corner', 'Bottom-right corner'];
let gStep = 0, gShots = [];
function addShot(src) { gShots.push(src); const i = new Image(); i.src = src; $('previews').appendChild(i); gStep++;
  if (gStep < 6) $('stepText').textContent = `Step ${gStep + 1}/6 – ${steps[gStep]}`; else { $('captureBtn').disabled = true; $('stepText').textContent = 'All photos captured.'; }
  $('analyzeBtn').hidden = gShots.length < 1; }
$('gcamBtn').onclick = async () => { if (await camera($('gvideo'))) $('captureBtn').disabled = false; };
$('captureBtn').onclick = () => addShot(grab($('gvideo')));
$('gfileIn').onchange = async e => { if (e.target.files[0] && gStep < 6) addShot(await readFile(e.target.files[0])); e.target.value = ''; };
function renderGradeTargets() {}
$('analyzeBtn').onclick = async () => {
  const out = $('gradeOut'); out.innerHTML = '<p class="muted">Measuring borders…</p>';
  const f = await measureCentering(gShots[0]), b = gShots[1] ? await measureCentering(gShots[1]) : { ok: false };
  if (!f.ok) { out.innerHTML = '<p class="bad">Could not find the card borders on the front photo. Shoot flat on a plain, contrasting background with the whole card in frame.</p>'; return; }
  const cap = centeringGrade(f, b), col = store.get(), cond = await conditionEstimate(gShots[0], gShots.slice(2, 6));
  out.innerHTML = `<div class="price"><b>Front</b> L/R ${f.lr} · T/B ${f.tb} <span class="${f.max <= 55 ? 'good' : 'bad'}">${f.max <= 55 ? 'PSA 10 range (≤55/45)' : 'outside PSA 10 (55/45)'}</span></div>
   ${b.ok ? `<div class="price"><b>Back</b> L/R ${b.lr} · T/B ${b.tb} <span class="${b.max <= 75 ? 'good' : 'bad'}">${b.max <= 75 ? 'OK (≤75/25)' : 'over 75/25'}</span></div>` : '<p class="muted">Back not measured.</p>'}
   <div class="price"><b>Estimates</b> (photo-based, not a real grade): Corners ${cond.corners ?? 'n/a – add corner photos'} · Edges ${cond.edges} · Surface ${cond.surface}/10${cond.glare ? '<br><span class="bad">Glare detected – reshoot without reflections.</span>' : ''}</div>
   <p>Centering alone caps this card at about <b>PSA ${cap}</b>. Corner/edge/surface numbers are rough estimates only.</p>
   ${col.length ? `<div class="row"><select id="attachTo">${col.map(c => `<option value="${c.uid}">${esc(c.name)} ${esc(c.number || '')}</option>`).join('')}</select><button id="attachBtn">Attach to card</button></div>` : '<p class="muted">Scan a card into your collection to attach this result.</p>'}`;
  if ($('attachBtn')) $('attachBtn').onclick = async () => { const ph = []; for (const s of gShots.slice(0, 6)) ph.push(await thumb(s));
    store.set(store.get().map(c => c.uid === $('attachTo').value ? { ...c, grade: { front: f, back: b, cap, cond, date: today(), photos: ph } } : c)); $('attachBtn').textContent = 'Attached ✓'; };
};
// Onboarding, alerts, daily price refresh, PWA
if (!localStorage.getItem('onboarded')) $('onboard').showModal();
$('onboardGo').onclick = () => localStorage.setItem('onboarded', '1');
renderCollection(); renderWish();
FX.load().then(() => { renderCollection(); refreshPrices(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
$('replayOnboard').onclick = () => { $('settings').close(); $('onboard').showModal(); };
