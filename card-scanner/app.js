const $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (v, c = 'USD') => (c === 'EUR' ? '€' : '$') + (+v).toFixed(2);
const store = { get: () => JSON.parse(localStorage.getItem('collection') || '[]'), set: v => { localStorage.setItem('collection', JSON.stringify(v)); renderCollection(); } };
let photo = null, current = null, stream = null;

// Tabs
const tech = () => localStorage.getItem('tech') === '1';
function go(tab) {
  document.querySelectorAll('nav button').forEach(x => { x.classList.toggle('on', x.dataset.tab === tab); x.setAttribute('aria-selected', x.dataset.tab === tab); });
  document.querySelectorAll('main section').forEach(s => s.hidden = s.id !== 'tab-' + tab); scrollTo(0, 0);
  if (tab === 'collection') renderCollection(); if (tab === 'wish') renderWish(); if (tab === 'settings') loadSettings(); if (tab === 'grade') gradeReset();
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
// Settings
function loadSettings() { $('proxyUrl').value = localStorage.getItem('proxyUrl') || ''; $('ocrOn').checked = localStorage.getItem('ocr') !== '0'; $('techOn').checked = tech();
  $('aiState').textContent = AI.available() ? 'AI vision: on' : 'AI vision: off (no server set) – on-device matching is used.'; }
$('saveSettings').onclick = () => { localStorage.setItem('proxyUrl', $('proxyUrl').value.trim()); localStorage.setItem('ocr', $('ocrOn').checked ? '1' : '0'); localStorage.setItem('tech', $('techOn').checked ? '1' : '0'); loadSettings(); $('saveSettings').textContent = 'Saved ✓'; setTimeout(() => $('saveSettings').textContent = 'Save', 1500); };
function syncChips() { document.querySelectorAll('.chip').forEach(c => { const on = c.dataset.game === $('game').value; c.classList.toggle('on', on); c.setAttribute('aria-checked', on); }); }
document.querySelectorAll('.chip').forEach(c => c.onclick = () => { $('game').value = c.dataset.game; localStorage.setItem('game', c.dataset.game); $('game').onchange(); });
$('game').onchange = () => { syncChips(); $('sportsFields').hidden = $('game').value !== 'sports'; $('q').placeholder = $('game').value === 'sports' ? 'Player name, e.g. Shohei Ohtani' : 'Card name, e.g. Charizard'; };

async function camera(videoEl) {
  try { stream = stream || await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }); videoEl.srcObject = stream; return true; }
  catch (e) { alert('Camera unavailable: ' + e.message + '. Use Upload instead.'); return false; }
}
function grab(videoEl, max = 1280) { const c = $('canvas'), s = Math.min(1, max / videoEl.videoWidth); c.width = videoEl.videoWidth * s; c.height = videoEl.videoHeight * s; c.getContext('2d').drawImage(videoEl, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .88); }
function readFile(f, max = 1280) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => { const i = new Image(); i.onload = () => { const c = $('canvas'), s = Math.min(1, max / Math.max(i.width, i.height)); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', .88)); }; i.src = fr.result; }; fr.readAsDataURL(f); }); }
const thumb = src => readFileFromUrl(src, 320);
async function readFileFromUrl(src, max) { const i = await loadImg(src), c = document.createElement('canvas'), s = Math.min(1, max / Math.max(i.width, i.height)); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .8); }
// ---- Photo capture: native camera / gallery (Capacitor) with browser file-input fallback ----
const Cam = () => (AI.native() ? Capacitor.registerPlugin('Camera') : null);
async function takePhoto(source) { // source: 'CAMERA' | 'PHOTOS'
  const c = Cam();
  if (c) { try { const p = await c.getPhoto({ quality: 92, resultType: 'dataUrl', source, correctOrientation: true, saveToGallery: false, width: 4000 }); return p.dataUrl; }
    catch (e) { if (!/cancel/i.test(e.message || '')) alert('Camera: ' + (e.message || e)); return null; } }
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (source === 'CAMERA') i.capture = 'environment';
    i.onchange = async () => res(i.files[0] ? await readFile(i.files[0], 4000) : null); i.click(); });
}
let quad = null;
const busy = t => { $('busy').hidden = !t; if (t) $('busyText').textContent = t; };
function showStage(on) { $('home').hidden = on; $('stage').hidden = !on; if (!on) { $('detail').innerHTML = ''; $('altBox').hidden = true; } }
function setAdjust(on) { $('adjustBar').hidden = !on; $('cropWrap').classList.toggle('adjust', on); }
async function setPhoto(src) {
  photo = src; quad = null; $('idBtn').disabled = false; $('results').innerHTML = ''; $('detail').innerHTML = ''; $('altBox').hidden = true; $('errBox').hidden = true;
  showStage(true); setAdjust(false); $('stageTitle').textContent = 'Your card'; $('idStatus').textContent = '';
  const img = $('shot'); img.src = src; img.hidden = false; $('cropWrap').hidden = false; busy('Finding your card…');
  await new Promise(r => img.complete && img.naturalWidth ? r() : (img.onload = r));
  let found = false; try { const d = await ID.detect(src); quad = d.quad; found = d.found; } catch { quad = [[0, 0], [1, 0], [1, 1], [0, 1]]; }
  drawCrop(); busy('');
  if (!found) { setAdjust(true); $('idStatus').textContent = 'We couldn’t spot the card’s edges. Drag the 4 dots onto the card corners, then tap “Looks good”.'; return; }
  $('idStatus').textContent = 'Found your card ✓'; await new Promise(r => setTimeout(r, 700)); identify();
}
$('backHome').onclick = () => { showStage(false); $('manualBox').open = false; };
$('retryBtn').onclick = () => identify();
$('errSearch').onclick = () => { $('errBox').hidden = true; openSearch(); };
$('openSearch').onclick = () => openSearch();
function openSearch() { $('manualBox').open = true; $('q').focus(); $('manualBox').scrollIntoView({ behavior: 'smooth' }); }
function showError(msg) { $('errText').textContent = msg; $('errBox').hidden = false; buzz([30, 60, 30]); }
function drawCrop() {
  const w = $('cropWrap'), r = $('shot').getBoundingClientRect(), base = w.getBoundingClientRect(); if (!quad) return;
  const pts = quad.map(([x, y]) => [r.left - base.left + x * r.width, r.top - base.top + y * r.height]);
  $('cropPoly').setAttribute('points', pts.map(p => p.join(',')).join(' '));
  w.querySelectorAll('.handle').forEach((h, i) => { h.style.left = pts[i][0] + 'px'; h.style.top = pts[i][1] + 'px'; });
}
document.querySelectorAll('#cropWrap .handle').forEach((h, i) => {
  h.onpointerdown = e => { e.preventDefault(); h.setPointerCapture(e.pointerId);
    h.onpointermove = ev => { const r = $('shot').getBoundingClientRect(); quad[i] = [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))]; drawCrop(); };
    h.onpointerup = () => { h.onpointermove = null; }; };
  h.onkeydown = e => { const d = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] }[e.key]; if (d) { e.preventDefault(); quad[i] = [quad[i][0] + d[0], quad[i][1] + d[1]]; drawCrop(); } };
});
addEventListener('resize', drawCrop);
$('resetCrop').onclick = () => { quad = [[0, 0], [1, 0], [1, 1], [0, 1]]; drawCrop(); };
$('camBtn').onclick = async () => { const p = await takePhoto('CAMERA'); if (p) await setPhoto(p); };
$('galBtn').onclick = async () => { const p = await takePhoto('PHOTOS'); if (p) await setPhoto(p); };
$('fileIn').onchange = async e => { if (!e.target.files[0]) return; await setPhoto(await readFile(e.target.files[0], 4000)); e.target.value = ''; };

// ---- Identification: AI vision (proxy) first → confirm against card databases + artwork; on-device fallback ----
async function croppedPhoto() { const { canvas } = await ID.rectify(photo, quad); return canvas.toDataURL('image/jpeg', 0.92); }
async function scanCard(game, step = () => {}) {
  const out = { ai: null, ranked: [], conf: 0, mode: 'device' };
  if (AI.available()) {
    step('Identifying with AI vision…');
    try { out.ai = await AI.identify(await croppedPhoto(), game === 'auto' ? '' : game); } catch (e) { out.aiError = e.message; }
  }
  const v = out.ai;
  if (v?.is_back) return { ...out, back: true };
  if (v && v.name) {
    out.mode = 'ai'; const g = v.game && v.game !== 'other' ? v.game : game; out.game = g;
    if (g === 'sports') return out;
    if (!Adapters[g]) return out;
    step('Confirming the exact print…');
    const r = await ID.run(photo, g, step, { name: v.name, number: v.number, total: v.total, setCode: v.setCode }, quad);
    let ranked = r.ranked;
    if (!ranked.length) ranked = await Adapters[g].search(v.name, v.number).catch(() => []);
    // boost prints that agree with what the AI read
    const nn = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    ranked.forEach(c => { c.score = (c.score || 0) + (nn(c.name) === nn(v.name) ? 0.3 : 0) + (v.number && nn(c.number) === nn(v.number) ? 0.5 : 0) + (v.setCode && (nn(c.number) === nn(v.setCode) || nn(c.setCode) === nn(v.setCode)) ? 0.4 : 0) + (v.set && nn(c.set).includes(nn(v.set).slice(0, 8)) ? 0.15 : 0); });
    ranked.sort((a, b) => b.score - a.score); out.ranked = ranked;
    const t = ranked[0]; out.conf = t ? Math.min(1, (v.confidence ?? 0.7) * 0.5 + (nn(t.name) === nn(v.name) ? 0.25 : 0) + (v.number && nn(t.number) === nn(v.number) || v.setCode && nn(t.number) === nn(v.setCode) ? 0.25 : 0)) : 0;
    return out;
  }
  if (game === 'auto' || game === 'sports') return out; // on-device fallback needs a specific TCG
  step(out.aiError ? `AI unavailable (${out.aiError}) – identifying on-device…` : 'Identifying on-device…');
  const r = await ID.run(photo, game, step, null, quad);
  return { ...out, back: r.back, ranked: r.ranked, conf: r.confidence, parsed: r.parsed, game };
}
$('idBtn').onclick = () => identify();
async function identify() {
  const st = $('idStatus'), btn = $('idBtn'), sel = $('game').value; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); $('results').innerHTML = ''; $('detail').innerHTML = '';
  setAdjust(false); $('errBox').hidden = true; $('altBox').hidden = true; st.textContent = ''; busy('Identifying…');
  const friendly = m => /Comparing|Confirming/.test(m) ? 'Finding the exact version…' : /Reading|Re-reading|AI vision/.test(m) ? 'Identifying…' : /Searching/.test(m) ? 'Looking it up…' : m;
  try {
    const r = await scanCard(sel, m => busy(tech() ? m : friendly(m)));
    if (r.back) { showError('That looks like the back of the card. Flip it over and scan the front.'); return; }
    if (r.game && r.game !== sel && $('game').querySelector(`option[value=${r.game}]`)) { $('game').value = r.game; $('game').onchange(); }
    const v = r.ai;
    if (r.mode === 'ai' && r.game === 'sports') {
      $('q').value = v.player || v.name; $('qnum').value = v.number; $('sYear').value = v.year; $('sBrand').value = v.brand || v.set; $('sPar').value = [v.variant, v.serial && '/' + v.serial.split('/').pop()].filter(Boolean).join(' ');
      st.textContent = `AI read: ${[v.year, v.brand || v.set, v.player || v.name, v.number && '#' + v.number, v.variant, v.serial].filter(Boolean).join(' · ')} (${Math.round((v.confidence || 0) * 100)}%)`; buzz(20); return doSearch();
    }
    if (!r.ranked.length) { showError(sel === 'auto' && !AI.available() ? 'Tell us the card type first – tap Pokémon, Magic, Yu-Gi-Oh!, Lorcana or Sports, then scan again.' : 'We couldn’t recognise this card. Try again with the card flat and well lit, or type its name.' + (tech() && r.aiError ? ` (${r.aiError})` : '')); return; }
    const top = r.ranked[0]; $('q').value = top.name; $('qnum').value = top.number || '';
    st.textContent = (r.conf >= 0.6 ? 'Here’s your card' : 'Our best guess – check below if it’s not right') + (tech() ? ` · ${Math.round(r.conf * 100)}% · ${r.mode === 'ai' ? 'AI vision + database' : 'on-device'}` : '');
    $('stageTitle').textContent = r.conf >= 0.6 ? 'We found it!' : 'Is this your card?';
    buzz(20); showList(r.ranked.slice(0, 9), true, r.conf < 0.6);
  } catch (e) { showError(navigator.onLine ? 'Something went wrong while identifying. Please try again.' + (tech() ? ` (${e.message})` : '') : 'You’re offline. Connect to the internet and try again.'); }
  finally { busy(''); btn.disabled = !photo; btn.removeAttribute('aria-busy'); }
}
function showList(list, autoOpen, showAlts) {
  $('results').innerHTML = list.map((c, i) => `<button class="card tile" data-i="${i}" aria-label="${esc(c.name)}${c.set ? ', ' + esc(c.set) : ''}${c.number ? ', number ' + esc(c.number) : ''}">
    ${c.img ? `<img src="${esc(c.img)}" loading="lazy" alt="">` : '<div class="noimg" aria-hidden="true">🃏</div>'}<b>${esc(c.name)}</b><span class="muted">${esc([c.set, c.number && '#' + c.number].filter(Boolean).join(' · '))}</span>${tech() && c.score != null ? `<span class="muted">score ${Math.round(Math.min(1, c.score) * 100)}</span>` : ''}</button>`).join('');
  $('results').querySelectorAll('.card').forEach(el => el.onclick = () => { $('altBox').hidden = true; showDetail(list[+el.dataset.i], list); });
  $('altBox').querySelector('h3').textContent = autoOpen ? 'Not right? Is it one of these?' : 'Pick your card';
  if (autoOpen && list.length) { showDetail(list[0], list); $('altBox').hidden = !showAlts; } else $('altBox').hidden = false;
}
$('searchBtn').onclick = () => doSearch();

async function doSearch(v = {}) {
  const game = $('game').value, q = $('q').value.trim(); if (!q) return;
  $('altBox').hidden = false; $('altBox').querySelector('h3').textContent = 'Searching…'; $('results').innerHTML = '<div class="spinner" aria-label="Searching"></div>'; $('detail').innerHTML = '';
  try {
    const list = await Adapters[game].search(q, $('qnum').value.trim(), { year: $('sYear').value, brand: $('sBrand').value, parallel: $('sPar').value, grade: $('sGrade').value });
    if (!list.length) { $('altBox').querySelector('h3').textContent = 'No cards found'; $('results').innerHTML = '<p class="muted">Check the spelling, or try just part of the name.</p>'; return; }
    if (v.set) list.sort((a, b) => (b.set || '').toLowerCase().includes(v.set.toLowerCase()) - (a.set || '').toLowerCase().includes(v.set.toLowerCase()));
    showList(list, false);
  } catch (e) { $('altBox').querySelector('h3').textContent = 'Search didn’t work'; $('results').innerHTML = `<div class="errbox"><p>${navigator.onLine ? 'The card database didn’t answer. Please try again.' : 'You’re offline.'}</p><button class="primary" id="searchRetry">Try again</button></div>`; $('searchRetry').onclick = () => doSearch(v); }
}

function priceHtml(c) {
  const ps = c.prices || [];
  return (ps.length ? ps.map(p => `<div class="price"><b>${money(p.value, p.currency)}</b> ${esc(p.label)}<br><span class="muted">${esc(p.source)} · ${esc(p.date || 'date n/a')}${p.url ? ` · <a href="${esc(p.url)}" target="_blank">view</a>` : ''}</span></div>`).join('')
    : '<p class="muted">No price data from connected sources for this card.</p>')
    + (c.links ? '<p class="muted">Check real sales (free):</p><div class="btns">' + c.links.map(([t, u]) => `<a class="file" href="${u}" target="_blank">${t}</a>`).join('') + '</div>' : '');
}
async function showDetail(c, alts) {
  $('detail').innerHTML = '<div class="result"><div class="spinner" aria-label="Loading price"></div><p class="muted">Getting today’s price…</p></div>';
  try { current = await Adapters[c.game].detail(c); } catch (e) { $('detail').innerHTML = `<div class="errbox" role="alert"><p>We couldn’t get the price right now.</p><button class="primary" id="retryDetail">Try again</button></div>`; $('retryDetail').onclick = () => showDetail(c, alts); return; }
  const d = current, bp = bestPrice(d), owned = store.get().find(x => x.game === d.game && x.id === d.id);
  $('detail').innerHTML = `<article class="result" aria-labelledby="resName">
    ${d.img ? `<img class="resImg" src="${esc(d.img)}" alt="${esc(d.name)} card">` : photo ? `<img class="resImg" src="${esc(photo)}" alt="Your card">` : ''}
    <h2 id="resName">${esc(d.name)}</h2>
    <p class="resSet">${esc([d.set, d.number && '#' + d.number + (d.setTotal ? '/' + d.setTotal : '')].filter(Boolean).join(' · '))}${d.variant ? ` · ${esc(d.variant)}` : ''}</p>
    <div class="bigPrice">${bp ? `<b>${money(bp.value)}</b><small>Market price · ${esc(bp.source.split(' (')[0])} · ${esc((bp.date || '').slice(0, 10))}</small>` : `<b class="na">No price yet</b><small>${d.game === 'sports' ? 'Check recent sales below' : 'This card has no listed price'}</small>`}</div>
    ${owned ? `<p class="muted">You already have ${owned.qty || 1} of these.</p>` : ''}
    <button id="addBtn" class="primary big">＋ Add to collection</button>
    <div class="btns three"><button id="gradeBtn" class="secondary">📐 Pre-grade</button><button id="sellBtn" class="secondary">🏷️ List for sale</button><button id="wishBtn" class="secondary">♡ Wishlist</button></div>
    <div class="btns"><button id="notRight" class="link">Not right?</button>${photo ? '<button id="adjustBtn" class="link">Adjust crop</button>' : ''}</div>
    <details><summary>All prices &amp; sources</summary><div id="prices">${priceHtml(d)}</div>
    ${d.game === 'sports' ? `<h4>Add a sale you found</h4><div class="row"><input id="compVal" type="number" step="0.01" placeholder="Sold for $" aria-label="Sold price"><input id="compSrc" placeholder="Where (e.g. eBay)" aria-label="Where it sold"></div><input id="compDate" type="date" aria-label="Sale date"><button id="compAdd" class="secondary">Add sale</button>` : ''}</details>
  </article>`;
  const addToCol = async () => { const col = store.get(), dup = col.find(x => x.game === d.game && x.id === d.id);
    if (dup) { dup.qty = (dup.qty || 1) + 1; store.set(col); return { uid: dup.uid, dup: dup.qty }; }
    const uid = Date.now().toString(36); col.unshift({ ...d, uid, added: today(), photo: photo ? await thumb(photo) : '', grade: null, qty: 1, tags: [], history: bp ? [{ d: today(), v: +bp.value.toFixed(2) }] : [] }); store.set(col); return { uid }; };
  $('addBtn').onclick = async () => { const r = await addToCol(); buzz(20); $('addBtn').textContent = r.dup ? `Added ✓ (you have ${r.dup})` : 'Added to collection ✓'; $('addBtn').disabled = true;
    if (r.dup) $('addBtn').textContent = `Already owned – now ×${r.dup}`; };
  $('gradeBtn').onclick = async () => { const r = owned ? { uid: owned.uid } : await addToCol(); gradeTarget = r.uid; go('grade'); };
  $('sellBtn').onclick = () => draftListing({ ...d, photo: photo || d.img, grade: owned?.grade });
  $('notRight').onclick = () => { if (alts && alts.length > 1) { $('altBox').hidden = false; $('altBox').querySelector('h3').textContent = 'Is it one of these?'; $('altBox').scrollIntoView({ behavior: 'smooth' }); } else openSearch(); $('manualBox').open = true; };
  if ($('adjustBtn')) $('adjustBtn').onclick = () => { $('detail').innerHTML = ''; $('altBox').hidden = true; setAdjust(true); $('idStatus').textContent = 'Drag the dots to the card corners, then tap “Looks good”.'; $('cropWrap').scrollIntoView({ behavior: 'smooth' }); };
  $('wishBtn').onclick = () => { const t = prompt('Tell me when the price drops to (optional, in $):', ''); if (t === null) return; const w = wish.get();
    w.unshift({ uid: Date.now().toString(36), game: d.game, id: d.id, name: d.name, set: d.set, number: d.number, setCode: d.setCode, img: d.img, target: +t || null, last: bp ? +bp.value.toFixed(2) : null });
    wish.set(w); $('wishBtn').textContent = '♥ On wishlist'; $('wishBtn').disabled = true; buzz(20); };
  if ($('compAdd')) $('compAdd').onclick = () => { const v = +$('compVal').value; if (!(v > 0) || !$('compSrc').value) return alert('Please enter the price and where it sold.');
    d.prices.unshift({ source: $('compSrc').value + ' (entered by you)', label: 'sold', value: v, currency: 'USD', date: $('compDate').value || today() }); showDetail(d, alts); };
  $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
let gradeTarget = null;

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
  $('total').textContent = money(tot); $('totalNote').textContent = `${n} card${n === 1 ? '' : 's'}${priced < col.length ? ` · ${col.length - priced} without a price` : ''}`;
  { let t = 0, k = 0; all.forEach(c => { k += c.qty || 1; t += val(c); }); $('homeTotal').textContent = money(t); $('homeCount').textContent = k ? `${k} card${k === 1 ? '' : 's'} · tap to view` : 'No cards yet'; }
  $('colList').innerHTML = col.length ? col.map(c => { const p = bestPrice(c);
    return `<div class="card">${c.photo || c.img ? `<img src="${esc(c.photo || c.img)}" alt="">` : ''}<div><b>${esc(c.name)}${c.qty > 1 ? ` ×${c.qty}` : ''}</b><span class="muted">${esc(GAMES[c.game] || '')} · ${esc([c.set, c.number && '#' + c.number, c.variant].filter(Boolean).join(' · '))}</span><br>
    ${p ? `<b class="good">${money(p.value)}</b> ${trend(c)}${tech() ? ` <span class="muted">${esc(p.source)} · ${esc(p.date)}</span>` : ''}` : '<span class="muted">No price</span>'}
    ${c.grade ? `<br><span>📐 Centering ${esc(c.grade.front.lr)} · up to PSA ${c.grade.cap}</span>` : ''}
    ${(c.tags || []).length ? `<br>${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join(' ')}` : ''}<span class="setc" data-set="${c.uid}"></span></div>
    <div class="side"><button data-sell="${c.uid}">🏷️ Sell</button><button data-grade="${c.uid}">📐 Grade</button><button data-share="${c.uid}">Share</button><button data-tag="${c.uid}">Tag</button><button data-del="${c.uid}" aria-label="Remove ${esc(c.name)}">🗑️</button></div></div>`; }).join('')
    : all.length ? '<div class="empty"><p>No cards match your search.</p></div>' : '<div class="empty"><div class="emptyArt">🗂️</div><h3>Your collection is empty</h3><p>Scan your first card to see what it’s worth.</p><button class="primary big" data-go="scan">📷 Scan a card</button></div>';
  $('colList').querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  const on = (attr, fn) => $('colList').querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => fn(store.get().find(c => c.uid === b.dataset[attr])));
  on('del', c => { if (!confirm('Remove card?')) return; const l = store.get(); const x = l.find(y => y.uid === c.uid); if (x.qty > 1) x.qty--; else l.splice(l.indexOf(x), 1); store.set(l); });
  on('sell', draftListing); on('share', shareCard); on('grade', c => { gradeTarget = c.uid; go('grade'); });
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
    ${x.last != null ? `Now <b class="good">${money(x.last)}</b>` : '<span class="muted">no price</span>'} ${x.target ? `· alert ≤ ${money(x.target)} ${x.last != null && x.last <= x.target ? '🔔' : ''}` : ''}</div><div class="side"><button data-wdel="${x.uid}">✕</button></div></div>`).join('') : '<div class="empty"><div class="emptyArt">♡</div><h3>No cards on your wishlist</h3><p>After you scan a card, tap ♡ Wishlist to watch its price.</p></div>';
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

// Pre-grade wizard: 6 guided photos with an example per step
const steps = [['Front of the card', 'Lay the card flat, face up, on a plain dark surface. Fit the whole card in the photo.', 'front'], ['Back of the card', 'Flip it over and take the same photo of the back.', 'back'],
  ['Top-left corner', 'Get close to the top-left corner so it fills the photo.', 'tl'], ['Top-right corner', 'Now the top-right corner, up close.', 'tr'], ['Bottom-left corner', 'Bottom-left corner, up close.', 'bl'], ['Bottom-right corner', 'Last one: bottom-right corner.', 'br']];
const EX = k => { const card = '<rect x="38" y="14" width="64" height="90" rx="6" fill="#f2c94c" stroke="#fff" stroke-width="2"/><rect x="45" y="22" width="50" height="40" rx="2" fill="#2d9cdb"/><rect x="45" y="68" width="50" height="4" fill="#fff8"/><rect x="45" y="76" width="40" height="4" fill="#fff8"/>';
  const back = '<rect x="38" y="14" width="64" height="90" rx="6" fill="#2f5bd3" stroke="#fff" stroke-width="2"/><ellipse cx="70" cy="59" rx="20" ry="26" fill="#f2c94c"/>';
  const zoom = { tl: [38, 14], tr: [102, 14], bl: [38, 104], br: [102, 104] }[k];
  return `<svg viewBox="0 0 140 118" role="img" aria-label="Example photo"><rect width="140" height="118" rx="10" fill="#1d2433"/>${k === 'back' ? back : card}${zoom ? `<circle cx="${zoom[0]}" cy="${zoom[1]}" r="16" fill="none" stroke="#3fb950" stroke-width="4"/><text x="70" y="114" fill="#cfd6e4" font-size="9" text-anchor="middle">close-up of this corner</text>` : ''}</svg>`; };
let gStep = 0, gShots = [];
function gradeReset() { gStep = 0; gShots = []; $('previews').innerHTML = ''; $('gradeOut').innerHTML = ''; $('analyzeBtn').hidden = true; $('captureBtn').disabled = false;
  const c = gradeTarget && store.get().find(x => x.uid === gradeTarget); $('gradeFor').textContent = c ? `For: ${c.name}${c.number ? ' #' + c.number : ''}` : ''; gradeStep(); }
function gradeStep() { const [t, h, k] = steps[Math.min(gStep, 5)];
  $('stepDots').innerHTML = steps.map((_, i) => `<i class="${i < gStep ? 'done' : i === gStep ? 'on' : ''}"></i>`).join('');
  if (gStep >= 6) { $('stepText').textContent = 'All done! 🎉'; $('stepHint').textContent = 'Tap “See my results”.'; $('stepExample').innerHTML = ''; $('captureBtn').disabled = true; $('skipStep').hidden = true; return; }
  $('stepText').textContent = `Step ${gStep + 1} of 6 – ${t}`; $('stepHint').textContent = h; $('stepExample').innerHTML = EX(k); $('skipStep').hidden = gStep < 1; }
function addShot(src) { gShots[gStep] = src; const i = new Image(); i.src = src; i.alt = steps[gStep][0]; $('previews').appendChild(i); gStep++; buzz(15); gradeStep(); $('analyzeBtn').hidden = !gShots[0]; }
$('skipStep').onclick = () => { if (gStep < 6) { gStep++; gradeStep(); } };
$('gradeBack').onclick = () => go(gradeTarget ? 'collection' : 'scan');
$('captureBtn').onclick = async () => { if (gStep >= 6) return; const p = await takePhoto('CAMERA'); if (p) addShot(await readFileFromUrl(p, 2000)); };
$('gfileIn').onchange = async e => { if (e.target.files[0] && gStep < 6) addShot(await readFile(e.target.files[0])); e.target.value = ''; };
$('analyzeBtn').onclick = async () => {
  const out = $('gradeOut'); out.innerHTML = '<div class="spinner" aria-label="Checking"></div><p class="muted">Checking your photos…</p>';
  const f = await measureCentering(gShots[0]), b = gShots[1] ? await measureCentering(gShots[1]) : { ok: false };
  if (!f.ok) { out.innerHTML = '<div class="errbox" role="alert"><p>We couldn’t see the card’s borders in the front photo. Retake it with the whole card on a plain, darker surface.</p><button class="primary" id="gradeRetry">Retake front photo</button></div>'; $('gradeRetry').onclick = () => { gradeReset(); }; return; }
  const cap = centeringGrade(f, b), col = store.get(), cond = await conditionEstimate(gShots[0], gShots.slice(2, 6).filter(Boolean));
  const good = f.max <= 55, word = n => n >= 9 ? 'Great' : n >= 7 ? 'Good' : n >= 5 ? 'Fair' : 'Worn';
  out.innerHTML = `<div class="result"><div class="bigPrice"><small>Best possible grade from centering</small><b>PSA ${cap}</b></div>
   <div class="price"><b>Front centering</b> ${f.lr} left/right · ${f.tb} top/bottom <span class="${good ? 'good' : 'bad'}">${good ? '✓ PSA 10 range' : 'Off-center for a 10'}</span></div>
   ${b.ok ? `<div class="price"><b>Back centering</b> ${b.lr} · ${b.tb} <span class="${b.max <= 75 ? 'good' : 'bad'}">${b.max <= 75 ? '✓ OK' : 'Off-center'}</span></div>` : ''}
   <div class="price"><b>Rough condition check</b><br>Corners: ${cond.corners != null ? word(cond.corners) : 'not photographed'} · Edges: ${word(cond.edges)} · Surface: ${word(cond.surface)}${cond.glare ? '<br><span class="bad">Glare in the photo – retake without reflections for a better surface check.</span>' : ''}</div>
   <p class="muted">These are estimates from your photos, not an official grade.</p>
   ${gradeTarget ? '' : col.length ? `<label>Save to card<select id="attachTo">${col.map(c => `<option value="${c.uid}">${esc(c.name)} ${esc(c.number || '')}</option>`).join('')}</select></label>` : ''}
   ${gradeTarget || col.length ? '<button id="attachBtn" class="primary big">Save to my card</button>' : '<p class="muted">Scan the card into your collection to save this result.</p>'}</div>`;
  if ($('attachBtn')) $('attachBtn').onclick = async () => { const ph = []; for (const s of gShots.filter(Boolean).slice(0, 6)) ph.push(await thumb(s)); const id = gradeTarget || $('attachTo').value;
    store.set(store.get().map(c => c.uid === id ? { ...c, grade: { front: f, back: b, cap, cond, date: today(), photos: ph } } : c)); $('attachBtn').textContent = 'Saved ✓'; $('attachBtn').disabled = true; buzz(20); };
};
// Onboarding, alerts, daily price refresh, PWA
let obI = 0; const obShow = i => { obI = i; document.querySelectorAll('.ob').forEach(o => o.hidden = +o.dataset.ob !== i); document.querySelectorAll('#obDots i').forEach((d, k) => d.classList.toggle('on', k === i)); $('obNext').textContent = i === 2 ? 'Get started' : 'Next'; };
const obDone = () => { localStorage.setItem('onboarded', '1'); $('onboard').close(); };
$('obNext').onclick = () => obI < 2 ? obShow(obI + 1) : obDone(); $('obSkip').onclick = obDone; $('onboardGo').onclick = obDone;
if (!localStorage.getItem('onboarded')) { obShow(0); $('onboard').showModal(); }
$('game').value = localStorage.getItem('game') || (AI.available() ? 'auto' : 'pokemon'); syncChips();
if (!AI.available() && $('game').value === 'auto') $('game').value = 'pokemon'; $('game').onchange();
renderCollection(); renderWish();
FX.load().then(() => { renderCollection(); refreshPrices(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
$('replayOnboard').onclick = () => { obShow(0); $('onboard').showModal(); };

// Offline awareness
const netState = () => { $('offline').hidden = navigator.onLine; };
addEventListener('online', netState); addEventListener('offline', netState); netState();
// Warm up the on-device model in the background after first paint
setTimeout(() => { if ('requestIdleCallback' in window) requestIdleCallback(() => ID.loadModel().catch(() => {})); }, 3000);
