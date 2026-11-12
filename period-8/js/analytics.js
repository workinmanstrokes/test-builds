// Firebase Analytics (project period-8-dd, free Spark plan). Strict no-op unless a Firebase app is configured:
//  - Android: ANALYTICS.native is true only when google-services.json was present at build (scripts/configure.mjs)
//  - Web: FIREBASE_WEB in firebase-config.js; the Firebase JS SDK is lazy-loaded only then
// Consent: NOTHING is sent until setAnalyticsAllowed(true). That happens only when the player has explicitly opted in
// (Settings > Share anonymous gameplay stats; legacy default-on saves do not count) AND, on Android, UMP allows it.
// Android also ships with firebase_analytics_collection_enabled=false, so automatic events wait for that call.
// Events logged before the decision are held (max 50) and sent only if allowed; a refusal drops them.
// Passing { forget: true } also deletes the on-device Firestore install id (used when the player is not opted in).
// Every event is also kept in window.__p8_events (last 300) so tests can verify instrumentation. It is not uploaded.
import { ANALYTICS } from './config.js';
import { FIREBASE_WEB } from './firebase-config.js';
const W = globalThis.window ?? globalThis;
const cap = W.Capacitor;
const nativeFA = ANALYTICS.native && cap?.isNativePlatform?.() ? cap.Plugins?.FirebaseAnalytics : null;
let webLog = null; const queue = [];
// Diagnostic status for tests: off | loading | ready | unsupported | error:<msg>
export const analyticsStatus = { web: 'off', allowed: null };
W.__p8_analytics = analyticsStatus;
const log = (W.__p8_events = W.__p8_events || []);
export const analyticsMode = () => (nativeFA ? 'firebase-native' : FIREBASE_WEB ? 'firebase-web' : 'off');

let allowed = null; // null = undecided (hold events), true = send, false = drop
function syncSession(forget) {
  try {
    const DA = W.DA;
    if (!DA) return;
    if (allowed) DA.setAllowed?.(true);
    else if (forget) DA.forgetDevice?.();
    else DA.setAllowed?.(false);
  } catch {}
}
function releaseHeld(send) {
  const held = queue.splice(0);
  if (!allowed) return;
  for (const [n, p] of held) {
    try { toDA(n, p); } catch {}
    try { send(n, p); } catch {}
  }
}
/** Apply the opt-in + UMP decision. Safe to call repeatedly (settings toggle, privacy options form). */
export async function setAnalyticsAllowed(v, { forget = false } = {}) {
  allowed = !!v; analyticsStatus.allowed = allowed;
  if (nativeFA) {
    try {
      const st = allowed ? 'GRANTED' : 'DENIED';
      await nativeFA.setConsent({ type: 'ANALYTICS_STORAGE', status: st });
      await nativeFA.setEnabled({ enabled: allowed });
    } catch {}
    if (!allowed) queue.length = 0;
    syncSession(forget);
    if (allowed) releaseHeld((n, p) => nativeFA.logEvent({ name: n, params: p }));
    return;
  }
  if (!allowed) { queue.length = 0; syncSession(forget); if (webSetEnabled) webSetEnabled(false); return; }
  syncSession(false);
  if (webSetEnabled) webSetEnabled(true);
  if (!webLog) await initWeb(); else releaseHeld((n, p) => webLog(n, p));
}
let webSetEnabled = null;
async function initWeb() {
  if (!FIREBASE_WEB || cap?.isNativePlatform?.() || analyticsStatus.web === 'loading' || analyticsStatus.web === 'ready') return;
  if (!allowed) return;
  analyticsStatus.web = 'loading';
  try {
    const v = '12.6.0';
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
    const { getAnalytics, logEvent, isSupported, setAnalyticsCollectionEnabled } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-analytics.js`);
    if (!(await isSupported())) { analyticsStatus.web = 'unsupported'; return; }
    // Revocation during the SDK download must not construct a collector.
    if (!allowed) { analyticsStatus.web = 'off'; return; }
    const a = getAnalytics(initializeApp(FIREBASE_WEB));
    webLog = (n, p) => logEvent(a, n, p); webSetEnabled = on => setAnalyticsCollectionEnabled(a, on);
    analyticsStatus.web = 'ready'; analyticsStatus.app = a.app.options.appId;
    if (allowed) releaseHeld((n, p) => webLog(n, p)); else { queue.length = 0; webSetEnabled(false); }
  } catch (e) { analyticsStatus.web = 'error:' + (e?.code || e?.message); console.warn('analytics off', e); }
}


// Mirror key events to the shared per-session Firestore logger (window.DA from /analytics.js). No-op without DA_CONFIG.
// Only after an explicit allow. Undecided and refused both skip the session row. Counts and short placement names only.
const RW = { escape_revive: 'revive', keep: 'keep' };
function toDA(name, p) {
  const DA = W.DA; if (!DA || allowed !== true) return;
  const pl = RW[p.placement] || String(p.placement || '').slice(0, 12);
  switch (name) {
    case 'ad_reward_offer': DA.rewardedShown(pl); break;
    case 'ad_reward_shown': if (!['keep', 'hint'].includes(p.placement)) DA.rewardedShown(pl); DA.rewardedAccepted(pl); break;
    case 'ad_reward_declined': DA.rewardedDeclined(pl); break;
    case 'remove_ads_shown': DA.removeAdsShown(); break;
    case 'iap_purchase': DA.removeAdsPurchased(); break;
    case 'da_level_start': DA.levelStart(p.level); break;
    case 'da_level_complete': DA.levelComplete(p.level, p.deaths); break;
    case 'da_level_fail': DA.levelFail(p.level, p.deaths); break;
  }
}
/** Log an event (snake_case name, flat params). Never throws. */
export function track(name, params = {}) {
  try { toDA(name, params); } catch {}
  log.push({ name, params, t: Date.now() }); if (log.length > 300) log.shift();
  if (allowed === false || (!nativeFA && !FIREBASE_WEB)) return;
  if (allowed === null) { if (queue.length < 50) queue.push([name, params]); return; }
  try {
    if (nativeFA) nativeFA.logEvent({ name, params });
    else if (webLog) webLog(name, params);
    else queue.push([name, params]);
  } catch {}
}
