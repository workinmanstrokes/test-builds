// Spin & Deal runtime config. Swap the ad IDs here (or let CI do it from the ADMOB_* secrets).
// The values below are Google's official AdMob TEST ids, which are safe to use while developing.
// The AdMob *App ID* is native: set it in android/gradle.properties (ADMOB_APP_ID) or the ADMOB_APP_ID CI secret.
export const ADS = {
  enabled: true,
  testing: true,                                         // CI sets this to false when real ids are supplied
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',  // TEST rewarded
  interstitialId: 'ca-app-pub-3940256099942544/1033173712', // TEST interstitial
  rewardCoins: 1500,          // coins per rewarded ad (virtual, non-cashable)
  rewardCooldownMs: 5 * 60e3, // 5 min between rewarded ads
  rewardDailyCap: 10,
  interstitialMinGapMs: 3 * 60e3, // at most one interstitial every 3 min
  interstitialGraceMs: 2 * 60e3,  // none in the first 2 min of a session
};
// "Remove ads" one-time Play Billing purchase: scaffold only, kept OFF until the product exists in Play Console.
export const BILLING = { removeAdsEnabled: false, removeAdsProductId: 'remove_ads' };
