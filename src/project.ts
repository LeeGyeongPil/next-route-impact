import { realpathSync } from 'node:fs';
import path from 'node:path';
import { ImpactError } from './errors.js';
import { isDirectory, isFile, toPosix } from './fsutil.js';

export interface ProjectLayout {
  /** Absolute, symlink-resolved app root. */
  root: string;
  /** "app" or "src/app" (relative to root), or null. */
  appDir: string | null;
  /** "pages" or "src/pages", or null. */
  pagesDir: string | null;
  /** Folders (relative to root, "" = root) where proxy.* / middleware.* are looked up. */
  proxyDirs: string[];
  /** tsconfig path relative to root, if any. */
  tsconfig: string | null;
}

/** Resolve the app root and find app/ and pages/ (root first, then src/, like Next.js). */
export function loadProject(rootInput: string, tsconfigOption?: string, label: string = rootInput): ProjectLayout {
  if (!isDirectory(rootInput)) throw new ImpactError('error.rootNotFound', { root: label }, 1);
  const root = realpathSync(rootInput);
  const pick = (name: string): string | null => {
    for (const candidate of [name, 'src/' + name]) {
      if (isDirectory(path.join(root, candidate))) return candidate;
    }
    return null;
  };
  const appDir = pick('app');
  const pagesDir = pick('pages');
  if (appDir === null && pagesDir === null) throw new ImpactError('error.noRoutes', { root: label }, 1);

  let tsconfig: string | null = null;
  const candidates = tsconfigOption ? [tsconfigOption] : ['tsconfig.json', 'jsconfig.json'];
  for (const candidate of candidates) {
    if (isFile(path.join(root, candidate))) {
      tsconfig = toPosix(candidate);
      break;
    }
  }
  return { root, appDir, pagesDir, proxyDirs: ['', 'src'], tsconfig };
}
