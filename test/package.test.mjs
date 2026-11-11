// AC-9: publishing readiness and repository hygiene.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cleanEnv, cleanupAll, findGitFolders, makeTree, repoRoot, runCli, shopApp } from './helpers.mjs';

after(cleanupAll);

const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

test('AC-9 npm pack (in a scripts-free temp copy, never in this repo) lists exactly what should ship', () => {
  assert.ok(readFileSync(path.join(repoRoot, 'dist', 'cli.js'), 'utf8').length > 0, 'run the build first');
  const copy = makeTree({}, 'nri-pack-');
  cpSync(path.join(repoRoot, 'dist'), path.join(copy, 'dist'), { recursive: true });
  cpSync(path.join(repoRoot, 'LICENSE'), path.join(copy, 'LICENSE'));
  // README files are written by the release step; stand-ins keep this test independent of them.
  writeFileSync(path.join(copy, 'README.md'), '# stand-in\n');
  writeFileSync(path.join(copy, 'README.ko.md'), '# stand-in\n');
  const { scripts, devDependencies, ...publishable } = pkg;
  void scripts;
  void devDependencies;
  writeFileSync(path.join(copy, 'package.json'), JSON.stringify(publishable, null, 2));

  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: copy,
    env: cleanEnv(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const files = JSON.parse(out)[0].files.map((file) => file.path);
  for (const expected of ['dist/cli.js', 'dist/index.js', 'dist/index.d.ts', 'README.md', 'README.ko.md', 'LICENSE', 'package.json']) {
    assert.ok(files.includes(expected), 'missing ' + expected + ' in ' + files.join(', '));
  }
  for (const file of files) {
    assert.ok(!/^(src|test|examples|scripts)\//.test(file), 'should not ship ' + file);
  }
  assert.match(readFileSync(path.join(copy, 'dist', 'cli.js'), 'utf8'), /^#!\/usr\/bin\/env node\n/);
});

test('AC-9 package metadata: bin, engines, license, exact runtime dependencies', () => {
  assert.equal(pkg.name, 'next-route-impact');
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.bin, { 'next-route-impact': 'dist/cli.js' });
  assert.equal(pkg.engines.node, '^20.19.0 || >=22.12.0');
  assert.deepEqual(pkg.dependencies, { 'oxc-parser': '0.158.0', 'oxc-resolver': '11.24.2' });
  assert.ok(!('typescript' in pkg.dependencies));
  assert.equal(pkg.devDependencies.typescript, '6.0.3');
  assert.deepEqual(pkg.files, ['dist', 'README.md', 'README.ko.md', 'LICENSE']);
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});

test('AC-9 the CI matrix runs Node 20 and 22', () => {
  const ci = readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(ci, /node:\s*\[\s*20\s*,\s*22\s*\]/);
  assert.match(ci, /node-version:\s*\$\{\{\s*matrix\.node\s*\}\}/);
  assert.match(ci, /npm ci/);
  assert.match(ci, /npm test/);
});

test('AC-9 message ids and JSON field names avoid the words key, token and secret', async () => {
  const { en } = await import(new URL('../dist/i18n/en.js', import.meta.url).href);
  const bad = /key|token|secret/i;
  for (const id of Object.keys(en)) assert.doesNotMatch(id, bad, id);
  const names = [];
  const collect = (value) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') {
      for (const [name, inner] of Object.entries(value)) {
        names.push(name);
        collect(inner);
      }
    }
  };
  const result = runCli(['--root', shopApp, 'src/lib/format.ts', 'public/logo.png', '--tests', '--json']);
  collect(JSON.parse(result.stdout));
  assert.ok(names.length > 20);
  for (const name of names) assert.doesNotMatch(name, bad, name);
});

test('AC-9 the repository has no .git fixtures and no leftover temp files at its root', () => {
  for (const folder of ['test', 'examples', 'src', 'scripts']) {
    assert.deepEqual(findGitFolders(path.join(repoRoot, folder)), []);
  }
});

test('AC-10 the start script prints the English impact table for the practice app', () => {
  const args = pkg.scripts.start.replace(/^node dist\/cli\.js /, '').split(' ');
  const result = runCli(args, { lang: null });
  assert.equal(result.status, 0, result.stderr);
  for (const url of ['/products/[id]', '/shop/[[...filters]]', '/docs/[...slug]', '/legacy']) {
    assert.ok(result.stdout.includes(url), url);
  }
  assert.match(result.stdout, /src\/hooks\/useCart\.ts/);
  assert.match(result.stdout, /^URL\s+KIND\s+REASON$/m);
});
