/* Aether Surge — game data (tuning tables). All names are original to Aether Surge. */
(function(AS){
"use strict";

AS.RUN_LEN=300;          // seconds until the final boss arrives (M2: 5:00 run)
AS.CAP=300;              // live cap for regular (director-spawned) enemies
AS.MAX_E=360;            // enemy pool size: cap + headroom for swarm surges, splits and bosses
AS.MAX_PROJ=220;         // player projectiles
AS.MAX_EPROJ=220;        // enemy projectiles
AS.MAX_SHARDS=400;       // XP shards (merge into nearest when full)
AS.MAX_PARTS=360;
AS.MAX_FTXT=50;
AS.FTXT_PER_FRAME=5;     // cap on new damage numbers per frame

AS.STAGE={n:"Training Rift",bg:"#0b1020"};
// Original stage list + their bosses, kept as data for the stages milestone (unused in M1)
AS.RIFTS=[
  {n:"Training Rift",   bg:"#0b1020",m:1.0,boss:"Rift Sentinel"},
  {n:"Shadow Forest",   bg:"#08140e",m:1.3,boss:"Grove Warden"},
  {n:"Crystal Wastes",  bg:"#120a1c",m:1.7,boss:"Crystal Tyrant"},
  {n:"Void Spire",      bg:"#18080c",m:2.2,boss:"Void Herald"},
  {n:"Frozen Abyss",    bg:"#0a1c30",m:2.6,boss:"Frost Sovereign"},
  {n:"Celestial Throne",bg:"#160a28",m:3.2,boss:"Aether Throne-Bearer"}
];
AS.LATER_BOSSES={
  herald:   {n:"Void Herald",          hp:1800,spd:72,r:32,c:"#ff2040",d:34},
  frost:    {n:"Frost Sovereign",      hp:2400,spd:78,r:34,c:"#40d0ff",d:40},
  throne:   {n:"Aether Throne-Bearer", hp:3200,spd:85,r:38,c:"#ffd040",d:48}
};

// Regular enemy archetypes (shape = sprite style)
AS.ETYPES={
  // sc = sprite scale (silhouette size); shape = sprite style (render.js)
  scout:   {n:"Drifter", hp:14, spd:100,r:10,c:"#5aa8ff",d:6, xp:2, shape:0, sc:1},
  swarmer: {n:"Swarmer", hp:6,  spd:165,r:6, c:"#ff4fd8",d:4, xp:1, shape:5, sc:0.62},                 // tiny, fast
  raider:  {n:"Chaser",  hp:24, spd:122,r:11,c:"#ff3838",d:9, xp:3, shape:1, sc:1.05, lunge:true},     // aggressive lunges
  caster:  {n:"Shooter", hp:18, spd:66, r:11,c:"#b06aff",d:5, xp:4, shape:2, sc:1, rng:true},          // keeps distance, fires
  brute:   {n:"Brute",   hp:110,spd:40, r:20,c:"#7aaa40",d:16,xp:10,shape:3, sc:1.55},                 // slow, big HP
  splitter:{n:"Splitter",hp:26, spd:80, r:12,c:"#30d0a8",d:8, xp:4, shape:7, sc:1.1, splits:2},        // splits on death
  shielder:{n:"Shielder",hp:60, spd:58, r:14,c:"#40e0ff",d:8, xp:7, shape:8, sc:1.2, shields:true},    // shields nearby allies
  bulwark: {n:"Bulwark", hp:100,spd:40, r:19,c:"#5a8a5a",d:18,xp:12,shape:6, sc:1.3, armor:0.35},
  warlord: {n:"Warlord", hp:140,spd:72, r:18,c:"#ffd040",d:16,xp:20,shape:4, sc:1}
};
// Elite modifiers: glowing outline in the modifier colour + a label
AS.ELITE_MODS=[
  {id:"swift",   n:"Swift",    c:"#7affff"},
  {id:"armored", n:"Armored",  c:"#c0c8d8"},
  {id:"vampiric",n:"Vampiric", c:"#ff4060"},
  {id:"volatile",n:"Volatile", c:"#ff9a30"},
  {id:"frenzied",n:"Frenzied", c:"#ff50ff"},
  {id:"warded",  n:"Warded",   c:"#60b0ff"}
];

// Spawn schedule by elapsed run time (s). rate = spawns/sec, hp = HP multiplier, spd = speed multiplier and
// dmg = contact/shot damage multiplier are interpolated between rows; mix (weights) switches at each row.
// M5: denser + steeper scaling (M4 was too easy for a skilled player)
AS.SCHEDULE=[
  {t:0,   rate:2.1, hp:1.00, spd:1.00, dmg:1.00, mix:{swarmer:6,scout:5}},
  {t:25,  rate:2.9, hp:1.05, spd:1.01, dmg:1.04, mix:{swarmer:6,scout:4,raider:3}},
  {t:50,  rate:3.9, hp:1.15, spd:1.03, dmg:1.08, mix:{swarmer:5,scout:3,raider:4,caster:3}},
  {t:85,  rate:5.0, hp:1.32, spd:1.05, dmg:1.15, mix:{swarmer:5,scout:2,raider:5,caster:3,splitter:2,brute:1}},
  {t:120, rate:6.4, hp:1.55, spd:1.09, dmg:1.28, mix:{swarmer:6,raider:5,caster:4,splitter:3,brute:2,shielder:1}},
  {t:160, rate:8.6, hp:2.02, spd:1.12, dmg:1.40, mix:{swarmer:6,raider:5,caster:4,splitter:3,brute:3,shielder:1.5,bulwark:0.8}},
  {t:210, rate:11.4,hp:2.60, spd:1.16, dmg:1.64, mix:{swarmer:6,raider:6,caster:4,splitter:3,brute:3,shielder:2,bulwark:1.5,warlord:0.6}},
  {t:250, rate:15,  hp:3.45, spd:1.22, dmg:1.90, mix:{swarmer:7,raider:6,caster:5,splitter:3,brute:4,shielder:2.5,bulwark:2,warlord:1}},
  {t:300, rate:8,   hp:3.80, spd:1.24, dmg:2.00, mix:{swarmer:6,raider:5,caster:4,brute:3,shielder:2,warlord:0.6}}
];

// Timeline events (elapsed seconds). Timer shows time LEFT, e.g. t:45 = 4:15 left.
AS.EVENTS=[
  {t:18,  kind:"cache"},                       // floor Sigil Cache near the player
  {t:35,  kind:"swarm", pattern:"ring"},
  {t:55,  kind:"elite"},
  {t:75,  kind:"swarm", pattern:"spiral"},
  {t:92,  kind:"elite"},
  {t:110, kind:"boss",  boss:"warden"},
  {t:128, kind:"elite"},
  {t:130, kind:"swarm", pattern:"ring"},
  {t:148, kind:"elite"},
  {t:165, kind:"swarm", pattern:"spiral"},
  {t:185, kind:"boss",  boss:"tyrant"},
  {t:198, kind:"elite"},
  {t:215, kind:"elite"},
  {t:220, kind:"swarm", pattern:"ring"},
  {t:234, kind:"elite"},
  {t:240, kind:"swarm", pattern:"spiral"},
  {t:256, kind:"elite", count:2},
  {t:268, kind:"swarm", pattern:"ring"},
  {t:276, kind:"elite"},
  {t:285, kind:"swarm", pattern:"spiral"},
  {t:300, kind:"boss",  boss:"sentinel"}
];
AS.ELITE={hpX:4.8,xpX:4,dmgX:1.4,scale:1.45};

// Bosses: moves are telegraphed attack patterns (see bossAI in game.js)
AS.BOSSES={
  // phases: hp fraction where the phase starts, its telegraphed move rotation, cooldown and elite summons on entry
  // M5: tougher, faster rotations, new moves (rain = scattered slams, cross = lanes through you, volley = double lance)
  warden:  {n:"Grove Warden",   hp:950,  spd:72,r:28,c:"#40c060",d:18,xp:70,
    phases:[{at:1,moves:["dash","slam","burst"],cd:1.8},{at:0.5,moves:["slam3","dash","rain","burst","slam"],cd:1.35}]},
  tyrant:  {n:"Crystal Tyrant", hp:2500, spd:70,r:30,c:"#c060ff",d:27,xp:110,
    phases:[{at:1,moves:["burst","lances","dash","cross"],cd:1.5},{at:0.5,moves:["volley","spiral","dash","cross","burst"],cd:1.15,summon:1}]},
  sentinel:{n:"Rift Sentinel",  hp:11000,spd:84,r:36,c:"#ff5050",d:34,xp:0,final:true,
    phases:[{at:1,moves:["dash","burst","slam","cross","burst"],cd:1.25},
            {at:0.66,moves:["volley","spiral","dash","rain","slam3"],cd:1.05,summon:1},
            {at:0.33,moves:["spiral","cross","slam3","volley","dash","rain","burst"],cd:0.9,summon:3}]}
};

// XP needed for next level (tuned so a good 5:00 run ends around Lv 25-30)
AS.xpNeed=function(lv){return Math.floor(5+lv*4+lv*lv*1.05);};

// Ranked upgrades. f(P, newRank) applies one rank.
var ROMAN=["","I","II","III","IV","V"];
AS.ROMAN=ROMAN;
AS.UPGRADES=[
  {id:"amp",tg:["Power"],   n:"Aether Amplify", i:"⚡",max:5,pl:1.10,d:function(){return "+20% damage";},f:function(P){P.dmgM*=1.2;}},
  {id:"rapid",tg:["Blast"], n:"Rapid Surge",    i:"🔥",max:5,pl:1.07,d:function(){return "-12% fire interval";},f:function(P){P.blast.rate*=0.88;}},
  {id:"split",tg:["Blast"], n:"Split Blast",    i:"✦",max:5,pl:1.12,d:function(){return "+1 projectile";},f:function(P){P.blast.cnt+=1;}},
  {id:"swift",tg:["Speed"], n:"Swift Step",     i:"💨",max:5,pl:1.04,d:function(){return "+10% move speed";},f:function(P){P.spdM*=1.10;}},
  {id:"core",tg:["Guard"],  n:"Core Harden",    i:"♥",max:5,pl:1.06,d:function(){return "+20 max HP, heal 20";},f:function(P){P.baseMaxHp+=20;P.maxHp+=20;P.hp=Math.min(P.maxHp,P.hp+20);}},
  {id:"orbit",tg:["Orbs"], n:"Orbiting Orbs",  i:"◎",max:5,pl:1.12,weapon:true,
    d:function(r){return r===0?"Unlock 2 orbs that circle you":"+1 orb, +25% orb damage";},
    f:function(P,r){if(r===1){P.orbit.on=true;}else{P.orbit.cnt+=1;P.orbit.dmg*=1.25;}}},
  {id:"wave",tg:["Pulse"],  n:"Shock Wave",     i:"💥",max:5,pl:1.11,weapon:true,
    d:function(r){return r===0?"Unlock a ring pulse every 1.8s":"+30% pulse damage, -10% interval";},
    f:function(P,r){if(r===1){P.wave.on=true;}else{P.wave.dmg*=1.3;P.wave.rate*=0.9;}}},
  {id:"reach",tg:["Blast"], n:"Extended Reach", i:"↗",max:5,pl:1.04,d:function(){return "+15% range & shot speed";},f:function(P){P.blast.rng*=1.15;P.blast.spd*=1.15;}},
  {id:"magnet",tg:["Utility"],n:"Magnet Pull",    i:"🧲",max:5,pl:1.02,d:function(){return "+35% shard pickup radius";},f:function(P){P.pick*=1.35;}},
  {id:"pierce",tg:["Blast"],n:"Piercing Rounds",i:"➹",max:5,pl:1.09,d:function(){return "Shots pierce +1 enemy";},f:function(P){P.blast.pierce+=1;}},
  {id:"vamp",tg:["Leech"],  n:"Vampiric Core",  i:"🩸",max:5,pl:1.08,d:function(){return "+2% lifesteal";},f:function(P){P.lifesteal+=0.02;}},
  {id:"crit",tg:["Crit"],  n:"Critical Focus", i:"✧",max:5,pl:1.09,d:function(){return "+10% crit chance (2x dmg)";},f:function(P){P.critChance=Math.min(0.75,P.critChance+0.10);}},
  {id:"wind",tg:["Guard"],  n:"Second Wind",    i:"🕊",max:1,pl:1.10,d:function(){return "Survive one killing blow";},f:function(P){P.extraLife=true;}}
];
AS.ASCENSION={id:"asc",n:"AETHER ASCENSION",i:"🌟",d:function(){return "Transform — 20s gold form";}};
AS.FILLERS=[
  {id:"mend", n:"Aether Mend", i:"✚",d:function(){return "Restore 28% HP";}},
  {id:"spark",n:"Power Spark", i:"★",d:function(){return "+8% Power Level";}}
];
AS.ASC_MIN_LV=5;      // Ascension can be offered from this level
AS.ASC_GAP=5;         // min levels between Ascension offers
AS.ASC_CHANCE=0.2;    // chance per eligible level-up
AS.FREE_REROLLS=1;

/* ---------------- M2: Sigils (extra abilities) ----------------
   Elites drop Sigil Caches: pick 1 of 3. 4 slots, ranks I-V. Owned sigils can also rank up via level-ups.
   Behaviour lives in js/sigils.js; d(r) describes the NEXT rank (r = current rank, 0 = new). */
AS.SIG_SLOTS=4;
AS.SIGILS=[
  {id:"arc",tg:["Lightning"],    n:"Arc Lattice",   i:"ϟ", c:"#8fd8ff", d:function(r){return r===0?"Chain lightning jumps between 4 foes":"+1 chain, +25% damage";}},
  {id:"motes",tg:["Seeker"],  n:"Seeker Motes",  i:"✺", c:"#9affd0", d:function(r){return r===0?"Fires homing motes at nearby foes":"+25% damage"+(r%2===0?", +1 mote":"");}},
  {id:"nova",tg:["Pulse"],   n:"Rift Nova",     i:"◉", c:"#b08aff", d:function(r){return r===0?"Erupts a shockwave around you":"+25% damage, bigger, faster";}},
  {id:"lance",tg:["Beam"],  n:"Prism Lance",   i:"⟁", c:"#ffe080", d:function(r){return r===0?"Fires a piercing beam":"+25% damage, wider beam";}},
  {id:"frost",tg:["Frost"],  n:"Frost Field",   i:"❄", c:"#7fd4ff", d:function(r){return r===0?"Slowing frost aura that chills foes":"+25% damage, wider, colder";}},
  {id:"gyre",tg:["Blade"],   n:"Gyre Blade",    i:"✢", c:"#ffb0a0", d:function(r){return r===0?"Hurls a blade that returns to you":"+25% damage"+(r===2||r===4?", +1 blade":"");}},
  {id:"sentry",tg:["Turret"], n:"Aether Sentry", i:"♜", c:"#a0c8ff", d:function(r){return r===0?"Deploys a turret that shoots foes":"+25% damage, lasts longer"+(r%2===0?", +1 turret":"");}},
  {id:"halo",tg:["Burn"],   n:"Ember Halo",    i:"☀", c:"#ffa040", d:function(r){return r===0?"A burning ring scorches foes near you":"+25% damage, wider ring";}},
  {id:"star",tg:["Astral"],   n:"Starfall",      i:"☄", c:"#ffd0ff", d:function(r){return r===0?"Calls falling stars onto foes":"+25% damage"+(r%2===1?", +1 star":"");}}
];

/* ---------------- M2: Relics (equipment, lost after the run) ---------------- */
AS.RELIC_SLOTS=["crown","mantle","gauntlets","treads","pendant","band","band"];
AS.SLOT_NAMES={crown:"Crown",mantle:"Mantle",gauntlets:"Gauntlets",treads:"Treads",pendant:"Pendant",band:"Band"};
AS.RARITY=[{n:"Common",c:"#a8b8d0",m:1},{n:"Rare",c:"#5aa8ff",m:1.6},{n:"Epic",c:"#d07aff",m:2.4}];
// stat keys: dmg, rate(-interval), spd, pick, xp, crit, critD, hp, armor, regen, abil, cd(-cooldown), area, leech
// fx = behaviour hook (see game.js): storm, echo, ember, thorns
AS.RELICS=[
  {id:"circlet", n:"Circlet of Insight", slot:"crown",    i:"♛", st:{xp:0.12}},
  {id:"diadem",  n:"Seer's Diadem",      slot:"crown",    i:"♔", st:{area:0.12}},
  {id:"storm",   n:"Stormcrown",         slot:"crown",    i:"⚡", fx:"storm", v:30, t:"Every 6th shot calls lightning ({v} dmg)"},
  {id:"warden",  n:"Warden's Mantle",    slot:"mantle",   i:"⛨", st:{hp:20,armor:0.06}},
  {id:"echo",    n:"Veil of Echoes",     slot:"mantle",   i:"◌", fx:"echo",  v:28, t:"When hit, release a nova ({v} dmg)"},
  {id:"forge",   n:"Forgehand Gauntlets",slot:"gauntlets",i:"✊", st:{dmg:0.12}},
  {id:"grips",   n:"Quickdraw Grips",    slot:"gauntlets",i:"☝", st:{rate:0.08}},
  {id:"wind",    n:"Windstep Treads",    slot:"treads",   i:"➶", st:{spd:0.10}},
  {id:"ember",   n:"Emberwake Treads",   slot:"treads",   i:"♨", fx:"ember", v:10, t:"Leave burning embers ({v} dmg/tick)"},
  {id:"lode",    n:"Lodestone Pendant",  slot:"pendant",  i:"⚲", st:{pick:0.5}},
  {id:"heart",   n:"Heartseed Pendant",  slot:"pendant",  i:"❦", st:{regen:0.8}},
  {id:"sigheart",n:"Sigilheart Pendant", slot:"pendant",  i:"✦", st:{abil:0.12}},
  {id:"prec",    n:"Band of Precision",  slot:"band",     i:"◎", st:{crit:0.06}},
  {id:"ruin",    n:"Band of Ruin",       slot:"band",     i:"✸", st:{critD:0.35}},
  {id:"haste",   n:"Band of Haste",      slot:"band",     i:"↻", st:{cd:0.07}},
  {id:"thorns",  n:"Band of Thorns",     slot:"band",     i:"✶", fx:"thorns",v:25, t:"Foes that touch you take {v} dmg"},
  {id:"leech",   n:"Band of the Leech",  slot:"band",     i:"♁", st:{leech:0.015}}
];
AS.STAT_TXT={dmg:"+{p}% damage",rate:"-{p}% fire interval",spd:"+{p}% move speed",pick:"+{p}% pickup radius",xp:"+{p}% XP gain",
  crit:"+{p}% crit chance",critD:"+{p}% crit damage",hp:"+{n} max HP",armor:"-{p}% damage taken",regen:"+{n} HP/s",
  abil:"+{p}% sigil damage",cd:"-{p}% sigil cooldowns",area:"+{p}% sigil area",leech:"+{p}% lifesteal"};
// rarity weights by chest tier: 0 = elite/coffer, 1 = mini-boss
AS.RELIC_ODDS=[[65,28,7],[20,55,25]];
AS.ELITE_CHEST_CHANCE=0.5;     // elites: Sigil Cache always, Relic Chest 50%
AS.COFFER_CHANCE=0.0012;       // regular kills: small chance of a relic coffer (max 2/run)

/* ---------------- M3: build tags, synergy evolutions, active combat ---------------- */
AS.TAG_INFO={Blast:{i:"✦",n:"Blaster"},Orbs:{i:"◎",n:"Orb"},Pulse:{i:"💥",n:"Pulse"},Crit:{i:"✧",n:"Crit"},Lightning:{i:"ϟ",n:"Lightning"},
  Seeker:{i:"✺",n:"Seeker"},Frost:{i:"❄",n:"Frost"},Burn:{i:"🔥",n:"Burn"},Beam:{i:"⟁",n:"Beam"},Blade:{i:"✢",n:"Blade"},Turret:{i:"♜",n:"Turret"},
  Astral:{i:"☄",n:"Astral"},Leech:{i:"🩸",n:"Leech"},Guard:{i:"⛨",n:"Guardian"},Speed:{i:"💨",n:"Swift"},Power:{i:"⚡",n:"Power"},Utility:{i:"🧲",n:"Utility"}};
AS.RELIC_TAGS={storm:"Lightning",ember:"Burn",thorns:"Guard",echo:"Pulse",prec:"Crit",ruin:"Crit",forge:"Power",leech:"Leech"};
// Evolutions: both parts at rank II+ -> a guaranteed evolution card on the next level-up
AS.EVOS=[
  {id:"starstorm",n:"Starstorm",      i:"✴",a:"orbit",b:"crit", tg:"Orbs",     d:"Orbs always crit, +2 orbs, wider orbit"},
  {id:"tempest",  n:"Tempest Lattice",i:"⚡",a:"arc",  b:"rapid",tg:"Lightning",d:"Every blast has a 30% chance to arc lightning"},
  {id:"inferno",  n:"Inferno Halo",   i:"🔥",a:"halo", b:"wave", tg:"Burn",     d:"Shock Waves ignite foes; halo +60% dmg, +30% size"},
  {id:"glacial",  n:"Glacial Nova",   i:"❄",a:"nova", b:"frost",tg:"Frost",    d:"Novas freeze foes (-70% speed) and grow 25%"},
  {id:"phantom",  n:"Phantom Volley", i:"✺",a:"motes",b:"split",tg:"Seeker",   d:"Your blasts home in on foes"},
  {id:"sunlance", n:"Sunlance",       i:"☀",a:"lance",b:"pierce",tg:"Beam",    d:"The lance fires 3 beams, 50% wider"},
  {id:"bloodgyre",n:"Bloodgyre",      i:"🩸",a:"gyre", b:"vamp", tg:"Blade",    d:"+1 blade; blade hits heal you"},
  {id:"meteor",   n:"Meteor Rain",    i:"☄",a:"star", b:"amp",  tg:"Astral",   d:"+2 falling stars, 30% bigger, they ignite"}
];
AS.EVO_RANK=2;
AS.COMBAT={
  dash:{cd:2.2,dur:0.17,spd:980,dmg:12},
  melee:{cd:0.75,rng:74,dmg:20,kb:420},          // auto energy slash at close range (or tap the attack button)
  charge:{max:1.1,min:0.25,dmg:30,dmgMax:150,r:90,rMax:185,kb:620} // hold the attack button
};
AS.LV_TIERS=[1,5,10,15];   // visible player evolution (aura + trails)

/* ---------------- M4: evolving arena, world objects, pickups, Legendary Cores, missions ---------------- */
// Arena shifts over the 5:00 run (elapsed seconds); each phase spawns its hazard near the player every ~"every" s
AS.ARENA=[
  {t:0,  id:"calm",    n:"",                          tint:null},
  {t:70, id:"ember",   n:"🔥 Ember Vents erupt",      tint:"rgba(255,90,30,.06)",  every:4.6},
  {t:150,id:"frost",   n:"❄ A Frost Storm rolls in",  tint:"rgba(120,200,255,.07)",every:3.7},
  {t:225,id:"void",    n:"🌀 Void Rifts tear open",    tint:"rgba(170,80,255,.08)", every:4.3},
  {t:300,id:"collapse",n:"☄ The Rift is collapsing",  tint:"rgba(255,40,60,.07)",  every:3.0}
];
AS.WORLD={chunk:520};
// pickup roles (from destructibles, elites, missions); w = drop weight from destructibles
AS.PICKUPS={
  heart: {n:"Heartshard",   i:"♥", c:"#ff5070",w:7},
  magnet:{n:"Lodestar",     i:"🧲",c:"#60c0ff",w:12},
  bomb:  {n:"Aether Bomb",  i:"✹", c:"#ffb040",w:7},
  haste: {n:"Quickening",   i:"»", c:"#7affc0",w:10},
  motes: {n:"Mote Cluster", i:"✦", c:"#9affe0",w:30},
  core:  {n:"Legendary Core",i:"◆",c:"#ffd040",w:0.35}
};
AS.CORES=[
  {id:"surge",  n:"Heart of the Surge",i:"♦",d:"+40% damage and -17% fire interval"},
  {id:"nova",   n:"Nova Core",         i:"✺",d:"Every 3.5s a massive nova erupts around you"},
  {id:"chrono", n:"Chrono Core",       i:"⧗",d:"Dash cooldown -60%; dashes end in a blast"},
  {id:"prism",  n:"Prism Core",        i:"◈",d:"+2 projectiles and +2 pierce"},
  {id:"phoenix",n:"Phoenix Core",      i:"♨",d:"+30 max HP and one extra Second Wind"}
];
AS.MAX_CORES=1;
AS.MISSION_TIMES=[25,105,185];   // one mission at a time; rewards scale with order
// M5 healing / pickup generosity (lower = harder)
AS.HEAL={heart:0.18,elite:0.12,mini:0.25,lsPerSec:12,dropChance:0.33,killHeart:0.0012,secondWind:0.3};

/* ---------------- M3 slice: Aether Motes + Resonance Altar (permanent, refundable) ---------------- */
AS.ALTAR=[
  {id:"vigor",    n:"Vigor",      i:"♥", max:5,base:40, d:"+10 max HP",          v:10},
  {id:"potency",  n:"Potency",    i:"⚡",max:5,base:50, d:"+5% damage",          v:0.05},
  {id:"celerity", n:"Celerity",   i:"💨",max:5,base:40, d:"+4% move speed",      v:0.04},
  {id:"haste",    n:"Cadence",    i:"🔥",max:5,base:50, d:"-3% fire interval",   v:0.03},
  {id:"attract",  n:"Attraction", i:"🧲",max:5,base:30, d:"+12% pickup radius",  v:0.12},
  {id:"insight",  n:"Insight",    i:"✧", max:5,base:45, d:"+5% XP gain",         v:0.05},
  {id:"fortune",  n:"Fortune",    i:"✪", max:5,base:60, d:"+8% Aether Motes",    v:0.08},
  {id:"resolve",  n:"Resolve",    i:"↻", max:2,base:150,d:"+1 free reroll per run",v:1}
];
AS.altarCost=function(a,rank){return Math.round(a.base*Math.pow(1.7,rank));};
// Motes earned for a run (before Fortune)
AS.motesFor=function(r){return Math.floor(r.kills*0.05+r.time*0.25+r.elites*12+r.minis*35+(r.won?120:0));};
})(window.AS);
