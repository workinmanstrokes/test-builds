/** Pad ink colour. Cream on dark pads, ink on light pads, both aimed at WCAG AA. */

const CREAM = '#fff7ec';
const INK = '#1a1208';

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '').trim();
  if (h.length !== 6) return [0, 0, 0];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function channel(c) {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

export function inkFor(hex) {
  const onCream = contrast(hex, CREAM);
  const onInk = contrast(hex, INK);
  return onCream >= onInk ? CREAM : INK;
}

export const INK_CREAM = CREAM;
export const INK_DARK = INK;
