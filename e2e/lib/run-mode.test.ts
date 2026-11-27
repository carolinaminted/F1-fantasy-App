import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertWriteAllowed, spikesEnabled, writesEnabled } from './run-mode.ts';
import { GuardError } from './guards.ts';

test('writes and spikes are off unless their flag is exactly 1', () => {
  assert.equal(writesEnabled({}), false);
  assert.equal(writesEnabled({ E2E_WRITES: 'true' }), false);
  assert.equal(writesEnabled({ E2E_WRITES: '1' }), true);
  assert.equal(spikesEnabled({}), false);
  assert.equal(spikesEnabled({ E2E_SPIKES: '1' }), true);
});

test('turning read-only off without E2E_WRITES=1 is refused', () => {
  assert.doesNotThrow(() => assertWriteAllowed(true, {}));
  assert.doesNotThrow(() => assertWriteAllowed(false, { E2E_WRITES: '1' }));
  assert.throws(() => assertWriteAllowed(false, {}), GuardError);
  assert.throws(() => assertWriteAllowed(false, {}), /E2E_WRITES=1/);
});
