// aura.js — the tactical aura system, defined in one paragraph and
// implemented at the smallest useful size.
//
// AURA, IN ONE PARAGRAPH: Aura is the squad's shared tactical resource.
// You earn aura by passing through gates (each gate pays aura equal to its
// value, and aura gates pay double), and you spend it at the gate overlay on
// exactly one squad choice per gate — add a new squad member, upgrade a
// member's weapon, or bank it for the boss. Aura never buys power directly
// and never appears in ads; it is the only currency that turns a good gate
// read into a stronger squad, so the "tactical" choice is always which
// squad member benefits, not whether to pay.
(function (global) {
  'use strict';

  var STORAGE_KEY = 'brainrot-aura-rush:aura-v1';
  var COSTS = { ADD_MEMBER: 10, UPGRADE_WEAPON: 15, BANK: 0 };

  function AuraSystem() {
    this.balance = 0;
    this.earnedTotal = 0;
    this.spentTotal = 0;
    this.load();
  }

  AuraSystem.prototype.earn = function (amount, reason) {
    amount = Math.max(0, Math.floor(amount));
    this.balance += amount;
    this.earnedTotal += amount;
    this.save();
    return { balance: this.balance, earned: amount, reason: reason || 'gate' };
  };

  // Spend aura on ONE squad choice at a gate. Returns the applied choice
  // or null when the balance cannot afford it.
  AuraSystem.prototype.spend = function (choice, squad) {
    var cost = COSTS[choice];
    if (cost === undefined) return null;
    if (this.balance < cost) return null;
    this.balance -= cost;
    this.spentTotal += cost;
    var applied = { choice: choice, cost: cost };
    if (choice === 'ADD_MEMBER' && squad) {
      squad.push({ kind: 'recruit', level: 1, weapon: 1 });
      applied.detail = 'New squad member joined.';
    } else if (choice === 'UPGRADE_WEAPON' && squad && squad.length) {
      var weakest = squad[0];
      for (var i = 1; i < squad.length; i++) if (squad[i].weapon < weakest.weapon) weakest = squad[i];
      weakest.weapon += 1;
      applied.detail = 'Upgraded a squad member weapon to level ' + weakest.weapon + '.';
    } else if (choice === 'BANK') {
      applied.detail = 'Aura banked for the boss fight.';
    }
    this.save();
    return applied;
  };

  AuraSystem.prototype.canAfford = function (choice) {
    return COSTS[choice] !== undefined && this.balance >= COSTS[choice];
  };

  AuraSystem.prototype.choices = function () {
    var self = this;
    return Object.keys(COSTS).map(function (c) {
      return { choice: c, cost: COSTS[c], affordable: self.canAfford(c) };
    });
  };

  AuraSystem.prototype.save = function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        balance: this.balance, earnedTotal: this.earnedTotal, spentTotal: this.spentTotal
      }));
    } catch (e) { /* storage unavailable (private mode) — aura lives in memory */ }
  };

  AuraSystem.prototype.load = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      this.balance = d.balance | 0; this.earnedTotal = d.earnedTotal | 0; this.spentTotal = d.spentTotal | 0;
    } catch (e) { /* corrupted save — start at zero */ }
  };

  global.BrainrotAura = { AuraSystem: AuraSystem, COSTS: COSTS, STORAGE_KEY: STORAGE_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
