const H = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.Haptics : null;
export let hapticsOn = true; export const setHaptics = v => { hapticsOn = v; };
export function buzzPhone(ms = 30) { if (!hapticsOn) return; try { if (H) H.vibrate({ duration: ms }); else navigator.vibrate?.(ms); } catch {} }
export function thud() { if (!hapticsOn) return; try { if (H) H.impact({ style: 'HEAVY' }); else navigator.vibrate?.([60, 40, 120]); } catch {} }
