import { createDoc, deleteDoc, getDoc } from './staging-admin.ts';
import { inviteCodeFor } from './identities.ts';

const CODE_TTL_MS = 600_000; // functions/index.js sendAuthCode: expiresAt = Date.now() + 600000

export async function mintInvite(runId: string): Promise<string> {
  const code = inviteCodeFor(runId);
  await createDoc(`invitation_codes/${code}`, { code, status: 'active', createdAt: new Date(), createdBy: 'e2e-harness' });
  return code;
}

export const revokeInvite = (code: string): Promise<void> => deleteDoc(`invitation_codes/${code}`);

export function isFreshVerification(doc: Record<string, unknown> | null, startedAt: number): boolean {
  if (!doc || typeof doc.code !== 'string') return false;
  return Number(doc.expiresAt) >= startedAt + CODE_TTL_MS - 5_000;
}

export async function readSignupCode(email: string, startedAt: number, timeoutMs = 30_000): Promise<string> {
  const path = `email_verifications/${email.trim().toLowerCase()}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await getDoc(path);
    if (isFreshVerification(doc, startedAt)) return doc!.code as string;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`no fresh verification code for ${email} within ${timeoutMs}ms`);
}
