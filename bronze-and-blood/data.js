'use strict';

/* Content tables: difficulty, technologies, wave flavour and enemy names. */

const DIFFICULTY = {
  easy:   { label: 'Steward',  hint: 'Fewer, weaker raiders',     hp: 0.8, dmg: 0.8, count: 0.8, bounty: 1.2, score: 0.75 },
  normal: { label: 'Basileus', hint: 'The intended challenge',    hp: 1,   dmg: 1,   count: 1,   bounty: 1,   score: 1 },
  hard:   { label: 'Collapse', hint: 'More raiders, harder hits', hp: 1.15, dmg: 1.15, count: 1.25, bounty: 0.9, score: 1.5 }
};

const TECHS = [
  { id: 'plows',    name: 'Ox-Drawn Plows',    desc: 'Fields yield 60% more grain.',                     cost: 3,  apply: (m) => { m.grain *= 1.6; } },
  { id: 'mines',    name: 'Deep Shaft Mining', desc: 'Copper and tin yield 65% more.',                   cost: 4,  apply: (m) => { m.metal *= 1.65; } },
  { id: 'levy',     name: 'Levy of the Land',  desc: 'Population cap +6.',                               cost: 5,  apply: (m) => { m.popCap += 6; } },
  { id: 'decree',   name: 'Royal Decree',      desc: 'Influence flows in 50% faster.',                   cost: 6,  apply: (m) => { m.infRate *= 1.5; } },
  { id: 'bows',     name: 'Composite Bows',    desc: 'Archers gain +1.5 range and 25% damage.',          cost: 7,  apply: (m) => { m.archRange += 1.5; m.archDmg *= 1.25; } },
  { id: 'chariots', name: 'Chariot Mastery',   desc: 'Chariots move 20% faster and charge sooner.',      cost: 8,  apply: (m) => { m.chariotSpd *= 1.2; m.chargeDist = 2.2; } },
  { id: 'smelting', name: 'Advanced Smelting', desc: 'Bronze costs 10 less Copper and 10 less Tin.',     cost: 9,  apply: (m) => { m.bronzeOff += 10; } },
  { id: 'walls',    name: 'Cyclopean Walls',   desc: 'Palace +180 strength. Gate towers loose arrows.',  cost: 10, apply: (m) => { m.cityMax += 180; m.towers = true; } }
];

const WAVE_INFO = [
  { title: 'The First Shore Landing', warn: 'Small scouts test your walls.' },
  { title: 'Coastal Skirmish',        warn: 'Marauders wade in behind the raiders.' },
  { title: 'Shoreline Scavengers',    warn: 'Fast reavers hunt your workers.' },
  { title: 'The Rising Tide',         warn: 'A battering ram comes for the gate.' },
  { title: 'The First Champion',      warn: "A champion leads the raiding party's charge." },
  { title: 'Blood on the Sands',      warn: 'Slingers outrange your archers.' },
  { title: 'The Dual Tyrants',        warn: 'Twin champions lead the slaughter.' },
  { title: 'The Final Collapse',      warn: 'The Sea King comes to end your dynasty.' }
];

// The vizier's counsel: one line is shown with each wave banner, and one when the palace is failing.
const ADVISOR = {
  wave: [
    ['A few spears at the gate will answer scouts.', 'Keep the workers in the fields while it is quiet.', 'They only test us. Do not empty the granary over it.'],
    ['Shield bearers before the archers, my king.', 'The marauders hit hard. Let the shields take it.', 'Hold the line together. Do not chase the raiders.'],
    ['Reavers run for the fields. Guard the workers.', 'They want our hands, not our walls. Shield the workers.', 'Keep soldiers near the fields and mines this time.'],
    ['Break the ram before it reaches the gate.', 'Send the chariots at the ram, my king.', 'Every blow on that gate weakens the palace. Stop the ram.'],
    ['Strike the champion together, and in bronze.', 'One champion is worth ten raiders. Bring him down first.', 'Bronze for the front rank before he lands.'],
    ['Their slings outreach our bows. Loose the chariots.', 'Run the slingers down before they find their range.', 'Do not trade arrows with them. Close the distance.'],
    ['Two champions. Hold at the gate and give no ground.', 'Bronze for every soldier who can carry it.', 'Do not split the army between them.'],
    ['The Sea King falls, and his host breaks with him.', 'Commit everything, my king. There is nothing left to save it for.', 'Every spear to the shore. This is the last tide.']
  ],
  palace: [
    'The walls are failing. Order the masons to repair.',
    'Pull the army back to the gate, my king.',
    'The palace cannot take much more of this.',
    'Repair the walls now, or there is nothing left to hold.'
  ]
};

const ENEMY_LABELS = {
  raider: 'Sea raider',
  marauder: 'Marauder',
  seaArcher: 'Sea archer',
  slinger: 'Slinger',
  reaver: 'Sherden reaver',
  champion: 'Champion',
  ram: 'Battering ram',
  warlord: 'The Sea King'
};
