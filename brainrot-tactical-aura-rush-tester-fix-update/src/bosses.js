// bosses.js — one DISTINCT written mechanic per boss.
// Each boss has exactly one signature: an attack pattern, an arena hazard
// or a weakness. No two bosses share a mechanic.
(function (global) {
  'use strict';

  var BOSSES = [
    {
      id: 'grump-king', name: 'Grump King', zoneId: 'zone-1', hp: 300, speed: 1.0,
      mechanic: 'Tantrum Shockwave',
      mechanicText: 'Every 4 seconds Grump King slams the ground and sends a shockwave ring across the arena. Jump (swipe up) or be behind a squad member to avoid it. Weakness: he is stunned for 2s after every third slam.',
      attack: 'shockwave-ring', hazard: 'shockwave', weakness: 'stunned-after-third-slam'
    },
    {
      id: 'sweeping-old-man', name: 'Sweeping Old Man', zoneId: 'zone-2', hp: 340, speed: 0.9,
      mechanic: 'Broom Sweep Lanes',
      mechanicText: 'The Old Man sweeps his broom across one lane at a time, telegraphed by dust. The swept lane is deadly for 1.5s — change lanes or lose squad members. Weakness: his broom gets stuck for 2s after sweeping the widest lane.',
      attack: 'lane-sweep', hazard: 'swept-lane', weakness: 'broom-stuck-after-wide-sweep'
    },
    {
      id: 'espressorilla', name: 'Espressorilla', zoneId: 'zone-3', hp: 380, speed: 1.3,
      mechanic: 'Caffeine Rush',
      mechanicText: 'Espressorilla drinks an espresso and goes into a 3-second caffeine rush: he moves and attacks twice as fast, but he cannot turn. Sidestep and let him charge past, then hit him from behind. Weakness: double damage from behind during the rush.',
      attack: 'caffeine-rush-charge', hazard: 'charge-lane', weakness: 'double-damage-from-behind-during-rush'
    },
    {
      id: 'flamenco-rotorina', name: 'Flamenco Rotorina', zoneId: 'zone-4', hp: 360, speed: 1.1,
      mechanic: 'Rhythm Castanets',
      mechanicText: 'Rotorina attacks on the beat: castanet clicks mark a 4-beat pattern and the strike lands on beat 4. Move on the off-beat and you are safe. Weakness: she misses entirely if the squad stands still on beat 4.',
      attack: 'beat-4-strike', hazard: 'beat-timer', weakness: 'misses-if-squad-still-on-beat-4'
    },
    {
      id: 'squalo-supremo', name: 'Squalo Supremo', zoneId: 'zone-5', hp: 420, speed: 1.2,
      mechanic: 'Whirlpool Pull',
      mechanicText: 'Squalo opens a whirlpool at the arena centre that drags the squad inward for 3 seconds, then snaps shut and bites anything still inside. Weakness: the whirlpool edge is safe ground — hug the rim.',
      attack: 'whirlpool-pull', hazard: 'whirlpool', weakness: 'rim-is-safe-ground'
    },
    {
      id: 'yeti-scudiero', name: 'Yeti Scudiero', zoneId: 'zone-6', hp: 460, speed: 0.8,
      mechanic: 'Blizzard Blind',
      mechanicText: 'The Yeti summons a blizzard that whites out the arena for 2 seconds — you can only see your own squad. Listen for the roar: it marks where he will land his leap. Weakness: his landing spot is frozen solid for 2s, a free hit window.',
      attack: 'blizzard-leap', hazard: 'whiteout', weakness: 'frozen-landing-spot'
    },
    {
      id: 'asciero-argento', name: 'Asciero Argento', zoneId: 'zone-7', hp: 520, speed: 1.4,
      mechanic: 'Silver Mirror Clone',
      mechanicText: 'Argento splits into three silver mirrors — only one is real. The real one casts a shadow; the fakes do not. Hit a fake and it shatters into shrapnel. Weakness: the real Argento always casts a shadow.',
      attack: 'mirror-split', hazard: 'shrapnel', weakness: 'real-one-casts-a-shadow'
    }
  ];

  function getBoss(id) {
    for (var i = 0; i < BOSSES.length; i++) if (BOSSES[i].id === id) return BOSSES[i];
    return BOSSES[0];
  }
  function getBossForZone(zoneIndex) { return BOSSES[((zoneIndex % BOSSES.length) + BOSSES.length) % BOSSES.length]; }

  // Boss runtime state: a tiny state machine the game loop drives.
  // update(bossState, dt, ctx) returns events the loop should act on.
  function createBossState(boss) {
    return { boss: boss, hp: boss.hp, maxHp: boss.hp, timer: 0, phase: 'idle', rush: false, clones: 0, slamCount: 0 };
  }
  function updateBossState(state, dt) {
    state.timer += dt;
    var events = [];
    if (state.boss.id === 'grump-king' && state.timer >= 4) {
      state.timer = 0; state.slamCount++;
      events.push({ type: 'shockwave', stunned: state.slamCount % 3 === 0 });
    }
    if (state.boss.id === 'espressorilla' && state.timer >= 6) {
      state.timer = 0; state.rush = !state.rush;
      events.push({ type: state.rush ? 'rush-start' : 'rush-end' });
    }
    if (state.boss.id === 'flamenco-rotorina' && state.timer >= 2) {
      state.timer = 0; events.push({ type: 'beat-4-strike' });
    }
    if (state.boss.id === 'squalo-supremo' && state.timer >= 5) {
      state.timer = 0; events.push({ type: 'whirlpool' });
    }
    if (state.boss.id === 'yeti-scudiero' && state.timer >= 7) {
      state.timer = 0; events.push({ type: 'blizzard-leap' });
    }
    if (state.boss.id === 'asciero-argento' && state.timer >= 5) {
      state.timer = 0; events.push({ type: 'mirror-split' });
    }
    if (state.boss.id === 'sweeping-old-man' && state.timer >= 3) {
      state.timer = 0; events.push({ type: 'lane-sweep', lane: Math.floor(Math.random() * 3) });
    }
    return events;
  }

  global.BrainrotBosses = {
    BOSSES: BOSSES, getBoss: getBoss, getBossForZone: getBossForZone,
    createBossState: createBossState, updateBossState: updateBossState
  };
})(typeof window !== 'undefined' ? window : globalThis);
