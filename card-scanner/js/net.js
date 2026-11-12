/* Network helper for Scan & Price: timeout, retry on 429/5xx, 12h JSON cache, Scryfall pacing + required headers.
 * Scryfall asks apps to send an accurate User-Agent and an Accept header. Browsers won't let pages set User-Agent
 * (Scryfall says to keep the browser's), so on Android the request goes through Capacitor's native HTTP with our own UA. */
const Net = (() => {
  const mem = new Map(), last = {}, TTL = 12 * 3600e3, GAP = { 'api.scryfall.com': 120 };
  const UA = 'CardPreGrade/' + ((window.CPG_CONFIG && CPG_CONFIG.VERSION) || '1') + ' (Android; mscofield1588@gmail.com)';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const native = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp);
  async function pace(host) { const g = GAP[host] || 0; if (!g) return; const w = (last[host] || 0) + g - Date.now(); last[host] = Date.now() + Math.max(0, w); if (w > 0) await sleep(w); }
  async function once(url, headers, timeout) {
    if (native() && /api\.scryfall\.com/.test(url)) {
      const r = await Capacitor.Plugins.CapacitorHttp.request({ url, method: 'GET', headers: { ...headers, 'User-Agent': UA }, connectTimeout: timeout, readTimeout: timeout });
      return { status: r.status, retryAfter: +(r.headers && (r.headers['Retry-After'] || r.headers['retry-after'])) || 0, json: async () => typeof r.data === 'string' ? JSON.parse(r.data) : r.data };
    }
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
    try { const r = await fetch(url, { headers, signal: ac.signal }); return { status: r.status, retryAfter: +r.headers.get('retry-after') || 0, json: () => r.json() }; } finally { clearTimeout(t); }
  }
  async function raw(url, { headers = {}, tries = 3, timeout = 12000 } = {}) {
    const host = new URL(url).host; headers = { Accept: 'application/json', ...headers };
    for (let i = 0; ; i++) {
      await pace(host);
      try { const r = await once(url, headers, timeout); if ((r.status === 429 || r.status >= 500) && i < tries - 1) { await sleep(r.retryAfter * 1000 || 500 * 2 ** i); continue; } return r; }
      catch (e) { if (i >= tries - 1) throw new Error(navigator.onLine === false ? 'You are offline' : 'Network error'); await sleep(500 * 2 ** i); }
    }
  }
  async function json(url, { ttl = TTL, headers } = {}) {
    if (mem.has(url)) return mem.get(url);
    const k = 'cpg.c:' + url; let hit = null; try { hit = JSON.parse(localStorage.getItem(k)); } catch {}
    if (hit && Date.now() - hit.t < ttl) { mem.set(url, hit.v); return hit.v; }
    try {
      const r = await raw(url, { headers }); if (r.status === 404) { const e = new Error('Not found'); e.status = 404; throw e; } if (r.status >= 400) throw new Error('Server error ' + r.status);
      const v = await r.json(); mem.set(url, v); const s = JSON.stringify({ t: Date.now(), v });
      if (s.length < 250000) try { localStorage.setItem(k, s); } catch { prune(); } return v;
    } catch (e) { if (hit && e.status !== 404) return hit.v; throw e; }
  }
  function prune() { Object.keys(localStorage).filter(k => k.startsWith('cpg.c:')).slice(0, 150).forEach(k => localStorage.removeItem(k)); }
  return { raw, json, sleep, native };
})();
