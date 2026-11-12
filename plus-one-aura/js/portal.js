// Web portal SDK adapters (Poki, CrazyGames v3, GameDistribution). Rewarded ads only, never interstitials.
// The SDK <script> tag is injected by scripts/build-web.mjs; with PORTAL.id 'none' everything here is a no-op.
import { PORTAL } from './portal-config.js';
export const portalId = PORTAL.id;
export const isPortal = PORTAL.id !== 'none';
let ready = false, playing = false, gdReward = null;

const wait = (test, ms = 8000) => new Promise(res => { const t0 = Date.now(); (function poll() { if (test()) return res(true); if (Date.now() - t0 > ms) return res(false); setTimeout(poll, 100); })(); });

export async function initPortal() {
  if (!isPortal) return;
  try {
    if (portalId === 'poki') {
      if (!(await wait(() => window.PokiSDK))) return;
      await window.PokiSDK.init().catch(() => {}); window.PokiSDK.gameLoadingFinished(); ready = true;
      window.addEventListener('keydown', ev => { if (['ArrowDown', 'ArrowUp', ' '].includes(ev.key)) ev.preventDefault(); });
      window.addEventListener('wheel', ev => ev.preventDefault(), { passive: false });
    } else if (portalId === 'crazygames') {
      if (!(await wait(() => window.CrazyGames?.SDK))) return;
      await window.CrazyGames.SDK.init(); window.CrazyGames.SDK.game.loadingStart?.(); window.CrazyGames.SDK.game.loadingStop?.(); ready = true;
    } else if (portalId === 'gamedistribution') {
      ready = await wait(() => window.gdsdk);
    }
  } catch (e) { console.warn('portal init', e); }
}
// GameDistribution reports rewards through GD_OPTIONS.onEvent (set up in index.html by the build script).
window.__gdEvent = e => { if (e?.name === 'SDK_REWARDED_WATCH_COMPLETE' && gdReward) gdReward(); };

export function gameplayStart() {
  if (!ready || playing) return; playing = true;
  try { if (portalId === 'poki') window.PokiSDK.gameplayStart(); else if (portalId === 'crazygames') window.CrazyGames.SDK.game.gameplayStart(); } catch {}
}
export function gameplayStop() {
  if (!ready || !playing) return; playing = false;
  try { if (portalId === 'poki') window.PokiSDK.gameplayStop(); else if (portalId === 'crazygames') window.CrazyGames.SDK.game.gameplayStop(); } catch {}
}
export const portalReady = () => ready;

/** Rewarded break on the portal. Resolves true only when the reward was earned. */
export async function portalRewarded() {
  if (!ready) return false;
  const wasPlaying = playing; gameplayStop();
  let earned = false;
  try {
    if (portalId === 'poki') earned = !!(await window.PokiSDK.rewardedBreak());
    else if (portalId === 'crazygames') earned = await new Promise(res => window.CrazyGames.SDK.ad.requestAd('rewarded', { adStarted: () => {}, adFinished: () => res(true), adError: () => res(false) }));
    else if (portalId === 'gamedistribution') earned = await new Promise(res => { gdReward = () => res(true); window.gdsdk.showAd('rewarded').then(() => setTimeout(() => res(false), 600)).catch(() => res(false)); }).finally(() => { gdReward = null; });
  } catch { earned = false; }
  if (wasPlaying) gameplayStart();
  return earned;
}
