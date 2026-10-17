// Firebase Analytics (free Spark plan), consent-gated.
//  - Collection starts DISABLED (Android manifest: firebase_analytics_collection_enabled=false; web SDK not loaded).
//  - It is enabled only when (a) consent allows it and (b) the player hasn't switched analytics off in Settings.
//    Android: consent = Google UMP result (status OBTAINED or NOT_REQUIRED and canRequestAds), reported by ads.js.
//    Web (no UMP): consent is not required, the Settings toggle alone decides. Portal builds have no Firebase config.
//  - Events tracked before consent is known are held in memory only, then sent if allowed or discarded if not.
//  - Strict no-op when no Firebase app is configured. Every event is mirrored to window.__aura_events for tests.
import { ANALYTICS } from './config.js';
import { FIREBASE_WEB } from './firebase-config.js';
const cap = window.Capacitor;
const isNative = !!cap?.isNativePlatform?.();
const nativeFA = ANALYTICS.native && isNative ? cap.Plugins?.FirebaseAnalytics : null;
let webLog = null, webApi = null, webStarting = false;
let consent = isNative ? null : true;   // null = unknown yet (waiting for UMP)
let userOptIn = true;
const pending = [];
export const analyticsStatus = { web: 'off', consent: consent == null ? 'pending' : 'granted', enabled: false };
window.__aura_analytics = analyticsStatus;
const log = (window.__aura_events = window.__aura_events || []);
export const analyticsMode = () => (nativeFA ? 'firebase-native' : FIREBASE_WEB ? 'firebase-web' : 'off');
const enabled = () => consent === true && userOptIn;

/** Called once with the saved Settings value. */
export function initAnalytics(optIn = true) { userOptIn = optIn !== false; apply(); }
/** ads.js reports the UMP consent outcome (true/false). */
export function setAnalyticsConsent(granted) { consent = !!granted; analyticsStatus.consent = consent ? 'granted' : 'denied'; apply(); }
/** Settings toggle. */
export function setAnalyticsOptIn(on) { userOptIn = !!on; apply(); }
export const analyticsEnabled = enabled;

async function apply() {
  const on = enabled(); analyticsStatus.enabled = on;
  if (consent != null && !on) pending.length = 0;            // decided and not allowed: drop the buffer
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

/** Log an event (snake_case name, flat params). Never throws. */
export function track(name, params = {}) {
  log.push({ name, params, t: Date.now() }); if (log.length > 100) log.shift();
  if (!nativeFA && !FIREBASE_WEB) return;
  if (enabled()) send(name, params);
  else if (consent == null && userOptIn && pending.length < 50) pending.push([name, params]);
}
