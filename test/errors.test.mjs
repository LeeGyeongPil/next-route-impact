// AC-8: every error path, in English and Korean, matches the message catalog exactly.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import path from 'node:path';
import { cleanupAll, git, makeGitRepo, makeTree, runCli, shopApp, smallApp, writeTree } from './helpers.mjs';

const { tr } = await import(new URL('../dist/i18n/index.js', import.meta.url).href);
after(cleanupAll);

const appOnly = { 'src/app/page.tsx': 'export default function P() { return null; }\n' };
const notAnApp = makeTree({ 'readme.txt': 'no routes here\n' });
const plainApp = makeTree(appOnly);
const brokenConfig = makeTree({ ...appOnly, 'next-route-impact.config.json': '{ "tests": \n' });
const wrongShapeConfig = makeTree({ ...appOnly, 'next-route-impact.config.json': '{ "tests": 5 }\n' });
const unrelatedHistory = makeGitRepo(smallApp);
git(unrelatedHistory, 'checkout', '-q', '--orphan', 'unrelated');
writeTree(unrelatedHistory, { 'other.txt': 'x\n' });
git(unrelatedHistory, 'add', 'other.txt');
git(unrelatedHistory, 'commit', '-q', '-m', 'unrelated root');
const plainRepo = makeGitRepo(smallApp);

// Each case: how to run the CLI, the catalog id and params it must print, and the exit code.
const cases = [
  { name: 'unknown option', args: ['--bogus'], id: 'error.unknownOption', params: { option: '--bogus' }, exit: 2 },
  { name: 'option without its value', args: ['--root', shopApp, 'a.ts', '--base'], id: 'error.missingValue', params: { option: '--base' }, exit: 2 },
  { name: 'invalid --lang', args: ['--lang', 'xx', 'a.ts'], noLangFlag: true, id: 'error.invalidLang', params: { value: 'xx' }, exit: 2 },
  { name: 'conflicting formats', args: ['--json', '--markdown', 'a.ts'], id: 'error.formatConflict', params: {}, exit: 2 },
  { name: 'no input', args: ['--root', shopApp], id: 'error.noInput', params: {}, exit: 2 },
  { name: 'root does not exist', args: ['--root', '/nonexistent/next-route-impact-root', 'a.ts'], id: 'error.rootNotFound', params: { root: '/nonexistent/next-route-impact-root' }, exit: 1 },
  { name: 'folder without app/ or pages/', args: ['--root', notAnApp, 'a.ts'], id: 'error.noRoutes', params: { root: notAnApp }, exit: 1 },
  { name: 'not a git repository', args: ['--root', plainApp, '--git'], id: 'error.notGitRepo', params: { root: plainApp }, exit: 1 },
  { name: 'base ref does not exist', args: ['--root', plainRepo, '--git', '--base', 'no-such-ref'], id: 'error.baseNotFound', params: { base: 'no-such-ref' }, exit: 1 },
  { name: 'no merge-base (shallow or unrelated history)', args: ['--root', unrelatedHistory, '--git', '--base', 'main'], id: 'error.noMergeBase', params: { base: 'main' }, exit: 1 },
  { name: 'config JSON syntax error', args: ['--root', brokenConfig, 'src/app/page.tsx'], id: 'error.configSyntax', params: { file: 'next-route-impact.config.json' }, exit: 1 },
  { name: 'config has the wrong shape', args: ['--root', wrongShapeConfig, 'src/app/page.tsx'], id: 'error.configShape', params: { file: 'next-route-impact.config.json', field: 'tests' }, exit: 1 },
  { name: '--tests without a mapping', args: ['--root', plainApp, 'src/app/page.tsx', '--tests'], id: 'error.testsNoMapping', params: {}, exit: 2 },
];

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const ENGLISH_ORIGINALS = [/Unknown option/i, /argument missing/i, /does not take an argument/i, /fatal:/i, /not a git repository/i, /ERR_PARSE_ARGS/, /bad revision/i, /Unexpected token/i];

test('AC-8 there are 13 error paths', () => {
  assert.equal(cases.length, 13);
});

for (const item of cases) {
  for (const lang of ['en', 'ko']) {
    test('AC-8 ' + item.name + ' [' + lang + ']', () => {
      // The language is pinned with --lang, except for the invalid --lang case where the environment decides.
      const result = item.noLangFlag
        ? runCli(item.args, { lang: null, env: { ROUTE_IMPACT_LANG: lang } })
        : runCli(item.args, { lang });
      const expected = tr(lang, item.id, item.params) + '\n';
      assert.equal(result.stderr, expected);
      assert.equal(result.status, item.exit);
      assert.equal(result.stdout, '');
      assert.doesNotMatch(result.stderr, /\n\s+at .*[:(]\d+/, 'no stack trace');
      assert.doesNotMatch(result.stderr, /Error:/, 'no raw error class name');
      if (lang === 'en') {
        assert.doesNotMatch(result.stderr, HANGUL);
      } else {
        assert.match(result.stderr, HANGUL);
        for (const pattern of ENGLISH_ORIGINALS) assert.doesNotMatch(result.stderr, pattern);
      }
    });
  }
}

test('AC-8 a flag that must not carry a value, and a short unknown option, are catalog errors too', () => {
  for (const lang of ['en', 'ko']) {
    const withValue = runCli(['--git=yes'], { lang });
    assert.equal(withValue.stderr, tr(lang, 'error.unexpectedValue', { option: '--git' }) + '\n');
    assert.equal(withValue.status, 2);
    const short = runCli(['-x'], { lang });
    assert.equal(short.stderr, tr(lang, 'error.unknownOption', { option: '-x' }) + '\n');
    assert.equal(short.status, 2);
  }
});

test('AC-8 a missing --config file is a catalog error', () => {
  const missing = path.join(plainApp, 'nope.json');
  for (const lang of ['en', 'ko']) {
    const result = runCli(['--root', plainApp, 'src/app/page.tsx', '--config', missing], { lang });
    assert.equal(result.stderr, tr(lang, 'error.configNotFound', { file: missing }) + '\n');
    assert.equal(result.status, 1);
  }
});

test('AC-8 the Korean and English catalogs have no leftover {placeholders} in the printed messages', () => {
  for (const item of cases) {
    for (const lang of ['en', 'ko']) assert.doesNotMatch(tr(lang, item.id, item.params), /\{\w+\}/);
  }
});

// Round 2 regressions (Q-6, Q-7): typos and unreadable folders are catalog errors, not silent "deleted" or raw Node text.
test('AC-6 a file argument that does not exist is a usage error, not a "deleted" report', () => {
  for (const lang of ['en', 'ko']) {
    const result = runCli(['--root', shopApp, 'src/lib/fromat.ts'], { lang });
    assert.equal(result.stderr, tr(lang, 'error.fileNotFound', { file: 'src/lib/fromat.ts' }) + '\n');
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    if (lang === 'ko') assert.match(result.stderr, HANGUL);
    else assert.doesNotMatch(result.stderr, HANGUL);
  }
});

test('AC-8 an unreadable folder inside the app is a catalog error in both languages', (t) => {
  if (typeof process.getuid === 'function' && process.getuid() === 0) return t.skip('root can read everything');
  const app = makeTree({ ...appOnly, 'src/locked/a.ts': 'export const a = 1;\n' });
  chmodSync(path.join(app, 'src/locked'), 0o000);
  try {
    for (const lang of ['en', 'ko']) {
      const result = runCli(['--root', app, 'src/app/page.tsx'], { lang });
      assert.equal(result.stderr, tr(lang, 'error.unreadableDir', { dir: 'src/locked' }) + '\n');
      assert.equal(result.status, 1);
      assert.doesNotMatch(result.stderr, /EACCES|scandir|permission denied,/);
      if (lang === 'ko') assert.match(result.stderr, HANGUL);
      else assert.doesNotMatch(result.stderr, HANGUL);
    }
  } finally {
    chmodSync(path.join(app, 'src/locked'), 0o755);
  }
});
