/** Kid-safe crash reports (Sentry) and play stats (PostHog) for Laugh Pad.
 * Blank keys, a saved "off" choice, Do Not Track, or a local http page send nothing.
 * No session replay, no input autocapture, no person profile, no stored IP. */

export const APP_LABEL = 'Laugh Pad';
export const POSTHOG_PROJECT = 'workinmanstrokesinc';
export const STATS_KEY = 'laughpad.stats.v1';

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const KINDS = new Set(['starter', 'recording', 'saved', 'chain']);

export function scrubText(value) {
  return typeof value === 'string' ? value.replace(EMAIL, '[email]') : value;
}

export function stripUrl(value) {
  return typeof value === 'string' ? value.split(/[?#]/)[0] : value;
}

export function privacySignals(nav = {}, win = {}) {
  return nav.doNotTrack == '1'
    || win.doNotTrack == '1'
    || nav.msDoNotTrack == '1'
    || nav.globalPrivacyControl === true;
}

export function reportersFor({ sentryDsn, posthogKey, allowed }) {
  const dsn = typeof sentryDsn === 'string' ? sentryDsn.trim() : '';
  const key = typeof posthogKey === 'string' ? posthogKey.trim() : '';
  return {
    sentry: Boolean(allowed && dsn),
    posthog: Boolean(allowed && key),
  };
}

/** stored is 'on', 'off', or null (null means the switch has never been moved, which is on). */
export function describeStats({ stored, doNotTrack, localHttp, sentryDsn, posthogKey }) {
  if (doNotTrack) return { allowed: false, sentry: false, posthog: false, reason: 'dnt' };
  if (stored === 'off') return { allowed: false, sentry: false, posthog: false, reason: 'off' };
  const plan = reportersFor({ sentryDsn, posthogKey, allowed: true });
  if (!plan.sentry && !plan.posthog) return { allowed: true, sentry: false, posthog: false, reason: 'no-keys' };
  if (localHttp) return { allowed: false, sentry: false, posthog: false, reason: 'local' };
  return { allowed: true, sentry: plan.sentry, posthog: plan.posthog, reason: 'on' };
}

export function eventProperties(extra) {
  const props = { app: APP_LABEL };
  if (extra && KINDS.has(extra.kind)) props.kind = extra.kind;
  return props;
}

export function keepBreadcrumb(breadcrumb) {
  return !(breadcrumb && breadcrumb.category === 'ui.input');
}

export function scrubSentryEvent(event) {
  if (!event || typeof event !== 'object') return null;
  event.user = { ip_address: null };
  delete event.server_name;
  if (event.request) {
    const headers = event.request.headers || {};
    event.request = {
      url: stripUrl(event.request.url),
      headers: headers['User-Agent'] ? { 'User-Agent': headers['User-Agent'] } : {},
    };
  }
  if (event.message) event.message = scrubText(event.message);
  const values = event.exception && event.exception.values;
  if (Array.isArray(values)) values.forEach((item) => { item.value = scrubText(item.value); });
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs.forEach((crumb) => {
      crumb.message = scrubText(crumb.message);
      if (crumb.data && crumb.data.url) crumb.data.url = stripUrl(crumb.data.url);
    });
  }
  return event;
}

export function posthogInitOptions(host, isAllowed) {
  return {
    api_host: host || 'https://us.i.posthog.com',
    person_profiles: 'never',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    capture_exceptions: false,
    capture_performance: false,
    advanced_disable_feature_flags: true,
    disable_external_dependency_loading: true,
    respect_dnt: true,
    ip: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    persistence: 'localStorage',
    save_referrer: false,
    property_denylist: [
      '$ip',
      '$referrer',
      '$referring_domain',
      '$initial_referrer',
      '$initial_referring_domain',
    ],
    sanitize_properties(props) {
      if (!props) return props;
      delete props.$ip;
      for (const key of ['$current_url', '$pathname', '$host']) {
        if (props[key]) props[key] = stripUrl(props[key]);
      }
      props.app = APP_LABEL;
      return props;
    },
    before_send(event) {
      if (isAllowed && !isAllowed()) return null;
      if (!event) return event;
      const props = event.properties || {};
      delete props.$ip;
      props.app = APP_LABEL;
      event.properties = props;
      return event;
    },
  };
}

export function sentryInitOptions(dsn) {
  return {
    dsn,
    sendDefaultPii: false,
    sampleRate: 1,
    maxBreadcrumbs: 20,
    initialScope: { tags: { app: APP_LABEL } },
    beforeBreadcrumb: keepBreadcrumb,
    beforeSend: scrubSentryEvent,
  };
}
