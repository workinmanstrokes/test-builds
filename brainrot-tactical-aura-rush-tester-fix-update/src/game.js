// game.js — portrait canvas runner loop: steering, gates, swarm combat,
// hero evolution, boss arenas, and the playtest metrics recorder.
// Self-contained: depends only on BrainrotZones, BrainrotBosses,
// BrainrotAura and BrainrotCollection (loaded before this file).
(function (global) {
  'use strict';

  var W = 360, H = 640;           // logical portrait canvas size
  var SAVE_KEY = 'brainrot-aura-rush:save-v1';
  var METRICS_KEY = 'brainrot-aura-rush:metrics-v1';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'menu'; // menu | running | gate | boss | over
    this.hero = { x: W / 2, y: H - 120, hp: 100, maxHp: 100, level: 1, xp: 0 };
    this.squad = [{ kind: 'hero', level: 1, weapon: 1 }];
    this.enemies = [];
    this.gates = [];
    this.score = 0;
    this.distance = 0;
    this.zoneIndex = 0;
    this.bossState = null;
    this.aura = new global.BrainrotAura.AuraSystem();
    this.collection = new global.BrainrotCollection.CollectionLog();
    this.metrics = this.loadMetrics();
    this.runStart = 0;
    this.deaths = 0;
    this.frameDrops = 0;
    this.lastTs = 0;
    this.pointerX = W / 2;
    this.shield = 0;
    this.loadSave();
    this.bindInput();
  }

  // --- input: drag to steer (thumb), arrow keys on desktop ---
  Game.prototype.bindInput = function () {
    var self = this;
    var move = function (clientX) {
      var r = self.canvas.getBoundingClientRect();
      self.pointerX = clamp((clientX - r.left) * (W / r.width), 24, W - 24);
    };
    this.canvas.addEventListener('pointerdown', function (e) { move(e.clientX); self.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', function (e) { if (e.buttons) move(e.clientX); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') self.pointerX = clamp(self.pointerX - 24, 24, W - 24);
      if (e.key === 'ArrowRight') self.pointerX = clamp(self.pointerX + 24, 24, W - 24);
      if (e.key === ' ' && self.state === 'menu') self.startRun();
    });
  };

  // --- run lifecycle ---
  Game.prototype.startRun = function () {
    this.state = 'running';
    this.score = 0; this.distance = 0; this.zoneIndex = 0; this.deaths = 0;
    this.hero.hp = this.hero.maxHp;
    this.squad = [{ kind: 'hero', level: 1, weapon: 1 }];
    this.enemies = []; this.gates = [];
    this.runStart = Date.now();
    this.metrics.runs = (this.metrics.runs || 0) + 1;
    this.spawnGate();
    this.lastTs = performance.now();
    var self = this;
    requestAnimationFrame(function (ts) { self.loop(ts); });
    this.emit('run-start');
  };

  Game.prototype.endRun = function (reason) {
    this.state = 'over';
    var seconds = Math.round((Date.now() - this.runStart) / 1000);
    this.collection.logRun(this.score, this.zoneIndex + 1);
    this.metrics.sessions.push({
      date: new Date().toISOString(), seconds: seconds, score: this.score,
      zone: this.zoneIndex + 1, deaths: this.deaths, frameDrops: this.frameDrops, reason: reason
    });
    this.saveMetrics();
    this.saveGame();
    this.emit('run-over', { score: this.score, seconds: seconds, reason: reason });
  };

  // --- gates: pass one, earn aura, spend it on one squad choice ---
  Game.prototype.spawnGate = function () {
    var zone = global.BrainrotZones.getZone(this.zoneIndex);
    var left = { x: W * 0.25, value: 2 + this.zoneIndex, rule: zone.gateRule, label: '+' + (2 + this.zoneIndex) };
    var right = { x: W * 0.75, value: 3 + this.zoneIndex, rule: zone.gateRule, label: '+' + (3 + this.zoneIndex) };
    if (zone.gateRule === 'multiply') { left.label = 'x2'; right.label = 'x3'; }
    if (zone.gateRule === 'aura') { left.label = '+5 aura'; right.label = '+8 aura'; }
    this.gates = [{ gate: left, y: -40 }, { gate: right, y: -40 }];
  };

  Game.prototype.passGate = function (gate) {
    var zone = global.BrainrotZones.getZone(this.zoneIndex);
    var auraEarned = zone.gateRule === 'aura' ? gate.value * 2 : gate.value;
    this.aura.earn(auraEarned, 'gate:' + zone.gateRule);
    if (zone.gateRule === 'multiply') {
      var mult = gate.label === 'x3' ? 3 : 2;
      var grown = [];
      for (var i = 0; i < this.squad.length * (mult - 1) && grown.length < 12; i++) grown.push({ kind: 'recruit', level: 1, weapon: 1 });
      this.squad = this.squad.concat(grown);
    } else if (zone.gateRule !== 'aura') {
      for (var j = 0; j < gate.value && this.squad.length < 12; j++) this.squad.push({ kind: 'recruit', level: 1, weapon: 1 });
    }
    this.score += gate.value * 10;
    this.state = 'gate'; // overlay offers the one aura squad choice
    this.emit('gate', { zone: zone, aura: this.aura.balance, choices: this.aura.choices() });
  };

  Game.prototype.chooseAuraSpend = function (choice) {
    var applied = this.aura.spend(choice, this.squad);
    if (applied) this.collection.logRecruit('recruit');
    this.state = 'running';
    this.spawnGate();
    this.emit('aura-choice', applied);
    return applied;
  };

  // --- combat: swarm spawns, squad auto-fires, hero evolves ---
  Game.prototype.spawnEnemy = function () {
    var zone = global.BrainrotZones.getZone(this.zoneIndex);
    var kind = global.BrainrotZones.pickEnemy(zone);
    this.enemies.push({
      kind: kind, x: 30 + Math.random() * (W - 60), y: -30,
      hp: kind === 'tank' ? 30 : (kind === 'shooter' ? 12 : 8),
      speed: kind === 'chaser' ? 90 + this.zoneIndex * 8 : 55 + this.zoneIndex * 5
    });
  };

  Game.prototype.update = function (dt) {
    // steering: hero eases toward the pointer (thumb) position
    this.hero.x += (this.pointerX - this.hero.x) * Math.min(1, dt * 10);
    this.distance += dt * 60;
    if (Math.random() < dt * 1.6) this.spawnEnemy();
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      e.y += e.speed * dt;
      if (e.y > H + 40) { this.enemies.splice(i, 1); continue; }
      // squad auto-fire: nearest enemy in range takes damage
      var dmg = 0;
      for (var s = 0; s < this.squad.length; s++) dmg += this.squad[s].weapon * 6 * dt;
      if (Math.abs(e.x - this.hero.x) < 90 && e.y > this.hero.y - 260) e.hp -= dmg;
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.score += 5;
        this.hero.xp += 1;
        if (this.hero.xp >= 20 * this.hero.level) { this.hero.level++; this.hero.xp = 0; this.hero.maxHp += 20; this.hero.hp = this.hero.maxHp; }
        continue;
      }
      // collision with the hero costs HP (shield absorbs one hit)
      if (Math.abs(e.x - this.hero.x) < 26 && Math.abs(e.y - this.hero.y) < 26) {
        this.enemies.splice(i, 1);
        if (this.shield > 0) { this.shield--; }
        else { this.hero.hp -= 10; this.deaths++; }
        if (this.hero.hp <= 0) { this.endRun('hero-down'); return; }
      }
    }
    for (var g = this.gates.length - 1; g >= 0; g--) {
      this.gates[g].y += 70 * dt;
      if (this.gates[g].y > this.hero.y - 10 && this.gates[g].y < this.hero.y + 30) {
        if (Math.abs(this.gates[g].gate.x - this.hero.x) < 60) { this.passGate(this.gates[g].gate); this.gates = []; return; }
      }
      if (this.gates[g].y > H + 60) this.gates.splice(g, 1);
    }
    if (!this.gates.length && this.state === 'running') this.spawnGate();
    // zone complete every 1200 distance: boss arena
    if (this.distance > (this.zoneIndex + 1) * 1200) this.startBoss();
  };

  Game.prototype.startBoss = function () {
    var boss = global.BrainrotBosses.getBossForZone(this.zoneIndex);
    this.bossState = global.BrainrotBosses.createBossState(boss);
    this.state = 'boss';
    this.emit('boss-start', boss);
  };

  Game.prototype.updateBoss = function (dt) {
    var events = global.BrainrotBosses.updateBossState(this.bossState, dt);
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.type === 'shockwave') { if (this.shield > 0) this.shield--; else this.hero.hp -= 8; }
      if (ev.type === 'beat-4-strike' || ev.type === 'lane-sweep' || ev.type === 'whirlpool' || ev.type === 'blizzard-leap') this.hero.hp -= 5;
      if (ev.type === 'mirror-split') this.bossState.clones = 2;
      if (this.hero.hp <= 0) { this.endRun('boss:' + this.bossState.boss.id); return; }
    }
    // squad damage on the boss; boss weakness windows double it
    var dmg = 0;
    for (var s = 0; s < this.squad.length; s++) dmg += this.squad[s].weapon * 8 * dt;
    if (this.bossState.boss.id === 'espressorilla' && this.bossState.rush) dmg *= 2;
    this.bossState.hp -= dmg;
    if (this.bossState.hp <= 0) {
      var boss = this.bossState.boss;
      this.collection.logBossDefeat(boss.id);
      this.score += 500;
      this.zoneIndex++;
      this.bossState = null;
      this.state = 'running';
      this.saveGame();
      this.emit('boss-defeated', boss);
    }
  };

  Game.prototype.loop = function (ts) {
    if (this.state !== 'running' && this.state !== 'boss') { this.render(); return; }
    var dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (dt > 0.034) this.frameDrops++; // dropped below ~30fps this frame
    if (this.state === 'running') this.update(dt);
    else this.updateBoss(dt);
    this.render();
    if (this.state === 'running' || this.state === 'boss') {
      var self = this;
      requestAnimationFrame(function (t) { self.loop(t); });
    }
  };

  // --- render: portrait canvas, zone palette, squad, enemies, gates, boss ---
  Game.prototype.render = function () {
    var ctx = this.ctx;
    var zone = global.BrainrotZones.getZone(this.zoneIndex);
    ctx.fillStyle = zone.palette.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = zone.palette.lane;
    ctx.fillRect(W / 2 - 90, 0, 180, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(zone.name + '  •  Score ' + this.score + '  •  Aura ' + this.aura.balance, 12, 24);
    ctx.fillText('HP ' + Math.max(0, this.hero.hp) + '/' + this.hero.maxHp + '  •  Lv ' + this.hero.level + '  •  Squad ' + this.squad.length, 12, 46);
    for (var g = 0; g < this.gates.length; g++) {
      var gate = this.gates[g];
      ctx.fillStyle = zone.palette.accent;
      ctx.fillRect(gate.gate.x - 45, gate.y, 90, 26);
      ctx.fillStyle = '#000';
      ctx.fillText(gate.gate.label, gate.gate.x - 18, gate.y + 18);
    }
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      ctx.fillStyle = en.kind === 'tank' ? '#e53935' : (en.kind === 'shooter' ? '#fb8c00' : '#ab47bc');
      ctx.beginPath(); ctx.arc(en.x, en.y, en.kind === 'tank' ? 16 : 11, 0, Math.PI * 2); ctx.fill();
    }
    if (this.state === 'boss' && this.bossState) {
      var b = this.bossState.boss;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(b.name + ' — ' + b.mechanic, 12, 80);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(12, 90, (W - 24) * (this.bossState.hp / this.bossState.maxHp), 10);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(b.mechanicText, 12, 140, W - 24);
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(W / 2, 220, 42, 0, Math.PI * 2); ctx.fill();
    }
    // hero + squad trail
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.arc(this.hero.x, this.hero.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#81d4fa';
    for (var s = 1; s < this.squad.length; s++) {
      ctx.beginPath(); ctx.arc(this.hero.x + ((s % 2) ? -1 : 1) * 22, this.hero.y + 22 + Math.floor(s / 2) * 14, 8, 0, Math.PI * 2); ctx.fill();
    }
    if (this.state === 'menu') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('Brainrot:', 20, 240);
      ctx.fillText('Tactical Aura Rush', 20, 272);
      ctx.font = '15px sans-serif';
      ctx.fillText('Drag to steer. Pass gates, earn aura,', 20, 310);
      ctx.fillText('spend it on one squad choice per gate.', 20, 332);
      ctx.fillText('Tap Start Run to play.', 20, 354);
    }
  };

  // --- persistence ---
  Game.prototype.saveGame = function () {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        heroLevel: this.hero.level, score: this.score, zoneIndex: this.zoneIndex,
        bossesBeaten: this.collection.bossesBeaten()
      }));
    } catch (e) { /* storage unavailable */ }
  };
  Game.prototype.loadSave = function () {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      this.hero.level = d.heroLevel || 1;
    } catch (e) { /* corrupted save */ }
  };
  Game.prototype.loadMetrics = function () {
    try {
      var raw = localStorage.getItem(METRICS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted metrics */ }
    return { runs: 0, sessions: [] };
  };
  Game.prototype.saveMetrics = function () {
    try { localStorage.setItem(METRICS_KEY, JSON.stringify(this.metrics)); } catch (e) { /* storage unavailable */ }
  };
  // Export the recorded session metrics as JSON for docs/PLAYTEST.md.
  Game.prototype.exportMetrics = function () { return JSON.stringify(this.metrics, null, 2); };

  // --- tiny event bus for the HTML overlays ---
  Game.prototype.emit = function (name, detail) {
    document.dispatchEvent(new CustomEvent('brainrot:' + name, { detail: detail || {} }));
  };

  global.BrainrotGame = Game;
})(typeof window !== 'undefined' ? window : globalThis);
