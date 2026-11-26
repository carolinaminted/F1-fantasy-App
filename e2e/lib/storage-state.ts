import { readFileSync } from 'node:fs';
import type { BrowserContext } from '@playwright/test';

export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

// Firebase keeps the session in IndexedDB, which is per origin. Compare serves two checkouts on
// two ports, so a session saved on one port is moved to the other instead of signing in again.
export function rebaseStorageState(state: StorageState, toOrigin: string): StorageState {
  if (state.origins.length === 0) return state;
  const match = state.origins.find((o) => o.origin === toOrigin);
  if (match) return { ...state, origins: [match] };
  if (state.origins.length > 1) throw new Error(`storage state has ${state.origins.length} origins and none is ${toOrigin}`);
  return { ...state, origins: [{ ...state.origins[0], origin: toOrigin }] };
}

export function loadStorageState(file: string, baseURL?: string): StorageState {
  const state = JSON.parse(readFileSync(file, 'utf8')) as StorageState;
  return baseURL ? rebaseStorageState(state, new URL(baseURL).origin) : state;
}
