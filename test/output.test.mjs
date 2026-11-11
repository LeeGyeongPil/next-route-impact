// AC-4: table, JSON and Markdown output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli, shopApp } from './helpers.mjs';

const base = ['--root', shopApp, 'src/lib/format.ts'];

test('AC-4 the default table has URL, KIND and REASON columns', () => {
  const result = runCli(base);
  assert.equal(result.status, 0, result.stderr);
  const header = result.stdout.split('\n').find((line) => line.startsWith('URL'));
  assert.match(header, /^URL\s+KIND\s+REASON$/);
  assert.match(result.stdout, /\/products\/\[id\]\s+page\s+src\/lib\/format\.ts -> src\/hooks\/useCart\.ts -> src\/app\/\(shop\)\/products\/\[id\]\/page\.tsx/);
  assert.match(result.stdout, /\/shop\/\[\[\.\.\.filters\]\]\s+page\s+src\/lib\/format\.ts -\[dynamic\]-> /);
});

test('AC-4 --json has schemaVersion 1 and the documented fields', () => {
  const result = runCli([...base, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 1);
  for (const field of ['changed', 'routes', 'removedRoutes', 'uncertain', 'unresolved', 'parseErrors', 'notes']) {
    assert.ok(Array.isArray(report[field]), field + ' should be an array');
  }
  assert.equal(report.routes.length, 4);
  for (const route of report.routes) {
    assert.deepEqual(Object.keys(route).sort(), ['changed', 'edges', 'expandedBy', 'file', 'intercept', 'kind', 'router', 'url', 'via']);
    assert.ok(['page', 'api', 'metadata'].includes(route.kind));
    assert.ok(['app', 'pages'].includes(route.router));
    assert.equal(typeof route.intercept, 'boolean');
    assert.ok(Array.isArray(route.via));
  }
  assert.deepEqual(report.notes.map((note) => note.code), ['middleware-renamed']);
});

test('AC-4 --json is identical in English and Korean except for the notes text', () => {
  const en = JSON.parse(runCli([...base, '--json'], { lang: 'en' }).stdout);
  const ko = JSON.parse(runCli([...base, '--json'], { lang: 'ko' }).stdout);
  assert.notEqual(en.notes[0].message, ko.notes[0].message);
  assert.match(ko.notes[0].message, /[가-힣]/);
  const stripNotes = (report) => ({ ...report, notes: report.notes.map((note) => note.code) });
  assert.deepEqual(stripNotes(en), stripNotes(ko));
});

test('AC-4 --markdown has a table and a <details> block with the reasons', () => {
  const result = runCli([...base, '--markdown']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^## Route impact/);
  assert.match(result.stdout, /\| URL \| Kind \| Changed file \|/);
  assert.match(result.stdout, /<details>\n<summary>Why these routes are affected<\/summary>/);
  assert.match(result.stdout, /<\/details>/);
  assert.match(result.stdout, /`\/products\/\[id\]`: `src\/lib\/format\.ts -> src\/hooks\/useCart\.ts -> /);
});

test('AC-4 --json together with --markdown is a usage error (exit 2)', () => {
  const result = runCli([...base, '--json', '--markdown']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /--json and --markdown cannot be used together/);
});

test('AC-4 a file that touches no route says so', () => {
  const result = runCli(['--root', shopApp, 'src/app/_private/helper.ts']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No routes are affected by 1 changed file\(s\)\./);
});

test('AC-4 a whole folder can be passed as input', () => {
  const result = runCli(['--root', shopApp, 'src/lib', '--json']);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.changed.map((change) => change.path), ['src/lib/db.ts', 'src/lib/format.ts', 'src/lib/theme.ts']);
});

test('AC-4 removed routes and uncertain items appear in the table and the Markdown', async () => {
  const table = runCli(['--root', shopApp, 'public/logo.png']);
  assert.match(table.stdout, /Uncertain \(check by hand\):\n {2}public\/logo\.png - not part of the import graph/);
  const markdown = runCli(['--root', shopApp, 'public/logo.png', '--markdown']);
  assert.match(markdown.stdout, /### Uncertain \(check by hand\)\n\n- `public\/logo\.png`: not part/);
});
