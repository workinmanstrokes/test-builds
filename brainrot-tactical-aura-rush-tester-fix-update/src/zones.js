// zones.js — one gate rule, one enemy mix and one hazard per zone.
// A player can tell zones apart without reading the boss name:
// each zone changes what the gates demand, what spawns, and what hurts.
(function (global) {
  'use strict';

  // gateRule: 'add' | 'multiply' | 'aura' | 'sacrifice' | 'shield' | 'speed' | 'heal'
  //   add       — pick the gate with the larger squad number
  //   multiply  — pick the gate that multiplies your squad (x2 / x3)
  //   aura      — gates pay aura instead of squad members
  //   sacrifice — one gate costs a squad member to open the better lane
  //   shield    — gates grant a shield charge; the wrong gate strips it
  //   speed     — gates trade squad size for run speed
  //   heal      — gates heal the hero; the wrong gate is a trap lane
  var ZONES = [
    {
      id: 'zone-1', name: 'Grump Fields', bossId: 'grump-king',
      gateRule: 'add',
      gateRuleText: 'ADD gates: choose the gate with the larger squad number.',
      enemyMix: { chaser: 0.6, shooter: 0.2, tank: 0.2 },
      hazard: 'mud-patches',
      hazardText: 'Mud patches slow steering by 40% while you cross them.',
      palette: { bg: '#1d2b1a', lane: '#2c4427', accent: '#8bc34a' }
    },
    {
      id: 'zone-2', name: 'Sweeping Dunes', bossId: 'sweeping-old-man',
      gateRule: 'multiply',
      gateRuleText: 'MULTIPLY gates: x2 and x3 gates — take the multiplier, dodge the ÷2 trap.',
      enemyMix: { chaser: 0.4, shooter: 0.3, tank: 0.3 },
      hazard: 'sand-gusts',
      hazardText: 'Sand gusts push the whole squad sideways in pulses.',
      palette: { bg: '#2b2413', lane: '#453a1c', accent: '#ffca28' }
    },
    {
      id: 'zone-3', name: 'Espresso Alley', bossId: 'espressorilla',
      gateRule: 'aura',
      gateRuleText: 'AURA gates: gates pay aura instead of squad members — bank aura for the boss.',
      enemyMix: { chaser: 0.3, shooter: 0.5, tank: 0.2 },
      hazard: 'coffee-spills',
      hazardText: 'Coffee spills speed enemies up 50% while they stand in them.',
      palette: { bg: '#241612', lane: '#3d241a', accent: '#ff7043' }
    },
    {
      id: 'zone-4', name: 'Flamenco Plaza', bossId: 'flamenco-rotorina',
      gateRule: 'sacrifice',
      gateRuleText: 'SACRIFICE gates: one gate costs a squad member to open the richer lane.',
      enemyMix: { chaser: 0.5, shooter: 0.3, tank: 0.2 },
      hazard: 'dance-floor',
      hazardText: 'The dance floor flips your steering left/right for 2 seconds per tile.',
      palette: { bg: '#2b1220', lane: '#471a30', accent: '#ec407a' }
    },
    {
      id: 'zone-5', name: 'Squalo Reef', bossId: 'squalo-supremo',
      gateRule: 'shield',
      gateRuleText: 'SHIELD gates: the right gate grants a shield charge; the wrong one strips it.',
      enemyMix: { chaser: 0.3, shooter: 0.3, tank: 0.4 },
      hazard: 'undertow',
      hazardText: 'Undertow drags the squad toward the reef edge — steer against it.',
      palette: { bg: '#0e2430', lane: '#14394a', accent: '#29b6f6' }
    },
    {
      id: 'zone-6', name: 'Yeti Pass', bossId: 'yeti-scudiero',
      gateRule: 'speed',
      gateRuleText: 'SPEED gates: trade squad size for run speed — fast lanes are thin.',
      enemyMix: { chaser: 0.5, shooter: 0.2, tank: 0.3 },
      hazard: 'ice-sheets',
      hazardText: 'Ice sheets remove steering friction — you slide until you counter-steer.',
      palette: { bg: '#16242e', lane: '#22394a', accent: '#b3e5fc' }
    },
    {
      id: 'zone-7', name: 'Argento Court', bossId: 'asciero-argento',
      gateRule: 'heal',
      gateRuleText: 'HEAL gates: gates heal the hero; the wrong gate is a trap lane that hurts.',
      enemyMix: { chaser: 0.4, shooter: 0.4, tank: 0.2 },
      hazard: 'silver-mirrors',
      hazardText: 'Silver mirrors spawn a mirrored copy of your squad that blocks the lane.',
      palette: { bg: '#23232e', lane: '#34344a', accent: '#ce93d8' }
    }
  ];

  function getZone(index) { return ZONES[((index % ZONES.length) + ZONES.length) % ZONES.length]; }
  function getZoneByBoss(bossId) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].bossId === bossId) return ZONES[i];
    return ZONES[0];
  }
  // Weighted enemy pick for a zone: returns 'chaser' | 'shooter' | 'tank'.
  function pickEnemy(zone) {
    var r = Math.random(), acc = 0, mix = zone.enemyMix;
    for (var k in mix) { acc += mix[k]; if (r <= acc) return k; }
    return 'chaser';
  }

  // Gate options for a zone: two gates, each with a value, a label the
  // canvas draws, and an effect passGate() applies. Every gateRule in
  // ZONES has its own pair here — no rule is documented-but-unimplemented.
  // n is the base squad value and grows with the zone index.
  function gateOptions(zone, zoneIndex) {
    var n = 2 + zoneIndex;
    switch (zone.gateRule) {
      case 'multiply': return [
        { x: 0.25, value: n, label: 'x2', effect: 'multiply-2' },
        { x: 0.75, value: n, label: 'x3', effect: 'multiply-3' }
      ];
      case 'aura': return [
        { x: 0.25, value: 5, label: '+5 aura', effect: 'aura' },
        { x: 0.75, value: 8, label: '+8 aura', effect: 'aura' }
      ];
      case 'sacrifice': return [
        { x: 0.25, value: n, label: '+' + n, effect: 'add' },
        { x: 0.75, value: n + 3, label: '+' + (n + 3) + ' (-1)', effect: 'sacrifice' }
      ];
      case 'shield': return [
        { x: 0.25, value: n, label: '+' + n + ' +shield', effect: 'shield-grant' },
        { x: 0.75, value: n, label: '+' + n + ' -shield', effect: 'shield-strip' }
      ];
      case 'speed': return [
        { x: 0.25, value: n, label: '+' + n + ' slow', effect: 'speed-slow' },
        { x: 0.75, value: n, label: '+' + n + ' fast (-1)', effect: 'speed-fast' }
      ];
      case 'heal': return [
        { x: 0.25, value: n, label: '+' + n + ' heal', effect: 'heal' },
        { x: 0.75, value: n, label: '+' + n + ' TRAP', effect: 'trap' }
      ];
      default: return [ // 'add'
        { x: 0.25, value: n, label: '+' + n, effect: 'add' },
        { x: 0.75, value: n + 1, label: '+' + (n + 1), effect: 'add' }
      ];
    }
  }

  // Hazard factors for the runner loop, from the zone's hazard id.
  // t is seconds into the zone (distance / 60). Returns:
  // { steer (1 = normal, <1 = sluggish), drift (px/s sideways push),
  //   enemySpeed (multiplier), flip (steering mirrored), slide, mirror }
  function hazardFactors(zone, t) {
    var f = { steer: 1, drift: 0, enemySpeed: 1, flip: false, slide: false, mirror: false };
    switch (zone.hazard) {
      case 'mud-patches': f.steer = 0.6; break;                    // steering 40% slower
      case 'sand-gusts': f.drift = 40 * Math.sin(t / 1.5); break;  // gusts push sideways in pulses
      case 'coffee-spills': f.enemySpeed = 1.5; break;             // enemies +50% speed
      case 'dance-floor': f.flip = Math.floor(t / 2) % 2 === 0; break; // steering flips 2s on / 2s off
      case 'undertow': f.drift = -25; break;                       // drags toward the reef (left) edge
      case 'ice-sheets': f.slide = true; f.steer = 0.45; break;    // low friction: sluggish, overshoots
      case 'silver-mirrors': f.mirror = true; break;               // mirror blockers spawn (see game.js)
    }
    return f;
  }

  global.BrainrotZones = {
    ZONES: ZONES, getZone: getZone, getZoneByBoss: getZoneByBoss, pickEnemy: pickEnemy,
    gateOptions: gateOptions, hazardFactors: hazardFactors
  };
})(typeof window !== 'undefined' ? window : globalThis);
