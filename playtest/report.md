# Playtest report

11/18/2026, 1:47:38 AM · 2 game-minutes per bot · speed 6x

Bots: **careful** uses FINE near targets · **rusher** never uses FINE · **greedy** takes the best-paying job and sells often.

## careful

- Jobs: 11 (5.26/min) · Earned: $1504 ($720/min) · Cash left: $159 · Rep: 16
- Star milestones: ★1@88s
- Results by job type: flatten 4/4 ok (4 perfect, 0 close, 0 failed) · scrap 4/4 ok (0 perfect, 0 close, 0 failed) · crate 1/1 ok (0 perfect, 0 close, 0 failed) · crack 2/2 ok (2 perfect, 0 close, 0 failed)
- Failures by item: none
- Upgrades (id+level@time): coils2@36s psi2@62s psi3@71s servo2@92s sensor2@102s dies2@112s
- Declined orders: 0 · Crate loot: cash · Stuck events: 0
- FPS (headless, software GPU): 7 · Heap: 10 MB
- Errors: none

## rusher

- Jobs: 16 (7.18/min) · Earned: $848 ($380/min) · Cash left: $33 · Rep: 0
- Star milestones: none
- Results by job type: flatten 1/9 ok (0 perfect, 8 close, 0 failed) · scrap 3/3 ok (0 perfect, 0 close, 0 failed) · crate 2/2 ok (0 perfect, 0 close, 0 failed) · crack 0/2 ok (0 perfect, 0 close, 2 failed)
- Failures by item: can×8, geode×2
- Upgrades (id+level@time): coils2@20s psi2@63s dies2@111s coils3@129s
- Declined orders: 0 · Crate loot: bomb, ingots · Stuck events: 0
- FPS (headless, software GPU): 7 · Heap: 13 MB
- Errors: none

## greedy

- Jobs: 10 (4.51/min) · Earned: $974 ($439/min) · Cash left: $154 · Rep: 1
- Star milestones: none
- Results by job type: flatten 0/2 ok (0 perfect, 2 close, 0 failed) · crate 4/4 ok (0 perfect, 0 close, 0 failed) · scrap 3/3 ok (0 perfect, 0 close, 0 failed) · crack 0/1 ok (0 perfect, 0 close, 1 failed)
- Failures by item: can×2, geode×1
- Upgrades (id+level@time): psi2@40s dies2@54s coils2@69s psi3@118s sign2@128s
- Declined orders: 4 · Crate loot: scrap, bomb, ingots, jackpot · Stuck events: 0
- FPS (headless, software GPU): 9 · Heap: 11 MB
- Errors: none

## Things to check

- Is any job type failing more than 30% of the time for the careful bot? → too hard or a bug.
- Does rusher do almost as well as careful? → FINE control doesn't matter enough.
- How long until ★1 and ★2? Target: ★1 within ~4 min, ★2 within ~12 min.
- Any errors or stuck events? → bug.
