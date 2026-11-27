// Themed packs of ORIGINAL brainrot-style characters (all names/art invented for this game; no existing memes).
// Row: [name, tagline, hint (vague word for the imposter-hint option), shape, color A, color B, accessory, limbs,
//        clues (three distinct one-word hooks for the clue round; first hook IS the hint word)]
// shapes: blob round box tall tri long drop star bean  ·  limbs: legs arms wheels tentacles wings none
const C = (pack, rows) => rows.map(([name, tag, hint, shape, a, b, acc, limbs, clues], i) => ({ id: `${pack}-${i}`, pack, name, tag, hint, shape, a, b, acc, limbs, clues, voice: 180 + ((i * 53 + pack.length * 31) % 260) }));

export const PACKS = [
  { id: 'starter', name: 'Starter Rot', emoji: '🌀', free: true, color: '#8b5cf6', chars: C('starter', [
    ['Spaghettino Rocketto', 'A noodle with a jetpack and zero brakes.', 'speed', 'long', '#ffd166', '#ef8a17', 'propeller', 'legs', ['speed', 'jetpack', 'noodle']],
    ['Pinguino Turbolino', 'Penguin. Turbo. Absolutely no chill.', 'cold', 'bean', '#2b2d42', '#edf2f4', 'shades', 'wheels', ['cold', 'turbo', 'penguin']],
    ['Mangoletto Bonkers', 'Bonks things with a tiny hammer. Smells tropical.', 'fruit', 'drop', '#ffb703', '#fb8500', 'bandana', 'arms', ['fruit', 'hammer', 'tropical']],
    ['Sockarino Dramatico', 'A lone sock who never got over the dryer.', 'laundry', 'tall', '#f72585', '#ffffff', 'mustache', 'legs', ['laundry', 'dryer', 'sock']],
    ['Cactusso Disco', 'Spiky on the outside, groovy on the inside.', 'desert', 'tall', '#2a9d8f', '#8ac926', 'shades', 'arms', ['desert', 'spiky', 'groovy']],
    ['Gnocchi Muscolini', 'Does potato push-ups every morning.', 'gym', 'blob', '#f4d58d', '#e0a458', 'bandana', 'arms', ['gym', 'potato', 'pushups']],
    ['Toastini Ninjarelli', 'Pops out of nowhere. Silent but crunchy.', 'breakfast', 'box', '#d4a373', '#7f4f24', 'bandana', 'legs', ['breakfast', 'crunchy', 'ninja']],
    ['Lampadino Sleepy', 'A lightbulb that refuses to turn on before noon.', 'idea', 'drop', '#fff3b0', '#ffd60a', 'halo', 'none', ['idea', 'lightbulb', 'noon']],
    ['Wobbelino Jellofanto', 'Jelly elephant. Wobbles when nervous. Always nervous.', 'wobble', 'blob', '#90e0ef', '#00b4d8', 'bow', 'legs', ['wobble', 'jelly', 'elephant']],
    ['Pizzalotto Pirata', 'Sails the seven sauces looking for extra cheese.', 'sea', 'tri', '#ffbe0b', '#e63946', 'pirate', 'legs', ['sea', 'cheese', 'pirate']],
    ['Snaileone Sprintini', 'Fastest snail alive. Still late.', 'slow', 'round', '#c77dff', '#7b2cbf', 'headphones', 'wheels', ['slow', 'snail', 'late']],
    ['Bubblino Shrimpolo', 'Lives in a bubble. Literally.', 'ocean', 'bean', '#ff8fa3', '#ff4d6d', 'antenna', 'tentacles', ['ocean', 'bubble', 'shrimp']],
    ['Cloudetto Grumpo', 'Rains on parades. On purpose.', 'weather', 'blob', '#e5e5e5', '#adb5bd', 'none', 'none', ['weather', 'rain', 'parade']],
    ['Hamsterino Helicoptero', 'Spins so fast it lifts off the wheel.', 'pet', 'round', '#e9c46a', '#f4a261', 'propeller', 'arms', ['pet', 'wheel', 'spinning']],
    ['Picklino Operetto', 'Sings one note. Holds it for nine minutes.', 'music', 'long', '#80b918', '#2b9348', 'crown', 'arms', ['music', 'singing', 'pickle']],
    ['Moonbo Mozzarello', 'A moon made of cheese, and proud of it.', 'space', 'round', '#fefae0', '#e9edc9', 'antenna', 'none', ['space', 'moon', 'mozzarella']],
  ]) },
  { id: 'school', name: 'School', emoji: '🎒', color: '#3a86ff', chars: C('school', [
    ['Erasero Furioso', 'Rubs out your mistakes. Angrily.', 'mistake', 'box', '#ff99c8', '#ff5d8f', 'horns', 'legs', ['mistake', 'eraser', 'angry']],
    ['Pencilio Pointy', 'Always sharp. Always pointing at you.', 'write', 'tall', '#ffd60a', '#fb8500', 'crown', 'legs', ['write', 'pencil', 'sharp']],
    ['Backpacko Gremlino', 'Eats your snacks and your permission slips.', 'carry', 'box', '#4361ee', '#3a0ca3', 'antenna', 'arms', ['carry', 'backpack', 'snacks']],
    ['Calculatto Crunchini', 'Does maths by chewing numbers.', 'numbers', 'box', '#6c757d', '#343a40', 'glasses', 'arms', ['numbers', 'maths', 'chewing']],
    ['Lockerino Slamm', 'Slams shut the second you remember your combo.', 'metal', 'tall', '#4895ef', '#3f37c9', 'none', 'legs', ['metal', 'locker', 'combo']],
    ['Gluestico Gloppo', 'Sticks to everyone. Socially and physically.', 'sticky', 'tall', '#e0aaff', '#9d4edd', 'bow', 'none', ['sticky', 'glue', 'clinging']],
    ['Rulerino Longo', 'Measures everything. Judges everything.', 'measure', 'long', '#ffe66d', '#ff9f1c', 'glasses', 'legs', ['measure', 'ruler', 'judging']],
    ['Chalkbo Dusterino', 'Leaves a cloud wherever it goes.', 'board', 'box', '#f8f9fa', '#ced4da', 'mustache', 'arms', ['board', 'chalk', 'dust']],
    ['Homeworko Hungrini', 'The dog did not eat it. This guy did.', 'excuse', 'box', '#fdfcdc', '#fed9b7', 'horns', 'arms', ['excuse', 'homework', 'dog']],
    ['Bellino Ringaringa', 'Rings exactly one minute too early.', 'loud', 'drop', '#ffcb69', '#d08c60', 'none', 'none', ['loud', 'bell', 'early']],
    ['Lunchtrayo Splatto', 'Mystery meat, mystery attitude.', 'cafeteria', 'box', '#a8dadc', '#457b9d', 'chef', 'legs', ['cafeteria', 'tray', 'meat']],
    ['Globino Spinnerino', 'Gets dizzy showing you where countries are.', 'map', 'round', '#48cae4', '#52b788', 'propeller', 'none', ['map', 'globe', 'dizzy']],
    ['Microscopo Squintini', 'Sees germs. Screams about germs.', 'science', 'tall', '#adb5bd', '#495057', 'glasses', 'legs', ['science', 'germs', 'microscope']],
    ['Hallpasso Sneakini', 'Technically allowed to be here.', 'sneak', 'box', '#fff1e6', '#ffb5a7', 'shades', 'legs', ['sneak', 'hallpass', 'allowed']],
    ['Stapleto Chompini', 'Chomp chomp. Your papers are together now.', 'office', 'long', '#e63946', '#a4161a', 'none', 'legs', ['office', 'stapler', 'papers']],
    ['Detentio Grrrumbolo', 'Stays after class. Forever.', 'trouble', 'blob', '#6d6875', '#3d348b', 'horns', 'arms', ['trouble', 'detention', 'afterschool']],
  ]) },
  { id: 'gaming', name: 'Gaming', emoji: '🎮', color: '#06d6a0', chars: C('gaming', [
    ['Joysticko Wigglino', 'Cannot sit still. Will not sit still.', 'stick', 'tall', '#ef476f', '#2b2d42', 'none', 'none', ['stick', 'joystick', 'wiggly']],
    ['Lagolino Freezio', 'Moves... ... ... later.', 'slow', 'blob', '#caf0f8', '#90e0ef', 'halo', 'legs', ['slow', 'lag', 'frozen']],
    ['Pixelotto Blocco', 'Eight bits of pure attitude.', 'retro', 'box', '#06d6a0', '#118ab2', 'crown', 'legs', ['retro', 'pixel', 'arcade']],
    ['Controllerino Sweaty', 'Hands always clammy. Grip always tight.', 'hands', 'bean', '#495057', '#212529', 'headphones', 'arms', ['hands', 'controller', 'clammy']],
    ['Headsetto Screamini', 'Unmuted. Always unmuted.', 'loud', 'round', '#7209b7', '#f72585', 'headphones', 'none', ['loud', 'headset', 'unmuted']],
    ['Respawnio Ghostino', 'Died 400 times. Still smiling.', 'again', 'drop', '#e0fbfc', '#98c1d9', 'halo', 'none', ['again', 'respawn', 'ghost']],
    ['Lootboxo Mystero', 'Could be anything. It is socks.', 'surprise', 'box', '#ffd166', '#c9184a', 'bow', 'legs', ['surprise', 'lootbox', 'socks']],
    ['Speedrunno Zoomini', 'Skips every cutscene, including this one.', 'fast', 'long', '#ff006e', '#fb5607', 'bandana', 'wheels', ['fast', 'speedrun', 'cutscene']],
    ['Noobolino Confuso', 'Which button is jump? All of them?', 'new', 'round', '#b8f2e6', '#5e6472', 'propeller', 'legs', ['new', 'noob', 'jump']],
    ['Buttonmasho Rapido', 'Presses everything. Wins somehow.', 'press', 'box', '#ff595e', '#ffca3a', 'shades', 'arms', ['press', 'button', 'mashing']],
    ['Chargerino Lowbatto', 'Two percent and panicking.', 'battery', 'long', '#8ac926', '#1982c4', 'antenna', 'none', ['battery', 'charger', 'panic']],
    ['Bossfighto Grandoso', 'Has three health bars and a cape.', 'final', 'star', '#9d0208', '#370617', 'crown', 'arms', ['final', 'boss', 'cape']],
    ['Cheatcodo Sneakeroni', 'Up up down down... wait, what was next?', 'secret', 'tri', '#3c096c', '#ff9e00', 'shades', 'legs', ['secret', 'cheatcode', 'hidden']],
    ['Glitchio Twitchini', 'Clips through walls on purpose.', 'bug', 'star', '#00f5d4', '#9b5de5', 'antenna', 'legs', ['bug', 'glitch', 'walls']],
    ['Ragequitto Flippini', 'Flips the table. Then apologizes to the table.', 'angry', 'blob', '#d00000', '#ffba08', 'horns', 'arms', ['angry', 'ragequit', 'table']],
    ['Clutchino Miracolo', 'One HP. One chance. Pure drama.', 'win', 'star', '#ffd60a', '#003566', 'cape', 'arms', ['win', 'clutch', 'drama']],
  ]) },
  { id: 'food', name: 'Food', emoji: '🍔', color: '#fb8500', chars: C('food', [
    ['Burrito Bouncerino', 'Wrapped tight. Nobody gets past.', 'wrap', 'long', '#e9c46a', '#bc6c25', 'shades', 'arms', ['wrap', 'burrito', 'bouncer']],
    ['Donutto Orbitto', 'Circles the kitchen like a tiny planet.', 'sweet', 'round', '#ffafcc', '#cdb4db', 'antenna', 'none', ['sweet', 'donut', 'planet']],
    ['Nachoclops', 'One eye. Extra cheese. Zero depth perception.', 'crunchy', 'tri', '#ffc300', '#ff5733', 'none', 'legs', ['crunchy', 'nacho', 'cyclops']],
    ['Broccolino Bodybuildo', 'Eats himself for protein. Somehow fine.', 'veggie', 'blob', '#55a630', '#2b9348', 'bandana', 'arms', ['veggie', 'broccoli', 'protein']],
    ['Sushi Sumorino', 'Small roll. Big stance.', 'rice', 'round', '#ffffff', '#ff6b6b', 'bandana', 'legs', ['rice', 'sushi', 'sumo']],
    ['Waffelino Grid', 'Thinks in squares. Lives in squares.', 'syrup', 'box', '#ddb892', '#b08968', 'glasses', 'legs', ['syrup', 'waffle', 'squares']],
    ['Ramenio Slurpini', 'Very loud eater. Very loud everything.', 'noodle', 'bean', '#ffe8d6', '#cb997e', 'chef', 'tentacles', ['noodle', 'ramen', 'slurp']],
    ['Popcornio Poppoppo', 'Pops when startled. Startled constantly.', 'movie', 'blob', '#fffcf2', '#ffd166', 'none', 'arms', ['movie', 'popcorn', 'startled']],
    ['Croissanto Crabbini', 'Flaky shell, flaky friend.', 'flaky', 'bean', '#f4a261', '#e76f51', 'none', 'tentacles', ['flaky', 'croissant', 'crab']],
    ['Avocadino Yogini', 'Breathes in. Breathes out. Becomes guac.', 'calm', 'drop', '#99d98c', '#52b69a', 'halo', 'arms', ['calm', 'avocado', 'guac']],
    ['Meatballo Bowlingo', 'Strikes every time. Messy every time.', 'roll', 'round', '#9c6644', '#7f5539', 'mustache', 'none', ['roll', 'meatball', 'bowling']],
    ['Pretzelino Twistrix', 'Tied himself in a knot. Again.', 'salty', 'star', '#b5651d', '#7f4f24', 'bow', 'legs', ['salty', 'pretzel', 'knot']],
    ['Formaggio Vulcanello', 'Erupts melted cheese when excited.', 'hot', 'tri', '#ffd60a', '#ff7b00', 'crown', 'none', ['hot', 'cheese', 'volcano']],
    ['Jellybeano Jitter', 'Too much sugar. Always vibrating.', 'candy', 'bean', '#ff4d6d', '#c9184a', 'antenna', 'legs', ['candy', 'jellybean', 'sugar']],
    ['Hotsaucio Flamenco', 'Dances until things catch fire.', 'spicy', 'tall', '#d00000', '#6a040f', 'flower', 'legs', ['spicy', 'hotsauce', 'dancing']],
    ['Pancakko Stackatoni', 'Tower of fluff with a butter hat.', 'stack', 'box', '#f6bd60', '#f28482', 'chef', 'arms', ['stack', 'pancake', 'butter']],
  ]) },
  { id: 'halloween', name: 'Halloween', emoji: '🎃', color: '#ff7b00', chars: C('halloween', [
    ['Pumpkinello Grinno', 'Smiles too wide. Way too wide.', 'orange', 'round', '#ff7b00', '#d65a00', 'witch', 'none', ['orange', 'pumpkin', 'grin']],
    ['Fantasmino Hiccupo', 'A ghost who hiccups through walls.', 'boo', 'drop', '#f8f9fa', '#dee2e6', 'none', 'none', ['boo', 'ghost', 'hiccup']],
    ['Pipistrello Sottosopra', 'Upside-down bat. Upside-down opinions.', 'night', 'bean', '#3c096c', '#10002b', 'none', 'wings', ['night', 'bat', 'upsidedown']],
    ['Mummino Unravello', 'One loose thread away from disaster.', 'wrap', 'tall', '#e9ecef', '#adb5bd', 'none', 'arms', ['wrap', 'mummy', 'thread']],
    ['Skeletono Xylofono', 'Plays tunes on his own ribs.', 'bones', 'tall', '#ffffff', '#ced4da', 'headphones', 'arms', ['bones', 'skeleton', 'xylophone']],
    ['Witchetta Broomzoom', 'Speeding ticket collector of the skies.', 'magic', 'tri', '#7b2cbf', '#240046', 'witch', 'legs', ['magic', 'witch', 'broom']],
    ['Candycornio Spooki', 'Nobody likes him. He knows.', 'candy', 'tri', '#ffba08', '#ffffff', 'bow', 'none', ['candy', 'candycorn', 'unliked']],
    ['Zombino Slowpoko', 'Wants brains. Settles for snacks.', 'undead', 'blob', '#80b918', '#55a630', 'bandana', 'arms', ['undead', 'zombie', 'brains']],
    ['Vampirino Sunscreeno', 'SPF 9000 and still nervous.', 'fangs', 'tall', '#6a040f', '#e5e5e5', 'cape', 'arms', ['fangs', 'vampire', 'sunscreen']],
    ['Cauldronio Bubblebrew', 'Burps purple smoke. Proudly.', 'potion', 'round', '#212529', '#7209b7', 'none', 'legs', ['potion', 'cauldron', 'smoke']],
    ['Ragnetto Tapdanzo', 'Eight legs. Eight tap shoes.', 'web', 'round', '#343a40', '#9d0208', 'crown', 'tentacles', ['web', 'spider', 'tapdance']],
    ['Lupetto Fluffini', 'Turns into a wolf. A very fluffy one.', 'moon', 'blob', '#8d99ae', '#edf2f4', 'horns', 'legs', ['moon', 'werewolf', 'fluffy']],
    ['Tombino Napini', 'A gravestone who just wants a nap.', 'rest', 'tall', '#6c757d', '#495057', 'flower', 'none', ['rest', 'tombstone', 'nap']],
    ['Boltonio Stitchetti', 'Patched together. Charged up.', 'lab', 'box', '#76c893', '#34a0a4', 'antenna', 'arms', ['lab', 'frankenstein', 'stitched']],
    ['Gufetto Mezzanotte', 'Hoots at exactly midnight. Never 12:01.', 'clock', 'bean', '#7f5539', '#ddb892', 'glasses', 'wings', ['clock', 'owl', 'midnight']],
    ['Gattonero Sfortunello', 'Black cat with the worst luck of all.', 'luck', 'round', '#1b1b1e', '#3a3a40', 'bow', 'legs', ['luck', 'blackcat', 'unlucky']],
  ]) },
];
export const packById = id => PACKS.find(p => p.id === id);
export const allChars = () => PACKS.flatMap(p => p.chars);
export const charById = id => allChars().find(c => c.id === id);

/**
 * Playtest fix #4: every character has three distinct clue hooks, and no two
 * characters in the same pack may be guessable from the same one-word clue —
 * a shared clue lets the table guess the secret from a single word.
 * Returns [{ pack, clue, chars: [id, id] }] — must be empty (asserted in tests).
 */
export function clueCollisions() {
  const bad = [];
  for (const p of PACKS) {
    const seen = new Map();
    for (const c of p.chars) for (const clue of c.clues || []) {
      if (seen.has(clue)) bad.push({ pack: p.id, clue, chars: [seen.get(clue), c.id] });
      else seen.set(clue, c.id);
    }
  }
  return bad;
}
