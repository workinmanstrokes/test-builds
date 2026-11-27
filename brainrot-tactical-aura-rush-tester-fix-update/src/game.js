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
    this.lastPointerX = null; // relative-drag steering: last finger x
    this.runSpeed = 1;        // SPEED gates raise/lower this
    this.enemySpeedMult = 1;  // zone hazard (coffee spills) raises this
    this.shield = 0;
    this.loadSave();
    this.bindInput();
  }

  // --- input: relative drag to steer (thumb never covers the hero),
  // arrow keys on desktop ---
  Game.prototype.bindInput = function () {
    var self = this;
    var move = function (clientX) {
      var r = self.canvas.getBoundingClientRect();
      if (self.lastPointerX === null) { self.lastPointerX = clientX; return; }
      // Relative drag: the hero follows the finger's *movement*, not its
      // position, so steering works from anywhere on screen and the thumb
      // never has to sit on top of the hero to steer it.
      var dx = (clientX - self.lastPointerX) * (W / r.width);
      self.lastPointerX = clientX;
      self.pointerX = clamp(self.pointerX + dx, 24, W - 24);
    };
    this.canvas.addEventListener('pointerdown', function (e) { self.lastPointerX = e.clientX; self.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', function (e) { if (e.buttons) move(e.clientX); });
    this.canvas.addEventListener('pointerup', function () { self.lastPointerX = null; });
    this.canvas.addEventListener('pointercancel', function () { self.lastPointerX = null; });
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
    this.runSpeed = 1; this.enemySpeedMult = 1; this.shield = 0;
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
    var opts = global.BrainrotZones.gateOptions(zone, this.zoneIndex);
    this.gates = opts.map(function (o) {
      return { gate: { x: W * o.x, value: o.value, rule: zone.gateRule, label: o.label, effect: o.effect }, y: -40 };
    });
  };

  // Grow the squad by n members (cap 12), shared by every gate effect
  // that pays squad members.
  Game.prototype.growSquad = function (n) {
    for (var i = 0; i < n && this.squad.length < 12; i++) this.squad.push({ kind: 'recruit', level: 1, weapon: 1 });
  };

  Game.prototype.passGate = function (gate) {
    var zone = global.BrainrotZones.getZone(this.zoneIndex);
    var auraEarned = zone.gateRule === 'aura' ? gate.value * 2 : gate.value;
    this.aura.earn(auraEarned, 'gate:' + zone.gateRule);
    var effect = gate.effect || 'add';
    if (effect === 'multiply-2' || effect === 'multiply-3') {
      var mult = effect === 'multiply-3' ? 3 : 2;
      var grown = [];
      for (var i = 0; i < this.squad.length * (mult - 1) && grown.length < 12; i++) grown.push({ kind: 'recruit', level: 1, weapon: 1 });
      this.squad = this.squad.concat(grown);
    } else if (effect === 'sacrifice') {
      if (this.squad.length > 1) this.squad.pop(); // the gate's price
      this.growSquad(gate.value);
    } else if (effect === 'shield-grant') {
      this.shield = Math.min(2, this.shield + 1);
      this.growSquad(gate.value);
    } else if (effect === 'shield-strip') {
      this.shield = 0;
      this.growSquad(gate.value);
    } else if (effect === 'speed-fast') {
      this.runSpeed = Math.min(2, this.runSpeed + 0.25);
      if (this.squad.length > 1) this.squad.pop(); // fast lanes are thin
      this.growSquad(gate.value);
    } else if (effect === 'speed-slow') {
      this.runSpeed = Math.max(0.75, this.runSpeed - 0.1);
      this.growSquad(gate.value);
    } else if (effect === 'heal') {
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 20);
      this.growSquad(gate.value);
    } else if (effect === 'trap') {
      this.hero.hp -= 10;
      this.growSquad(gate.value);
      if (this.hero.hp <= 0) { this.score += gate.value * 10; this.endRun('gate-trap'); return; }
    } else if (effect === 'aura') {
      // Aura gates pay aura only — no squad members (see gateOptions).
    } else { // 'add'
      this.growSquad(gate.value);
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
    // Argento Court mirrors: a silver copy blocks the lane.
    if (zone.hazard === 'silver-mirrors' && Math.random() < 0.15) kind = 'mirror';
    this.enemies.push({
      kind: kind, x: 30 + Math.random() * (W - 60), y: -30,
      hp: kind === 'tank' ? 30 : (kind === 'mirror' ? 20 : (kind === 'shooter' ? 12 : 8)),
      speed: (kind === 'chaser' ? 90 + this.zoneIndex * 8 : 55 + this.zoneIndex * 5) * this.enemySpeedMult
    });
  };

  Game.prototype.update = function (dt) {
    var zone = global.BrainrotZones.getZone(this.zoneIndex);
    // The zone hazard changes how the run feels, every frame.
    var hf = global.BrainrotZones.hazardFactors(zone, this.distance / 60);
    this.enemySpeedMult = hf.enemySpeed;
    // steering: hero eases toward the pointer (thumb) position; mud and
    // ice slow the ease, the dance floor mirrors it, gusts/undertow drift it
    var targetX = hf.flip ? (W - this.pointerX) : this.pointerX;
    this.hero.x += (targetX - this.hero.x) * Math.min(1, dt * 10 * hf.steer);
    this.hero.x = clamp(this.hero.x + hf.drift * dt, 24, W - 24);
    this.distance += dt * 60 * this.runSpeed;
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
      this.gates[g].y += 70 * dt * this.runSpeed;
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
    // Repeat cycles get harder: +25% boss HP per full 7-zone cycle, so the
    // second loop is not the same fight with the same numbers.
    var cycle = Math.floor(this.zoneIndex / global.BrainrotBosses.BOSSES.length);
    if (cycle > 0) {
      this.bossState.hp = Math.round(boss.hp * (1 + 0.25 * cycle));
      this.bossState.maxHp = this.bossState.hp;
    }
    this.state = 'boss';
    this.emit('boss-start', boss);
  };

  Game.prototype.updateBoss = function (dt) {
    if (this.bossState.stunned > 0) this.bossState.stunned = Math.max(0, this.bossState.stunned - dt);
    var events = global.BrainrotBosses.updateBossState(this.bossState, dt);
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      // Grump King: stunned for 2s after every third slam — no boss damage
      // while stunned, and the squad deals double damage (see below).
      if (ev.type === 'shockwave' && ev.stunned) this.bossState.stunned = 2;
      if (this.bossState.stunned > 0) continue;
      if (ev.type === 'shockwave') { if (this.shield > 0) this.shield--; else this.hero.hp -= 8; }
      if (ev.type === 'beat-4-strike' || ev.type === 'lane-sweep' || ev.type === 'whirlpool' || ev.type === 'blizzard-leap') this.hero.hp -= 5;
      if (ev.type === 'mirror-split') this.bossState.clones = 2;
      if (this.hero.hp <= 0) { this.endRun('boss:' + this.bossState.boss.id); return; }
    }
    // squad damage on the boss; weakness windows double it
    var dmg = 0;
    for (var s = 0; s < this.squad.length; s++) dmg += this.squad[s].weapon * 8 * dt;
    if (this.bossState.boss.id === 'espressorilla' && this.bossState.rush) dmg *= 2;
    if (this.bossState.stunned > 0) dmg *= 2;
    this.bossState.hp -= dmg;
    if (this.bossState.hp <= 0) {
      var boss = this.bossState.boss;
      this.collection.logBossDefeat(boss.id);
      // Daily challenge: beating today's boss pays +20 aura.
      var dc = this.collection.dailyChallenge();
      if (dc.bossId === boss.id && !this.collection.dailyDone(dc.date)) {
        this.collection.logDailyWin(dc.date, boss.id);
        this.aura.earn(dc.rewardAura, 'daily-challenge');
      }
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
    ctx.fillText('HP ' + Math.max(0, this.hero.hp) + '/' + this.hero.maxHp + '  •  Lv ' + this.hero.level + '  •  Squad ' + this.squad.length + (this.shield > 0 ? '  •  Shield x' + this.shield : ''), 12, 46);
    ctx.font = '12px sans-serif';
    ctx.fillText('Hazard: ' + zone.hazardText, 12, 68);
    ctx.font = 'bold 11px sans-serif';
    for (var g = 0; g < this.gates.length; g++) {
      var gate = this.gates[g];
      ctx.fillStyle = zone.palette.accent;
      ctx.fillRect(gate.gate.x - 45, gate.y, 90, 26);
      ctx.fillStyle = '#000';
      ctx.fillText(gate.gate.label, gate.gate.x - 42, gate.y + 18);
    }
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      ctx.fillStyle = en.kind === 'tank' ? '#e53935' : (en.kind === 'shooter' ? '#fb8c00' : (en.kind === 'mirror' ? '#e0e0e0' : '#ab47bc'));
      ctx.beginPath(); ctx.arc(en.x, en.y, en.kind === 'tank' ? 16 : (en.kind === 'mirror' ? 13 : 11), 0, Math.PI * 2); ctx.fill();
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
      if (this.bossState.stunned > 0) {
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('STUNNED — double damage!', 12, 164);
      }
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

  // Manual save backup: progress is localStorage-only (no cloud save yet),
  // so a run can be exported as JSON and imported on another device.
  // Returns the backup JSON string.
  Game.prototype.exportSave = function () {
    var saveRaw = null;
    try { saveRaw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { saveRaw = null; }
    return JSON.stringify({
      save: saveRaw,
      aura: { balance: this.aura.balance, earnedTotal: this.aura.earnedTotal, spentTotal: this.aura.spentTotal },
      collection: { bosses: this.collection.bosses, characters: this.collection.characters, bestRuns: this.collection.bestRuns, dailyWins: this.collection.dailyWins || {} },
      metrics: this.metrics
    }, null, 2);
  };
  // Restore a backup produced by exportSave. Returns true on success,
  // false when the JSON cannot be read (nothing is changed then).
  Game.prototype.importSave = function (json) {
    try {
      var d = JSON.parse(json);
      if (!d || typeof d !== 'object') return false;
      if (d.aura) { this.aura.balance = d.aura.balance | 0; this.aura.earnedTotal = d.aura.earnedTotal | 0; this.aura.spentTotal = d.aura.spentTotal | 0; this.aura.save(); }
      if (d.collection) {
        this.collection.bosses = d.collection.bosses || {};
        this.collection.characters = d.collection.characters || {};
        this.collection.bestRuns = d.collection.bestRuns || [];
        this.collection.dailyWins = d.collection.dailyWins || {};
        this.collection.save();
      }
      if (d.save && d.save.heroLevel) this.hero.level = d.save.heroLevel;
      if (d.metrics) { this.metrics = d.metrics; this.saveMetrics(); }
      this.saveGame();
      return true;
    } catch (e) { return false; }
  };

  // --- tiny event bus for the HTML overlays ---
  Game.prototype.emit = function (name, detail) {
    document.dispatchEvent(new CustomEvent('brainrot:' + name, { detail: detail || {} }));
  };

  global.BrainrotGame = Game;
})(typeof window !== 'undefined' ? window : globalThis);
