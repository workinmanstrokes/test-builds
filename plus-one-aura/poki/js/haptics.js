// Haptics: Capacitor Haptics on Android, navigator.vibrate on the web, throttled for rapid taps.
const cap = window.Capacitor; const H = cap?.isNativePlatform?.() ? cap.Plugins?.Haptics : null;
let on = true, last = 0;
export function setVibe(v) { on = v; }
export function buzz(kind = 'tap') {
  if (!on) return; const now = performance.now();
  if (kind === 'tap' && now - last < 45) return; last = now;
  try {
    if (H) {
      if (kind === 'tap') H.impact({ style: 'LIGHT' });
      else if (kind === 'heavy') H.impact({ style: 'HEAVY' });
      else H.notification({ type: kind === 'error' ? 'ERROR' : 'SUCCESS' });
    } else if (navigator.vibrate) navigator.vibrate(kind === 'tap' ? 8 : kind === 'heavy' ? 40 : [20, 40, 20]);
  } catch {}
}
