import { getDoc, lookupUserByEmail } from './staging-admin.ts';
import { ADMIN_EMAIL, MEMBER_EMAIL } from './identities.ts';
import type { StagingState } from './preconditions.ts';

const userDoc = async (email: string) => {
  const user = await lookupUserByEmail(email);
  return user ? getDoc(`users/${user.localId}`) : null;
};

let cached: Promise<StagingState> | null = null;

// Read once per worker: write journeys restore e2e-member's users doc before their test ends, and a failed test restarts the worker, so the cache stays valid.
export function readStagingState(): Promise<StagingState> {
  cached ??= Promise.all([
    getDoc('season_config/current'), getDoc('app_state/season_calendar'), getDoc('app_state/maintenance'),
    userDoc(MEMBER_EMAIL), userDoc(ADMIN_EMAIL),
  ]).then(([season, calendar, maintenance, member, admin]) => ({ season, calendar, maintenance, member, admin }));
  return cached;
}
