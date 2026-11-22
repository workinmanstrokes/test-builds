// Playtest log (playtest fix #1): opt-in, stays on this device, never sent anywhere and never stores player names.
// For the blind party playtests: rounds before boredom or a repeat, laughs per character, imposter win rate,
// guess-back success, and the bottom quarter of characters by laughs per draw (cut/rewrite candidates).
const KEY = 'wtb.playtest.v1';
export const emptyLog = () => ({ v: 1, nights: [] });
export function loadLog(ls = globalThis.localStorage) {
  try { const d = JSON.parse(ls.getItem(KEY)); if (d && d.v === 1 && Array.isArray(d.nights)) return d; } catch {}
  return emptyLog();
}
export function saveLog(log, ls = globalThis.localStorage) { try { ls.setItem(KEY, JSON.stringify(log)); } catch {} }

function night(log, nightId) {
  let n = log.nights.find(x => x.id === nightId);
  if (!n) { n = { id: nightId, started: new Date(nightId).toISOString(), rounds: [], boredAt: null, repeatAt: null }; log.nights.push(n); }
  return n;
}
/** A round finished. entry: { secretId, pack, mode, players, hidden, tie, revote, caught, guessed, winner }. */
export function logRound(log, nightId, entry) {
  const n = night(log, nightId);
  if (n.repeatAt == null && n.rounds.some(r => r.secretId === entry.secretId)) n.repeatAt = n.rounds.length + 1;
  n.rounds.push({ n: n.rounds.length + 1, laughs: 0, ...entry });
  return n.rounds[n.rounds.length - 1];
}
/** Count laughs for the round being played (they are attached to its secret when the round is logged). */
export function addLaugh(pending, k = 1) { pending.laughs = (pending.laughs || 0) + k; return pending.laughs; }
/** The group says they're bored: remember how many rounds they lasted. */
export function markBored(log, nightId) { const n = night(log, nightId); if (n.boredAt == null) n.boredAt = n.rounds.length; return n.boredAt; }

export function summary(log) {
  const rounds = log.nights.flatMap(n => n.rounds);
  const hiddenWon = rounds.filter(r => r.winner === 'brainrot' && r.mode !== 'reverse' || r.winner === 'knower').length;
  const guesses = rounds.filter(r => r.caught);
  return {
    nights: log.nights.length, rounds: rounds.length,
    imposterWinRate: rounds.length ? hiddenWon / rounds.length : null,
    guessBackSuccess: guesses.length ? guesses.filter(r => r.guessed).length / guesses.length : null,
    boredAfter: log.nights.map(n => n.boredAt).filter(x => x != null),
    repeatAt: log.nights.map(n => n.repeatAt).filter(x => x != null),
    laughs: rounds.reduce((k, r) => k + (r.laughs || 0), 0),
  };
}
/** Bottom quarter of the given characters by laughs per draw (only characters drawn at least once are ranked). */
export function bottomQuarter(log, chars) {
  const t = new Map(chars.map(c => [c.id, { id: c.id, name: c.name, drawn: 0, laughs: 0 }]));
  for (const n of log.nights) for (const r of n.rounds) { const x = t.get(r.secretId); if (x) { x.drawn++; x.laughs += r.laughs || 0; } }
  const ranked = [...t.values()].filter(x => x.drawn).map(x => ({ ...x, perDraw: x.laughs / x.drawn })).sort((a, b) => a.perDraw - b.perDraw);
  return ranked.slice(0, Math.ceil(ranked.length / 4));
}
export const exportLog = (log, chars) => JSON.stringify({ summary: summary(log), bottomQuarter: bottomQuarter(log, chars), nights: log.nights }, null, 2);
