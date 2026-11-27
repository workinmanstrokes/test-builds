// tests/smoke.js — node smoke test for the tester-fix update.
// Run with: node tests/smoke.js
// No dependencies. Loads only the DOM-free modules (zones, bosses, aura,
// collection) in a vm sandbox with a localStorage stub. game.js and
// index.html need a browser and are NOT covered here.
'use strict';

var fs = require('fs');
var vm = require('vm');
var path = require('path');

var store = {};
var sandbox = {
  console: console,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

function load(rel) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), sandbox, { filename: rel });
}
load('src/zones.js');
load('src/bosses.js');
load('src/aura.js');
load('src/collection.js');

var Z = sandbox.BrainrotZones;
var B = sandbox.BrainrotBosses;
var A = sandbox.BrainrotAura;
var C = sandbox.BrainrotCollection;

var failures = 0;
function check(name, ok) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
  if (!ok) failures++;
}
function distinct(arr) {
  var seen = {};
  arr.forEach(function (v) { seen[v] = true; });
  return Object.keys(seen).length;
}

// --- zones: 7 distinct gate rules, enemy mixes and hazards ---
check('7 zones', Z.ZONES.length === 7);
check('7 distinct gate rules', distinct(Z.ZONES.map(function (z) { return z.gateRule; })) === 7);
check('7 distinct hazards', distinct(Z.ZONES.map(function (z) { return z.hazard; })) === 7);
check('every zone has a gate rule text and hazard text',
  Z.ZONES.every(function (z) { return z.gateRuleText && z.hazardText; }));
Z.ZONES.forEach(function (zone) {
  var opts = Z.gateOptions(zone, 0);
  check('gateOptions(' + zone.id + ') returns 2 gates', opts.length === 2);
  check('gateOptions(' + zone.id + ') gates differ (effect or value)',
    opts[0].effect !== opts[1].effect || opts[0].value !== opts[1].value);
  check('gateOptions(' + zone.id + ') labels fit the canvas',
    opts.every(function (o) { return o.label.length <= 14; }));
  var seen = {};
  for (var i = 0; i < 500; i++) seen[Z.pickEnemy(zone)] = true;
  check('pickEnemy(' + zone.id + ') can spawn every mix kind',
    Object.keys(seen).sort().join(',') === Object.keys(zone.enemyMix).sort().join(','));
});
var hfMud = Z.hazardFactors(Z.getZone(0), 1);
check('mud slows steering 40%', hfMud.steer === 0.6);
check('coffee spills speed enemies +50%', Z.hazardFactors(Z.getZone(2), 1).enemySpeed === 1.5);
check('sand gusts push sideways', Z.hazardFactors(Z.getZone(1), 1).drift !== 0);
check('dance floor flips steering in 2s windows',
  Z.hazardFactors(Z.getZone(3), 0).flip === true && Z.hazardFactors(Z.getZone(3), 3).flip === false);
check('undertow drags toward the edge', Z.hazardFactors(Z.getZone(4), 1).drift === -25);
check('ice sheets slide', Z.hazardFactors(Z.getZone(5), 1).slide === true);
check('silver mirrors flag set', Z.hazardFactors(Z.getZone(6), 1).mirror === true);

// --- bosses: 7 distinct mechanics, attacks and weaknesses ---
check('7 bosses', B.BOSSES.length === 7);
check('7 distinct mechanics', distinct(B.BOSSES.map(function (b) { return b.mechanic; })) === 7);
check('7 distinct attacks', distinct(B.BOSSES.map(function (b) { return b.attack; })) === 7);
check('7 distinct weaknesses', distinct(B.BOSSES.map(function (b) { return b.weakness; })) === 7);
check('every boss has mechanic text', B.BOSSES.every(function (b) { return b.mechanicText && b.mechanicText.length > 20; }));
var grump = B.createBossState(B.getBoss('grump-king'));
var ev1 = B.updateBossState(grump, 4);
check('grump shockwave every 4s', ev1.length === 1 && ev1[0].type === 'shockwave' && ev1[0].stunned === false);
B.updateBossState(grump, 4);
var ev3 = B.updateBossState(grump, 4);
check('grump stunned after every third slam', ev3[0].stunned === true);
var esp = B.createBossState(B.getBoss('espressorilla'));
var rushEv = B.updateBossState(esp, 6);
check('espressorilla rush toggles on', rushEv[0].type === 'rush-start' && esp.rush === true);
var rushEv2 = B.updateBossState(esp, 6);
check('espressorilla rush toggles off', rushEv2[0].type === 'rush-end' && esp.rush === false);

// --- aura: earn at gates, spend on one squad choice ---
var aura = new A.AuraSystem();
check('aura starts at 0', aura.balance === 0);
aura.earn(10, 'gate:add');
check('aura earn 10', aura.balance === 10);
var squad = [];
var applied = aura.spend('ADD_MEMBER', squad);
check('ADD_MEMBER costs 10 and adds a member', applied && applied.cost === 10 && squad.length === 1 && aura.balance === 0);
check('cannot afford ADD_MEMBER at 0 aura', aura.spend('ADD_MEMBER', squad) === null);
check('BANK is free', aura.spend('BANK', squad) !== null);
check('unknown choice returns null', aura.spend('FLY', squad) === null);

// --- collection: log, best runs, daily challenge ---
var log = new C.CollectionLog();
log.logBossDefeat('grump-king');
log.logBossDefeat('grump-king');
check('boss defeat counted once, twice beaten',
  log.bossesBeaten() === 1 && log.bosses['grump-king'].timesBeaten === 2);
check('progress 1/7', log.progress(7).beaten === 1 && log.progress(7).total === 7);
for (var r = 1; r <= 6; r++) log.logRun(r * 100, r);
check('best runs keep top 5, sorted desc',
  log.bestRuns.length === 5 && log.bestRuns[0].score === 600 && log.bestRuns[4].score === 200);
var dc = log.dailyChallenge(new Date('2026-11-27T12:00:00Z'));
check('daily challenge names a roster boss',
  B.BOSSES.some(function (b) { return b.id === dc.bossId; }));
check('daily challenge pays 20 aura', dc.rewardAura === 20);
check('daily challenge is stable within a day',
  log.dailyChallenge(new Date('2026-11-27T23:00:00Z')).bossId === dc.bossId);
check('daily challenge rotates the next day',
  log.dailyChallenge(new Date('2026-11-28T12:00:00Z')).bossId !== dc.bossId);
check('daily not done before a win', log.dailyDone(dc.date) === false);
log.logDailyWin(dc.date, dc.bossId);
check('daily done after a win', log.dailyDone(dc.date) === true);

console.log(failures === 0 ? '\nAll smoke checks passed.' : '\n' + failures + ' check(s) FAILED.');
process.exit(failures ? 1 : 0);
