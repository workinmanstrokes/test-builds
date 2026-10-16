// AdMob rewarded ads with UMP consent (Google TEST ids by default, see config.js).
// Placements: boost (2x for 3 min), revive (after overheat), skip (next stage), offline (double away earnings).
// Web build: no AdMob, so a 3-second "TEST AD" overlay stands in for a rewarded ad.
import { ADS } from './config.js';
import { track } from './analytics.js';
const cap = window.Capacitor;
const native = !!cap?.isNativePlatform?.();
const AdMob = native ? cap.Plugins?.AdMob : null;
let ready = false, canRequest = !native, privacyRequired = false, loaded = false, showing = false;

export const adsInfo = () => ({ native, ready, canRequest, privacyRequired });

export async function initAds() {
  if (!ADS.enabled || !AdMob) return;
  try {
    await AdMob.initialize({ initializeForTesting: ADS.testing });
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
    canRequest = info.canRequestAds !== false;
    privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    ready = true; preload();
  } catch (e) { console.warn('ads init failed', e); }
}
export async function showPrivacyOptions() { try { await AdMob?.showPrivacyOptionsForm(); } catch {} }
async function preload() { if (!ready || !canRequest || loaded) return; try { await AdMob.prepareRewardVideoAd({ adId: ADS.rewardedId, isTesting: ADS.testing }); loaded = true; } catch { loaded = false; } }

/** Optional-ad gating (cooldown + daily cap) stored in the save so it survives restarts. Revive bypasses cooldown. */
export function rewardGate(s, placement, now = Date.now()) {
  if (!ADS.enabled) return { ok: false, why: 'Ads off' };
  if (native && (!ready || !canRequest)) return { ok: false, why: 'Ads unavailable' };
  const today = new Date(now).toISOString().slice(0, 10);
  if (s.ads.day !== today) { s.ads.day = today; s.ads.count = 0; }
  if (s.ads.count >= ADS.rewardDailyCap) return { ok: false, why: 'Daily limit reached' };
  const wait = (s.ads.lastReward || 0) + ADS.rewardCooldownMs - now;
  if (placement !== 'revive' && wait > 0) return { ok: false, why: `Ready in ${Math.ceil(wait / 1000)}s`, wait };
  return { ok: true };
}

/** Resolves true only if the reward was earned. */
export async function showRewarded(s, placement) {
  if (showing) return false;
  const g = rewardGate(s, placement); if (!g.ok) return false;
  showing = true; track('ad_reward_shown', { placement });
  let earned = false;
  try { earned = AdMob ? await nativeRewarded() : await simulated(); } finally { showing = false; }
  if (earned) { s.ads.count++; s.ads.lastReward = Date.now(); s.ads.earned++; track('ad_reward_earned', { placement }); }
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
