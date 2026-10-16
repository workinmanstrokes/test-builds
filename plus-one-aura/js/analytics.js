// Firebase Analytics (free Spark plan). Strict no-op unless a Firebase app is configured:
//  - Android: ANALYTICS.native is true only when google-services.json was present at build (scripts/configure.mjs)
//  - Web: FIREBASE_WEB in firebase-config.js; the Firebase JS SDK is lazy-loaded only then
// Every event is also kept in window.__aura_events (last 100) so tests can verify instrumentation.
import { ANALYTICS } from './config.js';
import { FIREBASE_WEB } from './firebase-config.js';
const cap = window.Capacitor;
const nativeFA = ANALYTICS.native && cap?.isNativePlatform?.() ? cap.Plugins?.FirebaseAnalytics : null;
let webLog = null; const queue = [];
const log = (window.__aura_events = window.__aura_events || []);
export const analyticsMode = () => (nativeFA ? 'firebase-native' : FIREBASE_WEB ? 'firebase-web' : 'off');

export async function initAnalytics() {
  if (nativeFA || !FIREBASE_WEB || cap?.isNativePlatform?.()) return;
  try {
    const v = '11.0.2';
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
    const { getAnalytics, logEvent, isSupported } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-analytics.js`);
    if (!(await isSupported())) return;
    const a = getAnalytics(initializeApp(FIREBASE_WEB));
    webLog = (n, p) => logEvent(a, n, p);
    queue.splice(0).forEach(([n, p]) => webLog(n, p));
  } catch (e) { console.warn('analytics off', e); }
}

/** Log an event (snake_case name, flat params). Never throws. */
export function track(name, params = {}) {
  log.push({ name, params, t: Date.now() }); if (log.length > 100) log.shift();
  try {
    if (nativeFA) nativeFA.logEvent({ name, params });
    else if (webLog) webLog(name, params);
    else if (FIREBASE_WEB) queue.push([name, params]);
  } catch {}
}
