export const BED = { x: 100, y: 120, z: 100 };  // Tina2S build volume, mm
// The part may be turned 90° on the bed, so either footprint orientation counts.
export function fitScale(s) { return Math.min(1, BED.z / s.z, Math.max(Math.min(BED.x / s.x, BED.y / s.y), Math.min(BED.x / s.y, BED.y / s.x))); }
export function fits(s) { return s.z <= BED.z && ((s.x <= BED.x && s.y <= BED.y) || (s.y <= BED.x && s.x <= BED.y)); }
