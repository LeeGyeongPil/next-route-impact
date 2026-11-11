// AC-7: English and Korean output, language precedence and catalog parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli, shopApp } from './helpers.mjs';

const i18nUrl = new URL('../dist/i18n/index.js', import.meta.url).href;
const { en } = await import(new URL('../dist/i18n/en.js', import.meta.url).href);
const { ko } = await import(new URL('../dist/i18n/ko.js', import.meta.url).href);
const { resolveLang } = await import(i18nUrl);

const HANGUL = /[가-힣]/;
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('AC-7 en and ko catalogs have the same ids and the same placeholders per id', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  for (const id of Object.keys(en)) {
    assert.deepEqual(placeholders(ko[id]), placeholders(en[id]), 'placeholders differ for ' + id);
    assert.notEqual(ko[id].trim(), '', id + ' is empty in ko');
  }
});

test('AC-7 English messages contain no Hangul', () => {
  for (const [id, text] of Object.entries(en)) assert.doesNotMatch(text, HANGUL, id);
});

test('AC-7 --help is localized', () => {
  const english = runCli(['--help'], { lang: 'en' });
  const korean = runCli(['--help'], { lang: 'ko' });
  assert.equal(english.status, 0);
  assert.doesNotMatch(english.stdout, HANGUL);
  assert.match(english.stdout, /Usage:/);
  assert.match(korean.stdout, /사용법:/);
  assert.match(korean.stdout, HANGUL);
});

test('AC-7 table headers, Markdown and warnings are localized', () => {
  const args = ['--root', shopApp, 'src/lib/format.ts', 'public/logo.png'];
  const english = runCli(args, { lang: 'en' }).stdout;
  const korean = runCli(args, { lang: 'ko' }).stdout;
  assert.doesNotMatch(english, HANGUL);
  assert.match(english, /^URL\s+KIND\s+REASON$/m);
  assert.match(english, /Uncertain \(check by hand\)/);
  assert.match(korean, /^URL\s+종류\s+이유$/m);
  assert.match(korean, /불확실 \(직접 확인 필요\)/);

  const markdownEn = runCli([...args, '--markdown'], { lang: 'en' }).stdout;
  const markdownKo = runCli([...args, '--markdown'], { lang: 'ko' }).stdout;
  assert.doesNotMatch(markdownEn, HANGUL);
  assert.match(markdownEn, /^## Route impact/);
  assert.match(markdownKo, /^## 라우트 영향/);
  assert.match(markdownKo, /<summary>이 라우트들이 영향받는 이유<\/summary>/);
});

test('AC-7 Korean table keeps its columns aligned (wide characters count as two columns)', () => {
  const lines = runCli(['--root', shopApp, 'src/lib/format.ts'], { lang: 'ko' }).stdout.split('\n');
  const header = lines.find((line) => line.startsWith('URL'));
  const row = lines.find((line) => line.startsWith('/legacy'));
  // The KIND column starts after the same 22-column URL column in both lines.
  const columnOf = (line, text) => [...line.slice(0, line.indexOf(text))].reduce((sum, ch) => sum + (/[가-힣]/.test(ch) ? 2 : 1), 0);
  assert.equal(columnOf(header, '종류'), columnOf(row, '페이지'));
});

const precedence = [
  { name: 'ko_KR.UTF-8 in LANG', env: { LANG: 'ko_KR.UTF-8' }, expected: 'ko' },
  { name: 'fr_FR in LANG', env: { LANG: 'fr_FR.UTF-8' }, expected: 'en' },
  { name: 'C in LANG', env: { LANG: 'C' }, expected: 'en' },
  { name: 'nothing set', env: {}, expected: 'en' },
  { name: 'LC_MESSAGES beats LANG', env: { LANG: 'en_US.UTF-8', LC_MESSAGES: 'ko_KR.UTF-8' }, expected: 'ko' },
  { name: 'LC_ALL beats LC_MESSAGES', env: { LC_ALL: 'C', LC_MESSAGES: 'ko_KR.UTF-8', LANG: 'ko_KR.UTF-8' }, expected: 'en' },
  { name: 'ROUTE_IMPACT_LANG beats LC_ALL', env: { ROUTE_IMPACT_LANG: 'ko', LC_ALL: 'en_US.UTF-8' }, expected: 'ko' },
  { name: 'ROUTE_IMPACT_LANG=en beats a Korean LANG', env: { ROUTE_IMPACT_LANG: 'en', LANG: 'ko_KR.UTF-8' }, expected: 'en' },
  { name: 'empty variables are skipped', env: { LC_ALL: '', LANG: 'ko_KR.UTF-8' }, expected: 'ko' },
  { name: '--lang beats every variable', flag: 'en', env: { ROUTE_IMPACT_LANG: 'ko', LANG: 'ko_KR.UTF-8' }, expected: 'en' },
  { name: '--lang ko beats an English environment', flag: 'ko', env: { LANG: 'en_US.UTF-8' }, expected: 'ko' },
];

for (const item of precedence) {
  test('AC-7 precedence: ' + item.name, () => {
    assert.equal(resolveLang(item.flag, item.env), item.expected);
  });
}

test('AC-7 precedence also holds end to end through the CLI', () => {
  const run = (env) => runCli(['--help'], { lang: null, env });
  assert.match(run({ LANG: 'ko_KR.UTF-8' }).stdout, /사용법:/);
  assert.match(run({ LANG: 'C' }).stdout, /Usage:/);
  assert.match(run({ ROUTE_IMPACT_LANG: 'ko', LANG: 'C' }).stdout, /사용법:/);
  assert.match(runCli(['--help'], { lang: 'en', env: { ROUTE_IMPACT_LANG: 'ko' } }).stdout, /Usage:/);
});

test('AC-7 the test helper does not leak the host locale (runs the same with LANG unset)', () => {
  const result = runCli(['--root', shopApp, 'src/lib/format.ts', '--json'], { lang: 'en', env: { LANG: '' } });
  assert.equal(result.status, 0);
});
