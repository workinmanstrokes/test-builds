// Light meta progression (character-upgrades plan §3.2): the Anomaly Notebook fills in as you spot anomalies, and
// every 10 entries unlocks a cosmetic. Endings and clip mode add locker stickers shown on the title screen.
// Cosmetic only: nothing here changes difficulty, scoring or odds, and nothing is for sale.
import { ANOMALIES, byId } from './anomalies.js';

export const NOTEBOOK_TOTAL = ANOMALIES.length;
export const notebookCount = save => Object.keys(save.seen || {}).filter(id => byId[id]).length;

// Flashlight colour: tints the hint highlight, the reveal ring and the streak pips.
export const FLASHLIGHTS = [
  { id: 'warm', name: 'Warm bulb', color: '#ffd666', need: 0 },
  { id: 'mint', name: 'Mint', color: '#7ee0b5', need: 10 },
  { id: 'rose', name: 'Rose', color: '#ff8fb1', need: 20 },
  { id: 'ice', name: 'Ice blue', color: '#8fd3ff', need: 30 },
  { id: 'violet', name: 'Violet', color: '#c39bff', need: 40 },
];
// Locker stickers.
export const STICKERS = [
  { id: 'n10', label: 'OBSERVANT', icon: '👁', col: '#7ee0b5', how: 'Notebook: 10 entries', ok: s => notebookCount(s) >= 10 },
  { id: 'n20', label: 'SHARP EYES', icon: '✦', col: '#ff8fb1', how: 'Notebook: 20 entries', ok: s => notebookCount(s) >= 20 },
  { id: 'n30', label: 'NIGHT SHIFT', icon: '☾', col: '#8fd3ff', how: 'Notebook: 30 entries', ok: s => notebookCount(s) >= 30 },
  { id: 'n40', label: 'HONOR ROLL', icon: '★', col: '#c39bff', how: 'Notebook: 40 entries', ok: s => notebookCount(s) >= 40 },
  { id: 'all', label: 'PERFECT ATTENDANCE', icon: '✓', col: '#f2c94c', how: `Notebook: all ${NOTEBOOK_TOTAL}`, ok: s => notebookCount(s) >= NOTEBOOK_TOTAL },
  { id: 'bell', label: 'FINAL BELL', icon: '🔔', col: '#f6efdc', how: 'Reach The Final Bell', ok: s => !!s.endings?.normal },
  { id: 'nine', label: 'ROOM 9', icon: '9', col: '#f2c94c', how: 'Find the secret ending', ok: s => !!s.endings?.secret },
  { id: 'held', label: 'HELD BACK', icon: '✎', col: '#ff6b5e', how: 'Get held back', ok: s => !!s.endings?.bad },
  { id: 'clip', label: '3-SECOND EYES', icon: '⏱', col: '#7ee0b5', how: 'Clip mode: 8/10 or better', ok: s => (s.clipBest || 0) >= 8 },
];

export const lightUnlocked = (save, id) => { const f = FLASHLIGHTS.find(x => x.id === id); return !!f && notebookCount(save) >= f.need; };
export const flashlight = save => { const id = save.cosmetics?.light; return FLASHLIGHTS.find(f => f.id === id && lightUnlocked(save, id)) || FLASHLIGHTS[0]; };
export const nextUnlock = save => { const n = notebookCount(save); const f = FLASHLIGHTS.find(x => x.need > n); return f ? { need: f.need, left: f.need - n } : null; };

/** Records newly earned stickers / flashlights in save.unlocks and returns them (for a toast). */
export function checkUnlocks(save) {
  save.unlocks = save.unlocks || []; const have = new Set(save.unlocks), fresh = [];
  for (const st of STICKERS) if (!have.has('s:' + st.id) && st.ok(save)) fresh.push({ type: 'sticker', id: st.id, name: st.label });
  for (const f of FLASHLIGHTS) if (f.need > 0 && !have.has('l:' + f.id) && notebookCount(save) >= f.need) fresh.push({ type: 'light', id: f.id, name: f.name + ' flashlight' });
  for (const u of fresh) save.unlocks.push((u.type === 'sticker' ? 's:' : 'l:') + u.id);
  return fresh;
}
export const stickersEarned = save => STICKERS.filter(s => (save.unlocks || []).includes('s:' + s.id));
