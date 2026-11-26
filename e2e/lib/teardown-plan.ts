import { RUN_EMAIL_RE } from './identities.ts';
import type { AuthUser } from './staging-admin.ts';

export function selectSweepTargets(users: AuthUser[], now: number, maxAgeMs = 60 * 60_000): AuthUser[] {
  return users.filter((u) => u.email && RUN_EMAIL_RE.test(u.email) && now - Number(u.createdAt ?? now) > maxAgeMs);
}
