import { randomBytes } from 'node:crypto';

export const ADMIN_EMAIL = 'lol.e2e.bot+admin@gmail.com';
export const MEMBER_EMAIL = 'lol.e2e.bot+member@gmail.com';
export const RUN_EMAIL_RE = /^lol\.e2e\.bot\+run-([a-z0-9]{8})@gmail\.com$/;

export const newRunId = (): string => randomBytes(6).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '0').slice(0, 8);
export const runEmail = (runId: string): string => `lol.e2e.bot+run-${runId}@gmail.com`;
export const inviteCodeFor = (runId: string): string => `E2E-${runId.slice(0, 4)}-${runId.slice(4, 8)}`.toUpperCase();

export function runIdFromEmail(email: string): string {
  const m = RUN_EMAIL_RE.exec(email);
  if (!m) throw new Error(`refusing to treat ${email} as a throwaway account`);
  return m[1];
}

export function assertThrowaway(email: string): void {
  if (!RUN_EMAIL_RE.test(email)) throw new Error(`refusing to treat ${email} as a throwaway account`);
}
