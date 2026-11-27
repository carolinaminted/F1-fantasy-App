import { test, expect } from '../fixtures.ts';
import { writesEnabled } from '../lib/run-mode.ts';

test('a test that declares nothing is read-only', async ({ readOnly }) => {
  expect(readOnly).toBe(true);
});

test.describe('read-only turned off', () => {
  test.use({ readOnly: false });
  test.skip(() => writesEnabled(), 'E2E_WRITES=1 allows this');

  // Opens no page, so it cannot write even while the gate is missing.
  test.fail('is refused without E2E_WRITES=1', async () => {});
});
