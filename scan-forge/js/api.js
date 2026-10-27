// Talks to the Scan Forge job server on the box (through the Cloudflare Tunnel URL).
const K = 'sf.server';
export function cfg() { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch { return {}; } }
export function setCfg(c) { localStorage.setItem(K, JSON.stringify({ url: (c.url || '').trim().replace(/\/+$/, ''), code: (c.code || '').trim() })); }
export const configured = () => { const c = cfg(); return !!(c.url && c.code); };
async function call(path, opt = {}, c = cfg()) {
  if (!c.url) throw new Error('Add your server address in Settings');
  const r = await fetch(c.url + path, { ...opt, headers: { 'X-Scan-Token': c.code || '', ...(opt.headers || {}) } });
  if (!r.ok) { let m = r.status === 401 ? 'Wrong access code' : `Server error ${r.status}`; try { const j = await r.json(); if (j.detail) m = j.detail; } catch {} throw new Error(m); }
  return r;
}
export const health = (c) => call('/api/health', {}, c).then(r => r.json());
export const jobs = () => call('/api/jobs').then(r => r.json());
export const job = (id) => call('/api/jobs/' + id).then(r => r.json());
export const modelBuf = (id, ext) => call(`/api/jobs/${id}/model.${ext}`).then(r => r.arrayBuffer());
export async function upload(name, blobs, onProgress) {
  const { id } = await call('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json());
  for (let i = 0; i < blobs.length; i++) {
    let tries = 0;
    for (;;) {
      try { const fd = new FormData(); fd.append('file', blobs[i], `p${i}.jpg`); await call(`/api/jobs/${id}/photos`, { method: 'POST', body: fd }); break; }
      catch (e) { if (++tries >= 3) throw e; await new Promise(r => setTimeout(r, 1200 * tries)); }
    }
    onProgress && onProgress((i + 1) / blobs.length);
  }
  await call(`/api/jobs/${id}/start`, { method: 'POST' });
  return id;
}
