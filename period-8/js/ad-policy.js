// Ad unit policy shared by the release configure script and the runtime.
// Do not log ids. Google's public test publisher is rejected for any production configuration.

export const GOOGLE_TEST_PUBLISHER = '3940256099942544';

export function isWellFormedAppId(id) {
  return typeof id === 'string' && /^ca-app-pub-\d+~\d+$/.test(id);
}

export function isWellFormedRewardedId(id) {
  return typeof id === 'string' && /^ca-app-pub-\d+\/\d+$/.test(id);
}

export function isGoogleTestPublisher(id) {
  return typeof id === 'string' && id.includes(GOOGLE_TEST_PUBLISHER);
}

/**
 * A release build may carry ads only when test mode is off and both ids are
 * well formed and are not Google's test publisher.
 */
export function isProductionAdConfig({ testing, appId, rewardedId }) {
  return testing === false
    && isWellFormedAppId(appId)
    && isWellFormedRewardedId(rewardedId)
    && !isGoogleTestPublisher(appId)
    && !isGoogleTestPublisher(rewardedId);
}

/**
 * Runtime gate. The JS bundle has the rewarded unit and the testing flag, not the native App ID.
 * testing:true may use Google's test unit. testing:false may not.
 */
export function rewardedRequestsAllowed(ads) {
  if (!ads || ads.enabled === false) return false;
  if (!isWellFormedRewardedId(ads.rewardedId)) return false;
  if (ads.testing === true) return true;
  if (ads.testing === false) return !isGoogleTestPublisher(ads.rewardedId);
  return false;
}
