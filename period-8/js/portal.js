// Web portal SDKs (Poki, CrazyGames). Loaded ONLY when the game runs on that portal (?portal=… for testing, a portal
// build from webzip.mjs, or the portal's domain). Elsewhere every call is a no-op.
// Events (intros/menus plan): gameLoadingFinished once the first screen can take input; gameplayStart on the first
// input of actual play (and again after every pause / menu); gameplayStop on pause, blur, menus and endings.
// Period 8 has no interstitials, so commercialBreak is never called; rewarded ads go through the portal's rewarded API.
import { PORTAL_BUILD } from './portal-config.js';
const SDK_URL = { poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js', crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' };
function detect() {
  try { const q = new URLSearchParams(location.search).get('portal'); if (q && SDK_URL[q]) return q; } catch {}
  if (PORTAL_BUILD && SDK_URL[PORTAL_BUILD]) return PORTAL_BUILD;
  const h = location.hostname;
  if (/(^|\.)poki(-gdn)?\.(com|io|dev)$/.test(h) || /poki-gdn\.com$/.test(h)) return 'poki';
  if (/(^|\.)crazygames\.(com|io)$/.test(h)) return 'crazygames';
  return null;
}
export const portal = detect();
const log = (window.__p8_portal = []); // test hook: every SDK call, in order
let sdk = null, ready = null, playing = false, loaded = false;
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

/** Starts loading + initialising the portal SDK (never blocks the game for more than 3 s). */
export function initPortal() {
  if (!portal || ready) return ready || Promise.resolve();
  ready = (async () => {
    try {
      if (portal === 'poki') { if (!window.PokiSDK) await timeout(loadScript(SDK_URL.poki), 3000); if (window.PokiSDK) { await timeout(window.PokiSDK.init(), 3000); sdk = window.PokiSDK; } }
      else { if (!window.CrazyGames?.SDK) await timeout(loadScript(SDK_URL.crazygames), 3000); const S = window.CrazyGames?.SDK; if (S) { await timeout(S.init(), 3000); sdk = S; call('loadingStart'); } }
    } catch (e) { console.warn('portal sdk unavailable', e); }
  })();
  return ready;
}
function call(ev) {
  log.push(ev); if (!sdk) return;
  try {
    if (portal === 'poki') ({ loadingFinished: () => sdk.gameLoadingFinished(), gameplayStart: () => sdk.gameplayStart(), gameplayStop: () => sdk.gameplayStop() }[ev] || (() => {}))();
    else ({ loadingStart: () => sdk.game.loadingStart(), loadingFinished: () => sdk.game.loadingStop(), gameplayStart: () => sdk.game.gameplayStart(), gameplayStop: () => sdk.game.gameplayStop() }[ev] || (() => {}))();
  } catch (e) { console.warn('portal', ev, e); }
}
/** The first screen is ready for input. */
export async function loadingFinished() { if (!portal || loaded) return; loaded = true; await initPortal(); call('loadingFinished'); }
/** Gameplay running (true) or stopped (false); deduplicated. */
export async function gameplay(on) { if (!portal || on === playing) return; playing = on; await initPortal(); call(on ? 'gameplayStart' : 'gameplayStop'); }
export const isPortal = () => !!portal;
/** Rewarded break through the portal. Resolves true if the reward was earned. onPause/onResume mute the game. */
export async function portalRewarded({ onPause = () => {}, onResume = () => {} } = {}) {
  await initPortal(); if (!sdk) return false; log.push('rewarded');
  const was = playing; if (was) await gameplay(false);
  try {
    if (portal === 'poki') { const ok = await sdk.rewardedBreak({ onStart: onPause }); return !!ok; }
    return await new Promise(res => sdk.ad.requestAd('rewarded', { adStarted: onPause, adFinished: () => res(true), adError: () => res(false) }));
  } catch { return false; } finally { onResume(); if (was) await gameplay(true); }
}
