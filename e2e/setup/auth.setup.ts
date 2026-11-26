import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { AUTH_DIR } from '../lib/paths.ts';
import { authFile, guardContext, signInViaUi } from '../lib/app.ts';
import { loadE2EEnv } from '../lib/env.ts';

const env = loadE2EEnv(['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_MEMBER_EMAIL', 'E2E_MEMBER_PASSWORD']);
mkdirSync(AUTH_DIR, { recursive: true });

for (const role of ['admin', 'member'] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const blocked: string[] = [];
    await guardContext(page.context(), { readOnly: false, blocked });
    const prefix = role === 'admin' ? 'E2E_ADMIN' : 'E2E_MEMBER';
    await signInViaUi(page, env[`${prefix}_EMAIL`], env[`${prefix}_PASSWORD`]);
    expect(blocked.filter((b) => b.startsWith('FORBIDDEN')), 'requests to production were attempted').toEqual([]);
    await page.context().storageState({ path: authFile(role), indexedDB: true });
  });
}
