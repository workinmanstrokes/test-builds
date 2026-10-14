// AI vision (xAI Grok) – primary identification path when a proxy (or a dev key) is configured.
const AI = (() => {
  const BAKED_PROXY = ''; // set to the deployed Vercel URL at release time
  // Keys never live in the app: all AI calls go through the proxy (proxy/), which holds XAI_API_KEY.
  const proxy = () => (localStorage.getItem('proxyUrl') || BAKED_PROXY).replace(/\/$/, '');
    const available = () => !!proxy();
  const native = () => !!window.Capacitor?.isNativePlatform?.();
  async function shrink(src, max = 1600) { const i = await loadImg(src), s = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas');
    c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.88); }
  async function post(url, headers, body) {
    if (native()) { const H = Capacitor.Plugins?.CapacitorHttp || Capacitor.registerPlugin('CapacitorHttp'); const r = await H.request({ url, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, data: body, connectTimeout: 30000, readTimeout: 60000 });
      return { ok: r.status < 300, status: r.status, json: async () => typeof r.data === 'string' ? JSON.parse(r.data) : r.data }; }
    return Net.raw(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), timeout: 60000 }, 2);
  }
  async function identify(src, gameHint) {
    const image = await shrink(src), px = proxy();
    if (px) { const r = await post(px + '/api/identify', { 'X-App-Token': localStorage.getItem('appToken') || '' }, { image, gameHint });
      if (r.status === 429) throw new Error('Too many scans – wait a minute'); if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch {} throw new Error('AI service error ' + r.status + (m ? ': ' + m : '')); } return norm(await r.json()); }
    throw new Error('AI vision not set up (no proxy)');
  }
  function norm(v) { const num = String(v.number || '').trim(), m = num.match(/^([A-Za-z]*\d+[a-z]?)\s*\/\s*([A-Za-z]*\d+)$/);
    return { ...v, number: m ? m[1].replace(/^0+(?=\d)/, '') : num.replace(/^#/, ''), total: m ? m[2].replace(/^0+(?=\d)/, '') : '', setCode: v.game === 'magic' ? (v.set_code || '').toLowerCase() : v.set_code || '' }; }
  return { identify, available, proxy, native, BAKED_PROXY };
})();
