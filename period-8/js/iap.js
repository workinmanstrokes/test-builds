// $1.99 "Remove ads" scaffold. Disabled (IAP.enabled = false) until Michael creates the in-app product in Play Console
// and we add a billing plugin. When enabled, a purchase sets save.noAds so hints and streak saves are free (no video).
import { IAP } from './config.js';
export const iapInfo = () => ({ enabled: IAP.enabled, sku: IAP.removeAdsSku, price: IAP.price });
export async function buyRemoveAds(save) {
  if (!IAP.enabled) return { ok: false, why: 'Coming soon' };
  // TODO(billing): call the Play Billing plugin with IAP.removeAdsSku, verify, then:
  save.noAds = true; return { ok: true };
}
export async function restorePurchases(save) { if (!IAP.enabled) return { ok: false, why: 'Coming soon' }; return { ok: true, noAds: !!save.noAds }; }
