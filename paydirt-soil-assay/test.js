// Run: node test.js
// Rules tests for the shipped ante loop in game.js (5 probes / 3 digs,
// one connected 3-5-cell pay streak, escalating quota). No dependencies.
const assert = require('assert');
const P = require('./game.js');

assert.strictEqual(P.SIZE, 6);
assert.strictEqual(P.SECONDS, 60);
assert.strictEqual(P.PROBES, 5);
assert.strictEqual(P.DIGS, 3);

// Quotas: 12.0 g at Ante 1, x1.4 each ante.
assert.strictEqual(P.quota(1), 12);
assert.strictEqual(P.quota(2), 16.8);
assert.strictEqual(P.quota(3), 23.5);

// Streak length: 5 cells at Antes 1-2, 4 at 3-4, 3 at Ante 5+.
const streakLen = (c) => c.tiles.filter((t) => t.pay).length;
for (let seed = 1; seed <= 100; seed++) {
  assert.strictEqual(streakLen(P.newClaim(seed, 1)), 5);
  assert.strictEqual(streakLen(P.newClaim(seed, 2)), 5);
  assert.strictEqual(streakLen(P.newClaim(seed, 3)), 4);
  assert.strictEqual(streakLen(P.newClaim(seed, 4)), 4);
  assert.strictEqual(streakLen(P.newClaim(seed, 5)), 3);
  assert.strictEqual(streakLen(P.newClaim(seed, 9)), 3);
}

for (let seed = 1; seed <= 200; seed++) {
  for (const ante of [1, 2, 3, 4]) {
    const c = P.newClaim(seed, ante);
    // Neighbour counts are exact.
    c.tiles.forEach((t, i) => assert.strictEqual(
      t.count, P.neighbours(i).filter((j) => c.tiles[j].pay).length));
    // Pay cells hold gold, dirt holds none.
    assert.ok(c.tiles.every((t) => (t.pay ? t.grams > 0 : t.grams === 0)));
    // The streak is connected.
    const seen = new Set([c.tiles.findIndex((t) => t.pay)]);
    let grew = true;
    while (grew) {
      grew = false;
      [...seen].forEach((i) => P.neighbours(i).forEach((j) => {
        if (c.tiles[j].pay && !seen.has(j)) { seen.add(j); grew = true; }
      }));
    }
    assert.strictEqual(seen.size, streakLen(c));
    // The best 3 streak cells always cover the quota (oracle check).
    const best3 = c.tiles.filter((t) => t.pay).map((t) => t.grams)
      .sort((a, b) => b - a).slice(0, 3)
      .reduce((s, g) => s + g, 0);
    assert.ok(best3 >= c.quota, `seed ${seed} ante ${ante}: best 3 = ${best3} < quota ${c.quota}`);
    assert.strictEqual(c.probes, P.PROBES);
    assert.strictEqual(c.digs, P.DIGS);
    assert.strictEqual(c.gold, 0);
  }
}

assert.deepStrictEqual(P.neighbours(0).sort((a, b) => a - b), [1, 6, 7]);
assert.strictEqual(P.neighbours(14).length, 8);

// Same seed gives the same claim.
assert.deepStrictEqual(P.newClaim(42, 1).tiles, P.newClaim(42, 1).tiles);

const c = P.newClaim(7, 1);
const pay = c.tiles.findIndex((t) => t.pay);
const dud = c.tiles.findIndex((t) => !t.pay);
assert.deepStrictEqual(P.probe(c, dud), { count: c.tiles[dud].count });
assert.strictEqual(c.probes, P.PROBES - 1);
assert.strictEqual(P.probe(c, dud), null, 'probing twice is refused and free');
assert.strictEqual(P.dig(c, dud).gold, 0, 'a probed tile can still be dug');
assert.strictEqual(P.dig(c, dud), null, 'digging twice is refused');
const hit = P.dig(c, pay);
assert.strictEqual(hit.gold, c.tiles[pay].grams);
assert.strictEqual(c.gold, c.tiles[pay].grams);
assert.strictEqual(c.digs, P.DIGS - 2);
assert.strictEqual(P.quotaMet(P.newClaim(7, 1)), false);

// Budgets bind: no probes left means probe refuses; no digs left means dig refuses.
const d = P.newClaim(9, 1);
d.probes = 0;
assert.strictEqual(P.probe(d, 0), null);
assert.strictEqual(P.isOver(d), false);
d.digs = 0;
assert.strictEqual(P.dig(d, 0), null);
assert.strictEqual(P.isOver(d), true);

// Digging every pay tile ends the claim with the top grade.
const e = P.newClaim(11, 1);
e.digs = 99; // lift the 3-dig budget so all 5 streak cells can be dug
e.tiles.forEach((t, i) => { if (t.pay) P.dig(e, i); });
assert.strictEqual(P.isOver(e), true);
assert.strictEqual(e.gold, e.available);
assert.strictEqual(P.grade(e), 'Bonanza');
assert.strictEqual(P.grade(P.newClaim(3, 1)), "Fool's Gold");

console.log('all tests passed');
