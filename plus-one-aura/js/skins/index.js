// Skin registry. A skin owns ALL presentation: text, palette, stage art, particles, sounds, haptics feel.
// Game logic never references a skin. To add a skin (week 2: 'keys' keyboard ASMR, 'skip' +1 Aura Skip):
//   1. copy aura.js to <id>.js and change text/stages/sound/draw functions (see docs/SKINS.md)
//   2. import + add it to SKINS below. Nothing else changes.
import aura from './aura.js';

export const SKINS = { [aura.id]: aura };
export function getSkin(id) { return SKINS[id] || aura; }
export const skinList = () => Object.values(SKINS);
