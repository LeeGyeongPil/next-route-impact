import { execFileSync } from 'node:child_process';
import { ImpactError } from './errors.js';
import { normalize } from './impact.js';
import type { ChangedFile } from './types.js';

interface GitResult {
  ok: boolean;
  stdout: string;
  missing: boolean;
}

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): GitResult {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    });
    return { ok: true, stdout, missing: false };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, stdout: '', missing: code === 'ENOENT' };
  }
}

/** Candidate base refs when --base is not given. */
const DEFAULT_BASES = ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master'];

function refExists(cwd: string, ref: string): boolean {
  return git(cwd, ['rev-parse', '--verify', '--quiet', ref + '^{commit}']).ok;
}

/** Split NUL-separated output without the trailing empty item. */
function splitNul(text: string): string[] {
  const parts = text.split('\0');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

/**
 * Files changed since the merge-base with `base`, plus staged, unstaged and untracked files.
 * Paths are relative to `cwd` (the app root), so a monorepo sub-app works with --root apps/web.
 * Errors are reported as ImpactError codes; git's own (localized) text is never shown.
 */
export function gitChangedFiles(cwd: string, base?: string): ChangedFile[] {
  const inside = git(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (inside.missing) throw new ImpactError('error.gitMissing', {}, 1);
  if (!inside.ok || inside.stdout.trim() !== 'true') throw new ImpactError('error.notGitRepo', { root: cwd }, 1);

  let baseRef: string;
  if (base !== undefined) {
    if (!refExists(cwd, base)) throw new ImpactError('error.baseNotFound', { base }, 1);
    baseRef = base;
  } else {
    baseRef = DEFAULT_BASES.find((candidate) => refExists(cwd, candidate)) ?? 'HEAD';
  }
  if (!refExists(cwd, 'HEAD')) throw new ImpactError('error.gitFailed', { root: cwd }, 1);
  if (!git(cwd, ['merge-base', baseRef, 'HEAD']).ok) throw new ImpactError('error.noMergeBase', { base: baseRef }, 1);

  const diff = git(cwd, ['diff', '--name-status', '-z', '-M', '--merge-base', baseRef, '--relative']);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (!diff.ok || !untracked.ok) throw new ImpactError('error.gitFailed', { root: cwd }, 1);

  const changes = new Map<string, ChangedFile>();
  const tokens = splitNul(diff.stdout);
  for (let i = 0; i < tokens.length; ) {
    const status = tokens[i++] as string;
    const letter = status[0];
    if (letter === 'R' || letter === 'C') {
      const oldPath = normalize(tokens[i++] as string);
      const newPath = normalize(tokens[i++] as string);
      changes.set(newPath, letter === 'R' ? { path: newPath, status: 'renamed', oldPath } : { path: newPath, status: 'added' });
    } else {
      const file = normalize(tokens[i++] as string);
      const mapped = letter === 'D' ? 'deleted' : letter === 'A' ? 'added' : 'modified';
      changes.set(file, { path: file, status: mapped });
    }
  }
  for (const file of splitNul(untracked.stdout)) {
    const normalized = normalize(file);
    if (!changes.has(normalized)) changes.set(normalized, { path: normalized, status: 'added' });
  }
  return [...changes.values()].sort((a, b) => a.path.localeCompare(b.path));
}
