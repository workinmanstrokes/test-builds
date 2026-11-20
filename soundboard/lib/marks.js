/** Original pad glyphs. Stroke icons, not emoji and not a third-party set. */

const PATHS = {
  airhorn: '<path d="M6 20h6l8-6V10l-8-6H6v16z"/><path d="M22 11v2M26 8c2 2 2 6 0 8"/>',
  rimshot: '<circle cx="12" cy="16" r="6"/><path d="M18 10l8-4M18 22l8 4"/>',
  'sad-trombone': '<path d="M5 20c4-1 6-6 10-6s6 5 12 4"/><path d="M7 12c.5 2 2 3 3 3"/>',
  boing: '<path d="M6 22c4-12 8-12 10 0s6 12 10 0"/>',
  laser: '<path d="M5 16h8l12-8M13 16l12 8"/>',
  whistle: '<path d="M6 18c6-2 8-8 14-8h6v6H18"/>',
  applause: '<path d="M8 18c0-4 2-8 4-8s2 3 2 6 2 6 2 6 2-2 2-6 2-6 4-6 4 4 4 8c0 4-3 8-8 8h-4c-4 0-6-2-6-2"/>',
  'drum-roll': '<ellipse cx="16" cy="16" rx="10" ry="6"/><path d="M6 16c2 3 6 4 10 4s8-1 10-4"/>',
  quack: '<path d="M6 16c4-4 8-4 10-1 2 2 6 2 10-1-4 6-8 8-14 6-4-1-6-2-6-4z"/>',
  moo: '<path d="M8 14c0-4 3-6 6-4 1-3 5-3 6 0 3-2 6 0 6 4 0 6-4 10-9 10S8 20 8 14z"/><path d="M12 8c-1-3 1-5 2-5M20 8c1-3-1-5-2-5"/>',
  ding: '<path d="M16 6v2M10 22h12"/><path d="M9 14a7 7 0 0 1 14 0c0 4 1 5 1 5H8s1-1 1-5z"/>',
  buzzer: '<rect x="6" y="10" width="20" height="12" rx="2"/><path d="M12 10V7M20 10V7M10 22h12"/>',
  coin: '<ellipse cx="16" cy="16" rx="8" ry="8"/><path d="M16 11v10M13 14h5c1 0 2 .6 2 1.6S19 17.2 18 17.2h-4"/>',
  fart: '<path d="M8 20c2-6 4-4 6-8s4-2 6 2 4 6 6 4"/>',
  tada: '<path d="M8 20l8-12 8 12"/><path d="M6 10l2 2M26 10l-2 2M16 5v2"/>',
  crickets: '<path d="M8 18c2-6 4-6 4 0s2 6 4 0 2-6 4 0 2 6 4 0"/>',
};

export function padMark(id) {
  const body = PATHS[id] || '<path d="M8 20c2-8 14-8 16 0"/><path d="M8 14h16"/>';
  return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
