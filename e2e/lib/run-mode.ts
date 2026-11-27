import { GuardError } from './guards.ts';

type Env = Record<string, string | undefined>;

export const writesEnabled = (env: Env = process.env): boolean => env.E2E_WRITES === '1';
export const spikesEnabled = (env: Env = process.env): boolean => env.E2E_SPIKES === '1';

export function assertWriteAllowed(readOnly: boolean, env: Env = process.env): void {
  if (!readOnly && !writesEnabled(env)) throw new GuardError('this test turns read-only off; staging writes need E2E_WRITES=1');
}
