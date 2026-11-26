import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIgnored, isShared, selectSurfaces } from './select.ts';

const closures = new Map<string, Set<string>>([
  ['standings', new Set(['components/LeaderboardPage.tsx', 'components/standings/HallOfFameView.tsx'])],
  ['standings-hall', new Set(['components/LeaderboardPage.tsx', 'components/standings/HallOfFameView.tsx'])],
  ['league', new Set(['components/LeagueHubPage.tsx', 'components/league/DuesStatus.tsx'])],
]);

test('a file reached by some surfaces selects only those', () => {
  const s = selectSurfaces(['components/standings/HallOfFameView.tsx'], closures);
  assert.deepEqual(s, { all: false, ids: ['standings', 'standings-hall'], reasons: ['components/standings/HallOfFameView.tsx → standings, standings-hall'] });
});

test('a shared file selects everything', () => {
  const s = selectSurfaces(['styles/theme.css'], closures);
  assert.equal(s.all, true);
  assert.deepEqual(s.ids, ['standings', 'standings-hall', 'league']);
  assert.deepEqual(s.reasons, ['shared styles/theme.css → all']);
});

test('a file no surface reaches selects everything', () => {
  const s = selectSurfaces(['zz-unmapped.ts'], closures);
  assert.equal(s.all, true);
  assert.deepEqual(s.reasons, ['unmapped zz-unmapped.ts → all']);
});

test('ignored files select nothing', () => {
  const s = selectSurfaces(['functions/index.js', 'e2e/surfaces.ts', 'DESIGN.md', 'services/scoringService.test.ts'], closures);
  assert.deepEqual(s.ids, []);
  assert.equal(s.all, false);
});

test('no changes select nothing and say so', () => {
  assert.deepEqual(selectSurfaces([], closures), { all: false, ids: [], reasons: ['no changed files'] });
});

test('test files are ignored before services/** counts as shared', () => {
  assert.equal(isIgnored('services/scoringService.test.ts'), true);
  assert.equal(isShared('services/scoringService.ts'), true);
});
