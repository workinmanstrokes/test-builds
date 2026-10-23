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
