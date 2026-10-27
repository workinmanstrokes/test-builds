// Pure game logic (no DOM): modes, round setup, roles, clue order, votes, resolution, scoring.
export const MODES = {
  classic: { name: 'Classic', min: 3, emoji: '🧠', desc: 'One Brainrot hides among you.' },
  two: { name: 'Two Imposters', min: 5, emoji: '👯', desc: 'Two Brainrots. Double the chaos.' },
  silent: { name: 'Silent Round', min: 3, emoji: '🤫', desc: 'No talking! Clues are gestures only.' },
  reverse: { name: 'Reverse', min: 4, emoji: '🔄', desc: 'Only ONE player knows the secret. Everyone else is a Brainrot.' },
};
export const MIN_PLAYERS = 3, MAX_PLAYERS = 10;

export function rng32(seed = Date.now()) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffle(arr, rnd = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

export function validPlayers(names) {
  const clean = names.map(n => String(n || '').trim()).filter(Boolean);
  if (clean.length < MIN_PLAYERS) return { ok: false, why: `Need at least ${MIN_PLAYERS} players` };
  if (clean.length > MAX_PLAYERS) return { ok: false, why: `Max ${MAX_PLAYERS} players` };
  if (new Set(clean.map(n => n.toLowerCase())).size !== clean.length) return { ok: false, why: 'Names must be different' };
  return { ok: true, names: clean };
}
export const modeAllowed = (mode, n) => n >= (MODES[mode]?.min ?? 99);

/**
 * players: names; packs: [{id, chars}] already filtered to the packs in play; mode; hint: 'none'|'hint'|'decoy'
 * recent: char ids to avoid repeating. Returns a round object.
 */
export function newRound({ players, packs, mode = 'classic', hint = 'none', recent = [], rnd = Math.random }) {
  const n = players.length;
  if (!modeAllowed(mode, n)) throw new Error(`${MODES[mode]?.name || mode} needs ${MODES[mode]?.min}+ players`);
  const pack = pick(packs, rnd);
  const fresh = pack.chars.filter(c => !recent.includes(c.id));
  const secret = pick(fresh.length ? fresh : pack.chars, rnd);
  const decoy = pick(pack.chars.filter(c => c.id !== secret.id), rnd);
  const idx = shuffle([...Array(n).keys()], rnd);
  const hidden = mode === 'two' ? idx.slice(0, 2) : idx.slice(0, 1);
  const roles = players.map((name, i) => {
    const isHidden = hidden.includes(i);
    if (mode === 'reverse') return isHidden ? { name, role: 'knower', sees: { type: 'secret', charId: secret.id } } : { name, role: 'brainrot', sees: { type: 'brainrot', hint: hint === 'hint' ? secret.hint : null } };
    if (!isHidden) return { name, role: 'crew', sees: { type: 'secret', charId: secret.id } };
    if (hint === 'decoy') return { name, role: 'brainrot', sees: { type: 'decoy', charId: decoy.id } };
    return { name, role: 'brainrot', sees: { type: 'brainrot', hint: hint === 'hint' ? secret.hint : null } };
  });
  // clue order: random start, but a lone Brainrot never has to go first (classic party-game courtesy)
  let start = Math.floor(rnd() * n);
  if (mode !== 'reverse' && hidden.includes(start)) start = (start + 1) % n;
  if (mode !== 'reverse' && hidden.includes(start)) start = (start + 1) % n;
  const order = [...Array(n).keys()].map(k => (start + k) % n);
  return { mode, hint, packId: pack.id, secretId: secret.id, decoyId: hint === 'decoy' ? decoy.id : null, roles, hidden, order, votes: {}, guess: null };
}

export const hiddenRole = round => (round.mode === 'reverse' ? 'knower' : 'brainrot');

export function castVote(round, voter, target) {
  if (voter === target) throw new Error('no self votes');
  if (target < 0 || target >= round.roles.length) throw new Error('bad target');
  round.votes[voter] = target;
}

export function tally(round) {
  const counts = Array(round.roles.length).fill(0);
  for (const t of Object.values(round.votes)) counts[t]++;
  const max = Math.max(...counts);
  const top = counts.map((c, i) => (c === max ? i : -1)).filter(i => i >= 0);
  const tie = top.length !== 1 || max === 0;
  return { counts, top, tie, voted: tie ? -1 : top[0] };
}

/** Was a hidden player voted out? (then the guess phase runs) */
export function caught(round) { const t = tally(round); return !t.tie && round.hidden.includes(t.voted); }

/** Multiple-choice options for the secret guess: the secret + up to 7 others from the same pack. */
export function guessOptions(round, pack, rnd = Math.random) {
  const others = shuffle(pack.chars.filter(c => c.id !== round.secretId), rnd).slice(0, 7).map(c => c.id);
  return shuffle([round.secretId, ...others], rnd);
}

/**
 * Resolve the round. guessId = the character picked in the guess phase (only used when caught).
 * Normal modes: Brainrot wins by surviving the vote (+2 each) or by guessing the secret after being caught (+2 each).
 *               Otherwise the crew wins: +1 each, +1 bonus for every crew member who voted for a Brainrot.
 * Reverse:      the knower wins by surviving (+3) or if the Brainrots guess wrong after catching them (+2).
 *               If the Brainrots catch the knower AND guess the secret: +1 each, +1 bonus for voting the knower.
 */
export function resolve(round, guessId = null) {
  const t = tally(round), wasCaught = !t.tie && round.hidden.includes(t.voted);
  const guessed = wasCaught && guessId === round.secretId;
  round.guess = wasCaught ? guessId : null;
  const pts = Array(round.roles.length).fill(0);
  let winner, reason;
  const votedHidden = v => round.hidden.includes(round.votes[v]);
  if (round.mode !== 'reverse') {
    if (!wasCaught) { winner = 'brainrot'; reason = t.tie ? 'tie' : 'survived'; round.hidden.forEach(i => (pts[i] += 2)); }
    else if (guessed) { winner = 'brainrot'; reason = 'guessed'; round.hidden.forEach(i => (pts[i] += 2)); }
    else { winner = 'crew'; reason = 'caught'; round.roles.forEach((r, i) => { if (r.role === 'crew') pts[i] += 1 + (votedHidden(i) ? 1 : 0); }); }
  } else {
    const k = round.hidden[0];
    if (!wasCaught) { winner = 'knower'; reason = t.tie ? 'tie' : 'survived'; pts[k] += 3; }
    else if (!guessed) { winner = 'knower'; reason = 'wrong-guess'; pts[k] += 2; }
    else { winner = 'brainrot'; reason = 'caught-and-guessed'; round.roles.forEach((r, i) => { if (i !== k) pts[i] += 1 + (votedHidden(i) ? 1 : 0); }); }
  }
  return { winner, reason, caught: wasCaught, guessed, voted: t.voted, tie: t.tie, counts: t.counts, points: pts };
}

export function applyScores(scores, names, points) {
  const out = { ...scores };
  names.forEach((n, i) => { out[n] = (out[n] || 0) + (points[i] || 0); });
  return out;
}
export const leaderboard = (scores, names) => names.map(n => ({ name: n, score: scores[n] || 0 })).sort((a, b) => b.score - a.score);
