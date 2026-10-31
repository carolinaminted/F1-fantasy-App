const test = require('node:test');
const assert = require('node:assert/strict');
const { TRUSTED_HOPS, resolveClientIp } = require('../client-ip');

test('trusts one hop from the end by default', () => {
  assert.equal(TRUSTED_HOPS, 1);
});

test('uses the only entry when the caller sent no header of their own', () => {
  assert.equal(resolveClientIp({ 'x-forwarded-for': '203.0.113.7' }, '10.0.0.1'), '203.0.113.7');
});

test('ignores a forged leading entry', () => {
  const headers = { 'x-forwarded-for': '1.2.3.4, 203.0.113.7' };
  assert.equal(resolveClientIp(headers, '10.0.0.1'), '203.0.113.7');
});

test('ignores several forged entries and stray whitespace', () => {
  const headers = { 'x-forwarded-for': ' 1.1.1.1 ,2.2.2.2,  203.0.113.7 ' };
  assert.equal(resolveClientIp(headers, undefined), '203.0.113.7');
});

test('counts further back when more hops are trusted', () => {
  const headers = { 'x-forwarded-for': '1.2.3.4, 203.0.113.7, 35.191.0.1' };
  assert.equal(resolveClientIp(headers, undefined, 2), '203.0.113.7');
});

test('never reads past the start of a short header', () => {
  assert.equal(resolveClientIp({ 'x-forwarded-for': '203.0.113.7' }, undefined, 3), '203.0.113.7');
});

test('handles IPv6 addresses', () => {
  const headers = { 'x-forwarded-for': '::1, 2001:db8::42' };
  assert.equal(resolveClientIp(headers, undefined), '2001:db8::42');
});

test('joins a header delivered as an array', () => {
  const headers = { 'x-forwarded-for': ['1.2.3.4', '203.0.113.7'] };
  assert.equal(resolveClientIp(headers, undefined), '203.0.113.7');
});

test('falls back to the socket address when the header is missing or empty', () => {
  assert.equal(resolveClientIp({}, '10.0.0.1'), '10.0.0.1');
  assert.equal(resolveClientIp({ 'x-forwarded-for': ' , ' }, '10.0.0.1'), '10.0.0.1');
});

test('reports unknown when nothing identifies the caller', () => {
  assert.equal(resolveClientIp(undefined, undefined), 'unknown');
});
