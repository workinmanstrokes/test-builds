// Firebase Analytics (project period-8-dd, free Spark plan). Strict no-op unless a Firebase app is configured:
//  - Android: ANALYTICS.native is true only when google-services.json was present at build (scripts/configure.mjs)
//  - Web: FIREBASE_WEB in firebase-config.js; the Firebase JS SDK is lazy-loaded only then
// Consent: NOTHING is sent until setAnalyticsAllowed(true) is called, i.e. after the UMP consent result allows it and the
// player hasn't switched off Settings > Share gameplay stats. Android also ships with
// firebase_analytics_collection_enabled=false in the manifest, so even automatic events (first_open) wait for consent.
// Events logged before the decision are held (max 50) and sent only if allowed; dropped if not.
// Every event is also kept in window.__p8_events (last 300) so tests can verify instrumentation.
import { ANALYTICS } from './config.js';
import { FIREBASE_WEB } from './firebase-config.js';
const cap = window.Capacitor;
const nativeFA = ANALYTICS.native && cap?.isNativePlatform?.() ? cap.Plugins?.FirebaseAnalytics : null;
let webLog = null; const queue = [];
// Diagnostic status for tests: off | loading | ready | unsupported | error:<msg>
export const analyticsStatus = { web: 'off', allowed: null };
window.__p8_analytics = analyticsStatus;
const log = (window.__p8_events = window.__p8_events || []);
export const analyticsMode = () => (nativeFA ? 'firebase-native' : FIREBASE_WEB ? 'firebase-web' : 'off');

let allowed = null; // null = undecided (hold events), true = send, false = drop
/** Apply the consent + opt-out decision. Safe to call repeatedly (settings toggle, privacy options form). */
export async function setAnalyticsAllowed(v) {
  allowed = !!v; analyticsStatus.allowed = allowed;
  if (nativeFA) {
    try {
      const st = allowed ? 'GRANTED' : 'DENIED';
      await nativeFA.setConsent({ type: 'ANALYTICS_STORAGE', status: st });
      await nativeFA.setEnabled({ enabled: allowed });
    } catch {}
    if (allowed) queue.splice(0).forEach(([n, p]) => { try { nativeFA.logEvent({ name: n, params: p }); } catch {} }); else queue.length = 0;
    return;
  }
  if (!allowed) { queue.length = 0; if (webSetEnabled) webSetEnabled(false); return; }
  if (webSetEnabled) webSetEnabled(true);
  if (!webLog) await initWeb(); else queue.splice(0).forEach(([n, p]) => webLog(n, p));
}
let webSetEnabled = null;
async function initWeb() {
  if (!FIREBASE_WEB || cap?.isNativePlatform?.() || analyticsStatus.web === 'loading') return;
  analyticsStatus.web = 'loading';
  try {
    const v = '12.6.0';
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
    const { getAnalytics, logEvent, isSupported, setAnalyticsCollectionEnabled } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-analytics.js`);
    if (!(await isSupported())) { analyticsStatus.web = 'unsupported'; return; }
    const a = getAnalytics(initializeApp(FIREBASE_WEB));
    webLog = (n, p) => logEvent(a, n, p); webSetEnabled = on => setAnalyticsCollectionEnabled(a, on);
    analyticsStatus.web = 'ready'; analyticsStatus.app = a.app.options.appId;
    if (allowed) queue.splice(0).forEach(([n, p]) => webLog(n, p)); else { queue.length = 0; webSetEnabled(false); }
  } catch (e) { analyticsStatus.web = 'error:' + (e?.code || e?.message); console.warn('analytics off', e); }
}


// Mirror key events to the shared per-session Firestore logger (window.DA from /analytics.js). No-op without DA_CONFIG.
// Respects the player's analytics opt-out. Only counts and short placement names are sent, never names or IDs.
const RW = { escape_revive: 'revive', keep: 'keep' };
function toDA(name, p) {
  const DA = window.DA; if (!DA || !(allowed !== false)) return;
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
