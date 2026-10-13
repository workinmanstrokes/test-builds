const $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (v, c = 'USD') => (c === 'EUR' ? '€' : '$') + (+v).toFixed(2);
const store = { get: () => JSON.parse(localStorage.getItem('collection') || '[]'), set: v => { localStorage.setItem('collection', JSON.stringify(v)); renderCollection(); } };
let photo = null, current = null, stream = null;

// Tabs
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach(s => s.hidden = s.id !== 'tab-' + b.dataset.tab);
  if (b.dataset.tab === 'collection') renderCollection(); if (b.dataset.tab === 'grade') renderGradeTargets();
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
      st.textContent = 'No AI proxy set — reading card text on-device (free)…';
      if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const { data } = await Tesseract.recognize(photo, 'eng');
      const lines = data.lines.map(l => l.text.replace(/[^A-Za-z0-9'é\- /]/g, '').trim()).filter(t => /[A-Za-z]{3,}/.test(t));
      const num = (data.text.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/) || [])[1] || '';
      const stop = /^(Evolves|Stage|Basic|Put|From|Pokemon|Pokémon|Trainer|Energy|Weakness|Resistance|Retreat|Illus|Length|Weight|Creature|Instant|Sorcery|Effect|Monster|Spell|Trap)$/i;
      const cands = [...new Set(lines.slice(0, 4).flatMap(l => l.match(/\b[A-Z][a-zé'\-]{3,}(?: [A-Z][a-zé'\-]+)*/g) || []).map(w => w.split(' ').filter(x => !stop.test(x)).join(' ')).filter(w => w.length > 3))];
      let name = '';
      for (const c of cands.slice(0, 8)) { try { if ((await Adapters[game].search(c, num)).length) { name = c; break; } } catch {} }
      $('q').value = name; $('qnum').value = num;
      st.textContent = name ? `Read "${name}"${num ? ' #' + num : ''}. Check it, edit if wrong, then pick the match below.` : 'Could not read the name. Type it below.';
      if (name) await doSearch();
      else if (!cands.length) st.textContent = 'Could not read the name. Type it below.';
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
    <button id="addBtn" class="primary">Add to collection</button>`;
  if ($('compAdd')) $('compAdd').onclick = () => { const v = +$('compVal').value; if (!(v > 0) || !$('compSrc').value) return alert('Enter price and source');
    d.prices.unshift({ source: $('compSrc').value + ' (entered by you)', label: 'sold comp', value: v, currency: 'USD', date: $('compDate').value || today() }); $('prices').innerHTML = priceHtml(d); };
  $('addBtn').onclick = async () => { const col = store.get();
    col.unshift({ ...d, uid: Date.now().toString(36), added: today(), photo: photo ? await thumb(photo) : '', grade: null }); store.set(col);
    photo = null; $('shot').hidden = true; $('idBtn').disabled = true; $('addBtn').textContent = 'Added ✓'; $('addBtn').disabled = true; };
}

function renderCollection() {
  const col = store.get(); $('colCount').textContent = col.length ? `(${col.length})` : '';
  let tot = 0, priced = 0; col.forEach(c => { const p = bestPrice(c); if (p) { tot += p.value; priced++; } });
  $('total').textContent = money(tot); $('totalNote').textContent = `${priced} of ${col.length} cards priced in USD. Sum of each card's first USD source.`;
  $('colList').innerHTML = col.length ? col.map(c => { const p = bestPrice(c);
    return `<div class="card">${c.photo || c.img ? `<img src="${esc(c.photo || c.img)}" alt="">` : ''}<div><b>${esc(c.name)}</b><span class="muted">${esc([c.set, c.number && '#' + c.number, c.variant].filter(Boolean).join(' · '))}</span><br>
    ${p ? `<b class="good">${money(p.value)}</b> <span class="muted">${esc(p.source)} · ${esc(p.date)}</span>` : '<span class="muted">no price</span>'}
    ${c.grade ? `<br><span>Centering ${esc(c.grade.front.lr)} L/R · ${esc(c.grade.front.tb)} T/B · est. cap PSA ${c.grade.cap}</span>` : ''}</div>
    <div style="flex:0;display:flex;flex-direction:column;gap:4px"><button data-sell="${c.uid}">Sell</button><button data-del="${c.uid}">✕</button></div></div>`; }).join('') : '<p class="muted">No cards yet. Scan one!</p>';
  $('colList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirm('Remove card?') && store.set(store.get().filter(c => c.uid !== b.dataset.del)));
  $('colList').querySelectorAll('[data-sell]').forEach(b => b.onclick = () => draftListing(store.get().find(c => c.uid === b.dataset.sell)));
}
$('exportBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(store.get(), null, 1)], { type: 'application/json' })); a.download = 'card-collection.json'; a.click(); };

// List for sale (M1 stub: drafts title/price/photos; real eBay listing comes in M2)
function draftListing(c) {
  const p = bestPrice(c), title = [c.set, c.name, c.number && '#' + c.number, c.variant, c.grade && `Centering ${c.grade.front.lr}`].filter(Boolean).join(' ').slice(0, 80);
  const photos = [c.photo, ...(c.grade?.photos || [])].filter(Boolean);
  const txt = `${title}\n\nCondition: Raw/ungraded${c.grade ? ` – measured centering front ${c.grade.front.lr} L/R, ${c.grade.front.tb} T/B` : ''}.\nShips in sleeve + top loader.`;
  $('listBody').innerHTML = `<label>Title (${title.length}/80)<input id="lt" value="${esc(title)}"></label>
   <label>Price<input id="lp" type="number" step="0.01" value="${p ? p.value.toFixed(2) : ''}"></label>
   <p class="muted">${p ? `Suggested from ${esc(p.source)} (${esc(p.date)}). ` : 'No price data — set your own. '}Real eBay posting arrives in M2.</p>
   <label>Description<textarea id="ld" rows="5">${esc(txt)}</textarea></label>
   <div class="preview-row">${photos.map(s => `<img src="${esc(s)}" alt="">`).join('') || '<span class="muted">No photos saved</span>'}</div>`;
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
  const cap = centeringGrade(f, b), col = store.get();
  out.innerHTML = `<div class="price"><b>Front</b> L/R ${f.lr} · T/B ${f.tb} <span class="${f.max <= 55 ? 'good' : 'bad'}">${f.max <= 55 ? 'PSA 10 range (≤55/45)' : 'outside PSA 10 (55/45)'}</span></div>
   ${b.ok ? `<div class="price"><b>Back</b> L/R ${b.lr} · T/B ${b.tb} <span class="${b.max <= 75 ? 'good' : 'bad'}">${b.max <= 75 ? 'OK (≤75/25)' : 'over 75/25'}</span></div>` : '<p class="muted">Back not measured.</p>'}
   <p>Centering alone caps this card at about <b>PSA ${cap}</b>. Corners, edges and surface are not scored yet.</p>
   ${col.length ? `<div class="row"><select id="attachTo">${col.map(c => `<option value="${c.uid}">${esc(c.name)} ${esc(c.number || '')}</option>`).join('')}</select><button id="attachBtn">Attach to card</button></div>` : '<p class="muted">Scan a card into your collection to attach this result.</p>'}`;
  if ($('attachBtn')) $('attachBtn').onclick = async () => { const ph = []; for (const s of gShots.slice(0, 6)) ph.push(await thumb(s));
    store.set(store.get().map(c => c.uid === $('attachTo').value ? { ...c, grade: { front: f, back: b, cap, date: today(), photos: ph } } : c)); $('attachBtn').textContent = 'Attached ✓'; };
};
renderCollection();
