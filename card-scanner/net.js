// Network helper: timeout, retry with exponential backoff on 429/5xx, JSON cache (memory + localStorage TTL), per-host pacing.
const Net = (() => {
  const mem = new Map(), last = {}, TTL = 12 * 3600e3, gap = { 'api.scryfall.com': 110 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function pace(host) { const g = gap[host] || 0; if (!g) return; const w = (last[host] || 0) + g - Date.now(); last[host] = Date.now() + Math.max(0, w); if (w > 0) await sleep(w); }
  async function raw(url, opt = {}, tries = 4) {
    const host = new URL(url, location.href).host;
    for (let i = 0; ; i++) {
      await pace(host); const ac = new AbortController(), t = setTimeout(() => ac.abort(), opt.timeout || 15000);
      try { const r = await fetch(url, { ...opt, signal: ac.signal }); clearTimeout(t);
        if ((r.status === 429 || r.status >= 500) && i < tries - 1) { await sleep((+r.headers.get('retry-after') || 0) * 1000 || 400 * 2 ** i); continue; }
        return r; }
      catch (e) { clearTimeout(t); if (i >= tries - 1 || !navigator.onLine) throw new Error(navigator.onLine ? 'Network error – please retry' : 'You are offline'); await sleep(400 * 2 ** i); }
    }
  }
  async function json(url, { ttl = TTL } = {}) {
    if (mem.has(url)) return mem.get(url);
    const k = 'c:' + url, hit = (() => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } })();
    if (hit && Date.now() - hit.t < ttl) { mem.set(url, hit.v); return hit.v; }
    try { const r = await raw(url); if (r.status === 404) { const e = new Error('Not found'); e.status = 404; throw e; } if (!r.ok) throw new Error('Server error ' + r.status);
      const v = await r.json(); mem.set(url, v); const s = JSON.stringify({ t: Date.now(), v }); if (s.length < 300000) try { localStorage.setItem(k, s); } catch { prune(); } return v; }
    catch (e) { if (hit) return hit.v; throw e; } // stale cache beats nothing when offline
  }
  function prune() { Object.keys(localStorage).filter(k => k.startsWith('c:')).slice(0, 200).forEach(k => localStorage.removeItem(k)); }
  return { raw, json, sleep };
})();
