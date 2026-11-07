// +1 Aura social: pure helpers (no DOM, no network) so they run in node tests and in the game.
// Boards: 3 modes x (all-time | this ISO week). Friends board = the same boards read for your friend uids only.
export const MODES = {
  aura:   { label: 'Aura',   unit: 'aura',   max: 1e15, icon: '✦' },   // all-time aura earned (s.ever)
  tower:  { label: 'Tower',  unit: 'floor',  max: 9,    icon: '🗼' },   // best tower floor reached (1..9)
  escape: { label: 'Escape', unit: 'm',      max: 2e5,  icon: '⚡' },   // best Speed Escape distance
};
export const MODE_IDS = Object.keys(MODES);
export const AVATARS = ['😇', '🔥', '⚡', '👑', '🦄', '🐉', '🌙', '💎', '🍀', '🚀', '🐱', '👾'];
export const NAME_RE = /^[A-Za-z0-9 _.\-]{3,16}$/;
const BAD = ['fuck','shit','bitch','cunt','dick','cock','pussy','nigg','fag','slut','whore','rape','nazi','hitler','porn','penis','vagina','retard','kike','spic','chink','twat','wank','bastard','asshole','tranny','dyke','coon','molest','pedo','cum'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
export function isProfane(name) {
  const n = String(name).toLowerCase().replace(/[013457@$!]/g, c => LEET[c]).replace(/[^a-z]/g, '');
  return BAD.some(w => n.includes(w));
}
/** Returns { ok, name, why }. Trims, collapses spaces, checks charset/length/profanity. */
export function cleanName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!NAME_RE.test(name)) return { ok: false, name, why: '3-16 letters, numbers, space . _ -' };
  if (isProfane(name)) return { ok: false, name, why: 'Pick a different name' };
  return { ok: true, name };
}
export const defaultName = uid => `Aurie${String(uid || Math.random()).replace(/\D/g, '').slice(-4).padStart(4, '7')}`;
/** ISO week id like 2026-W43 (UTC). */
export function weekId(t = Date.now()) {
  const d = new Date(t); const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
export const boardId = (mode, scope, t) => `${mode}_${scope === 'week' ? weekId(t) : 'all'}`;
/** Scores sent to the server: integers within bounds (rules re-check the same bounds). */
export function scoresFrom(s) {
  return {
    aura: Math.min(MODES.aura.max, Math.floor(s.ever || 0)),
    tower: Math.min(MODES.tower.max, (s.best?.floor || 0) + 1),
    escape: Math.min(MODES.escape.max, Math.floor(s.escape?.best || 0)),
  };
}
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
export function friendCode(rand = Math.random) { let c = ''; for (let i = 0; i < 6; i++) c += CODE_ABC[Math.floor(rand() * CODE_ABC.length)]; return c; }
export const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const validCode = c => /^[A-HJKMNP-Z2-9]{6}$/.test(c);
export const CHALLENGE_BASE = 'https://workinmanstrokes.github.io/test-builds/plus-one-aura/';
export function challengeUrl({ code, name, mode, score }, base = CHALLENGE_BASE) {
  const q = new URLSearchParams({ ch: code || '', n: name || '', m: mode, s: String(Math.floor(score)) });
  return `${base}?${q}`;
}
export function parseChallenge(search) {
  const q = new URLSearchParams(search || ''); if (!q.has('m') || !q.has('s')) return null;
  const mode = q.get('m'), score = Math.floor(+q.get('s'));
  if (!MODES[mode] || !Number.isFinite(score) || score < 0 || score > MODES[mode].max) return null;
  const c = cleanName(q.get('n')); const code = normCode(q.get('ch'));
  return { mode, score, name: c.ok ? c.name : 'A friend', code: validCode(code) ? code : null };
}
export function fmtScore(mode, v) {
  if (mode === 'tower') return `Floor ${v}`;
  if (mode === 'escape') return `${v} m`;
  const u = ['', 'K', 'M', 'B', 'T', 'Qa']; let i = 0; while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return (i ? v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) : Math.floor(v)) + u[i];
}
export const challengeText = (c, url) => `I hit ${fmtScore(c.mode, c.score)} in +1 Aura ${MODES[c.mode].label}. Beat my score! ${url}`;

/** First UTC day covered by the direct score sweep. Not the full rules regex (2020–2099). */
export const DELETE_EPOCH_MS = Date.UTC(2026, 9, 1);
export const DELETION_MAIL = 'mscofield1588@gmail.com';
const OWN_ENTRY = /^(?:boards\/(?:aura|tower|escape)_(?:all|\d{4}-W\d{2})\/entries\/([^/]+)|daily\/\d{4}-\d{2}-\d{2}\/entries\/([^/]+))$/;

export function utcDayIds(startMs, endMs) {
  const s = new Date(startMs), e = new Date(endMs);
  let t = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const end = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
  const out = [];
  for (; t <= end; t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
export function weekIdsBetween(startMs, endMs) {
  return [...new Set(utcDayIds(startMs, endMs).map(d => weekId(Date.parse(`${d}T00:00:00Z`))))];
}
/**
 * Paths addressed without trusting local score history.
 * Profile, ghost, known codes, every all-time board, and every week and day from DELETE_EPOCH through `now` + 1 day.
 * Local `posted` / `sent` maps are ignored. This is not every id the rules regex allows.
 */
export function directSocialPaths(uid, codes = [], now = Date.now()) {
  if (!uid || typeof uid !== 'string') return [];
  const out = [['profiles', uid], ['ghosts', uid]];
  const seen = new Set();
  for (const code of codes) if (validCode(code) && !seen.has(code)) { seen.add(code); out.push(['codes', code]); }
  const end = now + 864e5;
  for (const mode of MODE_IDS) {
    out.push(['boards', `${mode}_all`, 'entries', uid]);
    out.push(['scoreIndex', uid, 'rows', `${mode}_all`]);
  }
  for (const w of weekIdsBetween(DELETE_EPOCH_MS, end)) for (const mode of MODE_IDS) {
    out.push(['boards', `${mode}_${w}`, 'entries', uid]);
    out.push(['scoreIndex', uid, 'rows', `${mode}_${w}`]);
  }
  for (const day of utcDayIds(DELETE_EPOCH_MS, end)) {
    out.push(['daily', day, 'entries', uid]);
    out.push(['scoreIndex', uid, 'rows', day]);
  }
  return out;
}
const INDEX_RE = /^scoreIndex\/([^/]+)\/rows\/((?:aura|tower|escape)_(?:all|\d{4}-W\d{2})|\d{4}-\d{2}-\d{2})$/;
/** Accept this user's score entry, or their own score-index row. Anything else is ignored. */
export function ownEntryParts(path, uid) {
  const text = String(path || '');
  const m = OWN_ENTRY.exec(text);
  if (m) {
    const id = m[1] || m[2];
    if (id !== uid) return null;
    return text.split('/');
  }
  const idx = INDEX_RE.exec(text);
  if (!idx || idx[1] !== uid) return null;
  return text.split('/');
}
/**
 * False. Rows outside the checked dates that were never written to scoreIndex are not listed,
 * and scanning every id the rules regex allows exceeds the Spark daily write quota.
 */
export function clientCanProveUntaggedRowsGone() { return false; }
export function authDeletionAllowed({ discoveryOk, requeryEmpty, failures, legacyUntaggedProvable } = {}) {
  return discoveryOk === true
    && requeryEmpty === true
    && !(failures || []).length
    && legacyUntaggedProvable === true
    && clientCanProveUntaggedRowsGone() === true;
}
export function manualDeletionRequest({ uid, code, installId } = {}) {
  return [
    'Please delete my +1 Aura server data.',
    `Friend code: ${code || '(not on this device)'}`,
    `Anonymous id: ${uid || '(no sign-in on this device)'}`,
    'Social rows: profiles/{id}, codes/{code}, ghosts/{id}, boards/{mode}_{all|week}/entries/{id}, daily/{date}/entries/{id}.',
    installId
      ? `Analytics install id, separate from the anonymous id; the app cannot delete these session rows: ${installId}`
      : 'No analytics install id is stored on this device.',
    'The app does not delete Firebase Analytics, AdMob data, or session rows in the analytics project.',
  ].join('\n');
}
export function deletionResultMessage(r = {}) {
  if (r.offline) return 'You are offline. Nothing on the server was deleted. The sign-in was kept.';
  if (r.noSession) return 'This device has no anonymous sign-in. Nothing was deleted, and no new id was created.';
  if (r.mismatch) return 'The sign-in on this device does not match the saved player id. Nothing was deleted. The sign-in was kept.';
  const bits = ['The anonymous sign-in was kept so a missed score row is not left without an owner.'];
  bits.push('Checked the profile, friend code, ghost, all-time boards, and every week and day from 1 Oct 2026 through tomorrow. A saved list of old scores on this device is not used as proof.');
  if (!r.discoveryOk) bits.push('The list of score ids stored under your sign-in did not succeed. That list works only after the updated rules are published. Rows outside the checked dates that were never indexed can remain.');
  else if (r.requeryEmpty && !(r.failed || []).length) bits.push('Every indexed score id was removed. Rows outside the checked dates that were never indexed can remain.');
  else bits.push('Some deletes failed, so those items are still on the server. Try again. The sign-in is still here.');
  if (r.failed?.length) bits.push('Still reported: ' + r.failed.slice(0, 6).map(f => f.path).join(', ') + '.');
  bits.push(`Email ${DELETION_MAIL} for a manual request. The app cannot confirm that request, and it does not delete analytics.`);
  return bits.join(' ');
}
/** Best-effort social cleanup. Does not delete auth unless authDeletionAllowed, which the client cannot satisfy. */
export async function performSocialDeletion(io) {
  const uid = io.uid;
  const manualRequest = manualDeletionRequest(io);
  if (!uid) return { authDeleted: false, authRetained: true, deleted: [], failed: [], discoveryOk: false, requeryEmpty: false, manualRequest, message: deletionResultMessage({ noSession: true }) };
  let serverCode = null;
  try { const profile = await io.getProfile(); if (profile?.code) serverCode = profile.code; } catch { /* still try the local code */ }
  const codes = [];
  if (validCode(serverCode)) codes.push(serverCode);
  if (validCode(io.localCode) && io.localCode !== serverCode) codes.push(io.localCode);
  const queue = directSocialPaths(uid, codes, io.now || Date.now());
  let discoveryOk = false;
  try {
    const q = await io.queryOwnEntries();
    if (q?.ok) {
      discoveryOk = true;
      for (const path of q.paths || []) { const parts = ownEntryParts(path, uid); if (parts) queue.push(parts); }
    }
  } catch { discoveryOk = false; }
  const deleted = [], failed = [], seen = new Set();
  for (const parts of queue) {
    const key = parts.join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    try { await io.deleteDoc(parts); deleted.push(key); }
    catch (e) {
      const code = e?.code || e?.message || 'error';
      if (code === 'not-found') { deleted.push(key); continue; }
      failed.push({ path: key, code });
    }
  }
  let requeryEmpty = false;
  if (discoveryOk && !failed.length) {
    try {
      const again = await io.queryOwnEntries();
      discoveryOk = !!again?.ok;
      requeryEmpty = !!(again?.ok && !(again.paths || []).length);
    } catch { discoveryOk = false; requeryEmpty = false; }
  }
  const allowAuth = authDeletionAllowed({ discoveryOk, requeryEmpty, failures: failed, legacyUntaggedProvable: clientCanProveUntaggedRowsGone() });
  let authDeleted = false;
  if (allowAuth) { await io.deleteUser(); authDeleted = true; }
  const result = { authDeleted, authRetained: !authDeleted, deleted, failed, discoveryOk, requeryEmpty, manualRequest: manualDeletionRequest({ uid, code: serverCode || io.localCode, installId: io.installId }) };
  result.message = deletionResultMessage(result);
  return result;
}
