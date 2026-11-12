import test from 'node:test';
import assert from 'node:assert/strict';
import { stepProgress } from './seasonOps.ts';

const ts = (ms: number) => ({ toMillis: () => ms });

test('nothing run yet: neither step is complete', () => {
  assert.deepEqual(stepProgress(undefined), { archiveVerified: false, backupCurrent: false });
});

test('a verified archive is complete; a backup taken after it is current', () => {
  assert.deepEqual(stepProgress({
    archive: { state: 'verified', finishedAt: ts(1000) },
    backup: { state: 'done', at: ts(2000) },
  }), { archiveVerified: true, backupCurrent: true });
});

test('a backup older than the archive is not current, as reset.js refuses it', () => {
  assert.deepEqual(stepProgress({
    archive: { state: 'verified', finishedAt: ts(3000) },
    backup: { state: 'done', at: ts(2000) },
  }), { archiveVerified: true, backupCurrent: false });
});

test('a failed archive check is not complete', () => {
  assert.equal(stepProgress({ archive: { state: 'failed', finishedAt: ts(1000) } }).archiveVerified, false);
});
