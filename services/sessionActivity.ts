/**
 * The latest activity recorded by any tab. Every tab writes the shared localStorage key, but a
 * tab's own ref only sees its own events — and all tabs share one Firebase sign-in, so an idle
 * tab judging by its ref alone signs out the tab the member is actually using.
 */
export const lastActivityAcrossTabs = (own: number, stored: string | null): number => {
  const shared = stored === null ? NaN : Number.parseInt(stored, 10);
  return Number.isFinite(shared) ? Math.max(own, shared) : own;
};
