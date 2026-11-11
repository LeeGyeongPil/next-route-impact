// AC-5: --tests selection, runAll, unmapped routes and exit codes.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAll, makeTree, runCli, shopApp } from './helpers.mjs';

after(cleanupAll);

test('AC-5 changed util selects only the existing mapped spec files', () => {
  const result = runCli(['--root', shopApp, 'src/lib/format.ts', '--tests', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const { tests } = JSON.parse(result.stdout);
  assert.deepEqual(tests.files, ['e2e/docs.spec.ts', 'e2e/shop.spec.ts']);
  assert.equal(tests.runAll, false);
  assert.deepEqual(tests.unmappedRoutes, ['/legacy']);
});

test('AC-5 text mode prints one path per line', () => {
  const result = runCli(['--root', shopApp, 'src/lib/format.ts', '--tests']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'e2e/docs.spec.ts\ne2e/shop.spec.ts\n');
});

test('AC-5 a folder glob expands to the files that exist', () => {
  const result = runCli(['--root', shopApp, 'src/app/dashboard/layout.tsx', '--tests']);
  assert.equal(result.stdout, 'e2e/dashboard/overview.spec.ts\n');
});

test('AC-5 a changed spec file is selected even when no route maps to it', () => {
  const result = runCli(['--root', shopApp, 'e2e/api.spec.ts', '--tests']);
  assert.equal(result.stdout, 'e2e/api.spec.ts\n');
});

test('AC-5 next.config change means runAll; text mode keeps stdout empty and explains on stderr', () => {
  const json = JSON.parse(runCli(['--root', shopApp, 'next.config.ts', '--tests', '--json']).stdout);
  assert.equal(json.tests.runAll, true);
  assert.deepEqual(json.tests.runAllReasons, [{ file: 'next.config.ts', pattern: 'next.config.*' }]);
  const text = runCli(['--root', shopApp, 'next.config.ts', '--tests']);
  assert.equal(text.status, 0);
  assert.equal(text.stdout, '');
  assert.match(text.stderr, /Run all tests: next\.config\.ts changed/);
});

test('AC-5 --tests without a mapping is a usage error (exit 2)', () => {
  const root = makeTree({ 'src/app/page.tsx': 'export default function P() { return null; }\n' });
  const result = runCli(['--root', root, 'src/app/page.tsx', '--tests']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /needs a "tests" mapping/);
});

test('AC-5 --fail-on-uncertain exits 3 when something is uncertain, 0 otherwise', () => {
  const uncertain = runCli(['--root', shopApp, 'public/logo.png', '--fail-on-uncertain']);
  assert.equal(uncertain.status, 3);
  assert.match(uncertain.stderr, /--fail-on-uncertain/);
  assert.match(uncertain.stdout, /public\/logo\.png/);
  const clean = makeTree({
    'src/lib/a.ts': 'export const a = 1;\n',
    'src/app/page.tsx': "import { a } from '../lib/a';\nexport default function P() { return a; }\n",
  });
  const ok = runCli(['--root', clean, 'src/lib/a.ts', '--fail-on-uncertain']);
  assert.equal(ok.status, 0, ok.stderr);
});

test('AC-5 the mapping can live in package.json under "nextRouteImpact"', () => {
  const root = makeTree({
    'package.json': JSON.stringify({ name: 'x', nextRouteImpact: { tests: { '/**': ['e2e/*.spec.ts'] } } }),
    'e2e/a.spec.ts': '',
    'src/lib/a.ts': 'export const a = 1;\n',
    'src/app/page.tsx': "import { a } from '../lib/a';\nexport default function P() { return a; }\n",
  });
  const result = runCli(['--root', root, 'src/lib/a.ts', '--tests']);
  assert.equal(result.stdout, 'e2e/a.spec.ts\n');
});

test('AC-5 ignore patterns drop changed files (Markdown is ignored by default)', () => {
  const result = runCli(['--root', shopApp, 'README.md', '--json']);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.changed, []);
  assert.deepEqual(report.uncertain, []);
});
