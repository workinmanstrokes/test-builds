// Run: node test.js
const assert = require('assert');
const P = require('./game.js');

for (let seed = 1; seed <= 200; seed++) {
  for (const no of [1, 4, 7, 20]) {
    const c = P.newClaim(seed, no);
    assert.strictEqual(c.tiles.filter((t) => t.pay).length, P.payCount(no));
    c.tiles.forEach((t, i) => assert.strictEqual(t.count, P.neighbours(i).filter((j) => c.tiles[j].pay).length));
    assert.ok(c.tiles.every((t) => (t.pay ? t.grams > 0 : t.grams === 0)));
  }
}
assert.deepStrictEqual(P.neighbours(0).sort((a, b) => a - b), [1, 6, 7]);
assert.strictEqual(P.neighbours(14).length, 8);
assert.strictEqual(P.payCount(1), 8);
assert.strictEqual(P.payCount(100), 5);

// Same seed gives the same claim.
assert.deepStrictEqual(P.newClaim(42, 1).tiles, P.newClaim(42, 1).tiles);

const c = P.newClaim(7, 1);
const pay = c.tiles.findIndex((t) => t.pay), dud = c.tiles.findIndex((t) => !t.pay);
assert.deepStrictEqual(P.probe(c, dud), { count: c.tiles[dud].count });
assert.strictEqual(c.energy, P.ENERGY - 1);
assert.strictEqual(P.probe(c, dud), null, 'probing twice is refused and free');
assert.strictEqual(P.dig(c, dud).gold, 0, 'a probed tile can still be dug');
assert.strictEqual(P.dig(c, dud), null);
const hit = P.dig(c, pay);
assert.strictEqual(hit.gold, c.tiles[pay].grams);
assert.strictEqual(c.gold, c.tiles[pay].grams);
assert.strictEqual(c.energy, P.ENERGY - 5);

// Energy runs out: one point left allows a probe but not a dig.
const d = P.newClaim(9, 1);
d.energy = 1;
assert.strictEqual(P.dig(d, 0), null);
assert.strictEqual(P.isOver(d), false);
assert.ok(P.probe(d, 0));
assert.strictEqual(P.isOver(d), true);

// Digging every pay tile ends the claim with the top grade.
const e = P.newClaim(11, 1);
e.energy = 999;
e.tiles.forEach((t, i) => { if (t.pay) P.dig(e, i); });
assert.strictEqual(P.isOver(e), true);
assert.strictEqual(e.gold, e.available);
assert.strictEqual(P.grade(e), 'Bonanza');
assert.strictEqual(P.grade(P.newClaim(3, 1)), "Fool's Gold");

console.log('all tests passed');
