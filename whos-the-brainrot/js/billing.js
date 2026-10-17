// "All packs + no ads" in-app purchase via Google Play Billing (@capgo/native-purchases). s.noAds = owns it. Fully inert unless
// BILLING.removeAdsEnabled is true AND we're in the Android app. Ownership is re-checked from Play on every start.
import { BILLING } from './config.js';
import { track } from './track.js';
const cap = window.Capacitor;
const NP = cap?.isNativePlatform?.() ? cap.Plugins?.NativePurchases : null;
let supported = false, price = BILLING.priceFallback;
export const billingAvailable = () => !!(BILLING.removeAdsEnabled && NP && supported);
export const removeAdsPrice = () => price;

const owns = list => (list || []).some(p => p.productIdentifier === BILLING.removeAdsProductId && (p.purchaseState == null || String(p.purchaseState) === '1'));

export async function initBilling(s, onChange) {
  if (!BILLING.removeAdsEnabled || !NP) return;
  try {
    supported = (await NP.isBillingSupported()).isBillingSupported;
    if (!supported) return;
    const { products } = await NP.getProducts({ productIdentifiers: [BILLING.removeAdsProductId], productType: 'inapp' });
    if (products?.[0]?.priceString) price = products[0].priceString;
    const { purchases } = await NP.getPurchases({ productType: 'inapp' });
    const has = owns(purchases);
    if (has !== !!s.noAds) { s.noAds = has; onChange?.(); }
  } catch (e) { console.warn('billing init', e); }
}

/** Returns true if the user now owns remove-ads. */
export async function buyRemoveAds(s) {
  if (!billingAvailable()) return false;
  track('iap_start', { product: BILLING.removeAdsProductId });
  try {
    const tx = await NP.purchaseProduct({ productIdentifier: BILLING.removeAdsProductId, productType: 'inapp', isConsumable: false, quantity: 1 });
    if (tx && (tx.purchaseState == null || String(tx.purchaseState) === '1')) { s.noAds = true; track('iap_purchase', { product: BILLING.removeAdsProductId }); return true; }
  } catch (e) { track('iap_fail', { product: BILLING.removeAdsProductId }); }
  return false;
}

export async function restoreRemoveAds(s) {
  if (!billingAvailable()) return false;
  try { await NP.restorePurchases(); const { purchases } = await NP.getPurchases({ productType: 'inapp' }); s.noAds = owns(purchases); } catch {}
  return !!s.noAds;
}
