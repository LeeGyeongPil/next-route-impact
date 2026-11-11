// AC-6: things the tool cannot follow are reported with a reason code, and the analysis continues.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAll, loadApi, makeTree, shopApp } from './helpers.mjs';

const { analyze } = await loadApi();
after(cleanupAll);

const modified = (...paths) => paths.map((p) => ({ path: p, status: 'modified' }));

test('AC-6 a non-literal dynamic import is unresolved', async () => {
  const report = await analyze({ root: shopApp, changed: modified('src/app/dyn/page.tsx') });
  assert.deepEqual(report.unresolved, [
    { file: 'src/app/dyn/page.tsx', specifier: '`@/lib/${name}`', reason: 'non-literal-dynamic-import' },
  ]);
  assert.deepEqual(report.routes.map((route) => route.url), ['/dyn']);
});

test('AC-6 unresolved imports of unrelated files are not reported', async () => {
  const report = await analyze({ root: shopApp, changed: modified('src/lib/format.ts') });
  assert.deepEqual(report.unresolved, []);
});

test('AC-6 an alias that does not exist is unresolved "not-found"; packages are ignored', async () => {
  const root = makeTree({
    'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }\n',
    'src/app/page.tsx': "import 'react';\nimport { x } from '@/lib/missing';\nimport { y } from './nope';\nexport default function P() { return x + y; }\n",
  });
  const report = await analyze({ root, changed: modified('src/app/page.tsx') });
  assert.deepEqual(
    report.unresolved.map((item) => [item.specifier, item.reason]),
    [
      ['./nope', 'not-found'],
      ['@/lib/missing', 'not-found'],
    ],
  );
});

test('AC-6 a changed asset outside the graph is uncertain "outside-graph"', async () => {
  const report = await analyze({ root: shopApp, changed: modified('public/logo.png') });
  assert.deepEqual(report.uncertain, [{ file: 'public/logo.png', reason: 'outside-graph' }]);
  assert.deepEqual(report.routes, []);
});

test('AC-6 a file with a syntax error is listed in parseErrors and the rest is still analysed', async () => {
  const root = makeTree({
    'src/app/page.tsx': "import { ok } from '../lib/ok';\nexport default function P() { return ok; }\n",
    'src/lib/ok.ts': 'export const ok = 1;\n',
    'src/lib/broken.ts': 'export const = ;\n',
  });
  const report = await analyze({ root, changed: modified('src/lib/ok.ts') });
  assert.deepEqual(report.routes.map((route) => route.url), ['/']);
  assert.equal(report.parseErrors.length, 1);
  assert.equal(report.parseErrors[0].file, 'src/lib/broken.ts');
  assert.ok(report.parseErrors[0].count >= 1);
});

test('AC-6 a CSS module imported by a page is part of the graph; a stray stylesheet is not', async () => {
  const root = makeTree({
    'src/app/page.tsx': "import styles from './home.module.css';\nexport default function P() { return styles; }\n",
    'src/app/home.module.css': '.a { color: red; }\n',
    'src/app/stray.css': '.b { color: blue; }\n',
  });
  const used = await analyze({ root, changed: modified('src/app/home.module.css') });
  assert.deepEqual(used.routes.map((route) => route.url), ['/']);
  const stray = await analyze({ root, changed: modified('src/app/stray.css') });
  assert.deepEqual(stray.uncertain, [{ file: 'src/app/stray.css', reason: 'outside-graph' }]);
});

test('AC-6 Korean text before a dynamic import does not shift the reported specifier', async () => {
  const root = makeTree({
    'src/app/page.tsx': "// 한글 주석입니다 — 위치 계산이 어긋나지 않아야 합니다\nconst name = 'a';\nexport default async function P() { await import(`./x/${name}`); return null; }\n",
  });
  const report = await analyze({ root, changed: modified('src/app/page.tsx') });
  assert.equal(report.unresolved[0].specifier, '`./x/${name}`');
});
