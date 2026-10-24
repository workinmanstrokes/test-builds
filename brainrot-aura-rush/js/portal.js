// Web portal adapter (Poki SDK v2 / CrazyGames SDK v3). Plain script, exposes window.Portal.
// Active only in a portal build (window.PORTAL_BUILD set by portal-config.js), with ?portal=poki|crazygames for testing,
// or on the portal's own domain. Everywhere else (Android app, test site) every call is a cheap no-op.
// Events: loadingFinished once the first screen takes input; gameplayStart/Stop around real play (deduplicated);
// commercialBreak ONLY at natural breaks (between levels / before a new run), never mid-play; rewarded = opt-in only.
(function (root) {
  'use strict';
  const SDK_URL = { poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js', crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' };
  function detect() {
    try { const q = new URLSearchParams(root.location.search).get('portal'); if (q && SDK_URL[q]) return q; } catch (e) { /* no location */ }
    if (root.PORTAL_BUILD && SDK_URL[root.PORTAL_BUILD]) return root.PORTAL_BUILD;
    const h = (root.location && root.location.hostname) || '';
    if (/(^|\.)poki(-gdn)?\.(com|io|dev)$/.test(h) || /poki-gdn\.com$/.test(h)) return 'poki';
    if (/(^|\.)crazygames\.(com|io)$/.test(h)) return 'crazygames';
    return null;
  }
  const id = detect();
  const log = []; // test hook: every event in order
  let sdk = null, ready = null, playing = false, loaded = false, busy = false;
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  function init() {
    if (!id) return Promise.resolve();
    if (ready) return ready;
    ready = (async () => {
      try {
        if (id === 'poki') { if (!root.PokiSDK) await timeout(loadScript(SDK_URL.poki), 3000); if (root.PokiSDK) { await timeout(root.PokiSDK.init().catch(() => {}), 3000); sdk = root.PokiSDK; } }
        else { if (!(root.CrazyGames && root.CrazyGames.SDK)) await timeout(loadScript(SDK_URL.crazygames), 3000); const S = root.CrazyGames && root.CrazyGames.SDK; if (S) { await timeout(S.init(), 3000); sdk = S; try { S.game.loadingStart(); } catch (e) { /* older sdk */ } } }
      } catch (e) { console.warn('portal sdk unavailable', e); }
      // Portals embed the game in an iframe: stop arrow keys / space / wheel from scrolling the host page.
      root.addEventListener('keydown', ev => { if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key) && ev.target === document.body) ev.preventDefault(); });
      root.addEventListener('wheel', ev => ev.preventDefault(), { passive: false });
    })();
    return ready;
  }
  function call(ev) {
    log.push(ev); if (!sdk) return;
    try {
      if (id === 'poki') ({ loadingFinished: () => sdk.gameLoadingFinished(), gameplayStart: () => sdk.gameplayStart(), gameplayStop: () => sdk.gameplayStop() }[ev] || (() => {}))();
      else ({ loadingFinished: () => sdk.game.loadingStop(), gameplayStart: () => sdk.game.gameplayStart(), gameplayStop: () => sdk.game.gameplayStop() }[ev] || (() => {}))();
    } catch (e) { console.warn('portal', ev, e); }
  }
  async function loadingFinished() { if (!id || loaded) return; loaded = true; await init(); call('loadingFinished'); }
  async function gameplay(on) { if (!id || on === playing) return; playing = on; await init(); call(on ? 'gameplayStart' : 'gameplayStop'); }
  /** Natural-break ad slot (portal decides whether an ad actually plays). Resolves when the game may continue. */
  async function commercialBreak(onPause, onResume) {
    if (!id || busy) return; await init(); busy = true; log.push('commercialBreak');
    const was = playing; if (was) await gameplay(false);
    try {
      if (sdk && id === 'poki') await sdk.commercialBreak(() => onPause && onPause());
      else if (sdk) await new Promise(res => sdk.ad.requestAd('midgame', { adStarted: () => onPause && onPause(), adFinished: res, adError: res }));
    } catch (e) { /* no ad */ }
    busy = false; if (onResume) onResume();
  }
  /** Opt-in rewarded video. Resolves true only if the reward was earned. */
  async function rewarded(onPause, onResume) {
    if (!id || busy) return false; await init(); busy = true; log.push('rewarded');
    const was = playing; if (was) await gameplay(false);
    let ok = false;
    try {
      if (sdk && id === 'poki') ok = !!(await sdk.rewardedBreak(() => onPause && onPause()));
      else if (sdk) ok = await new Promise(res => sdk.ad.requestAd('rewarded', { adStarted: () => onPause && onPause(), adFinished: () => res(true), adError: () => res(false) }));
    } catch (e) { ok = false; }
    busy = false; if (onResume) onResume(); if (was) await gameplay(true);
    return ok;
  }
  root.Portal = { id, active: !!id, log, init, loadingFinished, gameplayStart: () => gameplay(true), gameplayStop: () => gameplay(false), commercialBreak, rewarded, available: () => !!id && !busy };
  if (id) init();
})(typeof window !== 'undefined' ? window : globalThis);
