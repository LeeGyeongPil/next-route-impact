// AC-3: --git input. Repositories are created in a temp folder during the test; no .git fixture lives in this repo.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cleanupAll, findGitFolders, git, makeGitRepo, repoRoot, runCli, smallApp } from './helpers.mjs';

after(cleanupAll);

function gitJson(cwd, extra = []) {
  const result = runCli(['--git', '--json', ...extra], { cwd });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const urls = (report) => report.routes.map((route) => route.url);

test('AC-3 an unstaged edit is found', () => {
  const repo = makeGitRepo(smallApp);
  writeFileSync(path.join(repo, 'src/lib/shared.ts'), 'export const shared = 2;\n');
  const report = gitJson(repo);
  assert.deepEqual(urls(report), ['/']);
  assert.deepEqual(report.changed, [{ path: 'src/lib/shared.ts', status: 'modified' }]);
});

test('AC-3 a staged edit is found', () => {
  const repo = makeGitRepo(smallApp);
  writeFileSync(path.join(repo, 'src/lib/shared.ts'), 'export const shared = 3;\n');
  git(repo, 'add', 'src/lib/shared.ts');
  assert.deepEqual(urls(gitJson(repo)), ['/']);
});

test('AC-3 a committed change on a branch is found through the merge-base', () => {
  const repo = makeGitRepo(smallApp);
  git(repo, 'checkout', '-q', '-b', 'feature');
  writeFileSync(path.join(repo, 'src/lib/shared.ts'), 'export const shared = 4;\n');
  git(repo, 'commit', '-q', '-am', 'change');
  assert.deepEqual(urls(gitJson(repo, ['--base', 'main'])), ['/']);
});

test('AC-3 an untracked new page is found', () => {
  const repo = makeGitRepo(smallApp);
  mkdirSync(path.join(repo, 'src/app/new'), { recursive: true });
  writeFileSync(path.join(repo, 'src/app/new/page.tsx'), 'export default function New() { return 3; }\n');
  const report = gitJson(repo);
  assert.deepEqual(urls(report), ['/new']);
  assert.equal(report.changed[0].status, 'added');
});

test('AC-3 a renamed page is analysed at its new path and the old route is removed', () => {
  const repo = makeGitRepo(smallApp);
  mkdirSync(path.join(repo, 'src/app/fresh'), { recursive: true });
  git(repo, 'mv', 'src/app/old/page.tsx', 'src/app/fresh/page.tsx');
  const report = gitJson(repo);
  assert.deepEqual(urls(report), ['/fresh']);
  assert.deepEqual(report.removedRoutes, [{ kind: 'page', url: '/old', router: 'app', file: 'src/app/old/page.tsx' }]);
  assert.deepEqual(report.changed, [{ path: 'src/app/fresh/page.tsx', status: 'renamed', oldPath: 'src/app/old/page.tsx' }]);
});

test('AC-3 a rename that is not staged shows up as a deleted page plus a new page', () => {
  const repo = makeGitRepo(smallApp);
  mkdirSync(path.join(repo, 'src/app/fresh'), { recursive: true });
  renameSync(path.join(repo, 'src/app/old/page.tsx'), path.join(repo, 'src/app/fresh/page.tsx'));
  const report = gitJson(repo);
  assert.deepEqual(urls(report), ['/fresh']);
  assert.deepEqual(report.removedRoutes.map((route) => route.url), ['/old']);
});

test('AC-3 a deleted page is a removed route', () => {
  const repo = makeGitRepo(smallApp);
  rmSync(path.join(repo, 'src/app/about/page.tsx'));
  const report = gitJson(repo);
  assert.deepEqual(urls(report), []);
  assert.deepEqual(report.removedRoutes.map((route) => route.url), ['/about']);
});

test('AC-3 a deleted lib is uncertain with reason "deleted"', () => {
  const repo = makeGitRepo(smallApp);
  rmSync(path.join(repo, 'src/lib/shared.ts'));
  const report = gitJson(repo);
  assert.deepEqual(report.uncertain, [{ file: 'src/lib/shared.ts', reason: 'deleted' }]);
});

test('AC-3 the default base falls back when no remote exists, and a clean tree reports nothing', () => {
  const repo = makeGitRepo(smallApp);
  const result = runCli(['--git'], { cwd: repo });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No routes are affected/);
});

test('AC-3 monorepo: --root apps/web normalises paths to the app root', () => {
  const files = {};
  for (const [rel, content] of Object.entries(smallApp)) files['apps/web/' + rel] = content;
  files['packages/ui/index.ts'] = 'export const ui = 1;\n';
  const repo = makeGitRepo(files);
  writeFileSync(path.join(repo, 'apps/web/src/lib/shared.ts'), 'export const shared = 5;\n');
  writeFileSync(path.join(repo, 'packages/ui/index.ts'), 'export const ui = 2;\n');
  mkdirSync(path.join(repo, 'apps/web/src/app/extra'), { recursive: true });
  writeFileSync(path.join(repo, 'apps/web/src/app/extra/page.tsx'), 'export default function Extra() { return 4; }\n');
  const report = gitJson(repo, ['--root', 'apps/web']);
  assert.deepEqual(report.changed.map((change) => change.path), ['src/app/extra/page.tsx', 'src/lib/shared.ts']);
  assert.deepEqual(urls(report), ['/', '/extra']);
});

test('AC-3 no .git folder is committed inside this repository', () => {
  for (const folder of ['test', 'examples', 'src', 'scripts']) {
    assert.deepEqual(findGitFolders(path.join(repoRoot, folder)), [], folder + ' contains a .git folder');
  }
});
