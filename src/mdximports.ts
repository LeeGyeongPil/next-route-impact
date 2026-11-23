/** One module request found in an MDX/Markdown file. */
export interface MdxImport {
  specifier: string;
  typeOnly: boolean;
}

/**
 * Pick the top-level `import ... from '...'`, `import '...'` and `export ... from '...'` statements of an MDX file.
 * Regex level on purpose (no MDX parser dependency): lines inside ``` or ~~~ code fences are ignored,
 * and imports inside JSX expressions are not seen.
 */
export function extractMdxImports(source: string): MdxImport[] {
  let fence: string | null = null;
  const kept = source.split(/\r?\n/).map((line) => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      const mark = (marker[1] as string)[0] as string;
      if (fence === null) fence = mark;
      else if (fence === mark) fence = null;
      return '';
    }
    return fence === null ? line : '';
  });
  const text = kept.join('\n');
  const out: MdxImport[] = [];
  const seen = new Set<string>();
  const add = (specifier: string, typeOnly: boolean): void => {
    const key = specifier + '\u0000' + String(typeOnly);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ specifier, typeOnly });
  };
  for (const match of text.matchAll(/^(import|export)\s+([^;'"`]*?)\bfrom\s*(['"])([^'"\n]+)\3/gm)) {
    add(match[4] as string, match[1] === 'import' && /^type[\s{*]/.test(match[2] as string));
  }
  for (const match of text.matchAll(/^import\s*(['"])([^'"\n]+)\1/gm)) add(match[2] as string, false);
  return out;
}
