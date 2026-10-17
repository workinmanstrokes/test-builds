// AdMob: UMP consent -> init -> rewarded (cooldown + daily cap) and capped interstitials.
// On the web build there is no AdMob, so rewarded ads are simulated with a short "test ad" overlay.
import { ADS, BILLING } from './config.js';
const cap = window.Capacitor;
const native = !!cap?.isNativePlatform?.();
const AdMob = native ? (cap.Plugins?.AdMob || cap.registerPlugin?.('AdMob')) : null;
let ready = false, canRequest = false, privacyRequired = false, rewardLoaded = false, interLoaded = false;
const started = Date.now();

export const adsState = () => ({ native, ready, canRequest, privacyRequired });

export async function initAds(){
  if(!ADS.enabled || !AdMob) return;
  try {
    await AdMob.initialize({ initializeForTesting: ADS.testing });
    let info = await AdMob.requestConsentInfo();
    if(info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
    canRequest = info.canRequestAds !== false;
    privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    ready = true;
    preloadReward(); preloadInter();
  } catch(e){ console.warn('ads init', e) }
}
export async function showPrivacyOptions(){ try{ await AdMob?.showPrivacyOptionsForm() }catch{} }

async function preloadReward(){ if(!ready||!canRequest||rewardLoaded) return; try{ await AdMob.prepareRewardVideoAd({ adId: ADS.rewardedId, isTesting: ADS.testing }); rewardLoaded = true }catch{ rewardLoaded = false } }
async function preloadInter(){ if(!ready||!canRequest||interLoaded) return; try{ await AdMob.prepareInterstitial({ adId: ADS.interstitialId, isTesting: ADS.testing }); interLoaded = true }catch{ interLoaded = false } }

// Rewarded gating lives in game state so it survives restarts.
export function rewardStatus(st){
  const today = new Date().toISOString().slice(0,10);
  if(st.ads.day !== today){ st.ads.day = today; st.ads.count = 0 }
  if(st.ads.count >= ADS.rewardDailyCap) return { ok:false, why:'Daily ad limit reached' };
  const wait = (st.ads.lastReward||0) + ADS.rewardCooldownMs - Date.now();
  if(wait > 0) return { ok:false, why:`Next in ${Math.ceil(wait/60e3)} min`, wait };
  return { ok:true };
}
// Resolves true only if the user actually earned the reward.
export function showRewarded(){
  if(!AdMob) return simulatedAd();
  if(!ready || !canRequest) return Promise.resolve(false);
  return new Promise(async res => {
    let earned = false, done = false; const hs = [];
    const finish = v => { if(done) return; done = true; hs.forEach(h=>h.remove?.()); rewardLoaded = false; setTimeout(preloadReward, 1500); res(v) };
    try {
      hs.push(await AdMob.addListener('onRewardedVideoAdReward', () => { earned = true }));
      hs.push(await AdMob.addListener('onRewardedVideoAdDismissed', () => finish(earned)));
      hs.push(await AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish(false)));
      if(!rewardLoaded) await AdMob.prepareRewardVideoAd({ adId: ADS.rewardedId, isTesting: ADS.testing });
      const item = await AdMob.showRewardVideoAd(); if(item) earned = true;
      setTimeout(() => finish(earned), 120000);
    } catch { finish(false) }
  });
}
// Interstitial: only between games, never mid-spin, at most every ADS.interstitialMinGapMs.
export async function maybeInterstitial(st, busy){
  if(!ADS.enabled || busy || st.noAds) return;
  const now = Date.now();
  if(now - started < ADS.interstitialGraceMs) return;
  if(now - (st.ads.lastInter||0) < ADS.interstitialMinGapMs) return;
  if(!AdMob || !ready || !canRequest || !interLoaded) { preloadInter(); return }
  st.ads.lastInter = now; interLoaded = false;
  try { await AdMob.showInterstitial() } catch {}
  setTimeout(preloadInter, 1500);
}
function simulatedAd(){
  return new Promise(res => {
    const el = document.createElement('div'); el.className = 'fake-ad';
    el.innerHTML = '<div><b>TEST AD</b><p>Real ads appear in the Android app.</p><span>3</span></div>';
    document.body.appendChild(el); let n = 3;
    const t = setInterval(() => { n--; el.querySelector('span').textContent = n; if(n<=0){ clearInterval(t); el.remove(); res(true) } }, 1000);
  });
}
// Remove-ads purchase scaffold: disabled until BILLING.removeAdsEnabled and a Play Billing plugin are added.
export const removeAdsAvailable = () => BILLING.removeAdsEnabled;
