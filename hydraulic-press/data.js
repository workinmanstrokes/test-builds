// data.js — game content. Safe to extend (the content-writer bot edits this file).
// Rules: keep the same fields on every entry. Numbers are fractions (0.30 = 30% flattened).

// kind: 'flatten' items can take flatten or scrap jobs; 'crack' items take crack jobs; 'crate' is mystery.
// reqPsi: press force needed to deform it at all.
// breakMin/breakMax: hidden rupture point range (fraction flattened).
// crackMin/crackMax + windowMin/windowMax: crack items open at crackPt, shatter at crackPt + window.
// tier: reputation stars needed before customers bring it in.
export const ITEMS = [
  { id: 'can',      name: 'Soda Can',            icon: '🥫', kind: 'flatten', reqPsi: 30,  breakMin: 0.82, breakMax: 0.92, scrap: 3,   pay: 35,   tier: 0, shape: 'can',      color: 0xc8102e, metal: 0.9,  rough: 0.25 },
  { id: 'toolbox',  name: 'Steel Toolbox',       icon: '🧰', kind: 'flatten', reqPsi: 70,  breakMin: 0.72, breakMax: 0.86, scrap: 7,   pay: 60,   tier: 0, shape: 'box',      color: 0xb91c1c, metal: 0.75, rough: 0.35 },
  { id: 'crate',    name: 'Mystery Crate',       icon: '📦', kind: 'crate',   reqPsi: 50,  breakMin: 0.55, breakMax: 0.70, scrap: 6,   pay: 0,    tier: 0, shape: 'crate',    color: 0x8b5a2b, metal: 0.05, rough: 0.85 },
  { id: 'bowling',  name: 'Bowling Ball',        icon: '🎳', kind: 'flatten', reqPsi: 110, breakMin: 0.52, breakMax: 0.66, scrap: 9,   pay: 95,   tier: 1, shape: 'ball',     color: 0x1e3a8a, metal: 0.2,  rough: 0.08 },
  { id: 'geode',    name: 'Amethyst Geode',      icon: '🪨', kind: 'crack',   reqPsi: 140, crackMin: 0.10, crackMax: 0.20, windowMin: 0.05, windowMax: 0.08, scrap: 4, pay: 240, tier: 1, shape: 'geode', color: 0x6b6158, metal: 0.05, rough: 0.9, inner: 0x9b5de5 },
  { id: 'goldbar',  name: 'Gold Bar',            icon: '🥇', kind: 'flatten', reqPsi: 90,  breakMin: 0.70, breakMax: 0.80, scrap: 5,   pay: 200,  tier: 2, shape: 'bar',      color: 0xf5c542, metal: 1.0,  rough: 0.18 },
  { id: 'safe',     name: 'Bank Safe',           icon: '🗄️', kind: 'flatten', reqPsi: 230, breakMin: 0.62, breakMax: 0.78, scrap: 24,  pay: 240,  tier: 2, shape: 'safe',     color: 0x3f4a5a, metal: 0.85, rough: 0.4 },
  { id: 'engine',   name: 'V8 Engine Block',     icon: '⚙️', kind: 'flatten', reqPsi: 400, breakMin: 0.55, breakMax: 0.68, scrap: 55,  pay: 420,  tier: 3, shape: 'engine',   color: 0x8a8f98, metal: 0.9,  rough: 0.3 },
  { id: 'meteor',   name: 'Iron Meteorite',      icon: '☄️', kind: 'crack',   reqPsi: 480, crackMin: 0.14, crackMax: 0.24, windowMin: 0.02, windowMax: 0.04, scrap: 30, pay: 850, tier: 4, shape: 'geode', color: 0x2b2522, metal: 0.6, rough: 0.7, inner: 0x7dd3fc },
  { id: 'core',     name: 'Reactor Core',        icon: '☢️', kind: 'flatten', reqPsi: 650, breakMin: 0.44, breakMax: 0.54, scrap: 110, pay: 1300, tier: 5, shape: 'core',     color: 0x10b981, metal: 0.9,  rough: 0.12 },
];

export const CUSTOMERS = [
  { name: 'Marty',   biz: 'Marty’s Muffler Barn' },
  { name: 'Dee',     biz: 'Riverbend Art Co-op' },
  { name: 'Hank',    biz: 'Hank’s Salvage' },
  { name: 'Priya',   biz: 'Lithic Labs' },
  { name: 'Gus',     biz: 'Gus & Sons Demolition' },
  { name: 'Loretta', biz: 'County Museum' },
  { name: 'Vince',   biz: 'Vince’s Pawn & Gold' },
  { name: 'Tamsin',  biz: 'Sculpture Works' },
  { name: 'Rocco',   biz: 'Rocco’s Pizza (don’t ask)' },
  { name: 'Dr. Ito', biz: 'Northgate Physics Dept.' },
  { name: 'Bev',     biz: 'Bev’s Rock Shop' },
  { name: 'Jojo',    biz: 'Viral Video Channel' },
];

// {item} {target} {tol} are filled in by the game.
export const LINES = {
  flatten: [
    'Need this {item} flattened to {target}. Going on a gallery wall.',
    'Press the {item} to {target} — it has to fit in a display frame.',
    'Can you get my {item} to exactly {target}? Within {tol}, please.',
    'Flatten the {item} to {target}. My buyer measures everything.',
    'I want a {item} at {target}. Not a hair more.',
    'Squash this {item} to {target} for a coffee table top.',
  ],
  scrap: [
    'Just crush the {item}. I want it gone.',
    'Turn this {item} into scrap. Insurance thing.',
    'Destroy the {item} on camera, my subscribers will love it.',
    'Crush the {item} all the way. Bonus if it pops.',
  ],
  crack: [
    'Crack this {item} open — gently. The inside is the whole point.',
    'I need the {item} opened clean. Shattered means worthless.',
    'Open the {item} without wrecking it. Easy does it.',
  ],
  crate: [
    'Found this crate at an auction. Crush it, split what’s inside?',
    'No idea what’s in this crate. You keep whatever you find.',
  ],
  success: ['Perfect, thanks!', 'That’s exactly it.', 'Beautiful work.', 'You’re the best press in town.'],
  fail:    ['Ugh. That’s ruined.', 'That’s not what I asked for.', 'I’m telling everyone about this.', 'Well, that’s scrap now.'],
};
