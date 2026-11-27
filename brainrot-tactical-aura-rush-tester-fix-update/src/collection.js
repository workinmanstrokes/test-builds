// collection.js — boss/character collection log, the retention hook.
// Persists in localStorage. Every boss beaten and every squad member
// recruited is logged; the main menu shows progress (n/7 bosses) and the
// best-run leaderboard (top 5 runs, local only — no server, no account).
// Also the daily challenge: one boss per day, beating it pays +20 aura.
(function (global) {
  'use strict';

  var STORAGE_KEY = 'brainrot-aura-rush:collection-v1';
  var MAX_BEST_RUNS = 5;
  var DAILY_BOSSES = ['grump-king', 'sweeping-old-man', 'espressorilla', 'flamenco-rotorina', 'squalo-supremo', 'yeti-scudiero', 'asciero-argento'];
  var DAILY_REWARD_AURA = 20;

  function CollectionLog() {
    this.bosses = {};      // bossId -> { beaten: true, firstBeatenAt, timesBeaten }
    this.characters = {};  // member kind -> { recruited: true, count }
    this.bestRuns = [];    // [{ score, zone, date }] sorted desc, max 5
    this.dailyWins = {};   // date 'YYYY-MM-DD' -> bossId beaten for the daily challenge
    this.load();
  }

  CollectionLog.prototype.logBossDefeat = function (bossId) {
    var e = this.bosses[bossId] || { beaten: false, timesBeaten: 0, firstBeatenAt: null };
    if (!e.beaten) e.firstBeatenAt = new Date().toISOString();
    e.beaten = true; e.timesBeaten += 1;
    this.bosses[bossId] = e;
    this.save();
    return e;
  };

  CollectionLog.prototype.logRecruit = function (kind) {
    var e = this.characters[kind] || { recruited: false, count: 0 };
    e.recruited = true; e.count += 1;
    this.characters[kind] = e;
    this.save();
    return e;
  };

  CollectionLog.prototype.logRun = function (score, zoneReached) {
    this.bestRuns.push({ score: score | 0, zone: zoneReached | 0, date: new Date().toISOString() });
    this.bestRuns.sort(function (a, b) { return b.score - a.score; });
    this.bestRuns = this.bestRuns.slice(0, MAX_BEST_RUNS);
    this.save();
    return this.bestRuns;
  };

  // Daily challenge: the boss rotates one per day (day count since epoch,
  // so every device agrees on today's boss without a server).
  // Returns { date: 'YYYY-MM-DD', bossId, rewardAura }.
  CollectionLog.prototype.dailyChallenge = function (date) {
    var d = date || new Date();
    var day = Math.floor(d.getTime() / 86400000);
    var bossId = DAILY_BOSSES[((day % DAILY_BOSSES.length) + DAILY_BOSSES.length) % DAILY_BOSSES.length];
    return { date: d.toISOString().slice(0, 10), bossId: bossId, rewardAura: DAILY_REWARD_AURA };
  };

  CollectionLog.prototype.logDailyWin = function (dateStr, bossId) {
    this.dailyWins = this.dailyWins || {};
    this.dailyWins[dateStr] = bossId;
    this.save();
    return true;
  };

  CollectionLog.prototype.dailyDone = function (dateStr) {
    return !!(this.dailyWins && this.dailyWins[dateStr]);
  };

  CollectionLog.prototype.bossesBeaten = function () {
    var n = 0;
    for (var k in this.bosses) if (this.bosses[k].beaten) n++;
    return n;
  };

  CollectionLog.prototype.progress = function (totalBosses) {
    return { beaten: this.bossesBeaten(), total: totalBosses, characters: Object.keys(this.characters).length };
  };

  CollectionLog.prototype.save = function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        bosses: this.bosses, characters: this.characters, bestRuns: this.bestRuns, dailyWins: this.dailyWins
      }));
    } catch (e) { /* storage unavailable — log lives in memory */ }
  };

  CollectionLog.prototype.load = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      this.bosses = d.bosses || {}; this.characters = d.characters || {}; this.bestRuns = d.bestRuns || []; this.dailyWins = d.dailyWins || {};
    } catch (e) { /* corrupted save — start empty */ }
  };

  global.BrainrotCollection = {
    CollectionLog: CollectionLog, STORAGE_KEY: STORAGE_KEY, MAX_BEST_RUNS: MAX_BEST_RUNS,
    DAILY_BOSSES: DAILY_BOSSES, DAILY_REWARD_AURA: DAILY_REWARD_AURA
  };
})(typeof window !== 'undefined' ? window : globalThis);
