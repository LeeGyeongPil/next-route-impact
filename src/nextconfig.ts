import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isFile } from './fsutil.js';

const CONFIG_NAMES = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts', 'next.config.mts'];

export type PageExtensionsRead =
  | { type: 'none' }
  | { type: 'static'; values: string[] }
  | { type: 'computed'; file: string };

/**
 * Read `pageExtensions` from next.config.* WITHOUT running it: only a literal array of plain strings is understood.
 * Anything else (a variable, a spread, a function call) is reported as "computed".
 */
export function readPageExtensions(root: string): PageExtensionsRead {
  for (const name of CONFIG_NAMES) {
    const file = path.join(root, name);
    if (!isFile(file)) continue;
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Drop comments so a commented-out line is not mistaken for the real setting.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const key = /\bpageExtensions\s*:\s*/.exec(code);
    if (!key) {
      // Shorthand (`{ pageExtensions }`), spread or similar: the word is there but no literal value can be read.
      if (/\bpageExtensions\b/.test(code)) return { type: 'computed', file: name };
      continue;
    }
    const rest = code.slice(key.index + key[0].length);
    const literal = /^\[([^\]]*)\]/.exec(rest);
    if (!literal) return { type: 'computed', file: name };
    const values: string[] = [];
    for (const item of (literal[1] as string).split(',')) {
      const trimmed = item.trim();
      if (trimmed === '') continue;
      const str = /^(['"`])([^'"`$\\]*)\1$/.exec(trimmed);
      if (!str) return { type: 'computed', file: name };
      values.push(str[2] as string);
    }
    return { type: 'static', values };
  }
  return { type: 'none' };
}
