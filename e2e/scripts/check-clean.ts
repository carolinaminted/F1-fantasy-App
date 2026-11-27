import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_EMAIL, MEMBER_EMAIL, RUN_EMAIL_RE } from '../lib/identities.ts';
import { listAuthUsers, queryDocIds, uidOf } from '../lib/staging-admin.ts';
import { canonical, memberDocPaths, snapshotDocs } from '../lib/snapshot.ts';

// Holds member data, so it lives under the gitignored e2e-results/ and is never printed.
const FILE = fileURLToPath(new URL('../../e2e-results/clean-baseline.json', import.meta.url));
const mode = process.argv[2];
if (mode !== '--save' && mode !== '--compare') {
  console.error('usage: check-clean.ts --save | --compare');
  process.exit(2);
}

const memberDocs = await snapshotDocs(memberDocPaths(await uidOf(MEMBER_EMAIL)));
const adminCodes = (await queryDocIds('invitation_codes', 'createdBy', await uidOf(ADMIN_EMAIL))).sort();
const runAccounts = (await listAuthUsers()).filter((u) => RUN_EMAIL_RE.test(u.email ?? '')).length;

if (mode === '--save') {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ memberDocs, adminCodes }));
  console.log(`saved: ${memberDocs.length} member docs, ${adminCodes.length} admin-created codes, ${runAccounts} +run-* accounts now`);
} else {
  if (!existsSync(FILE)) { console.error('no baseline: run with --save first'); process.exit(2); }
  const base = JSON.parse(readFileSync(FILE, 'utf8'));
  const problems: string[] = [];
  for (const doc of memberDocs) {
    const was = base.memberDocs.find((d: { path: string }) => d.path === doc.path);
    if (canonical(was?.fields ?? null) !== canonical(doc.fields)) problems.push(`${doc.path.split('/')[0]} differs from the baseline`);
  }
  if (canonical(base.adminCodes) !== canonical(adminCodes)) problems.push('invite codes created by e2e-admin differ from the baseline');
  if (runAccounts > 0) problems.push(`${runAccounts} +run-* accounts remain`);
  console.log(problems.length ? `NOT CLEAN:\n- ${problems.join('\n- ')}` : 'clean: member docs, admin codes and +run-* accounts match the baseline');
  process.exit(problems.length ? 1 : 0);
}
