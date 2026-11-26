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

test('reads top-level errors', () => {
  assert.deepEqual(readPlaywrightErrors(json), ['global boom']);
  assert.deepEqual(readPlaywrightErrors({}), []);
});
