/* Card PreGrade UI. All image analysis runs on-device in js/worker.js (GradeCore). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), qs = (s, r = document) => r.querySelector(s), qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const MAXDIM = 2400, HKEY = 'cpg.history.v1';
  const worker = new Worker('js/worker.js'); let seq = 0; const pending = new Map();
  worker.onmessage = e => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.ok ? p.res(e.data) : p.rej(new Error(e.data.error)); };
  const call = (op, img, quad) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); const buf = img.d.buffer.slice(0); worker.postMessage({ id, op, img: { w: img.w, h: img.h, buf }, quad }, [buf]); });
  const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); };
  const track = (n, p) => { try { window.TM && TM.event(n, p); } catch (e) {} };

  // ---------- navigation ----------
  let cur = 'home'; const stack = [];
  function show(id, push = true) { if (id === cur) return; if (push) { stack.push(cur); history.pushState({ s: id }, ''); } qsa('.screen').forEach(s => s.classList.toggle('active', s.id === id)); const prev = cur; cur = id; onLeave(prev); onEnter(id); }
  window.addEventListener('popstate', () => { if ($('sheet').classList.contains('open')) { closeSheet(); history.pushState({}, ''); return; } const to = stack.pop() || 'home'; show(to === 'working' ? 'home' : to, false); });
  function home() { stack.length = 0; show('home', false); history.pushState({ s: 'home' }, ''); }
  qsa('[data-back]').forEach(b => b.onclick = () => history.back()); qsa('[data-home]').forEach(b => b.onclick = home);
  function onEnter(id) { if (id === 'camera') startCam(); if (id === 'home') renderHistory(); }
  function onLeave(id) { if (id === 'camera') stopCam(); }

  // ---------- state ----------
  const S = { side: 'front', photo: {}, res: {}, card: {}, viewSide: 'front', layers: { centering: 1, print: 1, scratch: 1, edges: 1 } };
  function newScan() { S.side = 'front'; S.photo = {}; S.res = {}; S.card = {}; S.viewSide = 'front'; }

  // ---------- image input ----------
  function canvasFrom(src, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h); return c; }
  function imgData(c) { const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); return { w: c.width, h: c.height, d: d.data }; }
  async function fromFile(file) {
    let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
    const k = Math.min(1, MAXDIM / Math.max(bmp.width, bmp.height)); return canvasFrom(bmp, Math.round(bmp.width * k), Math.round(bmp.height * k));
  }
  async function takePhoto(canvas) {
    const img = imgData(canvas); S.photo[S.side] = { canvas, img };
    let det; try { det = (await call('detect', img)).res; } catch (e) { det = { quad: [[0, 0], [img.w, 0], [img.w, img.h], [0, img.h]], found: false, confidence: 0 }; }
    if (!det.found) { const w = img.w, h = img.h; det.quad = [[w * .12, h * .1], [w * .88, h * .1], [w * .88, h * .9], [w * .12, h * .9]]; }
    S.photo[S.side].det = det; S.photo[S.side].quad = det.quad.map(p => p.slice());
    openAdjust();
  }
  const onFile = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (cur === 'home') newScan(); try { await takePhoto(await fromFile(f)); } catch (err) { toast('Could not open that photo.'); } };
  $('fileIn').onchange = onFile; $('fileIn2').onchange = onFile;
  $('scanBtn').onclick = () => { newScan(); show('camera'); };

  // ---------- camera ----------
  let stream = null, liveTimer = null, liveBusy = false, lastLock = 0;
  async function startCam() {
    $('camSide').textContent = S.side === 'front' ? 'Front of card' : 'Back of card';
    $('skipBack').hidden = S.side !== 'back'; $('camSpacer').hidden = S.side === 'back';
    $('camStatus').textContent = 'Looking for card edges…'; $('camStatus').classList.remove('ok'); $('guide').classList.remove('lock');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
      const v = $('video'); v.srcObject = stream; await v.play().catch(() => {});
      liveTimer = setInterval(liveDetect, 450);
    } catch (err) { $('camStatus').textContent = 'Camera unavailable. Use a gallery photo instead.'; }
  }
  function stopCam() { clearInterval(liveTimer); liveTimer = null; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; const c = $('live'); c.getContext('2d').clearRect(0, 0, c.width, c.height); }
  function coverMap(v, el) { const vw = v.videoWidth, vh = v.videoHeight, W = el.clientWidth, H = el.clientHeight, k = Math.max(W / vw, H / vh); return { k, ox: (W - vw * k) / 2, oy: (H - vh * k) / 2 }; }
  async function liveDetect() {
    const v = $('video'); if (liveBusy || !v.videoWidth) return; liveBusy = true;
    try {
      const k = 360 / Math.max(v.videoWidth, v.videoHeight), c = canvasFrom(v, Math.round(v.videoWidth * k), Math.round(v.videoHeight * k));
      const det = (await call('detect', imgData(c))).res, lc = $('live'), ctx = lc.getContext('2d'); lc.width = lc.clientWidth * devicePixelRatio; lc.height = lc.clientHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
      if (det.found && det.confidence > 0.55) {
        const m = coverMap(v, $('camera')), pts = det.quad.map(([x, y]) => [x / k * m.k + m.ox, y / k * m.k + m.oy]);
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fillStyle = 'rgba(52,211,153,.10)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#34d399'; ctx.shadowColor = '#34d399'; ctx.shadowBlur = 12; ctx.stroke();
        $('camStatus').textContent = 'Card found · hold steady and tap'; $('camStatus').classList.add('ok'); $('guide').classList.add('lock'); lastLock = Date.now();
      } else if (Date.now() - lastLock > 900) { $('camStatus').textContent = 'Looking for card edges…'; $('camStatus').classList.remove('ok'); $('guide').classList.remove('lock'); }
    } catch (e) {} finally { liveBusy = false; }
  }
  $('shutter').onclick = async () => { const v = $('video'); if (!v.videoWidth) return; const k = Math.min(1, MAXDIM / Math.max(v.videoWidth, v.videoHeight)); const c = canvasFrom(v, Math.round(v.videoWidth * k), Math.round(v.videoHeight * k)); stopCam(); await takePhoto(c); };
  $('skipBack').onclick = () => showResults();

  // ---------- adjust corners ----------
  let adj = null;
  function openAdjust() {
    $('adjTitle').textContent = S.side === 'front' ? 'Front' : 'Back';
    const det = S.photo[S.side].det; $('adjSub').textContent = det.found ? 'Edges found. Fine-tune the corners if needed' : 'Drag the corners onto the card\'s cut edge';
    show('adjust'); requestAnimationFrame(layoutAdjust);
  }
  function layoutAdjust() {
    const P = S.photo[S.side], wrap = $('adjWrap'), c = $('adjCanvas'), W = wrap.clientWidth, H = wrap.clientHeight, k = Math.min(W / P.img.w, H / P.img.h);
    c.width = Math.round(P.img.w * k * devicePixelRatio); c.height = Math.round(P.img.h * k * devicePixelRatio); c.style.width = P.img.w * k + 'px'; c.style.height = P.img.h * k + 'px';
    adj = { k, ox: (W - P.img.w * k) / 2, oy: (H - P.img.h * k) / 2 }; c.style.left = adj.ox + 'px'; c.style.top = adj.oy + 'px'; drawAdjust();
    const hs = $('handles'); hs.innerHTML = '';
    P.quad.forEach((p, i) => { const h = document.createElement('div'); h.className = 'handle'; hs.appendChild(h); placeHandle(h, p);
      h.onpointerdown = ev => { h.setPointerCapture(ev.pointerId); $('loupe').style.display = 'block'; };
      h.onpointermove = ev => { if (!h.hasPointerCapture(ev.pointerId)) return; const r = wrap.getBoundingClientRect(); const x = (ev.clientX - r.left - adj.ox) / adj.k, y = (ev.clientY - r.top - adj.oy - 0) / adj.k;
        P.quad[i] = [Math.max(0, Math.min(P.img.w, x)), Math.max(0, Math.min(P.img.h, y))]; P.moved = true; placeHandle(h, P.quad[i]); drawAdjust(); loupe(P.quad[i], ev.clientX - r.left, ev.clientY - r.top); };
      h.onpointerup = () => { $('loupe').style.display = 'none'; }; });
  }
  function placeHandle(h, [x, y]) { h.style.left = adj.ox + x * adj.k + 'px'; h.style.top = adj.oy + y * adj.k + 'px'; }
  function drawAdjust() {
    const P = S.photo[S.side], c = $('adjCanvas'), ctx = c.getContext('2d'), s = adj.k * devicePixelRatio;
    ctx.drawImage(P.canvas, 0, 0, c.width, c.height); ctx.save(); ctx.fillStyle = 'rgba(4,6,10,.55)'; ctx.beginPath(); ctx.rect(0, 0, c.width, c.height);
    P.quad.forEach((p, i) => i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s)); ctx.closePath(); ctx.fill('evenodd');
    ctx.beginPath(); P.quad.forEach((p, i) => i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s)); ctx.closePath(); ctx.lineWidth = 2 * devicePixelRatio; ctx.strokeStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();
  }
  function loupe([x, y], cx, cy) { const l = $('loupe'), c = qs('canvas', l), ctx = c.getContext('2d'), P = S.photo[S.side], z = 40; ctx.imageSmoothingEnabled = false; ctx.drawImage(P.canvas, x - z / 2, y - z / 2, z, z, 0, 0, 132, 132); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(66, 50); ctx.lineTo(66, 82); ctx.moveTo(50, 66); ctx.lineTo(82, 66); ctx.stroke(); l.style.left = Math.max(0, cx - 66) + 'px'; l.style.top = Math.max(0, cy - 190) + 'px'; }
  window.addEventListener('resize', () => cur === 'adjust' && layoutAdjust());
  $('retake').onclick = () => { stack.pop(); history.back(); };
  $('useCorners').onclick = () => analyze();

  // ---------- analyze ----------
  async function analyze() {
    const P = S.photo[S.side]; show('working');
    const thumb = $('workThumb'); thumb.width = 250; thumb.height = 350; const tctx = thumb.getContext('2d'); tctx.fillStyle = '#000'; tctx.fillRect(0, 0, 250, 350);
    const k = Math.max(250 / P.img.w, 350 / P.img.h); tctx.drawImage(P.canvas, (250 - P.img.w * k) / 2, (350 - P.img.h * k) / 2, P.img.w * k, P.img.h * k);
    const steps = qsa('#steps li'); steps.forEach(s => s.className = ''); let si = 0; steps[0].className = 'on';
    const tick = setInterval(() => { if (si < steps.length - 1) { steps[si].className = 'done'; steps[++si].className = 'on'; } }, 380);
    try {
      const t0 = performance.now(), out = await call('analyze', P.img, P.quad); const r = out.res;
      if (!P.moved) r.detect = P.det; // keep auto-detect confidence when corners weren't touched
      const cd = new ImageData(new Uint8ClampedArray(out.card.buf), out.card.w, out.card.h), cc = document.createElement('canvas'); cc.width = cd.width; cc.height = cd.height; cc.getContext('2d').putImageData(cd, 0, 0);
      S.res[S.side] = r; S.card[S.side] = cc;
      const wait = Math.max(0, 1500 - (performance.now() - t0)); await new Promise(r => setTimeout(r, wait));
      clearInterval(tick); steps.forEach(s => s.className = 'done');
      track('side_analyzed', { side: S.side, ms: Math.round(performance.now() - t0) });
      if (S.side === 'front') { stack.length = 0; show('askBack', false); history.pushState({}, ''); } else showResults();
    } catch (err) { clearInterval(tick); console.error(err); toast('Analysis failed. Try another photo.'); home(); }
  }
  $('scanBackBtn').onclick = () => { S.side = 'back'; show('camera'); };
  $('skipBackBtn').onclick = () => showResults();

  // ---------- results ----------
  const fmt = a => `${Math.round(a[0])}/${Math.round(a[1])}`;
  let current = null; // {res:{front,back}, card:{front,back}, grade, t}
  function showResults() {
    const g = GradeCore.grade(S.res.front, S.res.back || null);
    current = { res: { front: S.res.front, back: S.res.back || null }, card: { front: S.card.front, back: S.card.back || null }, grade: g, t: Date.now(), scale: 1 };
    saveHistory(current); track('scan_complete', { range: g.range.join('-'), back: !!S.res.back });
    stack.length = 0; show('result', false); history.pushState({}, ''); renderResult();
  }
  function renderResult() {
    const { grade: g, res } = current; $('resDate').textContent = new Date(current.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    $('gradeRange').textContent = `${g.range[0]}–${g.range[1]}`; $('gradeConf').textContent = `${g.label} confidence`;
    const arc = $('gaugeArc'), L = 2 * Math.PI * 52; arc.style.strokeDasharray = L; arc.style.strokeDashoffset = L; requestAnimationFrame(() => requestAnimationFrame(() => arc.style.strokeDashoffset = L * (1 - g.est / 10)));
    const bt = qs('[data-side="back"]', $('sideTabs')); bt.disabled = !res.back; S.viewSide = 'front'; qsa('#sideTabs button').forEach(b => b.classList.toggle('on', b.dataset.side === 'front'));
    renderSubs(); renderSide(); $('resScroll').scrollTop = 0;
  }
  qsa('#sideTabs button').forEach(b => b.onclick = () => { if (b.disabled) return; S.viewSide = b.dataset.side; qsa('#sideTabs button').forEach(x => x.classList.toggle('on', x === b)); renderSide(); });
  qsa('#toggles button').forEach(b => b.onclick = () => { const l = b.dataset.l; S.layers[l] = !S.layers[l]; b.classList.toggle('on', !!S.layers[l]); drawOverlay(); });
  function subCard(name, v, body, na) { return `<div class="sub ${v === null ? 'na' : ''}"><div class="hd"><span>${name}</span><b>${v === null ? 'n/a' : v}</b></div><div class="bar"><i style="width:${v === null ? 0 : v * 10}%"></i></div>${v === null ? `<p>${na}</p>` : body}</div>`; }
  function renderSubs() {
    const { grade: g, res } = current, f = res.front, b = res.back, sides = [f, b].filter(Boolean);
    const cent = s => s && s.centering.ok ? `<div class="ratio"><div><small>${s === f ? 'Front' : 'Back'} L/R</small><b>${fmt(s.centering.lr)}</b></div><div><small>T/B</small><b>${fmt(s.centering.tb)}</b></div></div>` : '';
    const nl = sides.reduce((a, s) => a + s.printLines.length, 0), ns = sides.reduce((a, s) => a + s.scratches.length, 0);
    const ef = sides.map(s => s.edges.frac).filter(v => v !== null && v !== undefined), worstEdge = ef.length ? Math.max(...ef) : null;
    const cs = sides.flatMap(s => s.corners.filter(c => c.measurable)), worstC = cs.length ? cs.reduce((a, c) => c.wear > a.wear ? c : a) : null;
    $('subs').innerHTML =
      subCard('Centering', g.subs.centering, cent(f) + cent(b), 'No even border to measure (full-art or patterned border).') +
      subCard('Corners', g.subs.corners, `<p>${worstC && worstC.wear > 0.15 ? `Most wear: ${worstC.name.replace('-', ' ')}` : 'All four look sharp'}</p>`, 'Corners blend into the background. Use a contrasting surface.') +
      subCard('Edges', g.subs.edges, `<p>${worstEdge === null ? '' : worstEdge < 0.006 ? 'No whitening or chipping found' : `Wear along ${(worstEdge * 100).toFixed(1)}% of the worst edge`}</p>`, 'Edges blend into the background. Use a contrasting surface.') +
      subCard('Surface', g.subs.surface, `<p>${nl} print line${nl === 1 ? '' : 's'} · ${ns} scratch${ns === 1 ? '' : 'es'}</p>`, '');
  }
  function renderSide() {
    const r = current.res[S.viewSide], cc = current.card[S.viewSide], v = qs('.viewer');
    v.style.setProperty('--ar', `${cc.width}/${cc.height}`);
    const c = $('cardCanvas'); c.width = cc.width; c.height = cc.height; c.getContext('2d').drawImage(cc, 0, 0);
    drawOverlay(); renderCorners(r, cc);
    const notes = [...r.notes];
    if (r.centering.ok && Math.max(r.centering.tb[0], r.centering.tb[1]) >= 68 && Math.max(r.centering.lr[0], r.centering.lr[1]) <= 56) notes.push('Top and bottom borders differ a lot while left/right are even. Some designs print a deeper bottom border, so check T/B by eye.');
    const ls = Object.values(r.edges.sides); if (ls.some(s => s.lightBorder)) notes.push('Light border: whitening is hard to see on white or silver borders, so edges were checked for chipping only.');
    if (!notes.length) notes.push('Good photo: sharp, even light, card edges found.');
    $('notes').innerHTML = notes.map(n => `<li>${n}</li>`).join('');
  }
  function drawOverlay() {
    const r = current.res[S.viewSide], cc = current.card[S.viewSide], o = $('overlay'), k = current.scale || 1; o.width = cc.width; o.height = cc.height; const x = o.getContext('2d'), L = S.layers, W = o.width, H = o.height, u = W / 750;
    x.lineCap = 'round'; x.font = `700 ${Math.round(17 * u)}px system-ui,sans-serif`;
    const tag = (t, px, py, col) => { const w = x.measureText(t).width + 14 * u; x.fillStyle = 'rgba(5,8,14,.78)'; x.beginPath(); x.roundRect(px - w / 2, py - 13 * u, w, 26 * u, 8 * u); x.fill(); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, px, py + 1); };
    if (L.centering && r.centering.ok) { const i = r.centering.inner, s = v => v * k; x.setLineDash([10 * u, 7 * u]); x.lineWidth = 2.5 * u; x.strokeStyle = '#22d3ee'; x.shadowColor = '#22d3ee'; x.shadowBlur = 8; x.strokeRect(s(i.x0), s(i.y0), s(i.x1 - i.x0), s(i.y1 - i.y0)); x.setLineDash([]); x.shadowBlur = 0;
      const lr = r.centering.lr, tb = r.centering.tb; tag(`${Math.round(lr[0])}`, s(i.x0) / 2 + 20 * u, H / 2, '#a5f3fc'); tag(`${Math.round(lr[1])}`, W - s(W / k - i.x1) / 2 - 20 * u, H / 2, '#a5f3fc'); tag(`${Math.round(tb[0])}`, W / 2, s(i.y0) / 2 + 16 * u, '#a5f3fc'); tag(`${Math.round(tb[1])}`, W / 2, H - s(H / k - i.y1) / 2 - 16 * u, '#a5f3fc'); }
    if (L.print) for (const l of r.printLines) { x.strokeStyle = 'rgba(244,114,182,.95)'; x.lineWidth = 3 * u; x.shadowColor = '#f472b6'; x.shadowBlur = 10; x.setLineDash([16 * u, 8 * u]); x.beginPath(); if (l.orient === 'v') { x.moveTo(l.pos * k, 0); x.lineTo(l.pos * k, H); } else { x.moveTo(0, l.pos * k); x.lineTo(W, l.pos * k); } x.stroke(); x.setLineDash([]); x.shadowBlur = 0; tag('Print line', l.orient === 'v' ? l.pos * k : W * 0.78, l.orient === 'v' ? H * 0.12 : l.pos * k - 20 * u, '#fbcfe8'); }
    if (L.scratch) r.scratches.forEach(s => { x.strokeStyle = 'rgba(248,113,113,.95)'; x.lineWidth = 5 * u; x.shadowColor = '#f87171'; x.shadowBlur = 12; x.beginPath(); x.moveTo(s.p0[0] * k, s.p0[1] * k); x.lineTo(s.p1[0] * k, s.p1[1] * k); x.stroke(); x.shadowBlur = 0; x.lineWidth = 2 * u; x.strokeStyle = 'rgba(248,113,113,.7)'; x.beginPath(); x.arc(s.x * k, s.y * k, s.len * k / 2 + 10 * u, 0, 7); x.stroke(); });
    if (L.edges) { x.strokeStyle = '#fb923c'; x.lineWidth = 7 * u; x.shadowColor = '#fb923c'; x.shadowBlur = 10;
      for (const [side, s] of Object.entries(r.edges.sides)) for (const [a, b] of s.segs) { x.beginPath(); const A = a * k, B = b * k, e = 4 * u; if (side === 'top') { x.moveTo(A, e); x.lineTo(B, e); } if (side === 'bottom') { x.moveTo(A, H - e); x.lineTo(B, H - e); } if (side === 'left') { x.moveTo(e, A); x.lineTo(e, B); } if (side === 'right') { x.moveTo(W - e, A); x.lineTo(W - e, B); } x.stroke(); }
      x.shadowBlur = 0; for (const c of r.corners) { if (!c.measurable || c.wear < 0.15) continue; const cx = c.x < 10 ? 0 : W, cy = c.y < 10 ? 0 : H; x.strokeStyle = c.wear > 0.5 ? '#f87171' : '#fbbf24'; x.lineWidth = 3.5 * u; x.beginPath(); x.arc(cx, cy, 60 * u, 0, 7); x.stroke(); } }
  }
  function renderCorners(r, cc) {
    const grid = $('cornerGrid'); grid.innerHTML = ''; const k = current.scale || 1, S0 = Math.round(cc.width * 0.16);
    for (const c of r.corners) {
      const d = document.createElement('div'); d.className = 'corner'; const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160; const x = cv.getContext('2d');
      const sx = c.x < 10 ? 0 : cc.width - S0, sy = c.y < 10 ? 0 : cc.height - S0; x.imageSmoothingQuality = 'high'; x.drawImage(cc, sx, sy, S0, S0, 0, 0, 160, 160);
      const col = !c.measurable ? '#334155' : c.wear > 0.5 ? '#f87171' : c.wear > 0.15 ? '#fbbf24' : '#34d399'; d.style.setProperty('--cc', col);
      const label = !c.measurable ? 'n/a' : c.wear > 0.5 ? 'Worn' : c.wear > 0.15 ? 'Light wear' : 'Sharp';
      d.append(cv); d.insertAdjacentHTML('beforeend', `<b style="color:${col}">${label}</b><small>${c.name.replace('-', ' ')}</small>`); grid.append(d);
    }
  }

  // ---------- history (on-device only) ----------
  const loadHist = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch { return []; } };
  function slim(r) { if (!r) return null; const { quad, ...rest } = r; return rest; }
  function jpeg(cc, w) { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(cc.height * w / cc.width); c.getContext('2d').drawImage(cc, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.82); }
  function saveHistory(cur) {
    const h = loadHist(); const item = { id: cur.t, t: cur.t, range: cur.grade.range, grade: cur.grade, res: { front: slim(cur.res.front), back: slim(cur.res.back) }, img: { front: jpeg(cur.card.front, 450), back: cur.card.back ? jpeg(cur.card.back, 450) : null } };
    h.unshift(item); while (h.length) { try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 24))); break; } catch { h.pop(); } }
  }
  function renderHistory() {
    const h = loadHist(), el = $('history'); $('histCount').textContent = h.length ? `${h.length} saved on this phone` : '';
    if (!h.length) { el.innerHTML = '<div class="empty">Your condition reports will show up here.</div>'; return; }
    el.innerHTML = h.map(i => { const c = i.res.front.centering; return `<button class="h-item" data-id="${i.id}"><img src="${i.img.front}" alt=""><div class="meta" style="text-align:left"><b>${new Date(i.t).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${i.res.back ? 'Front + back' : 'Front only'}</b><small>${c.ok ? `Centering ${fmt(c.lr)} · ${fmt(c.tb)}` : 'Centering n/a'} · Surface ${i.grade.subs.surface}</small></div><span class="pill">${i.range[0]}–${i.range[1]}</span></button>`; }).join('');
    qsa('.h-item', el).forEach(b => b.onclick = () => openHistory(+b.dataset.id));
  }
  async function openHistory(id) {
    const i = loadHist().find(x => x.id === id); if (!i) return;
    const toCanvas = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(canvasFrom(im, im.width, im.height)); im.src = src; });
    const front = await toCanvas(i.img.front), back = await toCanvas(i.img.back);
    current = { res: i.res, card: { front, back }, grade: i.grade, t: i.t, scale: front.width / (i.res.front.landscape ? 1050 : 750) };
    show('result'); renderResult();
  }

  // ---------- sheet ----------
  const closeSheet = () => $('sheet').classList.remove('open');
  $('infoBtn').onclick = () => $('sheet').classList.add('open'); $('closeSheet').onclick = closeSheet; $('sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
  $('clearHist').onclick = () => { localStorage.removeItem(HKEY); renderHistory(); toast('Recent scans cleared'); };

  history.replaceState({ s: 'home' }, ''); renderHistory();
  window.CPG = { S, show, takePhoto, fromFile, analyze, showResults, openHistory, layoutAdjust, home, get current() { return current; } }; // test hooks
})();
