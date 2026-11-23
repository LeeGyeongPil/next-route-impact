// pageExtensions: MDX pages as route entries, MDX imports in the graph, config-file precedence, no-config regression.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAll, loadApi, makeTree, runCli } from './helpers.mjs';

const { analyze } = await loadApi();
after(cleanupAll);

const modified = (...paths) => paths.map((p) => ({ path: p, status: 'modified' }));

const mdxApp = (extra = {}) => ({
  'next.config.mjs': "export default { pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'] };\n",
  'app/layout.tsx': 'export default function L({ children }) { return children; }\n',
  'app/guide/page.mdx':
    "import D from '../../components/D';\nimport type { T } from '../../components/types';\n\n# Guide\n\n```js\nimport Fake from '../../components/Fake';\n```\n\n<D />\n",
  'app/home/page.tsx': 'export default function H() { return null; }\n',
  'components/D.tsx': 'export default function D() { return null; }\n',
  'components/Fake.tsx': 'export default function F() { return null; }\n',
  'components/types.ts': 'export type T = string;\n',
  ...extra,
});

test('PE-1 a changed page.mdx is a route entry when next.config lists mdx', async () => {
  const root = makeTree(mdxApp());
  const report = await analyze({ root, changed: modified('app/guide/page.mdx') });
  assert.deepEqual(report.routes.map((r) => [r.url, r.file, r.kind]), [['/guide', 'app/guide/page.mdx', 'page']]);
  assert.deepEqual(report.uncertain, []);
  assert.deepEqual(report.notes, []);
});

test('PE-2 a component imported by page.mdx reaches the MDX route; imports in code fences are ignored', async () => {
  const root = makeTree(mdxApp());
  const hit = await analyze({ root, changed: modified('components/D.tsx') });
  assert.deepEqual(hit.routes.map((r) => r.url), ['/guide']);
  assert.deepEqual(hit.routes[0].via, ['components/D.tsx', 'app/guide/page.mdx']);
  const fenced = await analyze({ root, changed: modified('components/Fake.tsx') });
  assert.deepEqual(fenced.routes, []);
});

test('PE-3 the config file pageExtensions wins over next.config', async () => {
  const files = mdxApp({ 'next-route-impact.config.json': '{ "pageExtensions": ["tsx", "ts"] }\n' });
  const root = makeTree(files);
  const report = await analyze({ root, changed: modified('components/D.tsx'), config: { pageExtensions: ['tsx', 'ts'] } });
  assert.deepEqual(report.routes, []);
  // and the other way round: config says mdx while next.config says nothing about it
  const root2 = makeTree(mdxApp({ 'next.config.mjs': 'export default {};\n' }));
  const report2 = await analyze({ root: root2, changed: modified('components/D.tsx'), config: { pageExtensions: ['tsx', 'mdx'] } });
  assert.deepEqual(report2.routes.map((r) => r.url), ['/guide']);
});

test('PE-3 the CLI reads pageExtensions from next-route-impact.config.json', () => {
  const root = makeTree(mdxApp({ 'next.config.mjs': 'export default {};\n', 'next-route-impact.config.json': '{ "pageExtensions": ["tsx", "mdx"] }\n' }));
  const result = runCli(['--root', root, '--json', 'components/D.tsx']);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout).routes.map((r) => r.url), ['/guide']);
  const bad = makeTree({ 'app/page.tsx': 'export default function P() { return null; }\n', 'next-route-impact.config.json': '{ "pageExtensions": "mdx" }\n' });
  const failed = runCli(['--root', bad, 'app/page.tsx']);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /pageExtensions/);
});

test('PE-3 a computed pageExtensions in next.config falls back to defaults and adds a note', async () => {
  const root = makeTree(mdxApp({ 'next.config.mjs': 'const ext = ["mdx", "tsx"];\nexport default { pageExtensions: ext };\n' }));
  const report = await analyze({ root, changed: modified('components/D.tsx') });
  assert.deepEqual(report.routes, []);
  assert.deepEqual(report.notes, [{ code: 'page-extensions-not-static', params: { file: 'next.config.mjs' } }]);
  const ko = runCli(['--root', root, 'components/D.tsx'], { lang: 'ko' });
  assert.match(ko.stdout, /pageExtensions/);
  assert.match(ko.stdout, /계산된 값/);
});

test('PE-4 regression: without pageExtensions page.mdx is not a route and results are unchanged', async () => {
  const root = makeTree(mdxApp({ 'next.config.mjs': 'export default {};\n' }));
  const direct = await analyze({ root, changed: modified('app/guide/page.mdx') });
  assert.deepEqual(direct.routes, []);
  assert.deepEqual(direct.uncertain, [{ file: 'app/guide/page.mdx', reason: 'outside-graph' }]);
  const viaComponent = await analyze({ root, changed: modified('components/D.tsx') });
  assert.deepEqual(viaComponent.routes, []);
  assert.deepEqual(viaComponent.notes, []);
});

test('PE-4 pageExtensions without mdx keeps a plain tsx app working (pages router too)', async () => {
  const root = makeTree({
    'next.config.js': "module.exports = { pageExtensions: ['tsx', 'ts'] };\n",
    'pages/index.tsx': "import { x } from '../lib/x';\nexport default function I() { return x; }\n",
    'pages/readme.mdx': '# not a page here\n',
    'lib/x.ts': 'export const x = 1;\n',
  });
  const report = await analyze({ root, changed: modified('lib/x.ts') });
  assert.deepEqual(report.routes.map((r) => r.url), ['/']);
});

test('PE-5 (Q-1) a changed page.md is analysed when md is listed; a custom ignore still wins', async () => {
  const files = mdxApp({
    'next.config.mjs': "export default { pageExtensions: ['ts', 'tsx', 'md'] };\n",
    'app/docs/page.md': "import D from '../../components/D';\n\n# Docs\n",
  });
  const root = makeTree(files);
  const report = await analyze({ root, changed: modified('app/docs/page.md') });
  assert.deepEqual(report.routes.map((r) => [r.url, r.file]), [['/docs', 'app/docs/page.md']]);
  const other = await analyze({ root, changed: modified('README.md') });
  assert.deepEqual(other.changed, []);
  const custom = await analyze({ root, changed: modified('app/docs/page.md'), config: { ignore: ['**/*.md'] } });
  assert.deepEqual(custom.routes, []);
  const plain = makeTree({ ...files, 'next.config.mjs': 'export default {};\n' });
  assert.deepEqual((await analyze({ root: plain, changed: modified('app/docs/page.md') })).changed, []);
});

test('PE-3 (Q-2) shorthand `{ pageExtensions }` is reported as not readable', async () => {
  const root = makeTree(mdxApp({ 'next.config.mjs': "const pageExtensions = ['ts', 'tsx', 'mdx'];\nexport default { pageExtensions };\n" }));
  const report = await analyze({ root, changed: modified('components/D.tsx') });
  assert.deepEqual(report.notes, [{ code: 'page-extensions-not-static', params: { file: 'next.config.mjs' } }]);
});

test('PE-3 (Q-3) dotted pageExtensions values are dropped with a note in both languages', async () => {
  const root = makeTree(mdxApp({ 'next.config.mjs': "export default { pageExtensions: ['page.tsx', 'mdx'] };\n" }));
  const report = await analyze({ root, changed: modified('components/D.tsx') });
  assert.deepEqual(report.notes, [{ code: 'page-extensions-dropped', params: { values: 'page.tsx' } }]);
  assert.deepEqual(report.routes.map((r) => r.url), ['/guide']);
  const ko = runCli(['--root', root, 'components/D.tsx'], { lang: 'ko' });
  assert.match(ko.stdout, /page\.tsx/);
  assert.match(ko.stdout, /무시/);
});

// Q-1 (round 3): the CLI always passes loadConfig(), whose `ignore` is the default list when no `ignore` is set.
const mdPageApp = (extra = {}) =>
  mdxApp({
    'next.config.mjs': "export default { pageExtensions: ['ts', 'tsx', 'md'] };\n",
    'app/docs/page.md': "import D from '../../components/D';\n\n# Docs\n",
    'README.md': '# Readme\n',
    'e2e/docs.spec.ts': '',
    ...extra,
  });

const cliJson = (root, file) => {
  const result = runCli(['--root', root, '--json', file]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test('PE-6 (Q-1) CLI: a changed page.md reaches /docs with or without a config file; a user ignore wins', () => {
  // (a) no config file: the default ignore does not hide the Markdown page, but still hides other Markdown
  const bare = makeTree(mdPageApp());
  const a = cliJson(bare, 'app/docs/page.md');
  assert.deepEqual(a.changed.map((c) => c.path), ['app/docs/page.md']);
  assert.deepEqual(a.routes.map((r) => [r.url, r.file]), [['/docs', 'app/docs/page.md']]);
  assert.deepEqual(cliJson(bare, 'README.md').changed, []);

  // (b) a config file without `ignore` (standalone file or package.json section), and --tests selects the spec
  const tests = { tests: { '/docs': ['e2e/docs.spec.ts'] } };
  const standalone = makeTree(mdPageApp({ 'next-route-impact.config.json': JSON.stringify(tests) }));
  assert.deepEqual(cliJson(standalone, 'app/docs/page.md').routes.map((r) => r.url), ['/docs']);
  const selected = runCli(['--root', standalone, '--tests', 'app/docs/page.md']);
  assert.equal(selected.status, 0, selected.stderr);
  assert.equal(selected.stdout, 'e2e/docs.spec.ts\n');
  const inPackage = makeTree(mdPageApp({ 'package.json': JSON.stringify({ name: 'x', nextRouteImpact: tests }) }));
  assert.deepEqual(cliJson(inPackage, 'app/docs/page.md').routes.map((r) => r.url), ['/docs']);

  // (c) an `ignore` the user wrote wins, even when it lists the same patterns as the default
  for (const ignore of [['**/*.md'], ['**/*.md', '.github/**']]) {
    const custom = makeTree(mdPageApp({ 'next-route-impact.config.json': JSON.stringify({ ignore }) }));
    const c = cliJson(custom, 'app/docs/page.md');
    assert.deepEqual(c.changed, []);
    assert.deepEqual(c.routes, []);
  }

  // regression: without pageExtensions the CLI ignores page.md exactly as before
  const plain = makeTree(mdPageApp({ 'next.config.mjs': 'export default {};\n' }));
  const r = cliJson(plain, 'app/docs/page.md');
  assert.deepEqual([r.changed, r.routes, r.uncertain, r.notes], [[], [], [], []]);
});

test('PE-6 (Q-1) library: analyze() with loadConfig() matches the CLI; an edited default list is the user list', async () => {
  const { loadConfig, defaultConfig } = await loadApi();
  const root = makeTree(mdPageApp());
  const loaded = await analyze({ root, changed: modified('app/docs/page.md'), config: loadConfig(root) });
  assert.deepEqual(loaded.routes.map((r) => r.url), ['/docs']);
  const written = await analyze({ root, changed: modified('app/docs/page.md'), config: { ignore: ['**/*.md', '.github/**'] } });
  assert.deepEqual(written.routes, []);
  const edited = defaultConfig();
  edited.ignore.push('drafts/**');
  const report = await analyze({ root, changed: modified('app/docs/page.md'), config: edited });
  assert.deepEqual(report.changed, []);
});
