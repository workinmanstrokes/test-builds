// Local save (localStorage only; nothing leaves the device).
import { PACKS, packById } from './packs.js';
const KEY = 'wtb.save.v1';
const DEF = () => ({ v: 1, players: [], scores: {}, rounds: 0, lifetimeRounds: 0, owned: [], unlocks: {}, noAds: false, recent: [],
  settings: { sound: true, vibe: true, vol: 0.8, clip: false, large: false, reduced: false, theme: 'classic', clueTimer: 20, mode: 'classic', hint: 'none', timer: 90, clueRounds: 1, packs: ['starter'] } });
export function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1) { const b = DEF(); return { ...b, ...d, settings: { ...b.settings, ...d.settings } }; } } catch {}
  return DEF();
}
export function store(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function unlockedUntil(s, id) { return s.unlocks[id] || 0; }
export function isUnlocked(s, id, now = Date.now()) { const p = packById(id); return !!p && (p.free || s.noAds || (s.owned || []).includes(id) || unlockedUntil(s, id) > now); }
/** Locked packs that aren't owned for good, in pack order (the free-every-5-rounds reward goes to the first). */
export function notOwned(s) { return PACKS.filter(p => !p.free && !s.noAds && !(s.owned || []).includes(p.id)).map(p => p.id); }
export function unlockFor(s, id, hours, now = Date.now()) { s.unlocks[id] = Math.max(now, s.unlocks[id] || 0) + hours * 3600e3; }
export function activePacks(s, now = Date.now()) {
  const sel = s.settings.packs.filter(id => isUnlocked(s, id, now));
  return (sel.length ? sel : ['starter']).map(packById);
}
export { PACKS };
