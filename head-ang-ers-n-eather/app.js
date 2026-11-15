/* Soundboard — single-page PWA.
 * Pads play either a synthesised starter sound (Web Audio, offline, instant)
 * or a saved clip (Internet Archive URL or a mic recording stored on-device).
 * Storage: localStorage key "soundboard.pads.v1" holds user pads + recordings
 * (recordings as data URLs, capped at ~4 MB each so the board stays fast).
 */
'use strict';

const STORAGE_KEY = 'soundboard.pads.v1';
const MACRO_KEY = 'soundboard.macros.v1';
const STARTER_URL = 'data/starter-pack.json';

/* ---------- audio core: one shared AudioContext, reused across taps ----------
 * Reusing a warm context (instead of creating one per tap) is the main
 * tap-to-sound delay fix: first tap unlocks audio, later taps play at once. */
let audioCtx = null;
let masterGain = null;
const activeSources = new Set(); // every live source, so Stop All can kill them

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volumeEl.value / 100;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function stopAll() {
  for (const src of [...activeSources]) {
    try { src.stop(); } catch (_) { /* already stopped */ }
  }
  activeSources.clear();
  document.querySelectorAll('.pad.playing').forEach(el => el.classList.remove('playing'));
  setStatus('Stopped everything.');
}

function track(source, padEl) {
  activeSources.add(source);
  if (padEl) padEl.classList.add('playing');
  source.onended = () => {
    activeSources.delete(source);
    if (padEl) padEl.classList.remove('playing');
  };
}

/* ---------- tiny synth engine for the starter pack ---------- */
function tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.3, delay = 0, gain = 0.5, attack = 0.005 }) {
  const ctx = ensureAudio();
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  track({ stop() { try { osc.stop(); } catch (_) {} }, set onended(_) {} }, null);
  return osc;
}

function noiseBurst({ dur = 0.3, delay = 0, gain = 0.5, lowpass = 4000 }) {
  const ctx = ensureAudio();
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t0);
  track(src, null);
  return src;
}

/* One synth recipe per starter sound. Durations stay short (0.2–2.5 s). */
const SYNTH = {
  airhorn() { // loud three-note blast
    [220, 277, 330].forEach(f => tone({ freq: f, type: 'sawtooth', dur: 0.9, gain: 0.28 }));
    noiseBurst({ dur: 0.5, gain: 0.15, lowpass: 2500 });
  },
  rimshot() { tone({ freq: 180, type: 'square', dur: 0.08, gain: 0.5 }); noiseBurst({ dur: 0.12, gain: 0.5, lowpass: 6000 }); },
  sadTrombone() { [233, 220, 207, 196].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.45, delay: i * 0.42, gain: 0.3 })); },
  boing() { tone({ freq: 120, freqEnd: 700, type: 'sine', dur: 0.35, gain: 0.5 }); },
  laser() { tone({ freq: 1400, freqEnd: 120, type: 'sawtooth', dur: 0.35, gain: 0.35 }); },
  whistle() { tone({ freq: 2200, freqEnd: 2600, type: 'sine', dur: 0.18, gain: 0.3 }); tone({ freq: 2600, freqEnd: 2200, type: 'sine', dur: 0.18, delay: 0.2, gain: 0.3 }); },
  applause() { for (let i = 0; i < 9; i++) noiseBurst({ dur: 0.15, delay: i * 0.09, gain: 0.3, lowpass: 5000 }); },
  drumroll() { for (let i = 0; i < 14; i++) noiseBurst({ dur: 0.06, delay: i * 0.06, gain: 0.35, lowpass: 3000 }); tone({ freq: 60, type: 'sine', dur: 0.5, delay: 0.9, gain: 0.6 }); },
  quack() { tone({ freq: 300, freqEnd: 180, type: 'square', dur: 0.12, gain: 0.4 }); tone({ freq: 300, freqEnd: 180, type: 'square', dur: 0.12, delay: 0.16, gain: 0.4 }); },
  moo() { tone({ freq: 180, freqEnd: 120, type: 'sawtooth', dur: 0.7, gain: 0.3 }); },
  ding() { tone({ freq: 880, type: 'sine', dur: 0.8, gain: 0.4 }); tone({ freq: 1318, type: 'sine', dur: 0.6, delay: 0.02, gain: 0.2 }); },
  buzzer() { tone({ freq: 140, type: 'square', dur: 0.6, gain: 0.4 }); },
  coin() { tone({ freq: 988, type: 'sine', dur: 0.09, gain: 0.4 }); tone({ freq: 1319, type: 'sine', dur: 0.4, delay: 0.09, gain: 0.4 }); },
  fart() { tone({ freq: 90, freqEnd: 55, type: 'sawtooth', dur: 0.5, gain: 0.5 }); noiseBurst({ dur: 0.4, gain: 0.2, lowpass: 800 }); },
  tada() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.35, delay: i * 0.12, gain: 0.4 })); },
  cricket() { for (let i = 0; i < 6; i++) tone({ freq: 4200, type: 'sine', dur: 0.05, delay: i * 0.12, gain: 0.18 }); },
};

/* ---------- state ---------- */
const $ = id => document.getElementById(id);
const padGrid = $('padGrid'), boardStatus = $('boardStatus'), volumeEl = $('volume');
let pads = [];   // {id, label, colour, kind: 'synth'|'url'|'recording', synth?, url?, duration}
let macros = []; // {id, name, steps: [padId, ...]}
let selectedPadId = null;
let macroChain = [];
let deferredInstallPrompt = null;

function setStatus(msg) { boardStatus.textContent = msg; }

function loadState() {
  try { pads = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { pads = []; }
  try { macros = JSON.parse(localStorage.getItem(MACRO_KEY) || '[]'); } catch (_) { macros = []; }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pads));
  localStorage.setItem(MACRO_KEY, JSON.stringify(macros));
}
const uid = () => 'pad-' + Math.random().toString(36).slice(2, 9);

async function loadStarterPack() {
  if (pads.length) return; // user board already exists — never clobber it
  try {
    const res = await fetch(STARTER_URL);
    const data = await res.json();
    pads = data.sounds.map(s => ({
      id: uid(), label: s.label, colour: s.colour,
      kind: 'synth', synth: s.synth, duration: s.duration, source: s.source,
    }));
  } catch (err) {
    // Offline / file:// fallback: a minimal built-in pack so the board is never empty.
    pads = [
      { id: uid(), label: 'Airhorn', colour: '#e5484d', kind: 'synth', synth: 'airhorn', duration: 0.9 },
      { id: uid(), label: 'Rimshot', colour: '#f5a623', kind: 'synth', synth: 'rimshot', duration: 0.2 },
      { id: uid(), label: 'Sad Trombone', colour: '#7c5cff', kind: 'synth', synth: 'sadTrombone', duration: 1.8 },
      { id: uid(), label: 'Boing', colour: '#2fbf71', kind: 'synth', synth: 'boing', duration: 0.4 },
    ];
  }
  saveState();
}

/* ---------- playback ---------- */
function playPad(pad, padEl) {
  ensureAudio();
  if (pad.kind === 'synth' && SYNTH[pad.synth]) {
    SYNTH[pad.synth]();
    if (padEl) { padEl.classList.add('playing'); setTimeout(() => padEl.classList.remove('playing'), (pad.duration || 0.5) * 1000); }
    return;
  }
  if (pad.url) { // saved search clip or recording
    const audio = new Audio(pad.url);
    audio.volume = volumeEl.value / 100;
    audio.play().catch(() => setStatus('Could not play that sound — the link may have expired.'));
    if (padEl) {
      padEl.classList.add('playing');
      audio.onended = () => padEl.classList.remove('playing');
    }
    return;
  }
  setStatus('That pad has no sound attached.');
}

function renderPads() {
  padGrid.innerHTML = '';
  pads.forEach(pad => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pad' + (pad.id === selectedPadId ? ' selected' : '');
    btn.style.background = pad.colour;
    btn.dataset.padId = pad.id;
    btn.innerHTML = `${escapeHtml(pad.label)}<small>${pad.kind === 'synth' ? 'built-in' : pad.kind === 'recording' ? 'my recording' : 'saved search'} · ${pad.duration ? pad.duration + 's' : '—'}</small>`;
    // pointerdown (not click) keeps tap-to-sound delay as low as possible.
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      btn.classList.add('pressed');
      playPad(pad, btn);
    });
    btn.addEventListener('pointerup', () => btn.classList.remove('pressed'));
    btn.addEventListener('pointerleave', () => btn.classList.remove('pressed'));
    btn.addEventListener('contextmenu', e => { e.preventDefault(); selectPad(pad.id); });
    padGrid.appendChild(btn);
  });
  renderPadSelect();
  renderMacros();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- pad editor ---------- */
function selectPad(id) {
  selectedPadId = id;
  renderPads();
  const pad = pads.find(p => p.id === id);
  if (pad) $('padNameInput').value = pad.label;
}
function renderPadSelect() {
  const sel = $('padSelect');
  sel.innerHTML = '';
  pads.forEach(pad => {
    const opt = document.createElement('option');
    opt.value = pad.id;
    opt.textContent = pad.label;
    if (pad.id === selectedPadId) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ---------- Internet Archive search ----------
 * One call to advancedsearch, then the metadata API for the top hits.
 * Preview plays in-page; Save adds the clip URL to the board in one tap. */
async function searchArchive(term) {
  const q = `(${term}) AND mediatype:audio AND (format:mp3 OR format:ogg)`;
  const url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q)
    + '&fl[]=identifier,title&rows=8&page=1&output=json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
  const data = await res.json();
  const docs = (data.response && data.response.docs) || [];
  const results = [];
  for (const doc of docs.slice(0, 6)) {
    try {
      const meta = await (await fetch(`https://archive.org/metadata/${doc.identifier}`)).json();
      const file = (meta.files || []).find(f => /\.(mp3|ogg)$/i.test(f.name) && (f.length || 0) < 30);
      if (!file) continue;
      results.push({
        title: doc.title || doc.identifier,
        identifier: doc.identifier,
        url: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(file.name)}`,
        duration: file.length ? Math.round(file.length) : null,
      });
    } catch (_) { /* skip items whose metadata fails */ }
  }
  return results;
}

function renderSearchResults(results, term) {
  const box = $('searchResults');
  box.innerHTML = '';
  if (!results.length) {
    box.innerHTML = `<p class="status">No short clips found for “${escapeHtml(term)}”. Try another word.</p>`;
    return;
  }
  results.forEach(r => {
    const row = document.createElement('div');
    row.className = 'result';
    row.innerHTML = `<div class="title"><b>${escapeHtml(r.title)}</b><span>archive.org · ${r.duration ? r.duration + 's' : 'short clip'}</span></div>`;
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.textContent = '▶ Preview';
    preview.addEventListener('click', () => { stopAll(); new Audio(r.url).play().catch(() => setStatus('Preview failed to load.')); });
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = '＋ Save to board';
    save.addEventListener('click', () => {
      pads.push({ id: uid(), label: r.title.slice(0, 28), colour: pickColour(), kind: 'url', url: r.url, duration: r.duration, source: 'Internet Archive: ' + r.identifier });
      saveState();
      renderPads();
      setStatus(`Saved “${r.title.slice(0, 28)}” to the board.`);
    });
    row.append(preview, save);
    box.appendChild(row);
  });
}

const PALETTE = ['#e5484d', '#f5a623', '#2fbf71', '#3d8bfd', '#7c5cff', '#ff6fb5', '#12a5a5', '#ff8c42'];
const pickColour = () => PALETTE[pads.length % PALETTE.length];

/* ---------- mic recorder ---------- */
let mediaRecorder = null, recChunks = [], recStart = 0, recTimerId = null;
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      if (blob.size > 4 * 1024 * 1024) {
        $('recStatus').textContent = 'That recording is over 4 MB — kept recordings are capped so the board stays fast. Try a shorter one.';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pads.push({ id: uid(), label: 'My recording ' + new Date().toLocaleTimeString(), colour: pickColour(), kind: 'recording', url: reader.result, duration: Math.round((Date.now() - recStart) / 1000), source: 'mic recording' });
        saveState();
        renderPads();
        $('recStatus').textContent = 'Saved your recording to a new pad.';
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
    recStart = Date.now();
    $('recBtn').disabled = true;
    $('recStopBtn').disabled = false;
    $('recStatus').textContent = 'Recording… tap “Stop & save to a pad” when done.';
    recTimerId = setInterval(() => { $('recTimer').textContent = Math.floor((Date.now() - recStart) / 1000) + 's'; }, 250);
  } catch (err) {
    // Permission denied (or no mic): say so plainly and keep the board working.
    $('recStatus').textContent = err && err.name === 'NotAllowedError'
      ? 'Microphone access was denied. Allow the mic in your browser settings to record, or use search instead.'
      : 'Could not start the microphone on this device/browser (' + (err && err.name ? err.name : 'unknown error') + ').';
  }
}
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearInterval(recTimerId);
  $('recTimer').textContent = '';
  $('recBtn').disabled = false;
  $('recStopBtn').disabled = true;
}

/* ---------- macros ---------- */
function renderMacros() {
  $('macroChain').textContent = macroChain.length
    ? macroChain.map(id => (pads.find(p => p.id === id) || {}).label || '?').join(' → ')
    : '—';
  const list = $('macroList');
  list.innerHTML = '';
  macros.forEach(m => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '▶ ' + m.name;
    btn.addEventListener('click', () => playMacro(m));
    list.appendChild(btn);
  });
}
function playMacro(macro) {
  ensureAudio();
  let delayMs = 0;
  macro.steps.forEach(id => {
    const pad = pads.find(p => p.id === id);
    if (!pad) return;
    setTimeout(() => playPad(pad, document.querySelector(`[data-pad-id="${id}"]`)), delayMs);
    delayMs += Math.max(250, (pad.duration || 0.5) * 1000);
  });
}

/* ---------- wire up ---------- */
$('stopAllBtn').addEventListener('click', stopAll);
volumeEl.addEventListener('input', () => { if (masterGain) masterGain.gain.value = volumeEl.value / 100; });

$('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const term = $('searchInput').value.trim();
  if (!term) return;
  $('searchResults').innerHTML = '<p class="status">Searching the Internet Archive…</p>';
  try {
    renderSearchResults(await searchArchive(term), term);
  } catch (err) {
    $('searchResults').innerHTML = '<p class="status">Search failed — check your connection and try again.</p>';
  }
});

$('recBtn').addEventListener('click', startRecording);
$('recStopBtn').addEventListener('click', stopRecording);

$('padSelect').addEventListener('change', e => selectPad(e.target.value));
$('renameBtn').addEventListener('click', () => {
  const pad = pads.find(p => p.id === $('padSelect').value);
  const name = $('padNameInput').value.trim();
  if (!pad || !name) return;
  pad.label = name;
  saveState(); renderPads();
  $('editStatus').textContent = `Renamed pad to “${name}”.`;
});
$('downloadBtn').addEventListener('click', () => {
  const pad = pads.find(p => p.id === $('padSelect').value);
  if (!pad || !pad.url) { $('editStatus').textContent = 'Built-in sounds cannot be downloaded — save a search clip or a recording first.'; return; }
  const a = document.createElement('a');
  a.href = pad.url;
  a.download = pad.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.audio';
  a.click();
});
$('deleteBtn').addEventListener('click', () => {
  const id = $('padSelect').value;
  const pad = pads.find(p => p.id === id);
  if (!pad) return;
  pads = pads.filter(p => p.id !== id);
  selectedPadId = null;
  saveState(); renderPads();
  $('editStatus').textContent = `Deleted pad “${pad.label}”.`;
});

// Tapping a pad while building a macro adds it to the chain (long-press selects for editing).
padGrid.addEventListener('click', e => {
  const btn = e.target.closest('.pad');
  if (!btn) return;
  if (document.activeElement === $('macroName') || macroChain.length || $('macroName').value) {
    macroChain.push(btn.dataset.padId);
    renderMacros();
  }
});
$('macroSaveBtn').addEventListener('click', () => {
  const name = $('macroName').value.trim();
  if (!name || !macroChain.length) return;
  macros.push({ id: uid(), name, steps: [...macroChain] });
  macroChain = [];
  $('macroName').value = '';
  saveState(); renderMacros();
});
$('macroClearBtn').addEventListener('click', () => { macroChain = []; renderMacros(); });

$('resetBtn').addEventListener('click', () => {
  if (!confirm('Reset the board to the 16-sound starter pack? Your saved pads and recordings will be removed.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MACRO_KEY);
  pads = []; macros = [];
  loadStarterPack().then(renderPads);
  setStatus('Board reset to the starter pack.');
});

// PWA install prompt (Android Chrome); iOS uses Share → Add to Home Screen.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  $('installStatus').textContent = choice.outcome === 'accepted' ? 'Installed — find Soundboard on your home screen.' : 'Install dismissed — you can still add it from the browser menu.';
  deferredInstallPrompt = null;
  $('installBtn').hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is a bonus, not a blocker */ });
  });
}

/* ---------- boot ---------- */
loadState();
loadStarterPack().then(() => {
  renderPads();
  setStatus(pads.length + ' sounds ready — tap a pad.');
});
