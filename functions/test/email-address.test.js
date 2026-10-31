const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_EMAIL_LENGTH, normalizeEmail } = require('../email-address');

test('trims and lowercases a plain address', () => {
  assert.equal(normalizeEmail('  Member@Example.COM '), 'member@example.com');
});

test('keeps plus tags and subdomains', () => {
  assert.equal(normalizeEmail('a.b+f1@mail.example.co.uk'), 'a.b+f1@mail.example.co.uk');
});

test('refuses a comma- or semicolon-separated recipient list', () => {
  assert.equal(normalizeEmail('a@example.com, b@example.com'), null);
  assert.equal(normalizeEmail('a@example.com,b@example.com'), null);
  assert.equal(normalizeEmail('a@example.com;b@example.com'), null);
});

test('refuses display-name syntax and markup', () => {
  assert.equal(normalizeEmail('Victim <a@example.com>'), null);
  assert.equal(normalizeEmail('"x"@example.com'), null);
  assert.equal(normalizeEmail('<b>a</b>@example.com'), null);
});

test('refuses embedded whitespace and newlines', () => {
  assert.equal(normalizeEmail('a b@example.com'), null);
  assert.equal(normalizeEmail('a@example.com\nBcc: b@example.com'), null);
});

test('refuses anything that is not exactly one address', () => {
  for (const bad of ['', '   ', 'a', 'a@', '@example.com', 'a@example', 'a@@example.com', 'a@b@example.com']) {
    assert.equal(normalizeEmail(bad), null, bad);
  }
});

test('refuses non-strings', () => {
  for (const bad of [undefined, null, 42, {}, ['a@example.com']]) {
    assert.equal(normalizeEmail(bad), null);
  }
});

test('enforces the 254-character limit', () => {
  const domain = '@example.com';
  const fits = 'a'.repeat(MAX_EMAIL_LENGTH - domain.length) + domain;
  assert.equal(normalizeEmail(fits), fits);
  assert.equal(normalizeEmail('a' + fits), null);
});
