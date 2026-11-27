import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appStateDocsIn, isWriteHandshakeOnly } from './write-channel.ts';

const DB = 'projects/formula-fantasy-staging/databases/(default)';
const body = (messages: unknown[], extra: Record<string, string> = {}) => new URLSearchParams({
  ...extra, count: String(messages.length), ofs: '0',
  ...Object.fromEntries(messages.map((m, i) => [`req${i}___data__`, JSON.stringify(m)])),
}).toString();
const write = (doc: string) => ({ streamToken: 'abc', writes: [{ update: { name: `${DB}/documents/${doc}`, fields: {} } }] });

test('a handshake that only names the staging database is recognised', () => {
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }])), true);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }], { headers: 'Authorization: x' })), true);
});

test('anything that could carry a write is not a handshake', () => {
  assert.equal(isWriteHandshakeOnly(body([write('app_state/scoring_config')])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }, write('app_state/form_locks')])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB, writes: [] }])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: 'projects/other/databases/(default)' }])), false);
  assert.equal(isWriteHandshakeOnly(body([{ database: DB }], { surprise: '1' })), false);
  assert.equal(isWriteHandshakeOnly(`count=2&ofs=0&req0___data__=${encodeURIComponent(JSON.stringify({ database: DB }))}`), false);
  assert.equal(isWriteHandshakeOnly(`${body([write('userPicks/u1')])}&req0___data__=${encodeURIComponent(JSON.stringify({ database: DB }))}`), false);
  assert.equal(isWriteHandshakeOnly('count=1&ofs=0&req0___data__=not-json'), false);
  assert.equal(isWriteHandshakeOnly(''), false);
});

test('app_state documents named by writes are listed once each', () => {
  const bodies = [
    body([write('app_state/scoring_config'), write('app_state/race_results')]),
    body([{ writes: [{ delete: `${DB}/documents/app_state/form_locks` }] }]),
    body([write('userPicks/u1')]),
    body([write('app_state/race_results')]),
  ];
  assert.deepEqual(appStateDocsIn(bodies), ['form_locks', 'race_results', 'scoring_config']);
});
