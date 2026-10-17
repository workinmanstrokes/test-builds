// AdMob rewarded ads with UMP consent (Google TEST ids by default, see config.js). One placement: unlock a pack for 24h.
// Never interstitials, never mid-round. Web build: a 3-second "TEST AD" overlay stands in. Portals: the portal's rewarded break.
import { ADS } from './config.js';
import { track } from './track.js';
import { isPortal, portalRewarded, portalReady } from './portal.js';
import { setSound } from './audio.js';
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
    applyConsent(info); ready = true; preload();
  } catch (e) { console.warn('ads init failed', e); }
}
function applyConsent(info) { canRequest = info.canRequestAds !== false; privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED'; }
export async function showPrivacyOptions() {
  if (!AdMob) return;
  try { await AdMob.showPrivacyOptionsForm(); applyConsent(await AdMob.requestConsentInfo()); } catch (e) { console.warn('privacy options', e); }
}
async function preload() { if (!ready || !canRequest || loaded) return; try { await AdMob.prepareRewardVideoAd({ adId: ADS.rewardedId, isTesting: ADS.testing }); loaded = true; } catch { loaded = false; } }

export function adAvailable() {
  if (!ADS.enabled) return false;
  if (native) return ready && canRequest;
  if (isPortal) return portalReady();
  return true;
}
/** Resolves true only if the reward was earned. */
export async function showRewarded(placement, soundOn = true) {
  if (showing || !adAvailable()) return false;
  showing = true; track('ad_reward_shown', { placement });
  let earned = false;
  try {
    if (isPortal) { setSound(false); earned = await portalRewarded(); }
    else earned = AdMob ? await nativeRewarded() : await simulated();
  } finally { showing = false; if (isPortal) setSound(soundOn); }
  if (earned) track('ad_reward_earned', { placement });
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
