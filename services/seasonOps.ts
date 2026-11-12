/** `season_ops/{seasonId}`, as far as Season Control needs it. Timestamps are Firestore Timestamps. */
interface Stamp { toMillis: () => number }
export interface SeasonOps {
  archive?: { state?: string; finishedAt?: Stamp };
  backup?: { state?: string; at?: Stamp };
}

/**
 * Which of the two steps that share the `archived` status are complete. The backup rule mirrors
 * functions/season-ops/reset.js, so Start new season is enabled exactly when the server accepts it.
 */
export const stepProgress = (ops: SeasonOps | undefined) => {
  const archiveVerified = ops?.archive?.state === 'verified';
  const archivedAt = ops?.archive?.finishedAt?.toMillis() ?? 0;
  const backupAt = ops?.backup?.at?.toMillis() ?? 0;
  const backupCurrent = ops?.backup?.state === 'done' && backupAt > archivedAt;
  return { archiveVerified, backupCurrent };
};
