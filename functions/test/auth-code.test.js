const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_FAILED_ATTEMPTS, evaluateCodeAttempt } = require('../auth-code');

const NOW = 1_000_000;
const record = (overrides = {}) => ({ code: '123456', expiresAt: NOW + 60_000, ...overrides });

test('reports a missing code without touching anything', () => {
  assert.deepEqual(evaluateCodeAttempt(null, '123456', NOW), {
    valid: false, message: 'Code not found', action: 'none',
  });
});

test('accepts the right code and consumes it', () => {
  assert.deepEqual(evaluateCodeAttempt(record(), '123456', NOW), { valid: true, action: 'delete' });
});

test('rejects and deletes an expired code, even when correct', () => {
  const result = evaluateCodeAttempt(record({ expiresAt: NOW - 1 }), '123456', NOW);
  assert.equal(result.valid, false);
  assert.equal(result.action, 'delete');
});

test('counts a wrong guess against a record written before the counter existed', () => {
  assert.deepEqual(evaluateCodeAttempt(record(), '000000', NOW), {
    valid: false, message: 'Invalid code', action: 'increment', failedAttempts: 1,
  });
});

test('deletes the code on the fifth wrong guess', () => {
  const result = evaluateCodeAttempt(
    record({ failedAttempts: MAX_FAILED_ATTEMPTS - 1 }), '000000', NOW);
  assert.equal(MAX_FAILED_ATTEMPTS, 5);
  assert.equal(result.valid, false);
  assert.equal(result.action, 'delete');
  assert.match(result.message, /request a new code/);
});

test('still accepts the right code after four misses', () => {
  const result = evaluateCodeAttempt(
    record({ failedAttempts: MAX_FAILED_ATTEMPTS - 1 }), '123456', NOW);
  assert.equal(result.valid, true);
});

test('does not coerce a numeric guess into a match', () => {
  assert.equal(evaluateCodeAttempt(record(), 123456, NOW).valid, false);
});
