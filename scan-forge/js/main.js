import * as api from './api.js';
import { startCapture, covDraw, SECTORS } from './capture.js';
import { doctor } from './doctor.js';
import { scaleSTL, shareFile } from './stl.js';
const $ = (q, el = document) => el.querySelector(q), view = $('#view');
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let tt; export function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2800); }
const STAGES = [['prep', 'Preparing photos'], ['features', 'Finding features'], ['matching', 'Matching photos'], ['sparse', 'Solving camera positions'], ['undistort', 'Correcting lens'], ['dense', 'Building dense points'], ['mesh', 'Meshing'], ['scale', 'Reading scale card'], ['repair', 'Repairing for print']];
const ICON3D = '<svg viewBox="0 0 24 24"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>';
let session = null, viewer = null, poll = null;
const ago = t => { const s = (Date.now() / 1000 - t); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t * 1000).toLocaleDateString(); };
const mins = s => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';

async function ping() {
  const p = $('#srv'); if (!api.configured()) { p.className = 'pill off'; p.lastChild.textContent = 'Not set up'; return false; }
  try { const h = await api.health(); p.className = 'pill on'; p.lastChild.textContent = h.busy ? 'Box busy' : 'Box online'; return h; }
  catch { p.className = 'pill off'; p.lastChild.textContent = 'Box offline'; return false; }
}
$('#srv').onclick = () => location.hash = '#/settings';

function scanHome() {
  view.innerHTML = `<section class="hero"><span class="chip run">Mug-sized objects · true mm scale</span><h1>Scan an object,<br>print a copy.</h1>
  <p class="sub" style="margin-bottom:0">Walk a slow circle around it at three heights. The box builds a watertight STL sized for your Tina2S.</p></section>
  <ol class="steps">
   <li><span class="n">1</span><div><b>Print the A4 scale card</b><small>Print at 100% (actual size). The bar on the card should measure 100 mm.</small><div style="margin-top:8px"><a class="btn ghost" id="card" href="#">Open scale card PDF</a></div></div></li>
   <li><span class="n">2</span><div><b>Set the object in the ring</b><small>Bright, even light. Matte, textured objects scan best. Spray shiny or clear ones matte.</small></div></li>
   <li><span class="n">3</span><div><b>Orbit three times</b><small>Low, middle and high. Keep the whole card in frame. Auto mode shoots each new position when it's sharp.</small></div></li>
  </ol>
  <div style="margin-top:16px"><button class="btn primary block" id="go">Start scan</button></div>
  ${api.configured() ? '' : '<p class="note" style="margin-top:12px">Connect your box in <a href="#/settings">Settings</a> before uploading. You can still capture now.</p>'}`;
  $('#card').onclick = e => { e.preventDefault(); openCard(); };
  $('#go').onclick = () => startCapture({ toast, onCancel: () => route(), onDone: (shots, cov) => { session = { shots, cov, name: '' }; location.hash = '#/review'; route(); } });
}
async function openCard() {
  try { const r = await fetch('card/scale-card-a4.pdf'); const b = await r.arrayBuffer(); await shareFile(b, 'scan-forge-scale-card-a4.pdf', 'application/pdf'); }
  catch (e) { toast('Could not open card: ' + e.message); }
}
function review() {
  if (!session || !session.shots.length) { location.hash = '#/scan'; return; }
  const s = session, n = s.shots.length, covered = s.cov.flat().filter(Boolean).length;
  const rings = s.cov.map(r => r.filter(Boolean).length);
  const weak = rings.map((c, i) => c < SECTORS * .6 ? ['low', 'middle', 'high'][i] : null).filter(Boolean);
  view.innerHTML = `<a class="back" href="#/scan">‹ New scan</a><h1>Review photos</h1><p class="sub">${n} photos · ${Math.round(100 * covered / (3 * SECTORS))}% of positions covered</p>
  <div class="card" style="display:flex;gap:16px;align-items:center"><svg class="covbig" style="width:120px;height:120px;margin:0" viewBox="0 0 100 100"></svg>
   <div><div class="kv"><span>Low</span><b>${rings[0]}/${SECTORS}</b><span>Middle</span><b>${rings[1]}/${SECTORS}</b><span>High</span><b>${rings[2]}/${SECTORS}</b></div>
   ${n < 24 ? '<p class="chip bad" style="margin-top:10px">Take at least 24 photos</p>' : weak.length ? `<p class="chip warn" style="margin-top:10px">Thin on the ${weak.join(' and ')} ring</p>` : '<p class="chip ok" style="margin-top:10px">Good coverage</p>'}</div></div>
  <label class="f"><span>Name</span><input id="nm" maxlength="60" placeholder="e.g. Coffee mug" value="${esc(s.name)}"></label>
  <div class="row"><button class="btn ghost" id="more">Add photos</button><button class="btn primary" id="up" ${n < 12 ? 'disabled' : ''}>Upload ${n}</button></div>
  <div id="upst" style="display:none" class="card"><b id="upt">Uploading…</b><div class="bar" style="margin-top:10px"><i id="upb"></i></div></div>
  <h2>Photos</h2><div class="grid3">${s.shots.map((p, i) => `<div class="ph"><img src="${p.url}" alt="" loading="lazy"><button data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>`;
  covDraw($('.covbig'), s.cov);
  $('#nm').oninput = e => s.name = e.target.value;
  view.querySelectorAll('.grid3 button').forEach(b => b.onclick = () => { const p = s.shots.splice(+b.dataset.i, 1)[0]; if (p.cell) s.cov[p.cell.r][p.cell.k]--; review(); });
  $('#more').onclick = () => startCapture({ toast, onCancel: review, onDone: (sh, cov) => { s.shots.push(...sh); cov.forEach((r, i) => r.forEach((v, k) => s.cov[i][k] += v)); review(); } });
  $('#up').onclick = async () => {
    if (!api.configured()) { toast('Connect your box in Settings first'); location.hash = '#/settings'; return; }
    $('#up').disabled = true; $('#more').disabled = true; $('#upst').style.display = 'block';
    try {
      const id = await api.upload(s.name || 'Scan', s.shots.map(p => p.blob), f => { $('#upb').style.width = (f * 100) + '%'; $('#upt').textContent = `Uploading ${Math.round(f * n)} of ${n}`; });
      s.shots.forEach(p => URL.revokeObjectURL(p.url)); session = null; location.hash = '#/job/' + id;
    } catch (e) { toast('Upload failed: ' + e.message); $('#up').disabled = false; $('#more').disabled = false; $('#upt').textContent = 'Upload stopped. Tap Upload to try again.'; }
  };
}
function chip(st) {
  return st.state === 'done' ? '<span class="chip ok">Ready</span>' : st.state === 'failed' ? '<span class="chip bad">Failed</span>' : st.state === 'running' ? `<span class="chip run">${Math.round((st.progress || 0) * 100)}%</span>` : st.state === 'queued' ? '<span class="chip warn">Queued</span>' : '<span class="chip">Uploading</span>';
}
async function library() {
  view.innerHTML = `<h1>Models</h1><p class="sub">Scans processed on your box.</p><div class="list" id="ls"><div class="empty">Loading…</div></div>`;
  if (!api.configured()) { $('#ls').innerHTML = `<div class="empty">${ICON3D}<p>Connect your box in <a href="#/settings">Settings</a> to see your scans.</p></div>`; return; }
  try {
    const js = await api.jobs();
    $('#ls').innerHTML = js.length ? js.map(j => `<a class="item" href="#/job/${j.id}"><div class="th">${ICON3D}</div><div class="meta"><b>${esc(j.name || 'Scan')}</b><small>${j.photo_count} photos · ${ago(j.created || j.updated)}${j.result ? ` · ${j.result.size_mm.map(v => Math.round(v)).join('×')} mm` : ''}</small></div>${chip(j)}</a>`).join('')
      : `<div class="empty">${ICON3D}<p>No scans yet. Start one from the Scan tab.</p></div>`;
  } catch (e) { $('#ls').innerHTML = `<div class="empty">${ICON3D}<p>Can't reach your box: ${esc(e.message)}</p></div>`; }
}
async function jobView(id) {
  const draw = st => {
    if (st.state === 'done') { location.hash = '#/model/' + id; return true; }
    const si = STAGES.findIndex(s => s[0] === st.stage);
    view.innerHTML = `<a class="back" href="#/library">‹ Models</a><h1>${esc(st.name || 'Scan')}</h1>
    <p class="sub">${st.state === 'failed' ? 'This scan could not be built.' : st.state === 'queued' ? 'Waiting for the box to finish another scan.' : st.state === 'uploading' ? 'Photos are still uploading.' : `Building on your box · ${mins(st.started ? Date.now() / 1000 - st.started : st.elapsed || 0)} so far`}</p>
    <div class="card">${st.state === 'failed' ? `<p class="chip bad">Failed</p><p>${esc(st.error)}</p>` : `<div class="bar"><i style="width:${Math.max(3, (st.progress || 0) * 100)}%"></i></div>`}
     <ol class="stages">${STAGES.map((s, i) => `<li class="${st.state === 'failed' ? (i < si ? 'done' : '') : i < si ? 'done' : i === si ? 'cur' : ''}"><i></i>${s[1]}</li>`).join('')}</ol></div>
    <p class="sub" style="font-size:14px">Typical time is 20 to 60 minutes for 60 photos. You can leave this screen; the scan keeps going.</p>
    <details class="card"><summary style="font-weight:700">Box log</summary><div class="logbox">${esc((st.log || []).join('\n'))}</div></details>`;
    return st.state === 'failed';
  };
  const tick = async () => { try { if (draw(await api.job(id))) clearInterval(poll); } catch (e) { toast(e.message); } };
  view.innerHTML = '<div class="empty">Loading…</div>'; await tick(); poll = setInterval(tick, 5000);
}
async function modelView(id) {
  view.innerHTML = '<div class="empty">Loading model…</div>';
  let st, glb;
  try { st = await api.job(id); glb = await api.modelBuf(id, 'glb'); } catch (e) { view.innerHTML = `<div class="empty">${ICON3D}<p>${esc(e.message)}</p></div>`; return; }
  const { createViewer, fitScale, fits, BED } = await import('./viewer.js');
  const r = st.result || {};
  view.innerHTML = `<a class="back" href="#/library">‹ Models</a><h1>${esc(st.name || 'Scan')}</h1>
  <p class="sub">${r.watertight ? 'Watertight' : 'Not watertight'} · ${(r.faces / 1000).toFixed(0)}k triangles · ${r.photos} photos · built in ${mins(st.elapsed || 0)}</p>
  <div class="viewer" id="vw"><div class="ov"><span class="chip" id="fit"></span><span class="chip">Tina2S 100×120×100</span></div>
   <div class="tools"><button id="ms" aria-label="Measure"><svg viewBox="0 0 24 24"><path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg></button><button id="rs" aria-label="Reset view"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg></button></div>
   <div class="mlabel" id="ml"></div></div>
  <div class="dims" id="dm"></div>
  <div class="card"><label class="f" style="margin:0"><span>Print size <b id="pct" style="color:var(--txt)">100%</b></span><input type="range" id="sc" min="10" max="300" step="1" value="100"></label>
   <div class="row" style="margin-top:6px"><button class="btn ghost" id="one">True size</button><button class="btn ghost" id="fb">Fit to bed</button></div></div>
  <button class="btn primary block" id="ex">Share STL to printer app</button>
  <p class="sub" style="font-size:13.5px;margin-top:10px">Scale from the card: ±${(r.card_rms_mm ?? 0).toFixed(2)} mm fit. Before printing, check <a href="#/doctor">Print Doctor</a> if the first layer or supports give trouble.</p>`;
  const ml = $('#ml');
  viewer = await createViewer($('#vw'), glb, { onMeasure: d => { ml.style.display = 'block'; ml.textContent = d == null ? 'Tap a second point' : `${d.toFixed(1)} mm`; } });
  let k = 1;
  const upd = () => {
    const s = viewer.size(), ok = fits(s);
    $('#dm').innerHTML = [['Width', s.x, BED.x], ['Depth', s.y, BED.y], ['Height', s.z, BED.z]].map(([n, v]) => `<div class="${ok ? '' : 'over'}"><small>${n}</small><b>${v.toFixed(1)}</b> mm</div>`).join('');
    const f = $('#fit'); f.className = 'chip ' + (ok ? 'ok' : 'bad'); f.textContent = ok ? 'Fits the bed' : 'Too big for the bed';
    $('#pct').textContent = Math.round(k * 100) + '%'; $('#sc').value = Math.round(k * 100);
  };
  const set = v => { k = v; viewer.setScale(k); upd(); };
  $('#sc').oninput = e => set(+e.target.value / 100);
  $('#one').onclick = () => set(1);
  $('#fb').onclick = () => { viewer.setScale(1); const f = fitScale(viewer.size()); set(f >= 1 ? 1 : Math.floor(f * 980) / 1000); toast(f >= 1 ? 'Already fits at true size' : 'Scaled to fit the bed'); };
  $('#rs').onclick = () => viewer.reset();
  $('#ms').onclick = () => { const on = !$('#ms').classList.contains('on'); $('#ms').classList.toggle('on', on); viewer.setMeasure(on); ml.style.display = on ? 'block' : 'none'; ml.textContent = 'Tap two points on the model'; };
  $('#ex').onclick = async () => {
    const b = $('#ex'); b.disabled = true; b.textContent = 'Preparing STL…';
    try { const stl = scaleSTL(await api.modelBuf(id, 'stl'), k); const nm = (st.name || 'scan').replace(/[^A-Za-z0-9_-]+/g, '-') + (k !== 1 ? `-${Math.round(k * 100)}pct` : '') + '.stl';
      const how = await shareFile(stl, nm); if (how === 'downloaded') toast('STL saved'); }
    catch (e) { if (e.name !== 'AbortError' && !/cancel/i.test(e.message)) toast('Share failed: ' + e.message); }
    finally { b.disabled = false; b.textContent = 'Share STL to printer app'; }
  };
  upd();
}
function settings() {
  const c = api.cfg();
  view.innerHTML = `<h1>Settings</h1><p class="sub">Your box runs the scans. Enter its tunnel address and access code once.</p>
  <div class="card"><label class="f"><span>Box address</span><input id="u" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://scan.example.com" value="${esc(c.url)}"></label>
  <label class="f"><span>Access code</span><input id="k" type="password" autocapitalize="off" autocorrect="off" placeholder="From the box" value="${esc(c.code)}"></label>
  <div class="row"><button class="btn ghost" id="t">Test</button><button class="btn primary" id="s">Save</button></div><p id="res" class="sub" style="margin:12px 0 0"></p></div>
  <div class="card"><b>About</b><div class="kv" style="margin-top:8px"><span>Version</span><b>0.1.0 (M1)</b><span>Printer</span><b>Tina2S · 100×120×100 mm</b><span>Processing</span><b>COLMAP + OpenMVS on CPU</b></div></div>`;
  const test = async () => { $('#res').textContent = 'Checking…'; try { const h = await api.health({ url: $('#u').value.trim().replace(/\/+$/, ''), code: $('#k').value.trim() }); $('#res').innerHTML = `<span class="chip ok">Connected</span> ${h.busy ? 'Box is building a scan' : 'Box is idle'}${h.queued ? ` · ${h.queued} queued` : ''}`; return true; } catch (e) { $('#res').innerHTML = `<span class="chip bad">No connection</span> ${esc(e.message)}`; return false; } };
  $('#t').onclick = test;
  $('#s').onclick = async () => { api.setCfg({ url: $('#u').value, code: $('#k').value }); toast('Saved'); await test(); ping(); };
}
function route() {
  clearInterval(poll); if (viewer) { viewer.dispose(); viewer = null; }
  const h = location.hash.replace(/^#\/?/, '') || 'scan', [p, ...rest] = h.split('/'), arg = rest.join('/');
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === ({ review: 'scan', job: 'library', model: 'library' }[p] || p)));
  view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  scrollTo(0, 0);
  ({ scan: scanHome, review, library, job: () => jobView(arg), model: () => modelView(arg), doctor: () => doctor(view, arg), settings }[p] || scanHome)();
}
addEventListener('hashchange', route); route(); ping(); setInterval(ping, 30000);
