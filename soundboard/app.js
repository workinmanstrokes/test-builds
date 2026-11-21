import { archiveDownloadUrl, archiveSearchUrl, MAX_BYTES, pickClipFile, safeTerm } from './lib/archive.js';
import { clearClips, deleteClip, getClip, putClip } from './lib/clip-store.js';
import { INK_CREAM, inkFor } from './lib/color.js';
import { createEngine } from './lib/engine.js';
import { classifyLicense, formatAttribution } from './lib/licenses.js';
import { padMark } from './lib/marks.js';
import { bootTelemetry, currentStats, setStatsEnabled, track } from './telemetry.js';

const PAD_KEY = 'soundboard.pads.v2';
const LEGACY_PAD_KEY = 'soundboard.pads.v1';
const MACRO_KEY = 'soundboard.macros.v1';
const SETTINGS_KEY = 'soundboard.settings.v1';
const MAX_CHAIN = 8;
const MAX_RECORD_SECONDS = 60;

const LEGACY_SYNTH = {
  airhorn: 'airhorn',
  rimshot: 'rimshot',
  sadTrombone: 'sad-trombone',
  boing: 'boing',
  laser: 'laser',
  whistle: 'whistle',
  applause: 'applause',
  drumroll: 'drum-roll',
  quack: 'quack',
  moo: 'moo',
  ding: 'ding',
  buzzer: 'buzzer',
  coin: 'coin',
  fart: 'fart',
  tada: 'tada',
  cricket: 'crickets',
};

const PALETTE = ['#c81f36', '#ef7d12', '#5346e4', '#0d7a4d', '#1f5fd4', '#0c7380', '#c21868', '#d4652a'];

const $ = (id) => document.getElementById(id);
const engine = createEngine();
const buffers = new Map();
const loading = new Map();
const queued = new Map();
const playing = new Map();

let catalog = [];
let pads = [];
let macros = [];
let playToken = 0;
let macroArmed = false;
let editArmed = false;
let macroChain = [];
let editingId = null;
let sheetName = '';
let mediaRecorder = null;
let recStream = null;
let recStarted = 0;
let recTimerId = 0;
let recCapId = 0;
let discardTake = false;
let deferredInstall = null;

const volumeEl = $('volume');

function uid() {
  return 'pad-' + Math.random().toString(36).slice(2, 10);
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (_) {
    return null;
  }
}

function savePads() {
  localStorage.setItem(PAD_KEY, JSON.stringify(pads));
}

function saveMacros() {
  localStorage.setItem(MACRO_KEY, JSON.stringify(macros));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ volume: Number(volumeEl.value) }));
}

function setStatus(text) {
  $('status').textContent = text;
}

function isNative() {
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
}

function padById(id) {
  return pads.find((p) => p.id === id) || null;
}

function bufferKey(pad) {
  return pad.kind === 'starter' ? 'starter:' + pad.soundId : 'clip:' + pad.clipId;
}

function makeStarter(def, overrides = {}) {
  return {
    id: overrides.id || uid(),
    label: overrides.label || def.label,
    colour: overrides.colour || def.colour,
    kind: 'starter',
    soundId: def.id,
    duration: def.duration,
    source: def.source || 'Original synthesis, generated for this app',
    licenseName: def.licenseName || 'Original',
  };
}

function metaLabel(pad) {
  if (pad.kind === 'starter') return 'Original';
  if (pad.kind === 'recording') return 'On this device';
  return pad.licenseName || 'Saved';
}

function slug(name) {
  return String(name || 'sound').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sound';
}

function paintPlaying(padId) {
  const set = playing.get(padId);
  const el = document.querySelector(`[data-pad-id="${CSS.escape(padId)}"]`);
  if (el) el.classList.toggle('playing', !!(set && set.size));
}

function startVoice(pad, buffer, when) {
  let voiceId = 0;
  voiceId = engine.play(buffer, {
    when,
    onEnd: () => {
      const set = playing.get(pad.id);
      if (set) set.delete(voiceId);
      if (set && !set.size) playing.delete(pad.id);
      paintPlaying(pad.id);
    },
  });
  const set = playing.get(pad.id) || new Set();
  set.add(voiceId);
  playing.set(pad.id, set);
  paintPlaying(pad.id);
}

async function ensureBuffer(pad) {
  const key = bufferKey(pad);
  if (buffers.has(key)) return buffers.get(key);
  if (loading.has(key)) return loading.get(key);
  const job = (async () => {
    let bytes;
    if (pad.kind === 'starter') {
      const def = catalog.find((s) => s.id === pad.soundId);
      if (!def) throw new Error('missing starter');
      const res = await fetch(def.file);
      if (!res.ok) throw new Error('missing file');
      bytes = await res.arrayBuffer();
    } else {
      const blob = await getClip(pad.clipId);
      if (!blob) throw new Error('missing clip');
      bytes = await blob.arrayBuffer();
    }
    const audio = await engine.decode(bytes);
    buffers.set(key, audio);
    loading.delete(key);
    return audio;
  })().catch((err) => {
    loading.delete(key);
    throw err;
  });
  loading.set(key, job);
  return job;
}

function playPad(pad, opts = {}) {
  if (!pad) return;
  if (!opts.quiet) {
    const kind = pad.kind === 'recording' ? 'recording' : pad.kind === 'starter' ? 'starter' : 'saved';
    track('pad_played', { kind });
  }
  engine.unlock();
  const token = playToken;
  const key = bufferKey(pad);
  const el = document.querySelector(`[data-pad-id="${CSS.escape(pad.id)}"]`);
  if (buffers.has(key)) {
    startVoice(pad, buffers.get(key));
    return;
  }
  queued.set(key, (queued.get(key) || 0) + 1);
  el?.classList.add('loading');
  ensureBuffer(pad).then((buf) => {
    el?.classList.remove('loading');
    const waiting = queued.get(key) || 0;
    queued.set(key, 0);
    if (token !== playToken || waiting <= 0) return;
    startVoice(pad, buf);
  }).catch(() => {
    el?.classList.remove('loading');
    queued.set(key, 0);
    if (token === playToken) setStatus('That sound could not be loaded.');
  });
}

function stopAll() {
  playToken += 1;
  queued.clear();
  engine.stopAll();
  document.querySelectorAll('.pad.loading').forEach((el) => el.classList.remove('loading'));
  setStatus('Stopped');
}

function renderMacros() {
  const strip = $('macroStrip');
  strip.replaceChildren();
  if (!macros.length) {
    strip.hidden = true;
  } else {
    strip.hidden = false;
    for (const macro of macros) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = macro.name;
      btn.addEventListener('pointerdown', (e) => {
        if (e.button) return;
        e.preventDefault();
        playMacro(macro);
      });
      strip.append(btn);
    }
  }
  const chain = $('macroChain');
  if (chain) {
    chain.textContent = macroChain.length
      ? macroChain.map((id) => (padById(id) || {}).label || 'Missing').join(' → ')
      : '—';
  }
  const list = $('macroList');
  if (!list) return;
  list.replaceChildren();
  for (const macro of macros) {
    const row = document.createElement('div');
    row.className = 'macro-item';
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = macro.name;
    play.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.preventDefault();
      playMacro(macro);
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'text-btn';
    del.textContent = 'Delete';
    del.setAttribute('aria-label', 'Delete chain ' + macro.name);
    del.addEventListener('click', () => {
      macros = macros.filter((m) => m.id !== macro.id);
      saveMacros();
      renderMacros();
      setStatus('Deleted “' + macro.name + '”.');
    });
    row.append(play, del);
    list.append(row);
  }
  const arm = $('macroArm');
  if (arm) {
    arm.textContent = macroArmed ? 'Adding pads…' : 'Add pads';
    arm.setAttribute('aria-pressed', macroArmed ? 'true' : 'false');
  }
}

function renderPads() {
  const grid = $('padGrid');
  grid.replaceChildren();
  for (const pad of pads) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pad';
    btn.dataset.padId = pad.id;
    btn.style.setProperty('--pad', pad.colour);
    const ink = inkFor(pad.colour);
    btn.style.setProperty('--ink-color', ink);
    btn.dataset.ink = ink === INK_CREAM ? 'light' : 'dark';
    btn.setAttribute('aria-label', pad.label + ', ' + metaLabel(pad));
    const mark = document.createElement('span');
    mark.innerHTML = padMark(pad.kind === 'starter' ? pad.soundId : pad.kind);
    const name = document.createElement('span');
    name.className = 'pad-name';
    name.textContent = pad.label;
    const meta = document.createElement('span');
    meta.className = 'pad-meta';
    meta.textContent = metaLabel(pad);
    btn.append(mark, name, meta);
    btn.addEventListener('pointerdown', (e) => onPadPointer(e, pad, btn));
    btn.addEventListener('pointerup', () => btn.classList.remove('pressed'));
    btn.addEventListener('pointercancel', () => btn.classList.remove('pressed'));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    grid.append(btn);
  }
  renderMacros();
  renderSources();
}

function onPadPointer(e, pad, btn) {
  if (e.button) return;
  e.preventDefault();
  if (editArmed) {
    editArmed = false;
    updateBanner();
    openEditor(pad.id);
    return;
  }
  btn.classList.add('pressed');
  if (macroArmed) addToChain(pad.id);
  playPad(pad);
}

function updateBanner() {
  const banner = $('banner');
  if (editArmed) {
    banner.hidden = false;
    banner.textContent = 'Tap a pad to edit it.';
  } else if (macroArmed) {
    banner.hidden = false;
    banner.textContent = macroChain.length
      ? 'Tap pads to extend the chain (' + macroChain.length + '/' + MAX_CHAIN + ').'
      : 'Tap pads in order. Up to ' + MAX_CHAIN + '.';
  } else {
    banner.hidden = true;
    banner.textContent = '';
  }
  const editBtn = $('editArm');
  if (editBtn) editBtn.textContent = editArmed ? 'Editing… tap a pad' : 'Edit a pad';
}

function addToChain(id) {
  if (macroChain.length >= MAX_CHAIN) {
    setStatus('A chain holds ' + MAX_CHAIN + ' pads. Save or clear it first.');
    return;
  }
  macroChain.push(id);
  renderMacros();
  updateBanner();
}

function playMacro(macro) {
  stopAll();
  track('chain_played', { kind: 'chain' });
  engine.unlock();
  let when = engine.ctx.currentTime + 0.01;
  let scheduled = 0;
  for (const id of macro.steps) {
    const pad = padById(id);
    if (!pad) continue;
    const buf = buffers.get(bufferKey(pad));
    if (!buf) {
      playPad(pad, { quiet: true });
      when += Math.max(0.25, pad.duration || 0.4);
      scheduled += 1;
      continue;
    }
    startVoice(pad, buf, when);
    when += Math.max(0.25, buf.duration);
    scheduled += 1;
  }
  setStatus(scheduled ? 'Playing “' + macro.name + '”.' : 'That chain has no pads left.');
}

function renderSources() {
  const box = $('sourceList');
  if (!box) return;
  box.replaceChildren();
  const archived = pads.filter((p) => p.kind === 'archive');
  if (!archived.length) return;
  const title = document.createElement('p');
  title.textContent = 'Saved from the Internet Archive:';
  box.append(title);
  for (const pad of archived) {
    const p = document.createElement('p');
    p.textContent = pad.attribution || pad.label;
    box.append(p);
  }
}

function openSheet(name) {
  sheetName = name;
  for (const section of document.querySelectorAll('.sheet-card section')) {
    section.hidden = section.id !== 'panel-' + name;
  }
  const section = $('panel-' + name);
  $('sheetTitle').textContent = section ? section.dataset.title || 'Laugh Pad' : 'Laugh Pad';
  $('sheet').hidden = false;
  document.querySelectorAll('.dock-btn').forEach((btn) => {
    btn.setAttribute('aria-current', btn.dataset.open === name ? 'page' : 'false');
  });
  const focus = section && section.querySelector('input, button');
  if (focus) focus.focus();
}

function closeSheet() {
  $('sheet').hidden = true;
  sheetName = '';
  document.querySelectorAll('.dock-btn').forEach((btn) => btn.setAttribute('aria-current', 'false'));
}

function openEditor(id) {
  const pad = padById(id);
  if (!pad) return;
  editingId = id;
  $('padName').value = pad.label;
  $('editStatus').textContent = '';
  const lines = [pad.source || '', pad.licenseName || ''];
  if (pad.attribution) lines.push(pad.attribution);
  if (pad.duration) lines.push(pad.duration + 's');
  $('padMeta').textContent = lines.filter(Boolean).join(' · ');
  openSheet('editor');
}

async function loadCatalog() {
  const res = await fetch('data/starter-pack.json');
  if (!res.ok) throw new Error('starter pack');
  const data = await res.json();
  catalog = data.sounds || [];
}

async function migrateLegacy(oldPads) {
  const out = [];
  for (const p of oldPads) {
    if (p.kind === 'synth' && LEGACY_SYNTH[p.synth]) {
      const def = catalog.find((s) => s.id === LEGACY_SYNTH[p.synth]);
      if (def) out.push(makeStarter(def, { id: p.id, label: p.label, colour: p.colour }));
    } else if (p.kind === 'recording' && typeof p.url === 'string' && p.url.startsWith('data:')) {
      try {
        const blob = await (await fetch(p.url)).blob();
        await putClip(p.id, blob);
        out.push({
          id: p.id,
          clipId: p.id,
          kind: 'recording',
          label: p.label,
          colour: p.colour,
          duration: p.duration || null,
          source: 'Microphone on this device',
          licenseName: 'Your recording',
        });
      } catch (_) { /* drop a recording that cannot be stored */ }
    }
  }
  return out;
}

function keepPad(pad) {
  if (!pad || !pad.id || !pad.kind) return false;
  if (pad.kind === 'archive') return classifyLicense(pad.licenseUrl, '').ok && !!pad.clipId;
  if (pad.kind === 'starter') return catalog.some((s) => s.id === pad.soundId);
  if (pad.kind === 'recording') return !!pad.clipId;
  return false;
}

async function bootPads() {
  const saved = readJson(PAD_KEY);
  if (Array.isArray(saved) && saved.length) {
    pads = saved.filter(keepPad);
    let changed = pads.length !== saved.length;
    // Refresh catalog facts on saved starters and add any starter-pack
    // sounds that arrived since these pads were saved, so a pack update
    // shows up for existing installs instead of only fresh ones.
    for (const pad of pads) {
      if (pad.kind !== 'starter') continue;
      const def = catalog.find((s) => s.id === pad.soundId);
      if (!def) continue;
      if (def.source && pad.source !== def.source) { pad.source = def.source; changed = true; }
      if (def.licenseName && pad.licenseName !== def.licenseName) { pad.licenseName = def.licenseName; changed = true; }
      if (def.duration && pad.duration !== def.duration) { pad.duration = def.duration; changed = true; }
    }
    for (const def of catalog) {
      if (!pads.some((p) => p.kind === 'starter' && p.soundId === def.id)) {
        pads.push(makeStarter(def));
        changed = true;
      }
    }
    if (changed) savePads();
    return;
  }
  const legacy = readJson(LEGACY_PAD_KEY);
  if (Array.isArray(legacy) && legacy.length) {
    pads = await migrateLegacy(legacy);
    localStorage.removeItem(LEGACY_PAD_KEY);
  }
  if (!pads.length) pads = catalog.map((def) => makeStarter(def));
  savePads();
}

async function preload() {
  const starters = pads.filter((p) => p.kind === 'starter');
  await Promise.all(starters.map((p) => ensureBuffer(p).catch(() => null)));
  const clips = pads.filter((p) => p.kind !== 'starter');
  await Promise.all(clips.map((p) => ensureBuffer(p).catch(() => null)));
}

function recorderSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function extFor(type) {
  if (!type) return 'webm';
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('wav')) return 'wav';
  return 'webm';
}

function resetRecUi() {
  clearInterval(recTimerId);
  clearTimeout(recCapId);
  $('recTimer').textContent = '';
  $('recBtn').disabled = !recorderSupported();
  $('recBtn').textContent = 'Record';
  $('recBtn').dataset.state = 'idle';
  $('recDiscard').hidden = true;
}

function micDeniedMessage(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    const where = isNative()
      ? ' You can turn it on in Settings → Apps → Laugh Pad → Permissions.'
      : ' You can turn it on in the browser site settings.';
    return 'Microphone access is off, so nothing was recorded.' + where + ' The pads still play.';
  }
  if (name === 'NotFoundError') return 'No microphone was found on this device. The pads still play.';
  if (name === 'SecurityError') return 'Recording needs a secure connection. The pads still play.';
  return 'The microphone could not be started. The pads still play.';
}

async function startRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording(false);
    return;
  }
  $('recStatus').textContent = '';
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError');
    if (denied) {
      $('recStatus').textContent = micDeniedMessage(err);
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (fallbackErr) {
      $('recStatus').textContent = micDeniedMessage(fallbackErr || err);
      return;
    }
  }
  recStream = stream;
  discardTake = false;
  const mime = pickMime();
  const chunks = [];
  try {
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  } catch (_) {
    stream.getTracks().forEach((t) => t.stop());
    $('recStatus').textContent = 'This device cannot record audio. The pads still play.';
    return;
  }
  mediaRecorder._chunks = chunks;
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  mediaRecorder.start(200);
  recStarted = Date.now();
  $('recBtn').textContent = 'Stop and save';
  $('recBtn').dataset.state = 'recording';
  $('recDiscard').hidden = false;
  $('recStatus').textContent = 'Recording. It stops automatically at ' + MAX_RECORD_SECONDS + ' seconds and stays on this device.';
  recTimerId = setInterval(() => {
    $('recTimer').textContent = Math.floor((Date.now() - recStarted) / 1000) + 's';
  }, 200);
  recCapId = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      $('recStatus').textContent = 'Stopped at ' + MAX_RECORD_SECONDS + ' seconds so the clip fits on this device.';
      stopRecording(false);
    }
  }, MAX_RECORD_SECONDS * 1000);
}

function stopRecording(discard) {
  discardTake = discard;
  const recorder = mediaRecorder;
  const started = recStarted;
  if (recorder && recorder.state !== 'inactive') {
    const chunks = recorder._chunks || [];
    recorder.onstop = () => {
      finishStream();
      saveTake(chunks, recorder.mimeType, discard, started);
    };
    recorder.stop();
  } else {
    finishStream();
  }
  resetRecUi();
}

function finishStream() {
  if (recStream) recStream.getTracks().forEach((t) => t.stop());
  recStream = null;
}

async function saveTake(chunks, mime, discard, started) {
  if (discard) {
    $('recStatus').textContent = 'Discarded. Nothing was saved.';
    return;
  }
  const blob = new Blob(chunks, { type: mime || 'audio/webm' });
  if (!blob.size) {
    $('recStatus').textContent = 'That take was empty. Try again.';
    return;
  }
  if (blob.size > 4 * 1024 * 1024) {
    $('recStatus').textContent = 'That recording is over 4 MB, so it was not saved. Try a shorter one.';
    return;
  }
  const id = uid();
  try {
    await putClip(id, blob);
    const audio = await engine.decode(await blob.arrayBuffer());
    buffers.set('clip:' + id, audio);
  } catch (_) {
    $('recStatus').textContent = 'Could not store that recording on this device.';
    return;
  }
  const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
  pads.push({
    id,
    clipId: id,
    kind: 'recording',
    label: 'Recording ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    colour: PALETTE[pads.length % PALETTE.length],
    duration: seconds,
    source: 'Microphone on this device',
    licenseName: 'Your recording',
  });
  savePads();
  renderPads();
  $('recStatus').textContent = 'Saved on this device.';
  setStatus('Recording added to the board.');
}

async function previewResult(result) {
  stopAll();
  const mine = playToken;
  $('searchStatus').textContent = 'Loading preview…';
  try {
    const res = await fetch(result.url);
    if (!res.ok) throw new Error('preview');
    const blob = await res.blob();
    if (blob.size > MAX_BYTES) {
      $('searchStatus').textContent = 'That file is too large to preview.';
      return;
    }
    const audio = await engine.decode(await blob.arrayBuffer());
    if (mine !== playToken) return;
    engine.play(audio);
    $('searchStatus').textContent = 'Playing preview.';
  } catch (_) {
    if (mine === playToken) $('searchStatus').textContent = 'Preview did not load.';
  }
}

async function saveResult(result, button) {
  button.disabled = true;
  $('searchStatus').textContent = 'Saving onto this device…';
  try {
    const res = await fetch(result.url);
    if (!res.ok) throw new Error('download');
    const blob = await res.blob();
    if (blob.size > MAX_BYTES || !blob.size) throw new Error('size');
    const id = uid();
    await putClip(id, blob);
    const audio = await engine.decode(await blob.arrayBuffer());
    buffers.set('clip:' + id, audio);
    const pad = {
      id,
      clipId: id,
      kind: 'archive',
      label: result.title.slice(0, 32),
      colour: PALETTE[pads.length % PALETTE.length],
      duration: result.duration,
      source: 'Internet Archive',
      licenseName: result.license.name,
      licenseUrl: result.license.url,
      creator: result.creator,
      identifier: result.identifier,
      attribution: result.attribution,
    };
    pads.push(pad);
    savePads();
    renderPads();
    $('searchStatus').textContent = 'Saved “' + pad.label + '”. ' + result.license.name + '.';
    setStatus('Saved to the board.');
  } catch (_) {
    button.disabled = false;
    $('searchStatus').textContent = 'Could not save that clip.';
  }
}

function renderResults(results) {
  const box = $('searchResults');
  box.replaceChildren();
  for (const result of results) {
    const row = document.createElement('div');
    row.className = 'result';
    const title = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = result.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = (result.creator ? result.creator + ' · ' : '') + (result.duration ? result.duration + 's' : '');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = result.license.name;
    title.append(name, meta, badge);
    const actions = document.createElement('div');
    actions.className = 'stack-row';
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.textContent = 'Preview';
    preview.addEventListener('click', () => previewResult(result));
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save';
    save.addEventListener('click', () => saveResult(result, save));
    actions.append(preview, save);
    row.append(title, actions);
    box.append(row);
  }
}

async function searchArchive(term) {
  const url = archiveSearchUrl(term);
  const res = await fetch(url);
  if (!res.ok) throw new Error('search');
  const data = await res.json();
  const docs = (data.response && data.response.docs) || [];
  const settled = await Promise.all(docs.map(async (doc) => {
    try {
      const metaRes = await fetch('https://archive.org/metadata/' + encodeURIComponent(doc.identifier));
      if (!metaRes.ok) return null;
      const meta = await metaRes.json();
      const md = meta.metadata || {};
      const license = classifyLicense(md.licenseurl || doc.licenseurl, md.rights || doc.rights);
      if (!license.ok) return null;
      const file = pickClipFile(meta.files);
      if (!file) return null;
      const creatorRaw = md.creator;
      const creator = Array.isArray(creatorRaw) ? creatorRaw.join(', ') : (creatorRaw || '');
      const title = String(doc.title || doc.identifier);
      return {
        title,
        identifier: doc.identifier,
        url: archiveDownloadUrl(doc.identifier, file.name),
        duration: Math.round(file.seconds * 10) / 10,
        license,
        creator,
        attribution: formatAttribution({ title, creator, license, identifier: doc.identifier }),
      };
    } catch (_) {
      return null;
    }
  }));
  return settled.filter(Boolean).slice(0, 8);
}

async function downloadPad(pad) {
  if (pad.kind === 'starter') {
    const def = catalog.find((s) => s.id === pad.soundId);
    if (!def) return;
    const a = document.createElement('a');
    a.href = def.file;
    a.download = slug(pad.label) + '.wav';
    a.click();
    return;
  }
  const blob = await getClip(pad.clipId);
  if (!blob) {
    $('editStatus').textContent = 'That audio is not on this device anymore.';
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slug(pad.label) + '.' + extFor(blob.type);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function deletePad(pad) {
  if (pad.clipId) {
    try { await deleteClip(pad.clipId); } catch (_) { /* still drop the pad */ }
    buffers.delete(bufferKey(pad));
  }
  pads = pads.filter((p) => p.id !== pad.id);
  macros = macros
    .map((m) => ({ ...m, steps: m.steps.filter((id) => id !== pad.id) }))
    .filter((m) => m.steps.length);
  savePads();
  saveMacros();
  editingId = null;
  renderPads();
  closeSheet();
  setStatus('Deleted “' + pad.label + '”.');
}

async function resetBoard() {
  stopAll();
  localStorage.removeItem(PAD_KEY);
  localStorage.removeItem(LEGACY_PAD_KEY);
  localStorage.removeItem(MACRO_KEY);
  try { await clearClips(); } catch (_) { /* storage may already be empty */ }
  buffers.clear();
  pads = catalog.map((def) => makeStarter(def));
  macros = [];
  macroChain = [];
  macroArmed = false;
  editArmed = false;
  savePads();
  saveMacros();
  renderPads();
  updateBanner();
  closeSheet();
  setStatus('Loading sounds…');
  await preload();
  setStatus(pads.length + ' sounds ready');
}

function triggerIndex(index) {
  const pad = pads[index];
  if (!pad) return;
  const el = document.querySelector(`[data-pad-id="${CSS.escape(pad.id)}"]`);
  if (editArmed) {
    editArmed = false;
    updateBanner();
    openEditor(pad.id);
    return;
  }
  if (macroArmed) addToChain(pad.id);
  if (el) {
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 120);
  }
  playPad(pad);
}

function wire() {
  document.addEventListener('pointerdown', () => engine.unlock(), { capture: true });
  document.addEventListener('keydown', () => engine.unlock(), { capture: true });

  $('stopAll').addEventListener('click', stopAll);
  volumeEl.addEventListener('input', () => {
    engine.setVolume(Number(volumeEl.value) / 100);
    saveSettings();
  });

  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (sheetName === btn.dataset.open && !$('sheet').hidden) closeSheet();
      else openSheet(btn.dataset.open);
    });
  });
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', closeSheet);
  });

  $('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const term = safeTerm($('searchInput').value);
    if (!term) return;
    $('searchBtn').disabled = true;
    $('searchStatus').textContent = 'Searching the Internet Archive…';
    $('searchResults').replaceChildren();
    try {
      const results = await searchArchive(term);
      if (!results.length) {
        $('searchStatus').textContent = 'No short clip with a clear license came back. Try another word, or record your own.';
      } else {
        $('searchStatus').textContent = results.length + ' licensed clip' + (results.length === 1 ? '' : 's') + '.';
        renderResults(results);
      }
    } catch (_) {
      $('searchStatus').textContent = 'Search did not complete. Check your connection. Pads you already have still play offline.';
    } finally {
      $('searchBtn').disabled = false;
    }
  });

  $('recBtn').addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording(false);
    else startRecording();
  });
  $('recDiscard').addEventListener('click', () => stopRecording(true));

  $('macroArm').addEventListener('click', () => {
    macroArmed = !macroArmed;
    if (macroArmed) editArmed = false;
    updateBanner();
    renderMacros();
  });
  $('macroClear').addEventListener('click', () => {
    macroChain = [];
    renderMacros();
    updateBanner();
  });
  $('macroSave').addEventListener('click', () => {
    const name = $('macroName').value.trim();
    if (!name || !macroChain.length) {
      setStatus('Name the chain and add at least one pad.');
      return;
    }
    macros.push({ id: uid(), name, steps: macroChain.slice(0, MAX_CHAIN) });
    macroChain = [];
    macroArmed = false;
    $('macroName').value = '';
    saveMacros();
    renderMacros();
    updateBanner();
    setStatus('Saved “' + name + '”.');
  });

  $('editArm').addEventListener('click', () => {
    editArmed = !editArmed;
    if (editArmed) macroArmed = false;
    updateBanner();
    renderMacros();
    if (editArmed) closeSheet();
  });
  $('resetAsk').addEventListener('click', () => openSheet('reset'));
  $('resetConfirm').addEventListener('click', () => { resetBoard(); });

  $('renameBtn').addEventListener('click', () => {
    const pad = padById(editingId);
    const name = $('padName').value.trim();
    if (!pad || !name) return;
    pad.label = name;
    savePads();
    renderPads();
    $('editStatus').textContent = 'Renamed.';
  });
  $('downloadBtn').addEventListener('click', () => {
    const pad = padById(editingId);
    if (pad) downloadPad(pad);
  });
  $('deleteBtn').addEventListener('click', () => {
    const pad = padById(editingId);
    if (pad) deletePad(pad);
  });

  const hotkeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w', 'e', 'r', 't', 'y'];
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (e.key === 'Escape') {
      stopAll();
      if (!$('sheet').hidden) closeSheet();
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (!$('sheet').hidden) return;
    const index = hotkeys.indexOf(String(e.key).toLowerCase());
    if (index >= 0) triggerIndex(index);
  });

  document.addEventListener('backbutton', (e) => {
    if (!$('sheet').hidden) {
      e.preventDefault();
      closeSheet();
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $('installBtn').hidden = true;
  });

  if (!recorderSupported()) {
    $('recBtn').disabled = true;
    $('recStatus').textContent = 'This browser cannot record from the microphone. The pads still play.';
  }

  const statsBox = $('statsToggle');
  if (statsBox) {
    const paintStats = () => {
      const plan = currentStats();
      const note = $('statsState');
      statsBox.checked = plan.reason !== 'off' && plan.reason !== 'dnt';
      statsBox.disabled = plan.reason === 'dnt';
      if (!note) return;
      if (plan.reason === 'dnt') note.textContent = 'This device asked not to be tracked. Nothing is sent.';
      else if (plan.reason === 'off') note.textContent = 'Off. Nothing is sent. This choice stays on this device.';
      else if (plan.reason === 'no-keys') note.textContent = 'On, but this build has no crash or stats keys, so nothing is sent.';
      else if (plan.reason === 'local') note.textContent = 'This page is on a local server, so nothing is sent.';
      else {
        const parts = [];
        if (plan.sentry) parts.push('crash reports');
        if (plan.posthog) parts.push('play stats');
        note.textContent = 'On. Sending ' + parts.join(' and ') + '. No recordings and no names.';
      }
    };
    paintStats();
    statsBox.addEventListener('change', () => {
      setStatsEnabled(statsBox.checked);
      paintStats();
    });
    bootTelemetry();
    paintStats();
  }
}

async function boot() {
  wire();
  const settings = readJson(SETTINGS_KEY) || {};
  if (typeof settings.volume === 'number') volumeEl.value = String(settings.volume);
  engine.setVolume(Number(volumeEl.value) / 100);
  try {
    await loadCatalog();
  } catch (_) {
    setStatus('The starter pack did not load.');
    return;
  }
  await bootPads();
  macros = readJson(MACRO_KEY);
  if (!Array.isArray(macros)) macros = [];
  renderPads();
  setStatus('Loading sounds…');
  await preload();
  setStatus(pads.length + ' sounds ready');
  if (location.hash === '#test') {
    window.__sb = {
      activeVoices: () => engine.activeCount,
      padCount: () => pads.length,
      playIndex: (i) => triggerIndex(i),
    };
  }
  if ('serviceWorker' in navigator) {
    if (isNative()) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    } else {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
}

boot();
