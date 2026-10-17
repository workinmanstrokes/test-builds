// AdMob rewarded ads + UMP consent. Placements: 'hint' (highlight the area of an anomaly), 'keep' (keep your streak
// after a miss). There are no interstitials. On the web build a 3-second "TEST AD" overlay stands in for the video.
import { ADS } from './config.js';
import { track } from './analytics.js';
const cap = window.Capacitor;
const native = !!cap?.isNativePlatform?.();
const AdMob = native ? cap.Plugins?.AdMob : null;
let ready = false, canRequest = !native, privacyRequired = false, loaded = false, showing = false;
export const adsInfo = () => ({ native, ready, canRequest, privacyRequired, testing: ADS.testing });

export async function initAds() {
  if (!ADS.enabled || !AdMob) return;
  try {
    await AdMob.initialize({ initializeForTesting: ADS.testing });
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
    canRequest = info.canRequestAds !== false; privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    ready = true; preload();
  } catch (e) { console.warn('ads init failed', e); }
}
export async function showPrivacyOptions() { try { await AdMob?.showPrivacyOptionsForm(); } catch {} }
async function preload() { if (!ready || !canRequest || loaded) return; try { await AdMob.prepareRewardVideoAd({ adId: ADS.rewardedId, isTesting: ADS.testing }); loaded = true; } catch { loaded = false; } }

export function rewardGate(save, placement, now = Date.now()) {
  if (save.noAds) return { ok: true, free: true };
  if (!ADS.enabled) return { ok: false, why: 'Ads off' };
  if (native && (!ready || !canRequest)) return { ok: false, why: 'Ads unavailable right now' };
  const today = new Date(now).toISOString().slice(0, 10);
  if (save.ads.day !== today) { save.ads.day = today; save.ads.count = 0; }
  if (save.ads.count >= ADS.rewardDailyCap) return { ok: false, why: 'Daily limit reached' };
  const wait = (save.ads.lastReward || 0) + ADS.rewardCooldownMs - now;
  if (placement !== 'keep' && wait > 0) return { ok: false, why: `Ready in ${Math.ceil(wait / 1000)}s`, wait };
  return { ok: true };
}
/** Resolves true only if the reward was earned. */
export async function showRewarded(save, placement) {
  if (showing) return false;
  const g = rewardGate(save, placement); if (!g.ok) return false; if (g.free) { track('reward_free', { placement }); return true; }
  showing = true; track('ad_reward_shown', { placement }); let earned = false;
  try { earned = AdMob ? await nativeRewarded() : await simulated(); } finally { showing = false; }
  if (earned) { save.ads.count++; save.ads.lastReward = Date.now(); save.ads.earned++; track('ad_reward_earned', { placement }); }
  return earned;
}
function nativeRewarded() {
  return new Promise(async res => {
    let earned = false, done = false; const hs = [];
    const finish = v => { if (done) return; done = true; hs.forEach(h => h.remove?.()); loaded = false; setTimeout(preload, 1500); res(v); };
    try {
      hs.push(await AdMob.addListener('onRewardedVideoAdReward', () => { earned = true; }));
      hs.push(await AdMob.addListener('onRewardedVideoAdDismissed', () => finish(earned)));
      hs.push(await AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish(false)));
      if (!loaded) await AdMob.prepareRewardVideoAd({ adId: ADS.rewardedId, isTesting: ADS.testing });
      const item = await AdMob.showRewardVideoAd(); if (item) earned = true;
      setTimeout(() => finish(earned), 90000);
    } catch { finish(false); }
  });
}
function simulated() {
  return new Promise(res => {
    const el = document.createElement('div'); el.className = 'fake-ad'; el.setAttribute('role', 'dialog');
    el.innerHTML = '<div><b>TEST AD</b><p>Real rewarded ads play in the Android app.</p><span>3</span></div>';
    document.body.appendChild(el); let n = 3;
    const t = setInterval(() => { n--; el.querySelector('span').textContent = n; if (n <= 0) { clearInterval(t); el.remove(); res(true); } }, 1000);
  });
}
