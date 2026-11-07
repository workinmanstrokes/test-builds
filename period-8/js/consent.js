// Pure consent decisions. No network, no storage.
// Statistics collection requires an explicit Settings opt-in. Legacy saves stored
// settings.analytics === true as the old default and do not count.

/** True only after the player turns on Settings > Share anonymous gameplay stats. */
export function explicitStatsOptIn(settings) {
  return settings?.statsOptIn === true;
}

/**
 * Normalize a UMP / consent-info payload.
 * canRequestAds must be strictly true. A missing flag is not permission.
 */
export function consentFromInfo(info = {}) {
  return {
    consentStatus: info.status || 'UNKNOWN',
    canRequest: info.canRequestAds === true,
    privacyRequired: info.privacyOptionsRequirementStatus === 'REQUIRED',
  };
}

/**
 * Android UMP gate for analytics and the Firestore session upload.
 * Web (native false) has no UMP form, so this returns true and the Settings opt-in still applies.
 * Fail closed: UNKNOWN, REQUIRED, a failed check, or canRequestAds not exactly true stay off.
 * NOT_REQUIRED is Google's "consent not required in this region" result.
 */
export function umpAllowsAnalytics({ native, consentStatus, canRequest }) {
  if (!native) return true;
  if (consentStatus === 'NOT_REQUIRED') return true;
  if (consentStatus === 'OBTAINED' && canRequest === true) return true;
  return false;
}

/** Both gates. Either one failing means do not collect or upload. */
export function collectionAllowed(settings, ump) {
  return explicitStatsOptIn(settings) && umpAllowsAnalytics(ump);
}
