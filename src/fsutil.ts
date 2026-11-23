import { readdirSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { ImpactError } from './errors.js';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.turbo', '.vercel']);

export const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** All regular files below `root` (POSIX relative paths), skipping node_modules, .next, .git and symlinks. */
export function walkFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      throw new ImpactError('error.unreadableDir', { dir: toPosix(path.relative(root, dir)) || '.' });
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        out.push(toPosix(path.relative(root, path.join(dir, entry.name))));
      }
    }
  };
  visit(root);
  return out.sort();
}

export function isSourceFile(rel: string): boolean {
  return SOURCE_EXTENSIONS.includes(path.posix.extname(rel));
}

/** Extensions whose files are read with the light-weight MDX import scan instead of a JS parser. */
export const MARKDOWN_EXTENSIONS = ['.mdx', '.md'];

export function isMarkdownFile(rel: string): boolean {
  return MARKDOWN_EXTENSIONS.includes(path.posix.extname(rel));
}

/** Values that `normalizePageExtensions` drops (for example "page.tsx"). */
export function droppedPageExtensions(values: string[]): string[] {
  return values.filter((value) => !/^\.[A-Za-z0-9]+$/.test('.' + value.replace(/^\./, '')));
}

/**
 * Normalise `pageExtensions` values ("mdx", ".mdx") to dotted form (".mdx").
 * Entries that are not a plain extension (for example "page.tsx") are dropped.
 */
export function normalizePageExtensions(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const ext = '.' + value.replace(/^\./, '');
    if (/^\.[A-Za-z0-9]+$/.test(ext) && !out.includes(ext)) out.push(ext);
  }
  return out;
}
