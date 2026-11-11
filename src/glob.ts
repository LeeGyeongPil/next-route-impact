/**
 * Tiny glob support (no dependencies, works on Node 20):
 *   *  anything except "/"      **  anything including "/"      ?  one character except "/"
 *   {a,b}  alternatives         a trailing "/**" also matches the folder itself
 */
const cache = new Map<string, RegExp>();

export function globToRegExp(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;
  let out = '';
  let braceDepth = 0;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i] as string;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        const atEnd = i + 2 === pattern.length;
        if (atEnd && out.endsWith('/')) {
          // "dir/**" matches "dir" itself and everything below it.
          out = out.slice(0, -1) + '(?:/.*)?';
        } else if (pattern[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
          continue;
        } else {
          out += '.*';
        }
        i += 1;
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else if (ch === '{') {
      braceDepth++;
      out += '(?:';
    } else if (ch === '}' && braceDepth > 0) {
      braceDepth--;
      out += ')';
    } else if (ch === ',' && braceDepth > 0) {
      out += '|';
    } else {
      out += ch.replace(/[.+^$()|[\]\\{}]/g, '\\$&');
    }
  }
  while (braceDepth-- > 0) out += ')';
  const re = new RegExp('^' + out + '$');
  cache.set(pattern, re);
  return re;
}

export function matchGlob(pattern: string, text: string): boolean {
  return globToRegExp(pattern).test(text);
}

export function matchAny(patterns: readonly string[], text: string): string | undefined {
  return patterns.find((pattern) => matchGlob(pattern, text));
}
