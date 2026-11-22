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
export function newRound({ players, packs, mode = 'classic', hint = 'none', recent = [], used = [], rnd = Math.random }) {
  const n = players.length;
  if (!modeAllowed(mode, n)) throw new Error(`${MODES[mode]?.name || mode} needs ${MODES[mode]?.min}+ players`);
  // used = secrets already drawn tonight (never repeated while any are left); recent = earlier nights (avoided when possible)
  const tiers = [c => !used.includes(c.id) && !recent.includes(c.id), c => !used.includes(c.id), () => true];
  const ok = tiers.find(f => packs.some(p => p.chars.some(f)));
  const pack = pick(packs.filter(p => p.chars.some(ok)), rnd);
  const secret = pick(pack.chars.filter(ok), rnd);
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
  return { mode, hint, packId: pack.id, secretId: secret.id, decoyId: hint === 'decoy' ? decoy.id : null, roles, hidden, order, votes: {}, guess: null, tied: null, firstVotes: null, accused: null };
}

export const hiddenRole = round => (round.mode === 'reverse' ? 'knower' : 'brainrot');

export function castVote(round, voter, target) {
  if (voter === target) throw new Error('no self votes');
  if (target < 0 || target >= round.roles.length) throw new Error('bad target');
  if (round.tied && !round.tied.includes(target)) throw new Error('revote is only between the tied players');
  round.votes[voter] = target;
}

export function tally(round) {
  const counts = Array(round.roles.length).fill(0);
  for (const t of Object.values(round.votes)) counts[t]++;
  const max = Math.max(...counts);
  const top = counts.map((c, i) => (c === max ? i : -1)).filter(i => i >= 0);
  if (round.accused != null) return { counts, top, tie: false, voted: round.accused };
  const tie = top.length !== 1 || max === 0;
  return { counts, top, tie, voted: tie ? -1 : top[0] };
}

/* ---- Tie-break (playtest fix): the rule is shown on screen whenever a vote ties. */
export const TIE_BREAK_RULE = 'Everyone revotes, choosing only between the tied players. Still tied? The tied player with the fewest points tonight is accused. Tied on points too? The hidden player escapes.';
/** Who can be voted for in this vote (everyone but the voter; only the tied players during a revote). */
export const voteTargets = (round, voter) => round.roles.map((_, j) => j).filter(j => j !== voter && (!round.tied || round.tied.includes(j)));
/** First vote tied: keep it for the record and start a revote between the tied players. */
export function startRevote(round) {
  const t = tally(round);
  if (!t.tie || round.tied) throw new Error('no revote needed');
  round.firstVotes = { ...round.votes }; round.tied = t.top; round.votes = {};
  return round.tied;
}
/**
 * After the revote. Still tied: the tied player with the fewest points tonight (scores keyed by name) is accused.
 * Returns { step: 'decided'|'points'|'escaped', accused }.
 */
export function settleTie(round, scores = {}) {
  const t = tally(round);
  if (!t.tie) return { step: 'decided', accused: t.voted };
  const pts = i => scores[round.roles[i].name] || 0;
  const low = Math.min(...t.top.map(pts)), lowest = t.top.filter(i => pts(i) === low);
  if (lowest.length === 1) { round.accused = lowest[0]; return { step: 'points', accused: lowest[0] }; }
  return { step: 'escaped', accused: -1 };
}

/* ---- Per-night no-repeat pool (playtest fix). night = { used: [charId], rounds, streak, mode } */
export const ROTATE_EVERY = 3;
export const newNight = () => ({ used: [], rounds: 0, streak: 0, mode: null, started: Date.now() });
/** Characters in these packs that haven't been the secret yet tonight. */
export const freshLeft = (packs, used) => packs.reduce((k, p) => k + p.chars.filter(c => !used.includes(c.id)).length, 0);
/** Record a finished round on the night. */
export function noteRound(night, round) {
  if (!night.used.includes(round.secretId)) night.used.push(round.secretId);
  night.streak = night.mode === round.mode ? night.streak + 1 : 1; night.mode = round.mode; night.rounds++;
}
/** After every few rounds of the same mode, suggest the next mode this group can play. */
export const shouldRotate = night => night.streak > 0 && night.streak % ROTATE_EVERY === 0;
export function nextMode(current, players) {
  const keys = Object.keys(MODES);
  for (let k = 1; k <= keys.length; k++) { const m = keys[(keys.indexOf(current) + k) % keys.length]; if (modeAllowed(m, players)) return m; }
  return current;
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
