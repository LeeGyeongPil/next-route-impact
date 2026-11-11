// Shared test helpers: run the built CLI with a fixed language, build temp app trees and temp git repos.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const cliPath = path.join(repoRoot, 'dist', 'cli.js');
export const shopApp = path.join(repoRoot, 'examples', 'shop-app');
export const apiUrl = new URL('../dist/index.js', import.meta.url).href;

const LANGUAGE_ENV = ['ROUTE_IMPACT_LANG', 'LC_ALL', 'LC_MESSAGES', 'LANG', 'LANGUAGE'];

/** Environment for child processes: no language variables, no user git config. */
export function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const name of LANGUAGE_ENV) delete env[name];
  return {
    ...env,
    LANG: 'C',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    ...extra,
  };
}

/**
 * Run the CLI. The language is always pinned with --lang (pass lang: null to test env-based detection),
 * and language environment variables are cleared so the host locale cannot change results.
 */
export function runCli(args, { lang = 'en', cwd = repoRoot, env = {} } = {}) {
  const fullArgs = lang === null ? args : ['--lang', lang, ...args];
  const result = spawnSync(process.execPath, [cliPath, ...fullArgs], {
    cwd,
    env: cleanEnv(env),
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function tmpBase() {
  return process.env.ROUTE_IMPACT_TEST_TMPDIR || os.tmpdir();
}

const created = [];

/** Create a temp folder with the given { "relative/path": "content" } files. Returns the real path. */
export function makeTree(files, prefix = 'nri-') {
  const dir = realpathSync(mkdtempSync(path.join(tmpBase(), prefix)));
  created.push(dir);
  writeTree(dir, files);
  return dir;
}

export function writeTree(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

export function removeTemp(dir) {
  rmSync(dir, { recursive: true, force: true });
}

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

export function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    env: cleanEnv(GIT_ENV),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Create a temp git repository (no template hooks, isolated config) containing `files`, committed on "main". */
export function makeGitRepo(files) {
  const dir = makeTree(files, 'nri-git-');
  git(dir, 'init', '--template=', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

/** Small Next.js app used by several tests (App Router + a shared lib). */
export const smallApp = {
  'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }\n',
  'src/lib/shared.ts': 'export const shared = 1;\n',
  'src/app/page.tsx': "import { shared } from '@/lib/shared';\nexport default function Home() { return shared; }\n",
  'src/app/old/page.tsx': 'export default function Old() { return 1; }\n',
  'src/app/about/page.tsx': 'export default function About() { return 2; }\n',
};

export function cleanupAll() {
  for (const dir of created.splice(0)) removeTemp(dir);
}

/** Collect every path below `dir` whose name is ".git" (to prove no git fixture is committed). */
export function findGitFolders(dir) {
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.name === '.git') found.push(full);
      else if (entry.isDirectory()) visit(full);
    }
  };
  visit(dir);
  return found;
}

export async function loadApi() {
  return import(apiUrl);
}
