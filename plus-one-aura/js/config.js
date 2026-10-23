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
  placementCooldownMs: { boost: 5 * 60e3, free: 10 * 60e3 },
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
  boostMs: 120e3,           // rewarded 2x boost: 120 s, once per 5 min (ADS.placementCooldownMs)
  boostCapMs: 120e3,
  reviveWindowMs: 6000,
  skipMinProgress: 0.25,    // wall-skip ad offered once you're 25% of the way to the next wall
  skipFromFloor: 2,         // ...and never for the first two walls (they take ~20 s and ~35 s)
  wispEverySec: [22, 34],   // floor-3 twist: a golden wisp drifts by; catch it for 5 s of income
  wispValueSec: 5,
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

// Leaderboards + friends (Firebase Spark: Firestore + Anonymous Auth, no Cloud Functions). See docs/SOCIAL.md.
// OFF until Michael enables Firestore + Anonymous sign-in and deploys firebase/firestore.rules; the game then shows
// an offline Ranks screen (your bests, sharing and challenge links still work). configure.mjs flips this from SOCIAL_ONLINE=true.
export const SOCIAL = {
  online: false,   // @cfg social
};
