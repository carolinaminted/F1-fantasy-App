import test from 'node:test';
import assert from 'node:assert/strict';
import { lastActivityAcrossTabs } from './sessionActivity.ts';

test('an idle tab sees activity another tab recorded in the shared key', () => {
  assert.equal(lastActivityAcrossTabs(1_000, '5000'), 5_000);
});

test("a tab's own newer activity wins over an older shared value", () => {
  assert.equal(lastActivityAcrossTabs(9_000, '5000'), 9_000);
});

test("a missing or unreadable shared value falls back to the tab's own activity", () => {
  assert.equal(lastActivityAcrossTabs(1_000, null), 1_000);
  assert.equal(lastActivityAcrossTabs(1_000, 'garbage'), 1_000);
});
