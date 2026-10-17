// Optional cloud adapter: Firebase AI Logic (Gemini Developer API, free Spark plan) protected by App Check.
// No keys in the app: FIREBASE_CONFIG holds public identifiers only. Off (on-device only) until a config exists.
const AI = (() => {
  const config = () => { try { return JSON.parse(localStorage.getItem('firebaseConfig') || 'null') || window.FIREBASE_CONFIG; } catch { return window.FIREBASE_CONFIG; } };
  const opts = () => ({ models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'], appCheckDebug: true, webRecaptchaSiteKey: '', ...(window.FIREBASE_OPTS || {}) });
  const native = () => !!window.Capacitor?.isNativePlatform?.();
  const available = () => !!(config()?.apiKey && config()?.projectId) && localStorage.getItem('aiOff') !== '1';
  let mod = null, off = 0; const load = () => mod ||= import('./firebase-ai.js');
  async function shrink(src, max = 1600) { const i = await loadImg(src), s = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas');
    c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.88); }
  async function identify(src, gameHint) {
    if (!available()) throw new Error('AI not set up (no Firebase config)');
    if (off && Date.now() < off) throw new Error('AI helper not switched on yet in Firebase (AI Logic → Get started)');
    const m = await load(); let v;
    try { v = await m.identify(config(), opts(), await shrink(src), gameHint); }
    catch (e) { const s = String(e.message || e); if (/SERVICE_DISABLED|has not been used|API.*disabled/i.test(s)) { off = Date.now() + 5 * 60e3; throw new Error('AI helper not switched on yet in Firebase (AI Logic → Get started)'); } throw new Error(/app.?check|attestation|403|PERMISSION_DENIED/i.test(s) ? 'AI blocked by App Check (register this device/debug token)' : /quota|429|RESOURCE_EXHAUSTED/i.test(s) ? 'Free AI quota used up – try later' : 'AI error: ' + s.slice(0, 120)); }
    return norm(v);
  }
  function norm(v) { const num = String(v.number || '').trim(), m = num.match(/^([A-Za-z]*\d+[a-z]?)\s*\/\s*([A-Za-z]*\d+)$/);
    return { set_code: '', year: '', player: '', brand: '', serial: '', is_back: false, ...v, number: m ? m[1].replace(/^0+(?=\d)/, '') : num.replace(/^#/, ''), total: m ? m[2].replace(/^0+(?=\d)/, '') : '', setCode: v.game === 'magic' ? (v.set_code || '').toLowerCase() : v.set_code || '' }; }
  return { identify, available, native, config, warm: () => available() && load().catch(() => {}) };
})();
