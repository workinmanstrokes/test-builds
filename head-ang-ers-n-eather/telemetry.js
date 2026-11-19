import { POSTHOG_HOST, POSTHOG_KEY, SENTRY_DSN } from './telemetry-config.js';
import {
  APP_LABEL,
  STATS_KEY,
  describeStats,
  eventProperties,
  posthogInitOptions,
  privacySignals,
  scrubSentryEvent,
  sentryInitOptions,
} from './lib/telemetry.js';

const SENTRY_SRC = 'https://browser.sentry-cdn.com/11.9.0/bundle.min.js';
const PH_SRC = 'https://us-assets.i.posthog.com/static/array.js';

let enabled = false;
let sentryState = 'idle';
let phState = 'idle';

export function readStatsChoice(storage) {
  try {
    const value = (storage || localStorage).getItem(STATS_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch (_) {
    return null;
  }
}

export function writeStatsChoice(on, storage) {
  try {
    (storage || localStorage).setItem(STATS_KEY, on ? 'on' : 'off');
  } catch (_) {
    /* private mode */
  }
}

function localHttp() {
  return typeof location !== 'undefined'
    && location.protocol === 'http:'
    && /^(localhost|127\.)/.test(location.hostname);
}

export function currentStats(storage) {
  return describeStats({
    stored: readStatsChoice(storage),
    doNotTrack: privacySignals(navigator, window),
    localHttp: localHttp(),
    sentryDsn: SENTRY_DSN,
    posthogKey: POSTHOG_KEY,
  });
}

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function later(fn) {
  const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 800));
  idle(() => {
    try { fn(); } catch (_) { /* telemetry never blocks the board */ }
  }, { timeout: 4000 });
}

function startSentry() {
  if (sentryState !== 'idle' || !enabled || !String(SENTRY_DSN).trim()) return;
  sentryState = 'loading';
  const early = [];
  const onErr = (event) => {
    if (!enabled || early.length >= 10) return;
    early.push(event.error || event.reason || (event.message ? new Error(String(event.message)) : null));
  };
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  loadScript(SENTRY_SRC).then((ok) => {
    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onErr);
    const Sentry = window.Sentry;
    if (!ok || !Sentry || !Sentry.init) {
      sentryState = 'idle';
      return;
    }
    const options = sentryInitOptions(SENTRY_DSN);
    options.beforeSend = (event) => (enabled ? scrubSentryEvent(event) : null);
    try { Sentry.init(options); } catch (_) { sentryState = 'idle'; return; }
    sentryState = 'ready';
    if (!enabled) return;
    early.forEach((err) => {
      if (!err) return;
      try { Sentry.captureException(err); } catch (_) { /* ignore */ }
    });
  });
}

function startPostHog() {
  if (phState !== 'idle' || !enabled || !String(POSTHOG_KEY).trim()) return;
  phState = 'loading';
  loadScript(PH_SRC).then((ok) => {
    const posthog = window.posthog;
    if (!ok || !posthog || !posthog.init) {
      phState = 'idle';
      return;
    }
    try {
      posthog.init(POSTHOG_KEY, posthogInitOptions(POSTHOG_HOST, () => enabled));
    } catch (_) {
      phState = 'idle';
      return;
    }
    phState = 'ready';
    if (!enabled) {
      try { posthog.opt_out_capturing(); } catch (_) { /* ignore */ }
      return;
    }
    try {
      posthog.register({ app: APP_LABEL });
      posthog.capture('app_opened', eventProperties());
    } catch (_) { /* ignore */ }
  });
}

function arm() {
  const plan = currentStats();
  enabled = plan.reason === 'on';
  if (!enabled) return;
  later(() => {
    if (!enabled) return;
    if (plan.sentry) startSentry();
    if (plan.posthog) startPostHog();
  });
}

export function bootTelemetry() {
  try { arm(); } catch (_) { enabled = false; }
  return currentStats();
}

export function setStatsEnabled(on) {
  writeStatsChoice(on);
  const plan = currentStats();
  enabled = plan.reason === 'on';
  const posthog = window.posthog;
  if (!enabled) {
    try { if (posthog && posthog.opt_out_capturing) posthog.opt_out_capturing(); } catch (_) { /* ignore */ }
    try { if (posthog && posthog.reset) posthog.reset(); } catch (_) { /* ignore */ }
    return plan;
  }
  if (phState === 'ready' && posthog && posthog.opt_in_capturing) {
    try {
      posthog.opt_in_capturing();
      posthog.register({ app: APP_LABEL });
    } catch (_) { /* ignore */ }
  } else if (plan.posthog) {
    startPostHog();
  }
  if (plan.sentry) startSentry();
  return plan;
}

export function track(name, extra) {
  if (!enabled || phState !== 'ready') return;
  const posthog = window.posthog;
  if (!posthog || !posthog.capture) return;
  try {
    if (posthog.has_opted_out_capturing && posthog.has_opted_out_capturing()) return;
    posthog.capture(name, eventProperties(extra));
  } catch (_) { /* ignore */ }
}
