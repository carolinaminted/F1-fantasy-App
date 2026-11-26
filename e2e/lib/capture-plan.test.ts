import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureKey, capturePaths, parseSides, parseSurfaceFilter } from './capture-plan.ts';

test('parseSides reads one or two named sides', () => {
  assert.deepEqual(parseSides(undefined), []);
  assert.deepEqual(parseSides('[{"name":"base","baseURL":"http://127.0.0.1:3101"},{"name":"head","baseURL":"http://127.0.0.1:3100"}]'), [
    { name: 'base', baseURL: 'http://127.0.0.1:3101' },
    { name: 'head', baseURL: 'http://127.0.0.1:3100' },
  ]);
});

test('parseSides refuses bad input', () => {
  assert.throws(() => parseSides('nope'), /not JSON/);
  assert.throws(() => parseSides('[]'), /one or two/);
  assert.throws(() => parseSides('[{"name":"Bad Name","baseURL":"x"}]'), /bad side/);
  assert.throws(() => parseSides('[{"name":"a","baseURL":"x"},{"name":"a","baseURL":"y"}]'), /unique/);
});

test('parseSurfaceFilter returns null for all and refuses unknown ids', () => {
  assert.equal(parseSurfaceFilter(undefined, ['home']), null);
  assert.equal(parseSurfaceFilter('', ['home']), null);
  assert.deepEqual(parseSurfaceFilter('home, league', ['home', 'league', 'profile']), ['home', 'league']);
  assert.throws(() => parseSurfaceFilter('home,nope', ['home']), /unknown surface.*nope/);
});

test('keys and paths are stable and per side', () => {
  const key = captureKey('capture-mobile', 'standings-hall', 'light');
  assert.equal(key, 'capture-mobile/standings-hall--light');
  assert.deepEqual(capturePaths('/r', 'base', key), {
    png: '/r/base/capture-mobile/standings-hall--light.png',
    aria: '/r/base/capture-mobile/standings-hall--light.aria.yml',
  });
});
