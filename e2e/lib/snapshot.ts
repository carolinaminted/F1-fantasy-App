import { deleteDoc, getRawDoc, putRawDoc, type RawFields } from './staging-admin.ts';

export type DocSnapshot = { path: string; fields: RawFields | null };
export type RestoreStep = { path: string; action: 'delete' } | { path: string; action: 'put'; fields: RawFields };

export const memberDocPaths = (uid: string): string[] => [`users/${uid}`, `public_users/${uid}`, `userPicks/${uid}`];

export function restorePlan(snapshots: DocSnapshot[]): RestoreStep[] {
  return snapshots.map((s): RestoreStep => (s.fields === null ? { path: s.path, action: 'delete' } : { path: s.path, action: 'put', fields: s.fields }));
}

export async function snapshotDocs(paths: string[]): Promise<DocSnapshot[]> {
  return Promise.all(paths.map(async (path) => ({ path, fields: await getRawDoc(path) })));
}

export async function restoreDocs(snapshots: DocSnapshot[]): Promise<void> {
  for (const step of restorePlan(snapshots)) {
    if (step.action === 'delete') await deleteDoc(step.path);
    else await putRawDoc(step.path, step.fields);
  }
}

// Stable JSON: object keys sorted at every depth, so two reads of one document compare equal.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
