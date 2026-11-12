'use strict';
// Resale Hub listing sync (Feature 2).
// One-tap "List on Resale Hub" from the scan result screen. The shop only shows a
// listing when userId === STORE_SELLER_UID, storefront === true and stock > 0, so
// the client POSTs to the seller endpoint POST /api/storefront/listings (built for
// this in the resale-hub backend) with the seller's Firebase ID token — never with
// the shop's keys. Photos: the app keeps only 450px JPEG thumbs on-device and has
// no upload path, so the listing carries a small `thumbnail` data URL (the shop
// frontend already falls back to it when photos[] is empty). Nothing is invented:
// no comp price means no listing price is sent.
(function (root) {
  const MAX_THUMBNAIL_CHARS = 60000;
  const THUMB_WIDTHS = [240, 200, 160];
  const THUMB_QUALITY = 0.72;

  // Pure payload builder — tested in Node, no DOM / network.
  // card: the identified card {name, year, brand, number, parallel, insert, serial, game}.
  // price: the comp median in dollars (number), or null when there is no comp.
  // thumbnail: a JPEG data URL <= 60,000 chars, or null.
  function buildListing(card, price, thumbnail) {
    const title = [card.year, card.brand, card.name,
      card.number ? '#' + card.number : '',
      card.parallel, card.insert, card.serial ? 'Serial ' + card.serial : '']
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title) return { error: 'No card identified yet — nothing to list.' };
    if (price == null || !Number.isFinite(+price) || +price <= 0)
      return { error: 'No recent-sales price for this card — set a price on the shop instead of listing from a guess.' };
    const out = { title, price: Math.round(+price * 100) / 100, condition: 'used', stock: 1, storefront: true };
    if (thumbnail) {
      if (typeof thumbnail !== 'string' || thumbnail.length > MAX_THUMBNAIL_CHARS)
        return { error: 'Photo too large for a listing thumbnail.' };
      out.thumbnail = thumbnail;
    }
    return { listing: out };
  }

  // Downscale the front photo canvas to a JPEG data URL under the shop's thumbnail
  // cap (60,000 chars). Tries widths 240 -> 200 -> 160 at quality 0.72; returns
  // null when even the smallest is too big (the listing still goes up without it).
  function makeThumbnail(canvas) {
    if (!canvas || !canvas.width) return null;
    for (const w of THUMB_WIDTHS) {
      const h = Math.max(1, Math.round(canvas.height * w / canvas.width));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(canvas, 0, 0, w, h);
      const url = c.toDataURL('image/jpeg', THUMB_QUALITY);
      if (url.length <= MAX_THUMBNAIL_CHARS) return url;
    }
    return null;
  }

  // --- Firebase Auth + API (browser only) ---
  // The Firebase apiKey is a public client key, but it is never stored in this
  // repo or in chat: the client fetches the shop's own public config.js (the
  // file every shop visitor loads) at runtime and reads the firebase block out
  // of it. If the shop has no key filled in yet, listing reports that plainly.
  let firebasePromise = null, appPromise = null;
  async function loadShopFirebaseConfig() {
    const url = (root.CPG_CONFIG && CPG_CONFIG.RESALE_CONFIG_URL) || '';
    if (!url) throw new Error('Resale Hub is not configured in this build yet.');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load the shop configuration (HTTP ' + res.status + ').');
    const text = await res.text();
    const pick = k => { const m = text.match(new RegExp(k + "\\s*:\\s*'([^']+)'")); return m ? m[1] : ''; };
    const cfg = { apiKey: pick('apiKey'), authDomain: pick('authDomain'), projectId: pick('projectId'), appId: pick('appId') };
    if (!cfg.apiKey || !cfg.projectId || cfg.apiKey === 'YOUR_FIREBASE_WEB_API_KEY')
      throw new Error('Resale Hub is not configured yet — the shop has no Firebase key filled in.');
    return cfg;
  }
  function loadFirebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = (async () => {
      const cfg = await loadShopFirebaseConfig();
      const load = src => new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s);
      });
      if (!root.firebase) {
        await load('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await load('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
      }
      if (!appPromise) appPromise = Promise.resolve(firebase.initializeApp(cfg, 'resale-hub'));
      const app = await appPromise;
      return app.auth();
    })();
    firebasePromise.catch(() => { firebasePromise = null; });
    return firebasePromise;
  }
  async function signIn(email, password) {
    const auth = await loadFirebase();
    if (auth.currentUser) return auth.currentUser;
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }
  async function listOnResaleHub(card, price, frontCanvas, email, password) {
    const built = buildListing(card, price, frontCanvas ? makeThumbnail(frontCanvas) : null);
    if (built.error) throw new Error(built.error);
    const user = await signIn(email, password);
    const token = await user.getIdToken();
    const api = (root.CPG_CONFIG && CPG_CONFIG.RESALE_API) || '';
    const res = await fetch(api + '/storefront/listings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(built.listing)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body && body.error) || ('Shop refused the listing (HTTP ' + res.status + ')'));
    return body.listing || body;
  }

  const api = { buildListing, makeThumbnail, listOnResaleHub, signIn, MAX_THUMBNAIL_CHARS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Resale = api;
})(typeof self !== 'undefined' ? self : this);
