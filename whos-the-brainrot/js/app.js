// Who's the Brainrot? UI flow: home -> setup -> pass & reveal -> clues -> discuss -> pass & vote -> reveal -> guess -> results.
import * as G from './game.js';
import { PACKS, packById, charById, allChars } from './packs.js';
import { charSVG, brainrotSVG } from './art.js';
import { sfx, unlockAudio, setSound } from './audio.js';
import { buzz, setVibe } from './haptics.js';
import { confetti } from './fx.js';
import { playReveal, closeStage } from './reveal.js';
import { load, store, isUnlocked, unlockFor, unlockedUntil, activePacks } from './save.js';
import { ADS, PRIVACY_URL, AGE_RATING } from './config.js';
import { initAds, adAvailable, showRewarded, adsInfo, showPrivacyOptions } from './ads.js';
import { initBilling, billingAvailable, buyRemoveAds, restoreRemoveAds, removeAdsPrice } from './billing.js';
import { initPortal, isPortal, gameplayStart, gameplayStop } from './portal.js';
import { track } from './track.js';
import { loadLog, saveLog, logRound, addLaugh, markBored, summary as ptSummary, exportLog, emptyLog } from './playtest.js';

const $ = s => document.querySelector(s);
const app = $('#app'), stage = $('#stage');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const save = load();
let round = null, draft = null, timer = null, result = null, guessOpts = null;
setSound(save.settings.sound); setVibe(save.settings.vibe);
const persist = () => store(save);
const render = html => { stopTimer(); app.innerHTML = html; app.scrollTop = 0; };
const quitBtn = '<button class="iconbtn" data-act="quit" aria-label="Quit round">✕</button>';
const S = save.settings;
let ptLog = loadLog();
const HOLD_MS = 450, NIGHT_IDLE = 8 * 3600e3;
const sideSlot = () => (S.playtest ? '<button class="iconbtn" data-act="laugh" id="btnLaugh" aria-label="Log a laugh">😂</button>' : '<span style="width:42px"></span>');
const hiddenName = () => (round?.mode === 'reverse' ? 'player who knew' : round?.hidden.length > 1 ? 'Brainrots' : 'Brainrot');

/* ---------------------------------------------------------------- home */
function home() {
  round = null; gameplayStop();
  const cont = save.players.length >= 3 && save.rounds > 0;
  render(`<div class="top"><span class="small dim">Ages ${AGE_RATING}</span><button class="iconbtn" data-act="settings" aria-label="Settings">⚙️</button></div>
  <div class="logo"><div class="t1">Who's the</div><div class="t2">BRAINROT?</div></div>
  <div class="mascot">${brainrotSVG(180)}</div>
  <p class="center dim">Pass-and-play imposter party game<br>3-10 players · one phone · no Wi-Fi needed</p>
  <div class="cast" aria-hidden="true">${PACKS.map(p => p.chars[0]).slice(0, 5).map((c, i) => `<span style="--i:${i};--pc:${packById(c.pack).color}">${charSVG(c, { size: 60, bg: false })}</span>`).join('')}</div>
  <div class="grow"></div>
  <div class="col">
    ${cont ? `<button class="btn big yel" data-act="next">▶ Round ${save.rounds + 1} with ${save.players.length} players</button>` : ''}
    <button class="btn big primary" data-act="setup" id="btnPlay">${cont ? 'New setup' : 'Play'}</button>
    <div class="row"><button class="btn grow" data-act="how">How to play</button><button class="btn grow" data-act="packs">Packs</button></div>
  </div>`);
}

/* ---------------------------------------------------------------- setup */
function setup() {
  draft ||= save.players.length ? save.players.slice() : ['', '', ''];
  const n = draft.filter(x => x.trim()).length;
  if (!G.modeAllowed(S.mode, Math.max(n, 3)) && n >= 3) S.mode = 'classic';
  render(`<div class="top"><button class="iconbtn" data-act="home" aria-label="Back">‹</button><h2>Game setup</h2><button class="iconbtn" data-act="settings" aria-label="Settings">⚙️</button></div>
  <div class="label">Players (${n}/${G.MAX_PLAYERS})</div>
  <div id="players">${draft.map((p, i) => `<div class="pl"><span class="pn" aria-hidden="true">${i + 1}</span><input data-i="${i}" maxlength="14" placeholder="Player ${i + 1}" value="${esc(p)}" autocomplete="off" enterkeyhint="next">${draft.length > 3 ? `<button class="iconbtn" data-act="delp" data-i="${i}" aria-label="Remove">✕</button>` : ''}</div>`).join('')}</div>
  ${draft.length < G.MAX_PLAYERS ? '<button class="btn ghost sm" data-act="addp" id="addp">+ Add player</button>' : ''}
  <div class="label">Mode</div>
  <div class="chips">${Object.entries(G.MODES).map(([k, m]) => `<button class="chip ${S.mode === k ? 'on' : ''}" data-act="mode" data-v="${k}" ${n >= 3 && !G.modeAllowed(k, n) ? 'disabled' : ''}>${m.emoji} ${m.name}</button>`).join('')}</div>
  <p class="small dim">${G.MODES[S.mode].desc}${G.MODES[S.mode].min > 3 ? ` (${G.MODES[S.mode].min}+ players)` : ''}</p>
  <div class="label">Packs</div>
  <div class="packs">${PACKS.map(packTile).join('')}</div>
  <div class="label">Discussion timer</div>
  <div class="chips">${[60, 90, 120, 180].map(t => `<button class="chip ${S.timer === t ? 'on' : ''}" data-act="timer" data-v="${t}">${t < 120 ? t + 's' : t / 60 + ' min'}</button>`).join('')}</div>
  <div class="label">Brainrot help</div>
  <div class="chips">${[['none', 'None'], ['hint', 'Hint word'], ['decoy', 'Decoy secret']].map(([k, l]) => `<button class="chip ${S.hint === k ? 'on' : ''}" data-act="hint" data-v="${k}">${l}</button>`).join('')}</div>
  <p class="small dim">${{ none: 'The Brainrot gets nothing. Pure bluffing.', hint: 'The Brainrot gets a vague hint word.', decoy: "The Brainrot gets a different character and doesn't know they're the Brainrot!" }[S.hint]}</p>
  <div class="label">Clue rounds</div>
  <div class="chips">${[1, 2].map(k => `<button class="chip ${S.clueRounds === k ? 'on' : ''}" data-act="clues" data-v="${k}">${k} ${k === 1 ? 'round' : 'rounds'}</button>`).join('')}</div>
  <div style="height:16px"></div>
  <button class="btn big primary" data-act="start" id="btnStart">Start round</button><div style="height:12px"></div>`);
  app.querySelectorAll('#players input').forEach(inp => {
    inp.oninput = () => { draft[+inp.dataset.i] = inp.value; };
    inp.onkeydown = e => { if (e.key === 'Enter') { const nx = app.querySelector(`#players input[data-i="${+inp.dataset.i + 1}"]`); nx ? nx.focus() : inp.blur(); } };
  });
}
function packTile(p) {
  const un = isUnlocked(save, p.id), on = un && S.packs.includes(p.id);
  const left = !p.free && !save.noAds && un ? Math.ceil((unlockedUntil(save, p.id) - Date.now()) / 3600e3) : 0;
  return `<button class="pack ${on ? 'on' : ''} ${un ? '' : 'locked'}" data-act="pack" data-id="${p.id}">
    ${un ? '' : '<span class="lock">🔒</span>'}<span class="e" style="--pc:${p.color}" aria-hidden="true">${charSVG(p.chars[0], { size: 46, bg: false })}</span><b>${p.name}</b>
    <small>${p.chars.length} characters · ${p.free ? 'Free' : save.noAds ? 'Owned' : un ? `${left}h left` : 'Watch ad: 24h'}</small>
    <span class="faces">${p.chars.slice(0, 4).map(c => charSVG(c, { size: 34, bg: false })).join('')}</span></button>`;
}

/* ---------------------------------------------------------------- round: pass & reveal */
function startRound() {
  const v = G.validPlayers(draft || save.players);
  if (!v.ok) return toast(v.why);
  if (!G.modeAllowed(S.mode, v.names.length)) return toast(`${G.MODES[S.mode].name} needs ${G.MODES[S.mode].min}+ players`);
  if (save.players.join('|') !== v.names.join('|')) { for (const k of Object.keys(save.scores)) if (!v.names.includes(k)) delete save.scores[k]; }
  save.players = v.names; draft = v.names.slice();
  if (!save.night || (save.night.last && Date.now() - save.night.last > NIGHT_IDLE)) save.night = G.newNight();
  persist();
  if (!G.freshLeft(activePacks(save), save.night.used)) return nightOut();
  round = G.newRound({ players: save.players, packs: activePacks(save), mode: S.mode, hint: S.hint, recent: save.recent, used: save.night.used });
  round.step = 0; result = null; guessOpts = null;
  track('round_start', { mode: S.mode, players: save.players.length, pack: round.packId });
  gameplayStart(); sfx.whoosh(); passTo(0);
}
function passTo(i) {
  const name = round.roles[i].name;
  render(`<div class="top">${quitBtn}<span class="small dim">Secret ${i + 1} of ${round.roles.length}</span><span style="width:42px"></span></div>
  <div class="pass"><div class="phone">📱</div><p class="dim">Pass the phone to</p><div class="who">${esc(name)}</div><p class="dim small">No peeking, everyone else! 👀</p></div>
  <button class="btn big primary" data-act="showcard" data-i="${i}" id="btnShow">I'm ${esc(name)}, show me</button>`);
}
function cardScreen(i) {
  const r = round.roles[i], m = round.mode, pack = packById(round.packId);
  let back;
  if (r.sees.type === 'brainrot') {
    const tip = m === 'reverse' ? 'Everyone is a Brainrot except ONE player who knows the secret. Find them, then figure it out!' : m === 'two' ? 'There are TWO Brainrots. Blend in, fake a clue, don\'t get caught.' : 'Blend in. Fake a clue. Don\'t get caught.';
    back = `<div class="face back rot">${brainrotSVG(150)}<div class="big">You're the Brainrot!</div><div class="tg">${tip}</div>${r.sees.hint ? `<div class="hintw">Hint: ${esc(r.sees.hint)}</div>` : ''}<div class="tg">Pack: ${pack.emoji} ${pack.name}</div></div>`;
  } else {
    const c = charById(r.sees.charId);
    const head = r.role === 'knower' ? '<div class="big" style="font-size:22px">Only YOU know this! 🤫</div>' : '<div class="small dim">The secret is…</div>';
    const tip = r.role === 'knower' ? 'Everyone else is a Brainrot. Give clues that blend in so they can\'t spot you.' : `Give ONE ${m === 'silent' ? 'gesture' : 'word'} clue. Not too obvious!`;
    back = `<div class="face back">${head}${charSVG(c, { size: 160 })}<div class="nm">${esc(c.name)}</div><div class="tg">${esc(c.tag)}</div><div class="tg"><b>${tip}</b></div></div>`;
  }
  render(`<div class="top">${quitBtn}<span class="small dim">${esc(r.name)}</span><span style="width:42px"></span></div>
  <div class="pass"><div class="card3d" id="card" role="button" tabindex="0" aria-label="Press and hold to see your card"><div class="in"><div class="face front"><div class="q">?</div><b>Press &amp; hold to peek</b><span class="small dim">Only ${esc(r.name)} looks! Let go to hide it.</span><div class="holdbar" aria-hidden="true"><i id="holdFill"></i></div></div>${back}</div></div></div>
  <button class="btn big" data-act="hidecard" data-i="${i}" id="btnHide" style="visibility:hidden">Seen it. Pass the phone ▶</button>`);
  armHold($('#card'));
}
// Hold-to-reveal: the card only shows while it's held, so a glance from the next player can't leak it.
function armHold(card) {
  let t0 = 0, raf = 0, holding = false, seen = false;
  const fill = $('#holdFill');
  const loop = () => {
    if (!holding) return;
    const k = Math.min(1, (performance.now() - t0) / HOLD_MS); fill.style.width = k * 100 + '%';
    if (k < 1) { raf = requestAnimationFrame(loop); return; }
    card.classList.add('flip'); sfx.secret(); buzz('tap'); // identical sound/vibration for every role, so nobody can hear who's the Brainrot
    if (!seen) { seen = true; setTimeout(() => { const b = $('#btnHide'); if (b) b.style.visibility = 'visible'; }, 350); }
  };
  const down = e => { e.preventDefault?.(); if (holding) return; holding = true; t0 = performance.now(); if (e.pointerId != null) card.setPointerCapture?.(e.pointerId); loop(); };
  const up = () => { if (!holding) return; holding = false; cancelAnimationFrame(raf); fill.style.width = '0'; card.classList.remove('flip'); };
  card.addEventListener('pointerdown', down);
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) card.addEventListener(ev, up);
  card.addEventListener('contextmenu', e => e.preventDefault());
  card.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); });
  card.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') up(); });
}
function afterCard(i) { sfx.back(); if (i + 1 < round.roles.length) passTo(i + 1); else { round.step = 0; clues(); } }

/* ---------------------------------------------------------------- clues */
function clues() {
  const n = round.roles.length, total = n * S.clueRounds, k = round.step;
  if (k >= total) return discuss();
  const who = round.order[k % n], silent = round.mode === 'silent', pack = packById(round.packId);
  render(`<div class="top">${quitBtn}<span class="small dim">${silent ? '🤫 Silent round' : 'Clue time'} · ${S.clueRounds > 1 ? `round ${Math.floor(k / n) + 1}/${S.clueRounds} · ` : ''}${pack.emoji} ${pack.name}</span>${sideSlot()}</div>
  <div class="order">${round.order.map((p, j) => `<span class="${j === k % n ? 'now' : j < k % n ? 'done' : ''}">${esc(round.roles[p].name)}</span>`).join('')}</div>
  <div class="turn"><p class="dim">Your turn</p><div class="who">${esc(round.roles[who].name)}</div>
  <h2>${silent ? 'Act out ONE clue.<br>No talking! 🤫' : 'Say ONE word<br>about the secret'}</h2>
  <p class="dim">${silent ? 'Gestures, faces and poses only. Sounds = cheating.' : "Don't make it too obvious… the Brainrot is listening."}</p></div>
  <button class="btn big primary" data-act="nextclue" id="btnNextClue">${k + 1 >= total ? 'Start discussion ⏱' : 'Next player ▶'}</button>`);
  sfx.ui();
}

/* ---------------------------------------------------------------- discussion timer */
function discuss() {
  const silent = round.mode === 'silent';
  let end = Date.now() + S.timer * 1000, lastSec = -1;
  render(`<div class="top">${quitBtn}<span class="small dim">${silent ? '🤫 Silent discussion' : 'Discussion'}</span>${sideSlot()}</div>
  <div class="center"><h2>${round.mode === 'reverse' ? 'Who knows the secret?' : "Who's the Brainrot?"}</h2>
  <p class="dim">${silent ? 'Point, gesture, make faces. Still NO words!' : 'Argue! Accuse! Defend yourself!'}</p></div>
  <div class="timer" id="timer"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff18" stroke-width="8"/><circle id="arc" cx="50" cy="50" r="44" fill="none" stroke="#ff2e88" stroke-width="8" stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><div class="num" id="tnum">${S.timer}</div></div>
  <div class="grow"></div>
  <div class="row"><button class="btn grow" data-act="addtime">+30s</button><button class="btn grow primary" data-act="tovote" id="btnVoteNow">Vote now 🗳</button></div>`);
  const tick = () => {
    const left = Math.max(0, end - Date.now()), sec = Math.ceil(left / 1000);
    const arc = $('#arc'); if (!arc) return stopTimer();
    arc.style.strokeDashoffset = String(276.5 * (1 - left / (S.timer * 1000 + (round.extra || 0))));
    if (sec !== lastSec) { lastSec = sec; $('#tnum').textContent = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : sec; if (sec <= 10 && sec > 0) { sfx.tick(sec <= 3); $('#timer').classList.add('hurry'); } }
    if (left <= 0) { stopTimer(); sfx.buzzer(); buzz('heavy'); setTimeout(() => round && votePass(0), 900); }
  };
  round.extra = 0; round.addTime = () => { end += 30e3; round.extra += 30e3; $('#timer')?.classList.remove('hurry'); sfx.boing(); };
  timer = setInterval(tick, 200); tick();
}
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

/* ---------------------------------------------------------------- voting */
function votePass(i) {
  if (i >= round.roles.length) return votesIn();
  const name = round.roles[i].name;
  render(`<div class="top">${quitBtn}<span class="small dim">Secret ${round.tied ? 'revote' : 'vote'} ${i + 1} of ${round.roles.length}</span><span style="width:42px"></span></div>
  <div class="pass"><div class="phone">🗳</div><p class="dim">Pass the phone to</p><div class="who">${esc(name)}</div><p class="dim small">Vote in secret. No peeking!</p></div>
  <button class="btn big primary" data-act="voteme" data-i="${i}" id="btnVoteMe">I'm ${esc(name)}, let me vote</button>`);
}
function voteGrid(i) {
  render(`<div class="top">${quitBtn}<span class="small dim">${esc(round.roles[i].name)} is voting</span><span style="width:42px"></span></div>
  <h2 class="center">${round.tied ? 'Revote! 🔁' : round.mode === 'reverse' ? 'Who knows the secret?' : "Who's the Brainrot?"}</h2><p class="center dim">${round.tied ? 'Only the tied players are on the ballot' : 'Tap your suspect'}</p>
  <div class="votes">${G.voteTargets(round, i).map(j => `<button class="btn" data-act="vote" data-i="${i}" data-t="${j}">${esc(round.roles[j].name)}</button>`).join('')}</div>`);
}
// Stated tie-break rule (playtest fix): a tied vote goes to a revote between the tied players, then to tonight's points.
function votesIn() {
  const t = G.tally(round);
  if (!t.tie) return voteDone();
  if (!round.tied) {
    sfx.boing(); buzz('heavy');
    return render(`<div class="pass"><div class="phone">⚖️</div><h1>It's a tie!</h1>
    <p class="dim">${t.top.map(j => `<b>${esc(round.roles[j].name)}</b>`).join(' · ')} got ${t.counts[t.top[0]]} ${t.counts[t.top[0]] === 1 ? 'vote' : 'votes'} each.</p>
    <div class="panel small tierule" id="tieRule"><b>Tie-break rule:</b> ${esc(G.TIE_BREAK_RULE)}</div></div>
    <button class="btn big primary" data-act="revote" id="btnRevote">Revote between them 🔁</button>`);
  }
  const s = G.settleTie(round, save.scores);
  const msg = s.step === 'points'
    ? `Still tied! <b>${esc(round.roles[s.accused].name)}</b> has the fewest points tonight, so they're accused.`
    : `Still tied, and level on points too. The ${hiddenName()} ${round.hidden.length > 1 && round.mode !== 'reverse' ? 'escape' : 'escapes'}!`;
  render(`<div class="pass"><div class="phone">⚖️</div><h1>Tie-break</h1><p>${msg}</p>
  <div class="panel small tierule"><b>Tie-break rule:</b> ${esc(G.TIE_BREAK_RULE)}</div></div>
  <button class="btn big primary" data-act="tiedone" id="btnTieDone">Continue</button>`);
}
function voteDone() {
  render(`<div class="pass"><div class="phone">🥁</div><h1>All votes are in!</h1><p class="dim">Gather round for the big reveal.</p>
  ${S.clip ? '<p class="panel small">🎬 <b>Clip mode is on.</b> Start your screen recording now, then tap Reveal. Perfect for Shorts & TikTok.</p>' : '<p class="small dim">Tip: turn on Clip mode in ⚙️ for a recording-ready reveal.</p>'}</div>
  <button class="btn big primary" data-act="reveal" id="btnReveal">Reveal 🥁</button>`);
}
async function doReveal() {
  const t = G.tally(round), hidden = G.hiddenRole(round);
  track('reveal', { clip: S.clip, tie: t.tie });
  await playReveal(stage, { names: round.roles.map(r => r.name), voted: t.voted, isHidden: i => round.hidden.includes(i), clip: S.clip, fast: !!window.__wtb_fast, hiddenLabel: hidden === 'knower' ? 'the one who knew' : 'the Brainrot' });
  const btn = document.createElement('div'); btn.className = 'cont';
  btn.innerHTML = `<button class="btn big ${G.caught(round) ? 'yel' : 'primary'}" id="btnAfterReveal">${G.caught(round) ? (round.mode === 'reverse' ? 'Brainrots: guess the secret!' : 'Last chance: guess the secret!') : 'See results'}</button>`;
  setTimeout(() => stage.append(btn), S.clip ? 900 : 0);
  btn.onclick = () => { closeStage(stage); sfx.ui(); G.caught(round) ? guessScreen() : finish(null); };
}

/* ---------------------------------------------------------------- guess */
function guessScreen() {
  const pack = packById(round.packId), t = G.tally(round), who = round.roles[t.voted].name;
  guessOpts ||= G.guessOptions(round, pack);
  render(`<div class="top">${quitBtn}<span class="small dim">${pack.emoji} ${pack.name}</span><span style="width:42px"></span></div>
  <h2 class="center">${round.mode === 'reverse' ? `You found ${esc(who)}! 🔎` : `${esc(who)}, you got caught!`}</h2>
  <p class="center dim">${round.mode === 'reverse' ? 'Brainrots, agree on the secret character to win:' : 'Guess the secret character to steal the win:'}</p>
  <div class="guess">${guessOpts.map(id => { const c = charById(id); return `<button data-act="guess" data-id="${id}">${charSVG(c, { size: 70, bg: false })}${esc(c.name)}</button>`; }).join('')}</div>`);
}

/* ---------------------------------------------------------------- results */
function finish(guessId) {
  result = G.resolve(round, guessId);
  save.scores = G.applyScores(save.scores, save.players, result.points); save.rounds++;
  save.recent = [round.secretId, ...save.recent].slice(0, 24);
  G.noteRound(save.night, round); save.night.last = Date.now(); persist();
  if (S.playtest) {
    logRound(ptLog, save.night.started, { secretId: round.secretId, pack: round.packId, mode: round.mode, players: round.roles.length, hidden: round.hidden.length,
      tie: result.tie, revote: !!round.tied, accusedOnPoints: round.accused != null, caught: result.caught, guessed: result.guessed, winner: result.winner, laughs: round.laughs || 0 });
    saveLog(ptLog);
  }
  track('round_end', { winner: result.winner, reason: result.reason, mode: round.mode });
  gameplayStop(); results();
}
function results() {
  const sec = charById(round.secretId), m = round.mode, names = round.hidden.map(i => round.roles[i].name);
  const crewWon = (m !== 'reverse' && result.winner === 'crew') || (m === 'reverse' && result.winner === 'brainrot');
  const title = m === 'reverse' ? (result.winner === 'knower' ? `${esc(names[0])} WINS! 🤫` : 'BRAINROTS WIN! 🧠') : (crewWon ? 'CREW WINS! 🎉' : (round.hidden.length > 1 ? 'THE BRAINROTS WIN! 🧠' : 'THE BRAINROT WINS! 🧠'));
  const why = {
    survived: m === 'reverse' ? 'Nobody figured out who knew the secret.' : 'You voted out the wrong person!',
    tie: 'Split vote… they slipped away.', guessed: 'Caught… but they guessed the secret! 😱',
    caught: "Caught, and they couldn't guess the secret.", 'wrong-guess': 'Found… but the Brainrots guessed wrong!', 'caught-and-guessed': 'Found the knower AND guessed the secret!',
  }[result.reason];
  const lb = G.leaderboard(save.scores, save.players);
  render(`<div class="banner ${crewWon ? 'crew' : 'rot'}">${title}</div><p class="center">${why}</p>
  <div class="panel secretcard">${charSVG(sec, { size: 96 })}<div><div class="small dim">The secret was</div><b style="font-size:20px">${esc(sec.name)}</b><div class="small dim">${esc(sec.tag)}</div>
  ${round.decoyId ? `<div class="small">Decoy: ${esc(charById(round.decoyId).name)}</div>` : ''}${result.caught ? `<div class="small">Guess: ${round.guess ? esc(charById(round.guess)?.name || '-') : '-'}</div>` : ''}</div></div>
  <p class="center"><b>${m === 'reverse' ? 'Knew the secret' : names.length > 1 ? 'Brainrots' : 'Brainrot'}:</b> ${names.map(esc).join(' & ')}</p>
  <div class="label">Scores · after ${save.rounds} ${save.rounds === 1 ? 'round' : 'rounds'}</div>
  <div class="board" id="board">${lb.map(({ name, score }) => { const i = save.players.indexOf(name), p = result.points[i]; return `<div class="r ${round.hidden.includes(i) ? 'rot' : ''}"><b>${esc(name)}</b>${p ? `<span class="plus">+${p}</span>` : ''}<span class="pts">${score}</span></div>`; }).join('')}</div>
  <div class="grow" style="min-height:14px"></div>
  <div class="col"><button class="btn big primary" data-act="next" id="btnNext">Next round ▶</button>
  <div class="row"><button class="btn grow" data-act="setup">Setup</button><button class="btn grow ghost" data-act="endgame">End game</button></div>
  ${S.playtest ? '<button class="btn sm ghost" data-act="bored" id="btnBored">🧪 Playtest: we\'re bored</button>' : ''}</div>`);
  setTimeout(() => sfx.voice(sec.name, sec.voice), 150);
  if (crewWon) { sfx.fanfare(); confetti(120); } else setTimeout(() => sfx.brainrot(), 700);
}

/* ---------------------------------------------------------------- night: no repeats, mode rotation, summary */
function nightOut() {
  sfx.fanfare();
  modal(`<h2>Every character used! 🎉</h2><p class="dim">You've had all ${activePacks(save).reduce((k, p) => k + p.chars.length, 0)} characters in your packs tonight, so nobody sees a repeat. Add a pack, end the night, or start reusing them.</p>
  <div class="col"><button class="btn big primary" data-act="packs">Packs</button><button class="btn big" data-act="endgame">End the night</button><button class="btn big ghost" data-act="reuse" id="btnReuse">Reuse characters</button></div>`);
}
function rotatePrompt(next) {
  const cur = G.MODES[S.mode], m = G.MODES[next];
  save.night.askedAt = save.night.rounds; persist();
  modal(`<h2>Mix it up?</h2><p class="dim">That's ${save.night.streak} ${cur.name} rounds in a row. Try ${m.emoji} <b>${m.name}</b>: ${m.desc}</p>
  <div class="col"><button class="btn big primary" data-act="rotate" data-v="${next}" id="btnRotate">Switch to ${m.name}</button><button class="btn big ghost" data-act="keepmode" id="btnKeepMode">Keep ${cur.name}</button></div>`);
}
function nextRound() {
  draft = save.players.slice();
  const nt = save.night;
  if (nt && G.shouldRotate(nt) && nt.mode === S.mode && nt.askedAt !== nt.rounds) { const nx = G.nextMode(S.mode, save.players.length); if (nx !== S.mode) return rotatePrompt(nx); }
  startRound();
}
function endNight() {
  const snap = { rounds: save.rounds, lb: G.leaderboard(save.scores, save.players), used: (save.night?.used || []).slice() };
  save.scores = {}; save.rounds = 0; save.night = G.newNight(); persist(); closeModal(); closeStage(stage);
  if (!snap.rounds) return home();
  render(`<div class="top"><span style="width:42px"></span><h2>Night summary</h2><span style="width:42px"></span></div>
  <p class="center dim">${snap.rounds} ${snap.rounds === 1 ? 'round' : 'rounds'} · ${snap.used.length} different ${snap.used.length === 1 ? 'character' : 'characters'} · no repeats</p>
  <div class="label">Final scores</div>
  <div class="board" id="nightBoard">${snap.lb.map(({ name, score }, k) => `<div class="r"><b>${k === 0 && score > 0 ? '👑 ' : ''}${esc(name)}</b><span class="pts">${score}</span></div>`).join('')}</div>
  <div class="label">Characters played tonight</div>
  <div class="usedchars">${snap.used.map(id => charById(id)).filter(Boolean).map(c => `<span>${charSVG(c, { size: 54, bg: false })}<small>${esc(c.name)}</small></span>`).join('')}</div>
  <div class="grow" style="min-height:14px"></div>
  <button class="btn big primary" data-act="home" id="btnNightDone">Done</button>`);
  if (snap.lb[0]?.score > 0) { sfx.fanfare(); confetti(100); }
}

/* ---------------------------------------------------------------- modals */
function modal(html) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200); }
function how() {
  modal(`<h2>How to play</h2><ol class="how">
  <li><b>Pass the phone.</b> Each player presses and holds the card to peek at the secret character (let go and it hides), except the <b>Brainrot</b>, who sees "You're the Brainrot!"</li>
  <li><b>Clues.</b> Going around, everyone says ONE word about the secret. The Brainrot has to fake it.</li>
  <li><b>Discuss.</b> Argue until the timer runs out.</li>
  <li><b>Vote</b> in secret, passing the phone around. Then watch the big reveal.</li>
  <li>The <b>Brainrot wins</b> by surviving the vote, or by guessing the secret after getting caught.</li></ol>
  <p><b>Tie votes:</b> ${esc(G.TIE_BREAK_RULE)}</p>
  <p><b>No repeats:</b> a secret character never comes up twice in one night.</p>
  <p><b>Scoring:</b> Brainrot win +2 each. Crew win +1 each, +1 more if you voted for a Brainrot.</p>
  <p><b>Modes:</b> 👯 Two Imposters (5+), 🤫 Silent Round (gesture clues, no talking), 🔄 Reverse (only one player knows; everyone else hunts them).</p>
  <button class="btn big primary" data-act="close">Got it</button>`);
}
function packsModal() {
  const buy = billingAvailable() && !save.noAds;
  modal(`<h2>Packs</h2><p class="dim small">Starter is free forever. Watch a short ad to unlock any other pack for ${ADS.unlockHours} hours.</p>
  <div class="col">${PACKS.map(p => { const un = isUnlocked(save, p.id); const left = Math.ceil((unlockedUntil(save, p.id) - Date.now()) / 3600e3);
    return `<div class="panel row"><span class="e" style="--pc:${p.color}" aria-hidden="true">${charSVG(p.chars[0], { size: 40, bg: false })}</span><div class="grow"><b>${p.name}</b><div class="small dim">${p.chars.length} characters · ${p.free ? 'Free' : save.noAds ? 'Owned' : un ? `Unlocked · ${left}h left` : 'Locked'}</div></div>
    ${un ? '✅' : `<button class="btn sm yel" data-act="unlock" data-id="${p.id}" id="unlock-${p.id}">▶ 24h</button>`}</div>`; }).join('')}</div>
  ${buy ? `<div style="height:10px"></div><button class="btn big primary" data-act="buy">All packs forever · no ads · ${removeAdsPrice()}</button>` : ''}
  <div style="height:10px"></div><button class="btn big ghost" data-act="close">Close</button>`);
}
async function unlock(id) {
  if (!adAvailable()) return toast('Ads unavailable right now. Try again later.');
  closeModal();
  if (await showRewarded('unlock_pack', S.sound)) {
    unlockFor(save, id, ADS.unlockHours); if (!S.packs.includes(id)) S.packs.push(id); persist();
    sfx.fanfare(); confetti(80); toast(`${packById(id).name} unlocked for ${ADS.unlockHours}h!`); track('pack_unlock', { pack: id });
  } else toast('No reward this time.');
  refresh();
}
function settings() {
  const ai = adsInfo();
  modal(`<div class="settings"><h2>Settings</h2>
  <div class="toggle">Sound <button class="chip ${S.sound ? 'on' : ''}" data-act="set" data-k="sound">${S.sound ? 'On' : 'Off'}</button></div>
  <div class="toggle">Vibration <button class="chip ${S.vibe ? 'on' : ''}" data-act="set" data-k="vibe">${S.vibe ? 'On' : 'Off'}</button></div>
  <div class="toggle"><span>🎬 Clip mode<br><span class="small dim">3-2-1 countdown, captions and a watermark on the reveal, made for screen recording Shorts/TikTok.</span></span><button class="chip ${S.clip ? 'on' : ''}" data-act="set" data-k="clip" id="clipToggle">${S.clip ? 'On' : 'Off'}</button></div>
  <div class="toggle"><span>🧪 Playtest log<br><span class="small dim">For test nights: adds a 😂 laugh counter and logs each round on this phone only (no names). Copy it out to see which characters flop.</span></span><button class="chip ${S.playtest ? 'on' : ''}" data-act="set" data-k="playtest" id="playtestToggle">${S.playtest ? 'On' : 'Off'}</button></div>
  ${S.playtest ? playtestPanel() : ''}
  ${billingAvailable() ? '<div class="toggle">Purchases <button class="chip" data-act="restore">Restore</button></div>' : ''}
  ${ai.native && ai.privacyRequired ? '<div class="toggle">Ad privacy <button class="chip" data-act="privopts">Privacy options</button></div>' : ''}
  <p class="small dim">No account. Crash reports and play counts are anonymous: no names, no screen recordings. Optional rewarded ads may share device info with the ad provider. Ages ${AGE_RATING}.</p>
  ${isPortal ? '' : `<p class="small"><a href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy policy</a></p>`}
  <p class="small dim">Who's the Brainrot? v0.1.0 · Diddlerrr</p>
  <button class="btn big ghost" data-act="close">Close</button></div>`);
}
function playtestPanel() {
  const s = ptSummary(ptLog), pct = x => (x == null ? '-' : Math.round(x * 100) + '%');
  return `<div class="panel small" id="ptPanel">${s.rounds} rounds over ${s.nights} ${s.nights === 1 ? 'night' : 'nights'} · ${s.laughs} laughs · hidden side wins ${pct(s.imposterWinRate)} · guess-backs ${pct(s.guessBackSuccess)}${s.boredAfter.length ? ` · bored after ${s.boredAfter.join(', ')} rounds` : ''}
  <div class="row" style="margin-top:8px"><button class="chip" data-act="ptcopy" id="ptCopy">Copy log</button><button class="chip" data-act="ptclear">Clear log</button></div></div>`;
}
async function copyLog() {
  const txt = exportLog(ptLog, allChars());
  try { await navigator.clipboard.writeText(txt); toast('Playtest log copied'); }
  catch { modal(`<h2>Playtest log</h2><textarea class="ptlog" readonly>${esc(txt)}</textarea><button class="btn big ghost" data-act="close">Close</button>`); }
}
function refresh() { if (app.querySelector('#btnStart')) setup(); else if (app.querySelector('#btnPlay')) home(); }

/* ---------------------------------------------------------------- actions */
const act = {
  home: () => { sfx.back(); home(); }, setup: () => { sfx.ui(); draft = null; setup(); }, how: () => { sfx.ui(); how(); }, packs: () => { sfx.ui(); packsModal(); }, settings: () => { sfx.ui(); settings(); }, close: () => { sfx.back(); closeModal(); },
  addp: () => { if (draft.length < G.MAX_PLAYERS) { draft.push(''); sfx.ui(); setup(); app.querySelector(`#players input[data-i="${draft.length - 1}"]`)?.focus(); } },
  delp: b => { draft.splice(+b.dataset.i, 1); sfx.back(); setup(); },
  mode: b => { S.mode = b.dataset.v; persist(); sfx.ui(); setup(); }, timer: b => { S.timer = +b.dataset.v; persist(); sfx.ui(); setup(); },
  hint: b => { S.hint = b.dataset.v; persist(); sfx.ui(); setup(); }, clues: b => { S.clueRounds = +b.dataset.v; persist(); sfx.ui(); setup(); },
  pack: b => { const id = b.dataset.id; if (!isUnlocked(save, id)) return packsModal();
    const i = S.packs.indexOf(id); if (i >= 0) { if (S.packs.filter(p => isUnlocked(save, p)).length > 1) S.packs.splice(i, 1); else return toast('Pick at least one pack'); } else S.packs.push(id); persist(); sfx.ui(); setup(); },
  start: () => { sfx.ui(); startRound(); }, next: () => nextRound(),
  showcard: b => { sfx.ui(); cardScreen(+b.dataset.i); }, hidecard: b => afterCard(+b.dataset.i),
  revote: () => { G.startRevote(round); sfx.whoosh(); votePass(0); }, tiedone: () => { sfx.ui(); voteDone(); },
  rotate: b => { S.mode = b.dataset.v; persist(); closeModal(); sfx.ui(); startRound(); }, keepmode: () => { closeModal(); sfx.ui(); startRound(); },
  reuse: () => { save.night.used = []; persist(); closeModal(); startRound(); },
  laugh: () => { if (!round) return; const k = addLaugh(round); sfx.boing(); toast(`😂 ${k} ${k === 1 ? 'laugh' : 'laughs'} this round`); },
  bored: () => { const k = markBored(ptLog, save.night.started); saveLog(ptLog); toast(`Logged: bored after ${k} ${k === 1 ? 'round' : 'rounds'}`); },
  ptcopy: () => copyLog(),
  ptclear: () => modal(`<h2>Clear the playtest log?</h2><p class="dim">This deletes every logged round on this phone.</p><div class="row"><button class="btn grow ghost" data-act="settings">Cancel</button><button class="btn grow primary" data-act="ptclearyes">Clear</button></div>`),
  ptclearyes: () => { ptLog = emptyLog(); saveLog(ptLog); toast('Playtest log cleared'); settings(); },
  nextclue: () => { round.step++; clues(); }, addtime: () => round.addTime?.(), tovote: () => { sfx.ui(); votePass(0); },
  voteme: b => { sfx.ui(); voteGrid(+b.dataset.i); },
  vote: b => { const i = +b.dataset.i; G.castVote(round, i, +b.dataset.t); sfx.ui(); buzz('tap'); votePass(i + 1); },
  reveal: () => doReveal(),
  guess: b => { sfx.ui(); finish(b.dataset.id); },
  quit: () => modal(`<h2>Quit this round?</h2><p class="dim">Scores from finished rounds are kept.</p><div class="row"><button class="btn grow ghost" data-act="close">Keep playing</button><button class="btn grow primary" data-act="quityes">Quit</button></div>`),
  quityes: () => { closeModal(); closeStage(stage); home(); },
  endgame: () => modal(`<h2>End the night?</h2><p class="dim">You'll see tonight's summary, then everyone's score resets and characters can come up again.</p><div class="row"><button class="btn grow ghost" data-act="close">Cancel</button><button class="btn grow primary" data-act="endyes">End night</button></div>`),
  endyes: () => endNight(),
  unlock: b => unlock(b.dataset.id),
  buy: async () => { closeModal(); if (await buyRemoveAds(save)) { persist(); toast('All packs unlocked forever!'); confetti(); } refresh(); },
  restore: async () => { await restoreRemoveAds(save); persist(); toast(save.noAds ? 'Purchase restored' : 'Nothing to restore'); closeModal(); refresh(); },
  privopts: () => showPrivacyOptions(),
  set: b => { const k = b.dataset.k; S[k] = !S[k]; persist(); if (k === 'sound') setSound(S.sound); if (k === 'vibe') setVibe(S.vibe); sfx.ui(); settings(); },
};
document.addEventListener('click', e => {
  unlockAudio();
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  act[b.dataset.act]?.(b);
});

/* ---------------------------------------------------------------- boot */
window.__wtb = { save, get round() { return round; }, get result() { return result; }, get playtest() { return ptLog; }, G };
track('app_open', { platform: window.Capacitor?.isNativePlatform?.() ? 'android' : 'web', app_version: '0.1.0' });
home();
initPortal(); initAds(); initBilling(save, () => { persist(); refresh(); });
