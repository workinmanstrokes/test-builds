// Skin registry. A skin owns ALL presentation: text, palette, stage art, particles, sounds, haptics feel.
// Game logic never references a skin (it only receives optional skin.tuning numbers). To add a skin:
//   1. copy aura.js to <id>.js and change text/stages/sound/draw functions (see docs/SKINS.md)
//   2. import + add it to SKINS below. Nothing else changes.
import aura from './aura.js';
import keys from './keys.js';
import skip from './skip.js';

export const SKINS = { [aura.id]: aura, [keys.id]: keys, [skip.id]: skip };
export function getSkin(id) { return SKINS[id] || aura; }
export const skinList = () => Object.values(SKINS);
