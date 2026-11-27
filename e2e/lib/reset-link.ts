import { GuardError, STAGING_PROJECT, stagingWebApiKey } from './guards.ts';

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts';

// The mail links to Firebase's hosted page, which the guards do not allow a browser to open.
// The journey reads the code from the link and finishes the reset over REST instead.
export function oobCodeFromResetLink(link: string, project = STAGING_PROJECT): string {
  const url = new URL(link);
  const stagingHost = url.hostname === `${project}.firebaseapp.com` || url.hostname === `${project}.web.app`;
  if (!stagingHost || url.searchParams.get('mode') !== 'resetPassword') throw new GuardError(`not a staging reset link: ${url.hostname}`);
  const code = url.searchParams.get('oobCode');
  if (!code) throw new Error('reset link has no oobCode');
  return code;
}

async function identity(op: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${IDENTITY}:${op}?key=${stagingWebApiKey()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
  const res = await identity('resetPassword', { oobCode, newPassword });
  if (!res.ok) throw new Error(`resetPassword: HTTP ${res.status}`);
}

// A wrong password is an answer; a throttle or an outage is not, and must not read as "the old password no longer works".
export function classifySignIn(status: number, body: unknown): boolean {
  if (status === 200) return true;
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  const code = typeof message === 'string' ? message.split(/[\s:]/)[0] : '';
  if (status === 400 && (code.startsWith('INVALID_LOGIN_CREDENTIALS') || code.startsWith('INVALID_PASSWORD'))) return false;
  throw new Error(`signInWithPassword: HTTP ${status} ${code}`.trimEnd());
}

export async function passwordWorks(email: string, password: string): Promise<boolean> {
  const res = await identity('signInWithPassword', { email, password, returnSecureToken: false });
  return classifySignIn(res.status, await res.json().catch(() => null));
}
