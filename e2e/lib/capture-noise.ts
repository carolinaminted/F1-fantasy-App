// Chromium logs each route-aborted request as this console error; it is the observed text, with no URL in it.
export const ABORTED_REQUEST_LOG = /^console\.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT\.Inspector$/;

// Only lines the Task 2 spike observed after a blocked write. Add a line here only with the
// request that caused it, recorded in the worklog.
export const BLOCKED_WRITE_NOISE: RegExp[] = [ABORTED_REQUEST_LOG];

// Blocked entries are reported; their query strings carry session ids, so they are dropped.
export const stripQuery = (entry: string): string => entry.replace(/\?.*$/, '');

// In read-only capture an aborted write is expected. Its log lines are dropped only when the
// test really had a write blocked, so the allowance cannot hide an unrelated error.
export function dropBlockedWriteNoise(errors: string[], blocked: string[]): { remaining: string[]; dropped: number } {
  if (!blocked.some((b) => b.startsWith('WRITE '))) return { remaining: errors, dropped: 0 };
  const remaining = errors.filter((e) => !BLOCKED_WRITE_NOISE.some((re) => re.test(e)));
  return { remaining, dropped: errors.length - remaining.length };
}
