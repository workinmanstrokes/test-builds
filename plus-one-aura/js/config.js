// +1 Aura runtime config. scripts/configure.mjs rewrites the marked values in CI from secrets.
// Ad unit ids below are Google's official AdMob TEST ids (safe while developing).
// The AdMob *App ID* is native: android/gradle.properties ADMOB_APP_ID or the ADMOB_APP_ID CI secret.
export const ADS = {
  enabled: true,
  testing: true,                                          // @cfg testing
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',   // @cfg rewarded (TEST)
  interstitialId: 'ca-app-pub-3940256099942544/1033173712', // @cfg interstitial (TEST) - unused in week 1
  rewardCooldownMs: 20e3,   // min gap between optional rewarded ads (revive is exempt)
  rewardDailyCap: 40,
};

// Firebase Analytics (free Spark plan). Both paths are OFF until Michael approves a Firebase project.
//  - native: true once android/app/google-services.json is present (configure.mjs flips this)
//  - web: put the web app config in js/firebase-config.js (see docs/FIREBASE.md); null = no-op
export const ANALYTICS = {
  native: true,  // @cfg analytics-native
};

export const GAME = {
  skin: 'aura',             // default skin id (see js/skins/)
  offlineCapHours: 8,
  offlineEfficiency: 0.5,
  boostMs: 3 * 60e3,        // rewarded 2x boost length
  boostCapMs: 15 * 60e3,
  reviveWindowMs: 6000,
  skipMinProgress: 0.25,    // stage-skip ad offered once you're 25% of the way to the next stage
};

// "Remove ads" one-time Play Billing purchase ($1.99). OFF until Michael creates the in-app product in Play Console;
// then set the repo variable REMOVE_ADS_ENABLED=true (configure.mjs flips this line) or edit it here.
// Owning it grants every rewarded bonus instantly without watching an ad (there are no forced ads to remove).
export const BILLING = {
  removeAdsEnabled: false,          // @cfg billing
  removeAdsProductId: 'remove_ads', // must match the Play Console product id
  priceFallback: '$1.99',
};

export const PRIVACY_URL = 'https://workinmanstrokes.github.io/test-builds/privacy/plus-one-aura.html'; // permanent path
