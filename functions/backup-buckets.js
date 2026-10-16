/**
 * The Cloud Storage bucket that holds season backups, by data project ([ROLL-10]).
 *
 * Keyed by the project whose Firestore is exported, not the project hosting the function: the
 * portal (lights-out-league-prod) exports formula-fantasy-1, so callers resolve through the runtime
 * target first. A project with no entry has no bucket, and the backup step refuses rather than
 * guess one.
 */
const BACKUP_BUCKET_BY_PROJECT = new Map([
  ['formula-fantasy-staging', 'formula-fantasy-staging-season-backups'],
  ['formula-fantasy-1', 'formula-fantasy-1-season-backups'],
]);

const resolveBackupBucket = (projectId) => BACKUP_BUCKET_BY_PROJECT.get(projectId) || null;

module.exports = { BACKUP_BUCKET_BY_PROJECT, resolveBackupBucket };
