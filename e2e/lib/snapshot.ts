import { deleteDoc, getRawDoc, putRawDoc, type RawFields } from './staging-admin.ts';

export type DocSnapshot = { path: string; fields: RawFields | null };
export type RestoreStep = { path: string; action: 'delete' } | { path: string; action: 'put'; fields: RawFields };

// The three document operations a snapshot needs. Real staging by default; the harness proof swaps in a stub.
export type DocIo = {
  get: (path: string) => Promise<RawFields | null>;
  put: (path: string, fields: RawFields) => Promise<void>;
  del: (path: string) => Promise<void>;
};
export const stagingIo: DocIo = { get: getRawDoc, put: putRawDoc, del: deleteDoc };

export const memberDocPaths = (uid: string): string[] => [`users/${uid}`, `public_users/${uid}`, `userPicks/${uid}`];

export function restorePlan(snapshots: DocSnapshot[]): RestoreStep[] {
  return snapshots.map((s): RestoreStep => (s.fields === null ? { path: s.path, action: 'delete' } : { path: s.path, action: 'put', fields: s.fields }));
}

export async function snapshotDocs(paths: string[], io: DocIo = stagingIo): Promise<DocSnapshot[]> {
  return Promise.all(paths.map(async (path) => ({ path, fields: await io.get(path) })));
}

// Best effort: one failing document must not leave the others unrestored. The error names paths only,
// because the underlying messages can carry document content.
export async function restoreDocs(snapshots: DocSnapshot[], io: DocIo = stagingIo): Promise<void> {
  const failed: string[] = [];
  for (const step of restorePlan(snapshots)) {
    try {
      if (step.action === 'delete') await io.del(step.path);
      else await io.put(step.path, step.fields);
    } catch {
      failed.push(step.path);
    }
  }
  if (failed.length) throw new Error(`restore failed for: ${failed.join(', ')}`);
}

// Paths whose current fields differ from the snapshot. Paths only: never the values.
export function changedPaths(expected: DocSnapshot[], actual: DocSnapshot[]): string[] {
  const now = new Map(actual.map((s) => [s.path, canonical(s.fields)]));
  return expected.filter((s) => now.get(s.path) !== canonical(s.fields)).map((s) => s.path);
}

// Stable JSON: object keys sorted at every depth, so two reads of one document compare equal.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
