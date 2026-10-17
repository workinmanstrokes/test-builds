// Analytics shim. No Firebase project exists for Period 8 yet (needs Michael's OK, Spark plan only), so events are only
// kept in memory (window.__p8_events) for tests. Wiring Firebase later = replace send() below.
const log = (window.__p8_events = window.__p8_events || []);
export function track(name, params = {}) { log.push({ name, params, t: Date.now() }); if (log.length > 500) log.shift(); }
