import { STAGING_PROJECT } from './guards.ts';

const MESSAGE = /^req\d+___data__$/;
const ENVELOPE = new Set(['count', 'ofs', 'headers']);

// A Firestore Write channel POST is form-encoded: count, ofs and one reqN___data__ JSON per
// message. Returns null for anything else, so callers fail closed.
export function writeChannelMessages(body: string): Record<string, unknown>[] | null {
  const params = new URLSearchParams(body);
  const messages: Record<string, unknown>[] = [];
  for (const [key, value] of params) {
    if (ENVELOPE.has(key)) continue;
    if (!MESSAGE.test(key)) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
      messages.push(parsed as Record<string, unknown>);
    } catch { return null; }
  }
  return messages.length > 0 && Number(params.get('count')) === messages.length ? messages : null;
}

// A handshake names the database and nothing else, so it cannot change data.
export function isWriteHandshakeOnly(body: string): boolean {
  const prefix = `projects/${STAGING_PROJECT}/`;
  return writeChannelMessages(body)?.every((m) => Object.keys(m).length === 1 && typeof m.database === 'string' && m.database.startsWith(prefix)) ?? false;
}

const APP_STATE = /\/documents\/app_state\/([A-Za-z0-9_-]+)/g;

export function appStateDocsIn(bodies: string[]): string[] {
  const names = bodies.flatMap((body) => [...JSON.stringify(writeChannelMessages(body) ?? []).matchAll(APP_STATE)].map((m) => m[1]));
  return [...new Set(names)].sort();
}
