// Firebase Analytics (free Spark plan), consent-gated.
//  - Collection starts DISABLED (Android manifest: firebase_analytics_collection_enabled=false; web SDK not loaded).
//  - It is enabled only when Settings was explicitly opted in AND applicable consent allows it.
//    Android: consent = Google UMP result (status OBTAINED or NOT_REQUIRED and canRequestAds), reported by ads.js.
//    Web (no UMP form): the Settings opt-in is the applicable consent. The session logger uses the same gate.
//  - Events before a UMP decision are held in memory only after an explicit opt-in, then sent or discarded.
//    Opting out or a denied consent drops that buffer and stops the session logger without sending it.
//  - Strict no-op when no Firebase app is configured. Every event is mirrored to window.__aura_events for tests.
import { ANALYTICS } from './config.js';
import { FIREBASE_WEB } from './firebase-config.js';
const cap = window.Capacitor;
const isNative = !!cap?.isNativePlatform?.();
const nativeFA = ANALYTICS.native && isNative ? cap.Plugins?.FirebaseAnalytics : null;
let webLog = null, webApi = null, webStarting = false;
let consent = isNative ? null : true;   // null = UMP applies and has not answered; web has no UMP form
let userOptIn = false;
const pending = [];
export const analyticsStatus = { web: 'off', consent: consent == null ? 'pending' : 'granted', enabled: false };
window.__aura_analytics = analyticsStatus;
const log = (window.__aura_events = window.__aura_events || []);
export const analyticsMode = () => (nativeFA ? 'firebase-native' : FIREBASE_WEB ? 'firebase-web' : 'off');
const enabled = () => consent === true && userOptIn;

/** Called once with the saved Settings value. Only an explicit true opts in. */
export function initAnalytics(optIn = false) { userOptIn = optIn === true; apply(); }
/** ads.js reports the UMP consent outcome (true/false). */
export function setAnalyticsConsent(granted) { consent = granted === true; analyticsStatus.consent = consent ? 'granted' : 'denied'; apply(); }
/** Settings toggle. */
export function setAnalyticsOptIn(on) { userOptIn = on === true; apply(); }
export const analyticsEnabled = enabled;

async function apply() {
  const on = enabled(); analyticsStatus.enabled = on;
  if (!on && !(consent == null && userOptIn)) pending.length = 0;
  try { window.DA?.allow?.(on); } catch {}
  try {
    if (nativeFA) {
      await nativeFA.setEnabled({ enabled: on });
      if (on) await nativeFA.setConsent?.({ type: 'ANALYTICS_STORAGE', status: 'GRANTED' }).catch(() => {});
    } else if (FIREBASE_WEB && !isNative) {
      if (on && !webApi && !webStarting) await startWeb();
      if (webApi) webApi.setAnalyticsCollectionEnabled(webApi.a, on);
    }
  } catch (e) { console.warn('analytics apply', e); }
  if (on) pending.splice(0).forEach(([n, p]) => send(n, p));
}

async function startWeb() {
  webStarting = true; analyticsStatus.web = 'loading';
  try {
    const v = '12.6.0';
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
    const m = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-analytics.js`);
    if (!(await m.isSupported())) { analyticsStatus.web = 'unsupported'; return; }
    const a = m.getAnalytics(initializeApp(FIREBASE_WEB));
    webApi = { a, setAnalyticsCollectionEnabled: m.setAnalyticsCollectionEnabled };
    webLog = (n, p) => m.logEvent(a, n, p);
    analyticsStatus.web = 'ready'; analyticsStatus.app = a.app.options.appId;
  } catch (e) { analyticsStatus.web = 'error:' + (e?.code || e?.message); console.warn('analytics off', e); }
  finally { webStarting = false; }
}
function send(name, params) {
  try { if (nativeFA) nativeFA.logEvent({ name, params }); else if (webLog) webLog(name, params); else if (FIREBASE_WEB && !isNative) pending.push([name, params]); } catch {}
}


// Mirror key events to the shared per-session Firestore logger (window.DA from /analytics.js). No-op without DA_CONFIG.
// Respects the player's analytics opt-out. Only counts and short placement names are sent, never names or IDs.
const RW = { escape_revive: 'revive', keep: 'keep' };
function toDA(name, p) {
  const DA = window.DA; if (!DA || !enabled()) return;
  const pl = RW[p.placement] || String(p.placement || '').slice(0, 12);
  switch (name) {
    case 'ad_reward_offer': DA.rewardedShown(pl); break;
    case 'ad_reward_shown': if (!['escape_revive'].includes(p.placement)) DA.rewardedShown(pl); DA.rewardedAccepted(pl); break;
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
  log.push({ name, params, t: Date.now() }); if (log.length > 100) log.shift();
  if (!nativeFA && !FIREBASE_WEB) return;
  if (enabled()) send(name, params);
  else if (consent == null && userOptIn && pending.length < 50) pending.push([name, params]);
}
