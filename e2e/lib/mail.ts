import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { loadE2EEnv } from './env.ts';

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ');
}

// The code is anchored to the phrase: the raw mail also carries CSS colours and header
// numbers that are 6-digit runs.
export function extractSixDigitCode(text: string): string | null {
  const plain = stripTags(text);
  const phrase = /verification code is/i.exec(plain);
  if (!phrase) return null;
  return /(?:^|\D)(\d{6})(?:\D|$)/.exec(plain.slice(phrase.index + phrase[0].length))?.[1] ?? null;
}

export function extractResetLink(html: string): string | null {
  const href = /href="([^"]*mode=resetPassword[^"]*)"/.exec(html)?.[1];
  return href ? href.replace(/&amp;/g, '&') : null;
}

function client(): ImapFlow {
  const env = loadE2EEnv(['E2E_MAIL_USER', 'E2E_MAIL_APP_PASSWORD']);
  return new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, logger: false, auth: { user: env.E2E_MAIL_USER, pass: env.E2E_MAIL_APP_PASSWORD } });
}

export async function inboxCount(): Promise<number> {
  const c = client();
  await c.connect();
  try { const box = await c.mailboxOpen('INBOX', { readOnly: true }); return box.exists; } finally { await c.logout(); }
}

export async function waitForMessage(opts: { to: string; subjectIncludes: string; since: Date; timeoutMs?: number }) {
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  while (Date.now() < deadline) {
    const c = client();
    await c.connect();
    try {
      const lock = await c.getMailboxLock('INBOX');
      try {
        const uids = (await c.search({ to: opts.to, since: opts.since }, { uid: true })) || [];
        for (const uid of [...uids].reverse()) {
          const msg = await c.fetchOne(String(uid), { envelope: true, source: true, internalDate: true }, { uid: true });
          if (!msg || !msg.envelope?.subject?.includes(opts.subjectIncludes)) continue;
          if (msg.internalDate && new Date(msg.internalDate) < opts.since) continue;
          const parsed = await simpleParser(msg.source as Buffer);
          const html = parsed.html || '';
          const text = parsed.text || stripTags(html).replace(/\s+/g, ' ').trim();
          return { subject: msg.envelope.subject, text, html };
        }
      } finally { lock.release(); }
    } finally { await c.logout(); }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error(`no "${opts.subjectIncludes}" mail to ${opts.to} within timeout`);
}
