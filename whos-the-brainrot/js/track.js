// Kid-safe play stats. The smoke test reads the in-memory list. telemetry.js forwards the same
// events to PostHog once it loads. Only the allowlist below can leave the device: no names, no free text.
const MODES = ['classic', 'two', 'silent', 'reverse'];
const PACKS = ['starter', 'school', 'gaming', 'food', 'halloween'];
const ALLOW = {
  app_open: { platform: ['web', 'android'], app_version: /^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$/ },
  round_start: { mode: MODES, players: n => Number.isInteger(n) && n >= 3 && n <= 10, pack: PACKS },
  reveal: { clip: 'bool', tie: 'bool' },
  round_end: { winner: ['crew', 'brainrot', 'knower'], reason: ['survived', 'tie', 'guessed', 'caught', 'wrong-guess', 'caught-and-guessed'], mode: MODES },
  pack_unlock: { pack: PACKS },
  ad_reward_shown: { placement: ['unlock_pack'] },
  ad_reward_earned: { placement: ['unlock_pack'] },
  iap_start: { product: ['all_packs'] },
  iap_purchase: { product: ['all_packs'] },
  iap_fail: { product: ['all_packs'] },
};

export function sanitize(name, params) {
  const spec = ALLOW[name];
  if (!spec) return null;
  const out = {};
  for (const [k, rule] of Object.entries(spec)) {
    if (!params || !Object.prototype.hasOwnProperty.call(params, k)) continue;
    const v = params[k];
    const ok = rule === 'bool' ? typeof v === 'boolean'
      : typeof rule === 'function' ? rule(v)
      : rule instanceof RegExp ? typeof v === 'string' && rule.test(v)
      : Array.isArray(rule) && rule.includes(v);
    if (ok) out[k] = v;
  }
  return out;
}

export function track(name, params = {}) {
  const safe = sanitize(name, params);
  if (!safe) return;
  const root = globalThis;
  (root.__wtb_events ||= []).push({ name, params: safe, t: Date.now() });
  try { root.TM?.event?.(name, safe); } catch { /* a stats failure must never break a round */ }
}
