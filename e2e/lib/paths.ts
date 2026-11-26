import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const E2E_ROOT = resolve(here, '..');
export const REPO_ROOT = resolve(E2E_ROOT, '..');
export const AUTH_DIR = join(E2E_ROOT, '.auth');
export const RESULTS_DIR = join(REPO_ROOT, 'e2e-results');
