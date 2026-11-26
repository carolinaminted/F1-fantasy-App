// Remove once the app stops seeding app_state/race_results for non-admins (App.tsx:552-559).
// TODO(tracker): bug ID added in Task 12.
export const RACE_RESULTS_SEED_ERROR = /^pageerror: Missing or insufficient permissions\.$/;
export const RACE_RESULTS_SEED_NOTE = 'known-app-issue: race_results self-seed denied for non-admin (App.tsx:552-559)';

export const isFirestoreWriteBody = (url: string): boolean =>
  url.includes('/google.firestore.v1.Firestore/Write/') || /\/documents:commit(?=[?#/]|$)/.test(url);

// Splits errors into those the race_results self-seed explains and the rest. An error is
// explained only when it is exactly the permission pageerror AND this page sent a write naming
// app_state/race_results.
export function splitKnownIssues(errors: string[], writeBodies: string[]): { remaining: string[]; knownHit: boolean } {
  // The channel body is form-encoded, so the document path may arrive with its slash escaped.
  const sentSeed = writeBodies.some((b) => /app_state(\/|%2F)race_results/i.test(b));
  const remaining = errors.filter((e) => !(sentSeed && RACE_RESULTS_SEED_ERROR.test(e)));
  return { remaining, knownHit: remaining.length !== errors.length };
}
