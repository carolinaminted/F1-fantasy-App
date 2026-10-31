const test = require('node:test');
const assert = require('node:assert/strict');
const { BACKUP_BUCKET_BY_PROJECT, resolveBackupBucket } = require('../backup-buckets');

test('maps each data project to its own bucket', () => {
  assert.equal(resolveBackupBucket('formula-fantasy-staging'), 'formula-fantasy-staging-season-backups');
  assert.equal(resolveBackupBucket('formula-fantasy-1'), 'formula-fantasy-1-season-backups');
});

test('the portal host has no bucket of its own', () => {
  assert.equal(resolveBackupBucket('lights-out-league-prod'), null);
});

test('an unlisted or empty project has no bucket', () => {
  assert.equal(resolveBackupBucket('some-other-project'), null);
  assert.equal(resolveBackupBucket(''), null);
});

test('every bucket name is a valid Cloud Storage name', () => {
  for (const bucket of BACKUP_BUCKET_BY_PROJECT.values()) {
    assert.match(bucket, /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/);
  }
});
