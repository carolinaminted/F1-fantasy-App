const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSeasonConfig } = require('../scripts/seed-season-config');

const constants = fs.readFileSync(path.join(__dirname, '..', '..', 'constants.ts'), 'utf8');

test('builds the 2026 config from constants.ts in round order', () => {
  const config = buildSeasonConfig(constants);
  assert.equal(config.activeSeasonId, '2026');
  assert.equal(config.label, '2026 Season');
  assert.equal(config.status, 'active');
  assert.equal(config.scoredEventIds.length, 23);
  assert.equal(config.scoredEventIds[0], 'aus_26');
  assert.equal(config.scoredEventIds[22], 'abu_26');
});

test('Bahrain is scored and Saudi Arabia and the Emilia placeholder are not', () => {
  const { scoredEventIds } = buildSeasonConfig(constants);
  assert.ok(scoredEventIds.includes('bhr_26'));
  assert.ok(!scoredEventIds.includes('sau_26'));
  assert.ok(!scoredEventIds.includes('emi_26'));
});

test('refuses a source with no EVENTS array', () => {
  assert.throws(() => buildSeasonConfig('export const X = 1;'), /EVENTS/);
});
