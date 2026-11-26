import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPlaywrightErrors, readPlaywrightResults } from './run-results.ts';

const json = {
  errors: [{ message: '\u001b[31mglobal boom\u001b[39m' }],
  suites: [{
    title: 'capture.spec.ts',
    specs: [],
    suites: [{
      title: 'base',
      specs: [{
        title: 'home dark [base]',
        tests: [{
          projectName: 'capture-desktop',
          annotations: [{ type: 'capture-target', description: '{"key":"k"}' }],
          results: [{ status: 'failed', error: { message: '\u001b[2mexpect\u001b[22m failed' }, annotations: [{ type: 'capture-target', description: '{"key":"k"}' }] }],
        }],
      }],
    }],
  }],
};

test('walks nested suites, takes the last result, strips colour codes and dedupes annotations', () => {
  assert.deepEqual(readPlaywrightResults(json), [{
    title: 'home dark [base]', project: 'capture-desktop', status: 'failed', error: 'expect failed',
    annotations: [{ type: 'capture-target', description: '{"key":"k"}' }],
  }]);
});

test('keeps every errors[] message, body and teardown, joined by a separator', () => {
  const j = { suites: [{ specs: [{ title: 't', tests: [{ projectName: 'capture-desktop', results: [{
    status: 'failed',
    error: { message: '\u001b[31mpage overflows horizontally by 9px: div#x\u001b[39m' },
    errors: [{ message: '\u001b[31mpage overflows horizontally by 9px: div#x\u001b[39m' }, { message: 'console.error: e2e probe' }],
  }] }] }] }] };
  assert.equal(readPlaywrightResults(j)[0].error, 'page overflows horizontally by 9px: div#x\n---\nconsole.error: e2e probe');
});

test('a test with no results is skipped with no error', () => {
  const j = { suites: [{ specs: [{ title: 't', tests: [{ projectName: 'p', results: [] }] }] }] };
  const [o] = readPlaywrightResults(j);
  assert.equal(o.status, 'skipped');
  assert.equal(o.error, undefined);
});

test('reads top-level errors', () => {
  assert.deepEqual(readPlaywrightErrors(json), ['global boom']);
  assert.deepEqual(readPlaywrightErrors({}), []);
});
