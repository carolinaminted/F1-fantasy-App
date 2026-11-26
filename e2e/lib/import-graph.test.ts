import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importClosure, relativeImports, resolveImport, type Reader } from './import-graph.ts';

const files: Record<string, string> = {
  'components/Page.tsx': [
    "import React from 'react';",
    "import { Thing,",
    "  Other } from './parts/Thing';",
    "import type { Shape } from './types';",
    "import { type Kind, helper } from '../utils/helper.ts';",
    "import '../styles/page.css';",
    "const Lazy = lazy(() => import('./Lazy.tsx'));",
    "import { App } from '../App';",
  ].join('\n'),
  'components/parts/Thing.tsx': "export { x } from './index';",
  'components/parts/index.ts': 'export const x = 1;',
  'components/types.ts': 'export type Shape = {};',
  'utils/helper.ts': 'export const helper = 1;',
  'styles/page.css': 'body {}',
  'components/Lazy.tsx': 'export default 1;',
  'App.tsx': "import { Everything } from './components/Everything';",
  'components/Everything.tsx': 'export const Everything = 1;',
};
const read: Reader = (p) => files[p] ?? null;

test('relativeImports finds static, multi-line, side-effect and dynamic imports and skips type-only ones', () => {
  assert.deepEqual(relativeImports(files['components/Page.tsx']).sort(), [
    '../App', '../styles/page.css', '../utils/helper.ts', './Lazy.tsx', './parts/Thing',
  ]);
});

test('resolveImport tries .tsx, .ts and index files, and takes an explicit extension as is', () => {
  assert.equal(resolveImport('components/Page.tsx', './parts/Thing', read), 'components/parts/Thing.tsx');
  assert.equal(resolveImport('components/parts/Thing.tsx', './index', read), 'components/parts/index.ts');
  assert.equal(resolveImport('components/Page.tsx', '../utils/helper.ts', read), 'utils/helper.ts');
  assert.equal(resolveImport('components/Page.tsx', './missing', read), null);
});

test('importClosure follows imports but does not descend into a stop file', () => {
  const closure = importClosure(['components/Page.tsx'], read, (f) => f === 'App.tsx');
  assert.deepEqual([...closure].sort(), [
    'App.tsx', 'components/Lazy.tsx', 'components/Page.tsx', 'components/parts/Thing.tsx',
    'components/parts/index.ts', 'styles/page.css', 'utils/helper.ts',
  ]);
});

test('importClosure skips entries that do not exist', () => {
  assert.deepEqual([...importClosure(['components/Gone.tsx'], read, () => false)], []);
});
