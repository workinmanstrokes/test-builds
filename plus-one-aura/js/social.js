// +1 Aura social layer: leaderboards (global / weekly / friends x aura / tower / escape), profile, friend codes,
// score-card sharing and "beat my score" challenge links.
// Backend: Firebase Spark only (Firestore + Anonymous Auth via the web SDK, also inside the Capacitor WebView).
// No Cloud Functions. When SOCIAL.online is false, no Firebase config exists, or we're on a portal build, everything
// falls back to an offline local mode (your own bests + challenges + sharing still work).
import { SOCIAL } from './config.js';
import { FIREBASE_WEB } from './firebase-config.js';
import * as C from './social-core.js';

const LS = 'plusoneaura.social.v1';
let me = load(); let api = null, starting = null;
export const socialStatus = { mode: 'offline', why: '' };
window.__aura_social = socialStatus;
function load() { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch { return null; } }
function persist() { try { localStorage.setItem(LS, JSON.stringify(me)); } catch {} }
if (!me) { me = { uid: null, name: C.defaultName(), avatar: C.AVATARS[0], code: C.friendCode(), friends: [], sent: {}, sentAt: 0 }; persist(); }
export const profile = () => me;
export const isOnline = () => socialStatus.mode === 'online';

export function onlineAllowed(portal) {
  if (portal) return 'portal build';
  if (!SOCIAL.online) return 'online leaderboards not switched on yet';
  if (!FIREBASE_WEB) return 'no Firebase config';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return '';
}

/** Connect lazily (first time the Ranks screen opens or a score is submitted). Never throws. */
export function connect(portal = false) {
  const why = onlineAllowed(portal); if (why) { socialStatus.mode = 'offline'; socialStatus.why = why; return Promise.resolve(false); }
  if (api) return Promise.resolve(true);
  return starting ||= (async () => {
    try {
      const v = '12.6.0', base = `https://www.gstatic.com/firebasejs/${v}`;
      const [{ initializeApp, getApps }, A, F] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
      const app = getApps()[0] || initializeApp(FIREBASE_WEB);
      const auth = A.getAuth(app); const cred = auth.currentUser ? { user: auth.currentUser } : await A.signInAnonymously(auth);
      api = { F, db: F.getFirestore(app), uid: cred.user.uid };
      me.uid = api.uid; persist();
      await ensureProfile();
      socialStatus.mode = 'online'; socialStatus.why = ''; return true;
    } catch (e) { socialStatus.mode = 'offline'; socialStatus.why = 'error: ' + (e?.code || e?.message); console.warn('social offline', e); api = null; return false; }
    finally { starting = null; }
  })();
}

async function ensureProfile() {
  const { F, db, uid } = api; const ref = F.doc(db, 'profiles', uid); const snap = await F.getDoc(ref);
  if (snap.exists()) { const d = snap.data(); Object.assign(me, { name: d.name, avatar: d.avatar, code: d.code, friends: d.friends || [] }); persist(); return; }
  for (let i = 0; i < 5; i++) {   // claim a unique friend code (create-only doc; rules reject taking an existing one)
    try { await F.setDoc(F.doc(db, 'codes', me.code), { uid }); break; } catch { me.code = C.friendCode(); }
  }
  await F.setDoc(ref, { name: me.name, avatar: me.avatar, code: me.code, friends: me.friends.slice(0, 100), at: F.serverTimestamp() });
  persist();
}

export async function setProfile(name, avatar) {
  const c = C.cleanName(name); if (!c.ok) return c;
  if (!C.AVATARS.includes(avatar)) avatar = C.AVATARS[0];
  me.name = c.name; me.avatar = avatar; me.sent = {}; persist();       // re-send scores so boards show the new name
  if (api) { try { const { F, db, uid } = api; await F.updateDoc(F.doc(db, 'profiles', uid), { name: me.name, avatar, at: F.serverTimestamp() }); } catch (e) { return { ok: false, why: 'Saved locally (try again in a minute)' }; } }
  return { ok: true, name: me.name };
}

/** Add a friend by 6-char code. Online only (codes live in Firestore). */
export async function addFriend(raw) {
  const code = C.normCode(raw);
  if (!C.validCode(code)) return { ok: false, why: 'Codes are 6 letters/numbers' };
  if (code === me.code) return { ok: false, why: "That's your own code" };
  if (!api) return { ok: false, why: 'Friends need the online leaderboard' };
  const { F, db, uid } = api;
  try {
    const snap = await F.getDoc(F.doc(db, 'codes', code)); if (!snap.exists()) return { ok: false, why: 'No player with that code' };
    const fid = snap.data().uid; if (me.friends.includes(fid)) return { ok: false, why: 'Already friends' };
    if (me.friends.length >= 100) return { ok: false, why: 'Friend list is full (100)' };
    me.friends.push(fid); persist();
    await F.updateDoc(F.doc(db, 'profiles', uid), { friends: F.arrayUnion(fid), at: F.serverTimestamp() });
    const p = await F.getDoc(F.doc(db, 'profiles', fid));
    return { ok: true, name: p.exists() ? p.data().name : 'Friend' };
  } catch (e) { return { ok: false, why: 'Could not add friend (' + (e?.code || 'network') + ')' }; }
}

/** Submit improved bests. Client throttle 120 s (31 s when forced); the rules also enforce 30 s per board entry + bounds + increase-only. */
export async function submitScores(s, portal = false, force = false, now = Date.now()) {
  if (now - (me.sentAt || 0) < (force ? 31e3 : 120e3)) return 0;   // rules allow one write per entry per 30 s
  if (!(await connect(portal))) return 0;
  const { F, db, uid } = api; const sc = C.scoresFrom(s); let n = 0; me.sentAt = now;
  const wk = C.weekId(now); me.week ||= {}; if (me.weekId !== wk) { me.weekId = wk; me.week = {}; }
  for (const mode of C.MODE_IDS) {
    const v = sc[mode]; if (!(v > 0)) continue;
    // weekly board: best value *reached* this week (first submit of the week seeds it with the current best)
    for (const scope of ['all', 'week']) {
      const id = C.boardId(mode, scope, now);
      if ((me.sent[id] || 0) >= v) continue;
      try { await F.setDoc(F.doc(db, 'boards', id, 'entries', uid), { score: v, name: me.name, avatar: me.avatar, at: F.serverTimestamp() }); me.sent[id] = v; n++; }
      catch (e) { console.warn('score submit', id, e?.code); }   // retried on the next throttled sync
    }
  }
  persist(); return n;
}

/** Rows: [{ uid, name, avatar, score, me }] sorted desc. scope: 'all' | 'week' | 'friends'. */
export async function fetchBoard(mode, scope, s, portal = false) {
  const mine = { uid: me.uid || 'me', name: me.name, avatar: me.avatar, score: C.scoresFrom(s)[mode], me: true };
  if (!(await connect(portal))) return { online: false, rows: mine.score > 0 ? [mine] : [], why: socialStatus.why };
  const { F, db, uid } = api;
  try {
    let docs;
    if (scope === 'friends') {
      const ids = [uid, ...me.friends].slice(0, 30); const col = F.collection(db, 'boards', C.boardId(mode, 'all'), 'entries');
      docs = (await F.getDocs(F.query(col, F.where(F.documentId(), 'in', ids)))).docs;
    } else {
      const col = F.collection(db, 'boards', C.boardId(mode, scope), 'entries');
      docs = (await F.getDocs(F.query(col, F.orderBy('score', 'desc'), F.limit(50)))).docs;
    }
    const rows = docs.map(d => ({ uid: d.id, ...d.data(), me: d.id === uid })).sort((a, b) => b.score - a.score);
    if (!rows.some(r => r.me) && mine.score > 0) rows.push({ ...mine, rank: '–' });
    return { online: true, rows };
  } catch (e) { return { online: false, rows: [mine], why: 'error: ' + (e?.code || e?.message) }; }
}

// ---------- share card (canvas PNG) + native share sheet ----------
export function drawCard(c, { mode, score, name, avatar, accent = '#ffb347' }) {
  const W = 1080, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1b0f3a'); bg.addColorStop(1, '#0b0716'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 470, 20, W / 2, 470, 420); glow.addColorStop(0, accent + 'cc'); glow.addColorStop(1, '#0000'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.fillStyle = '#ffe2b8'; g.font = '900 96px system-ui,sans-serif'; g.fillText('+1 AURA', W / 2, 150);
  g.font = '700 46px system-ui,sans-serif'; g.fillStyle = '#ffffffcc'; g.fillText(`${C.MODES[mode].icon} ${C.MODES[mode].label.toUpperCase()}`, W / 2, 250);
  g.font = '200px system-ui,sans-serif'; g.fillText(avatar, W / 2, 520);
  g.fillStyle = '#fff'; g.font = '900 140px system-ui,sans-serif'; g.fillText(C.fmtScore(mode, score), W / 2, 720);
  g.font = '700 54px system-ui,sans-serif'; g.fillStyle = '#ffe2b8'; g.fillText(name, W / 2, 810);
  g.fillStyle = accent; g.beginPath(); g.roundRect(W / 2 - 330, 880, 660, 110, 55); g.fill();
  g.fillStyle = '#1b0f3a'; g.font = '900 54px system-ui,sans-serif'; g.fillText('BEAT MY SCORE?', W / 2, 955);
  return cv;
}
/** Share text + optional PNG. Capacitor Share (+Filesystem) on Android, Web Share API in browsers, else clipboard. */
export async function share({ text, url, canvas, title = '+1 Aura' }) {
  const cap = window.Capacitor, P = cap?.Plugins || {};
  const dataUrl = canvas?.toDataURL('image/png');
  try {
    if (cap?.isNativePlatform?.() && P.Share) {
      let files;
      if (dataUrl && P.Filesystem) {
        const w = await P.Filesystem.writeFile({ path: 'aura-score.png', data: dataUrl.split(',')[1], directory: 'CACHE' });
        files = [w.uri];
      }
      await P.Share.share({ title, text, url, files, dialogTitle: 'Share your score' }); return 'native';
    }
    if (navigator.share) {
      const blob = dataUrl ? await (await fetch(dataUrl)).blob() : null;
      const file = blob && new File([blob], 'aura-score.png', { type: 'image/png' });
      const data = { title, text, url }; if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
      await navigator.share(data); return 'web';
    }
  } catch (e) { if (e?.name === 'AbortError' || /cancel/i.test(e?.message)) return 'cancelled'; }
  try { await navigator.clipboard.writeText(`${text}`); return 'copied'; } catch { return 'failed'; }
}

// ---------- Daily Challenge board (daily/{YYYY-MM-DD}/entries/{uid}) + ghosts (ghosts/{uid}) ----------
/** Submit today's daily distance if it improved (rules: increase-only, 30 s per entry). */
export async function submitDaily(day, dist, portal = false) {
  const v = Math.min(C.MODES.escape.max, Math.floor(dist)); if (!(v > 0)) return false;
  me.dailySent ||= {}; if ((me.dailySent[day] || 0) >= v) return false;
  if (!(await connect(portal))) return false;
  const { F, db, uid } = api;
  try { await F.setDoc(F.doc(db, 'daily', day, 'entries', uid), { score: v, name: me.name, avatar: me.avatar, at: F.serverTimestamp() }); me.dailySent = { [day]: v }; persist(); return true; }
  catch (e) { console.warn('daily submit', e?.code); return false; }
}
/** Daily rows (top 50, or you + friends). Offline: just your local best. */
export async function fetchDaily(day, localBest, scope = 'all', portal = false) {
  const mine = { uid: me.uid || 'me', name: me.name, avatar: me.avatar, score: localBest || 0, me: true };
  if (!(await connect(portal))) return { online: false, rows: mine.score > 0 ? [mine] : [], why: socialStatus.why };
  const { F, db, uid } = api;
  try {
    const col = F.collection(db, 'daily', day, 'entries');
    const q = scope === 'friends' ? F.query(col, F.where(F.documentId(), 'in', [uid, ...me.friends].slice(0, 30))) : F.query(col, F.orderBy('score', 'desc'), F.limit(50));
    const rows = (await F.getDocs(q)).docs.map(d => ({ uid: d.id, ...d.data(), me: d.id === uid })).sort((a, b) => b.score - a.score);
    if (!rows.some(r => r.me) && mine.score > 0) rows.push({ ...mine, rank: '–' });
    return { online: true, rows };
  } catch (e) { return { online: false, rows: mine.score > 0 ? [mine] : [], why: 'error: ' + (e?.code || e?.message) }; }
}
/** Upload your best-run ghost (string from daily.encodeGhost). */
export async function uploadGhost(g, dist, portal = false) {
  if (!(await connect(portal))) return false;
  const { F, db, uid } = api;
  try { await F.setDoc(F.doc(db, 'ghosts', uid), { g, dist: Math.floor(dist), name: me.name, avatar: me.avatar, at: F.serverTimestamp() }); me.ghostSent = Math.floor(dist); persist(); return true; }
  catch (e) { console.warn('ghost upload', e?.code); return false; }
}
/** Friends' ghosts: [{ uid, name, avatar, dist, g }] best first. */
export async function fetchFriendGhosts(portal = false) {
  if (!me.friends.length || !(await connect(portal))) return [];
  const { F, db } = api; const out = [];
  await Promise.all(me.friends.slice(0, 30).map(async fid => { try { const s = await F.getDoc(F.doc(db, 'ghosts', fid)); if (s.exists()) out.push({ uid: fid, ...s.data() }); } catch {} }));
  return out.sort((a, b) => b.dist - a.dist);
}
