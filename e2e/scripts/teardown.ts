import { listAuthUsers } from '../lib/staging-admin.ts';
import { selectSweepTargets } from '../lib/teardown-plan.ts';
import { deleteRunAccount } from '../lib/teardown.ts';

const emailArg = process.argv.find((a) => a.startsWith('--email='))?.slice(8);
const targets = emailArg ? [emailArg] : selectSweepTargets(await listAuthUsers(), Date.now()).map((u) => u.email!);
console.log(targets.length ? `deleting: ${targets.join(', ')}` : 'nothing to sweep');
for (const email of targets) await deleteRunAccount(email);
