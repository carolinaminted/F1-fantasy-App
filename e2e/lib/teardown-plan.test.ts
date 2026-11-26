import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSweepTargets } from './teardown-plan.ts';

const now = Date.parse('2026-11-26T20:00:00Z');
const at = (iso: string) => String(Date.parse(iso));

test('sweeps only throwaway accounts older than an hour', () => {
  const users = [
    { localId: '1', email: 'lol.e2e.bot+run-aaaaaaaa@gmail.com', createdAt: at('2026-11-26T18:00:00Z') },
    { localId: '2', email: 'lol.e2e.bot+run-bbbbbbbb@gmail.com', createdAt: at('2026-11-26T19:30:00Z') },
    { localId: '3', email: 'lol.e2e.bot+member@gmail.com', createdAt: at('2026-01-01T00:00:00Z') },
    { localId: '4', email: 'lol.e2e.bot+admin@gmail.com', createdAt: at('2026-01-01T00:00:00Z') },
    { localId: '5', email: 'real.member@gmail.com', createdAt: at('2026-01-01T00:00:00Z') },
    { localId: '6', createdAt: at('2026-01-01T00:00:00Z') },
  ];
  assert.deepEqual(selectSweepTargets(users, now).map((u) => u.localId), ['1']);
});
