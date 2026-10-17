// No analytics: nothing leaves the device. Events are only kept in memory for the automated smoke test.
export function track(name, params = {}) { (window.__wtb_events ||= []).push({ name, params, t: Date.now() }); }
