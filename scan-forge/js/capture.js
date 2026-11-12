// Guided orbit capture: 3 height rings x 20 positions, live sharpness, blur rejection, auto-shutter.
export const RINGS = [{ name: 'Low', min: -90, max: 28 }, { name: 'Middle', min: 28, max: 48 }, { name: 'High', min: 48, max: 91 }];
export const SECTORS = 20;
const MAX_SIDE = 2400;

export function lapVar(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
  let s = 0, s2 = 0, n = 0;
  const x0 = Math.floor(w * .2), x1 = Math.ceil(w * .8), y0 = Math.floor(h * .2), y1 = Math.ceil(h * .8);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x, v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; s += v; s2 += v * v; n++;
  }
  const m = s / n; return s2 / n - m * m;
}
function sharpOf(src, sw, sh, tmp) {
  const w = 320, h = Math.round(320 * sh / sw); tmp.width = w; tmp.height = h;
  const c = tmp.getContext('2d', { willReadFrequently: true }); c.drawImage(src, 0, 0, w, h); return lapVar(c, w, h);
}
export function covDraw(svg, cov, cur) {
  const R = [46, 34, 22], seg = 360 / SECTORS; let s = '';
  const arc = (r, a0, a1) => { const p = a => [50 + r * Math.sin(a * Math.PI / 180), 50 - r * Math.cos(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  for (let r = 0; r < 3; r++) for (let k = 0; k < SECTORS; k++) {
    const on = cov[r][k] > 0, me = cur && cur.r === r && cur.k === k;
    s += `<path d="${arc(R[r], k * seg + 1.6, (k + 1) * seg - 1.6)}" stroke="${me ? '#ff7a1a' : on ? '#5ad1ff' : 'rgba(255,255,255,.18)'}" stroke-width="${me ? 9 : 7}" fill="none" stroke-linecap="round"/>`;
  }
  const n = cov.flat().filter(Boolean).length;
  s += `<text x="50" y="49" text-anchor="middle" fill="#fff" font-size="15" font-weight="800">${Math.round(100 * n / (3 * SECTORS))}%</text><text x="50" y="60" text-anchor="middle" fill="#aab" font-size="7.5" font-weight="700">COVERED</text>`;
  svg.innerHTML = s;
}
export const emptyCov = () => RINGS.map(() => new Array(SECTORS).fill(0));

export async function startCapture({ onDone, onCancel, toast }) {
  const el = document.createElement('div'); el.className = 'cap';
  el.innerHTML = `<video playsinline muted autoplay></video><div class="reticle"></div><div class="flash"></div>
  <div class="hud"><button class="x" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  <div class="count"><span id="cn">0</span> photos<small id="ring">Low ring</small></div></div>
  <div class="guide" id="guide">Starting camera…</div>
  <div class="bottom"><svg class="cov" viewBox="0 0 100 100"></svg>
  <button class="shutter" aria-label="Take photo"><i></i></button>
  <div class="side"><button class="tog on" id="auto">Auto</button><div class="sharp"><div class="bar"><i id="sb"></i></div></div><button class="tog" id="fin">Done</button></div></div>`;
  document.body.appendChild(el);
  const v = el.querySelector('video'), guide = el.querySelector('#guide'), cn = el.querySelector('#cn'), covSvg = el.querySelector('.cov');
  const tmp = document.createElement('canvas');
  const shots = [], cov = emptyCov(); let auto = true, last = 0, busy = false, stream, track, ic, timer;
  let heading = null, tilt = null, rate = 0; const hist = []; const accepted = [];
  const ori = e => { if (e.alpha != null) { heading = e.alpha; tilt = 90 - (e.beta || 0); } };
  const mot = e => { const r = e.rotationRate; if (r) rate = Math.max(Math.abs(r.alpha || 0), Math.abs(r.beta || 0), Math.abs(r.gamma || 0)); };
  addEventListener('deviceorientation', ori); addEventListener('devicemotion', mot);
  const cell = () => { if (heading == null) return null; const r = RINGS.findIndex(g => tilt >= g.min && tilt < g.max); return { r: r < 0 ? 0 : r, k: Math.floor(((360 - heading) % 360) / (360 / SECTORS)) % SECTORS }; };
  const cleanup = () => { clearInterval(timer); removeEventListener('deviceorientation', ori); removeEventListener('devicemotion', mot); stream && stream.getTracks().forEach(t => t.stop()); el.remove(); };
  el.querySelector('.x').onclick = () => { if (shots.length && !confirm(`Discard ${shots.length} photos?`)) return; cleanup(); onCancel && onCancel(); };
  el.querySelector('#fin').onclick = () => { cleanup(); onDone(shots, cov); };
  const autoBtn = el.querySelector('#auto'), sh = el.querySelector('.shutter'); sh.classList.add('auto');
  autoBtn.onclick = () => { auto = !auto; autoBtn.classList.toggle('on', auto); sh.classList.toggle('auto', auto); };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } } });
  } catch (e) { cleanup(); toast('Camera unavailable: ' + (e.message || e.name)); onCancel && onCancel(); return; }
  v.srcObject = stream; track = stream.getVideoTracks()[0];
  try { const caps = track.getCapabilities?.() || {}; const adv = {};
    if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
    if (caps.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous';
    if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] }); } catch {}
  if ('ImageCapture' in window) { try { ic = new ImageCapture(track); } catch {} }
  await v.play().catch(() => {});
  const ref = () => { const a = accepted.slice(-15).sort((x, y) => x - y); return a.length >= 3 ? a[Math.floor(a.length / 2)] : null; };
  async function shoot(manual) {
    if (busy) return; busy = true;
    try {
      let bmp;
      if (ic) { try { bmp = await createImageBitmap(await ic.takePhoto()); } catch { bmp = null; } }
      if (!bmp) bmp = await createImageBitmap(v);
      const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const s = sharpOf(c, c.width, c.height, tmp), rf = ref();
      if (rf && s < rf * .55) { guide.textContent = 'Blurry, rejected. Hold still'; guide.className = 'guide warn'; return; }
      accepted.push(s);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
      const at = cell(); if (at) cov[at.r][at.k]++; else { const i = shots.length; cov[Math.min(2, Math.floor(i / SECTORS))][i % SECTORS]++; }
      shots.push({ blob, url: URL.createObjectURL(blob), sharp: s, cell: at });
      cn.textContent = shots.length; last = performance.now();
      const f = el.querySelector('.flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      navigator.vibrate?.(18);
    } finally { busy = false; }
  }
  sh.onclick = () => shoot(true);
  timer = setInterval(() => {
    if (!v.videoWidth) return;
    const s = sharpOf(v, v.videoWidth, v.videoHeight, tmp); hist.push(s); if (hist.length > 40) hist.shift();
    const top = [...hist].sort((a, b) => a - b)[Math.floor(hist.length * .9)] || s;
    el.querySelector('#sb').style.width = Math.min(100, 100 * s / (top || 1)) + '%';
    const at = cell(); covDraw(covSvg, cov, at);
    el.querySelector('#ring').textContent = at ? `${RINGS[at.r].name} ring` : 'Walk around the object';
    const steady = rate < 22 && s > top * .7, free = !at || !cov[at.r][at.k];
    const nDone = cov.flat().filter(Boolean).length;
    if (busy) return;
    if (!steady) { guide.textContent = 'Hold steady'; guide.className = 'guide warn'; }
    else if (at && !free) { guide.textContent = nDone >= 3 * SECTORS ? 'All covered. Tap Done' : 'Covered here. Keep moving'; guide.className = 'guide'; }
    else { guide.textContent = auto ? 'Good. Capturing' : 'Good. Tap to shoot'; guide.className = 'guide good'; }
    if (auto && steady && free && performance.now() - last > 900) shoot(false);
  }, 160);
}
