// Who's the Brainrot? runtime config. scripts/configure.mjs rewrites the @cfg lines in CI from secrets.
// Ad unit ids below are Google's official AdMob TEST ids (safe while developing). Real ids: release AAB only.
// The AdMob *App ID* is native: the ADMOB_APP_ID gradle property / CI secret (release job only).
export const ADS = {
  enabled: true,
  testing: true,                                          // @cfg testing
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',   // @cfg rewarded (TEST)
  unlockHours: 24,          // a rewarded ad unlocks one locked pack for this long
};
// "All packs + no ads" one-time Play Billing purchase ($2.99). OFF until Michael creates the in-app product in
// Play Console; then set the repo variable REMOVE_ADS_ENABLED=true (configure.mjs flips this line).
// There are no forced/interstitial ads at all; owning it unlocks every pack forever without watching ads.
export const BILLING = {
  removeAdsEnabled: false,          // @cfg billing
  removeAdsProductId: 'all_packs',  // must match the Play Console product id
  priceFallback: '$2.99',
};
export const PRIVACY_URL = 'https://workinmanstrokes.github.io/test-builds/privacy/whos-the-brainrot.html'; // permanent path
export const AGE_RATING = '13+';
