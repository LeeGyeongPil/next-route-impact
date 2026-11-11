import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Remove // and block comments and trailing commas from JSONC text (tsconfig.json style). */
export function stripJsonc(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** Collect `compilerOptions.paths` keys of a tsconfig and of the tsconfigs it extends by relative path. */
export function readPathAliases(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(readFileSync(file, 'utf8')));
  } catch {
    return [];
  }
  const obj = parsed as { extends?: unknown; compilerOptions?: { paths?: Record<string, unknown> } };
  const aliases = Object.keys(obj.compilerOptions?.paths ?? {});
  const parents = Array.isArray(obj.extends) ? obj.extends : obj.extends ? [obj.extends] : [];
  for (const parent of parents) {
    if (typeof parent !== 'string' || !parent.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(file), parent);
    for (const candidate of [resolved, resolved + '.json']) {
      aliases.push(...readPathAliases(candidate, seen));
    }
  }
  return aliases;
}

/** Does `specifier` look like it was meant to go through one of the tsconfig path aliases? */
export function matchesAlias(specifier: string, aliases: readonly string[]): boolean {
  return aliases.some((alias) => {
    const star = alias.indexOf('*');
    if (star < 0) return specifier === alias;
    const prefix = alias.slice(0, star);
    return prefix !== '' && specifier.startsWith(prefix);
  });
}
