const test = require('node:test');
const assert = require('node:assert/strict');
const { computeFinalStandings, podiumOf, p22AwardOf } = require('../season-ops/standings');

const u = (uid, displayName, totalPoints) => ({ uid, data: { displayName, totalPoints, rank: 99 } });

test('ranks by points, ties share a place (1224), ties listed by name', () => {
  const s = computeFinalStandings([u('c', 'Cara', 90), u('a', 'Abe', 100), u('b', 'Bea', 90), u('d', 'Dan', 80)]);
  assert.deepEqual(s.map((r) => [r.uid, r.finalRank]), [['a', 1], ['b', 2], ['c', 2], ['d', 4]]);
});

test('excludes the Admin Principal account and treats missing points as 0', () => {
  const s = computeFinalStandings([u('x', 'Admin Principal', 500), { uid: 'n', data: { displayName: 'New' } }]);
  assert.deepEqual(s.map((r) => [r.uid, r.totalPoints, r.finalRank]), [['n', 0, 1]]);
});

test('champions are everyone at rank 1; podium is everyone at rank 3 or better', () => {
  const s = computeFinalStandings([u('a', 'A', 100), u('b', 'B', 100), u('c', 'C', 90), u('d', 'D', 80)]);
  assert.deepEqual(podiumOf(s), { champions: ['a', 'b'], podium: ['a', 'b', 'c'] });
});

const p = (uid, displayName, totalPoints, p22) => ({ uid, data: { displayName, totalPoints, breakdown: { p22 } } });

test('P22 Award goes to the most P22 picks; ties share it, listed by name', () => {
  const s = computeFinalStandings([p('a', 'Abe', 100, 2), p('c', 'Cara', 50, 5), p('b', 'Bea', 80, 5), p('d', 'Dan', 10, 0)]);
  assert.deepEqual(p22AwardOf(s), [
    { uid: 'b', displayName: 'Bea', p22Count: 5, finalRank: 2 },
    { uid: 'c', displayName: 'Cara', p22Count: 5, finalRank: 3 },
  ]);
});

test('P22 Award is unclaimed when nobody picked a last-place finisher, and skips the admin account', () => {
  assert.deepEqual(p22AwardOf(computeFinalStandings([p('a', 'Abe', 100, 0), u('b', 'Bea', 90)])), []);
  assert.deepEqual(p22AwardOf(computeFinalStandings([p('x', 'Admin Principal', 0, 9), p('a', 'Abe', 100, 1)])),
    [{ uid: 'a', displayName: 'Abe', p22Count: 1, finalRank: 1 }]);
});
