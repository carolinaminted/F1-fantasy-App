import type { FullConfig } from '@playwright/test';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile } from './lib/guards.ts';
import { loadE2EEnv } from './lib/env.ts';

export default async function globalSetup(config: FullConfig): Promise<void> {
  for (const p of config.projects) if (p.use.baseURL) assertAllowedBaseUrl(p.use.baseURL);
  assertStagingEnvFile();
  assertNoProdInEnv(process.env);
  loadE2EEnv(['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_MEMBER_EMAIL', 'E2E_MEMBER_PASSWORD']);
}
