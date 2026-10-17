// Period 8 runtime config. scripts/configure.mjs rewrites the @cfg lines from CI secrets for --release builds only.
// Ad unit ids below are Google's official AdMob TEST ids. Real units go in ONLY for release AABs.
// The AdMob *App ID* is native: release builds only, from the ADMOB_APP_ID secret via configure.mjs --release.
export const ADS = {
  enabled: true,
  testing: true,                                          // @cfg testing
  maxAdContentRating: 'Teen',                             // matches the AdMob app's max ad content rating (T)
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',   // @cfg rewarded (TEST)
  rewardCooldownMs: 15e3,   // min gap between optional rewarded ads
  rewardDailyCap: 30,
  // Rewarded only, by design: NO interstitials anywhere in Period 8.
};
// $1.99 "Remove ads" (makes hints + streak saves free, no video). Scaffolded but OFF until a Play product exists.
export const IAP = { enabled: false, removeAdsSku: 'period8_remove_ads', price: '$1.99' };
// Firebase Analytics (project period-8-dd, Spark/free). native flips to true in configure.mjs when
// android/app/google-services.json is present; web uses js/firebase-config.js.
export const ANALYTICS = {
  native: false,  // @cfg analytics-native
};
export const PRIVACY_URL = 'https://workinmanstrokes.github.io/test-builds/privacy/period-8.html';
export const PLAY_URL = 'https://workinmanstrokes.github.io/test-builds/period-8/';
