// Firebase AI Logic (Gemini Developer API) + App Check. ES module, loaded on demand by ai.js. Vendored SDK – no CDN at runtime.
import { initializeApp } from './vendor/firebase/firebase-app.js';
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from './vendor/firebase/firebase-ai.js';
import { initializeAppCheck, CustomProvider, ReCaptchaV3Provider } from './vendor/firebase/firebase-app-check.js';

export const PROMPT = `You are an expert trading-card identifier. Identify the single card in the photo (front side).
Read the printed text exactly: card name, collector number (e.g. "4/102", "123", "SV049"), set code (e.g. "LOB-EN001" for Yu-Gi-Oh, "MKM" for Magic), set name, year.
For sports cards also give player, brand/product (e.g. "2025 Donruss"), parallel/variant (e.g. "Rated Rookie", "Silver Prizm"), serial numbering (e.g. "23/99").
Only report what you can see or are highly sure of; use "" when unknown. is_back is true if this is the back of a card. confidence is 0..1 for the exact print.`;
export const schema = Schema.object({
  properties: {
    game: Schema.enumString({ enum: ['pokemon', 'magic', 'yugioh', 'lorcana', 'sports', 'other'] }),
    name: Schema.string(), set: Schema.string(), number: Schema.string(), variant: Schema.string(), confidence: Schema.number(),
    set_code: Schema.string(), year: Schema.string(), player: Schema.string(), brand: Schema.string(), serial: Schema.string(), is_back: Schema.boolean()
  },
  optionalProperties: ['set_code', 'year', 'player', 'brand', 'serial', 'is_back']
});
let ctx = null;
async function init(config, opts) {
  if (ctx) return ctx;
  const app = initializeApp(config, 'card-scanner'), cap = window.Capacitor;
  const nativeAC = cap?.isNativePlatform?.() && cap.isPluginAvailable?.('FirebaseAppCheck'); // native App Check plugin is added once google-services.json exists
  if (nativeAC) { // Android: Play Integrity (or debug provider for test builds) via the native plugin, fed into the JS SDK
    const N = cap.Plugins?.FirebaseAppCheck || cap.registerPlugin('FirebaseAppCheck');
    await N.initialize({ debugToken: !!opts.appCheckDebug, isTokenAutoRefreshEnabled: true });
    if (opts.appCheckDebug) N.getToken({ forceRefresh: false }).catch(e => console.warn('App Check token not accepted yet (register the debug token below): ' + (e.message || e))).finally(async () => { // test builds: surface this phone's debug token so it can be registered without adb
      try { const D = cap.Plugins?.AppCheckDebug || cap.registerPlugin('AppCheckDebug'); const r = await D.getSecret(); if (r?.secret) { window.APP_CHECK_DEBUG_TOKEN = r.secret; console.log('App Check debug token (add in Firebase console → App Check → Android app → Manage debug tokens): ' + r.secret); } } catch {} });
    initializeAppCheck(app, { provider: new CustomProvider({ getToken: async () => { const t = await N.getToken({ forceRefresh: false }); return { token: t.token, expireTimeMillis: t.expireTimeMillis || Date.now() + 30 * 60e3 }; } }), isTokenAutoRefreshEnabled: true });
  } else if (opts.webRecaptchaSiteKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(opts.webRecaptchaSiteKey), isTokenAutoRefreshEnabled: true });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  ctx = { ai, models: opts.models };
  console.log('[t] firebase ai ready (' + (nativeAC ? 'App Check: ' + (opts.appCheckDebug ? 'debug' : 'Play Integrity') : opts.webRecaptchaSiteKey ? 'App Check: reCAPTCHA' : 'no App Check yet') + ')');
  return ctx;
}
export async function identify(config, opts, dataUrl, gameHint) {
  const { ai, models } = await init(config, opts), [, mime, data] = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  let last;
  for (const model of models) {
    try {
      const m = getGenerativeModel(ai, { model, systemInstruction: PROMPT, generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema } });
      const t0 = performance.now(), r = await m.generateContent([{ inlineData: { mimeType: mime, data } }, { text: 'Identify this card.' + (gameHint ? ` The user selected: ${gameHint}.` : '') }]);
      const txt = r.response.text(), v = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
      console.log(`[t] gemini ${model} ${Math.round(performance.now() - t0)}ms`); return { ...v, model };
    } catch (e) { last = e; console.warn('gemini ' + model + ' failed: ' + (e.message || e).slice(0, 200)); if (!/not found|404|unsupported|not supported/i.test(e.message || '')) break; }
  }
  throw last || new Error('AI unavailable');
}
