# Boss Mechanics

One distinct mechanic per boss. No two bosses share a mechanic. Implemented
in `src/bosses.js` (`BrainrotBosses.BOSSES`, `updateBossState`); the in-game
boss arena shows the mechanic name and text.

## 1. Grump King — Tantrum Shockwave

Every 4 seconds Grump King slams the ground and sends a shockwave ring across
the arena. Jump (swipe up) or be behind a squad member to avoid it.
**Weakness:** he is stunned for 2 seconds after every third slam.

## 2. Sweeping Old Man — Broom Sweep Lanes

The Old Man sweeps his broom across one lane at a time, telegraphed by dust.
The swept lane is deadly for 1.5 seconds — change lanes or lose squad members.
**Weakness:** his broom gets stuck for 2 seconds after sweeping the widest lane.

## 3. Espressorilla — Caffeine Rush

Espressorilla drinks an espresso and goes into a 3-second caffeine rush: he
moves and attacks twice as fast, but he cannot turn. Sidestep and let him
charge past, then hit him from behind.
**Weakness:** double damage from behind during the rush.

## 4. Flamenco Rotorina — Rhythm Castanets

Rotorina attacks on the beat: castanet clicks mark a 4-beat pattern and the
strike lands on beat 4. Move on the off-beat and you are safe.
**Weakness:** she misses entirely if the squad stands still on beat 4.

## 5. Squalo Supremo — Whirlpool Pull

Squalo opens a whirlpool at the arena centre that drags the squad inward for
3 seconds, then snaps shut and bites anything still inside.
**Weakness:** the whirlpool edge is safe ground — hug the rim.

## 6. Yeti Scudiero — Blizzard Blind

The Yeti summons a blizzard that whites out the arena for 2 seconds — you can
only see your own squad. Listen for the roar: it marks where he will land his leap.
**Weakness:** his landing spot is frozen solid for 2 seconds, a free hit window.

## 7. Asciero Argento — Silver Mirror Clone

Argento splits into three silver mirrors — only one is real. The real one
casts a shadow; the fakes do not. Hit a fake and it shatters into shrapnel.
**Weakness:** the real Argento always casts a shadow.
