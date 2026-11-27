import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../fixtures.ts';
import { RESULTS_DIR } from '../lib/paths.ts';
import type { DocIo } from '../lib/snapshot.ts';
import type { RawFields } from '../lib/staging-admin.ts';

// No staging access: the "document" is a file under e2e-results/, reached through the fixture's docIo seam,
// so the real restoring fixture, snapshotDocs and restoreDocs all run against it.
const FILE = join(RESULTS_DIR, 'harness-restoring-doc.json');
const doc = (v: string): RawFields => ({ v: { stringValue: v } });
const seed = (v: string) => { mkdirSync(RESULTS_DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(doc(v))); };
const read = (): RawFields | null => { try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return null; } };
const fileIo: DocIo = {
  get: async () => read(),
  put: async (_path, fields) => { writeFileSync(FILE, JSON.stringify(fields)); },
  del: async () => { rmSync(FILE, { force: true }); },
};

test.describe('restoring fixture', () => {
  test.use({ docIo: fileIo });

  // Playwright runs fixture teardown after a timeout with a fresh budget; this proves the restore rides on it.
  // test.fail() would not do here: it expects an assertion failure and still reports a timeout as unexpected.
  test('a timeout still lets teardown restore the document', async ({ restoring }) => {
    test.info().expectedStatus = 'timedOut';
    test.setTimeout(2_000);
    seed('before');
    await restoring(['stub/doc']);
    seed('after');
    await new Promise<never>(() => {});
  });

  // Runs after the timed-out test (one worker, file order). That test left the file at 'after', so only a
  // teardown restore can make this pass.
  test('the document the timed-out test changed is back as it was', async () => {
    expect(read(), 'teardown did not restore the document the timed-out test changed').toEqual(doc('before'));
  });
});

test.describe('restoring fixture, restore that does not take', () => {
  let current = doc('before');
  test.use({ docIo: { get: async () => current, put: async () => {}, del: async () => {} } });

  // The body passes; the only error can come from teardown's re-read finding the document still changed.
  test.fail('teardown fails the test when a document differs after restore', async ({ restoring }) => {
    current = doc('before');
    await restoring(['stub/doc']);
    current = doc('after');
  });
});
