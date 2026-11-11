import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import { ResolverFactory } from 'oxc-resolver';
import { isSourceFile, SOURCE_EXTENSIONS, toPosix, walkFiles } from './fsutil.js';
import { matchesAlias, readPathAliases } from './jsonc.js';
import type { ProjectLayout } from './project.js';
import type { EdgeKind, ParseErrorItem, UnresolvedImport } from './types.js';

/** One import seen from the importer's side, stored on the imported file. */
export interface RevEdge {
  from: string;
  kind: EdgeKind;
  /** Imported names of the target ("*" = whole module); null = unknown/all. */
  names: string[] | null;
  /** For re-exports: [importedName, exportedName] pairs, or "*" for `export * from`. */
  pairs: Array<[string, string]> | '*' | null;
}

export interface Graph {
  /** Source files (relative POSIX paths). */
  files: string[];
  /** target file -> who imports it. */
  rev: Map<string, RevEdge[]>;
  /** file -> exported names; null = unknown (CommonJS, `export *` present). */
  exportsOf: Map<string, Set<string> | null>;
  unresolved: UnresolvedImport[];
  parseErrors: ParseErrorItem[];
}

interface Request {
  specifier: string;
  kind: EdgeKind;
  names: string[] | null;
  pairs: Array<[string, string]> | '*' | null;
}

// oxc-parser module record shapes we depend on (kept in this one file on purpose: 0.x output may change).
interface NameRef {
  kind: string;
  name: string | null;
}
interface ImportEntry {
  importName: NameRef;
  isType: boolean;
}
interface StaticImport {
  start: number;
  end: number;
  moduleRequest: { value: string };
  entries: ImportEntry[];
}
interface ExportEntry {
  moduleRequest: { value: string } | null;
  importName: NameRef;
  exportName: NameRef;
  isType: boolean;
}
interface StaticExport {
  entries: ExportEntry[];
}
interface DynamicImport {
  moduleRequest: { start: number; end: number };
}

function nameOf(ref: NameRef): string {
  if (ref.kind === 'Name') return ref.name ?? '*';
  if (ref.kind === 'Default') return 'default';
  return '*';
}

function isBarePackage(specifier: string): boolean {
  return !specifier.startsWith('.') && !specifier.startsWith('/');
}

/** Read every source file below the app root, extract imports with oxc-parser, resolve them with oxc-resolver. */
export function buildGraph(layout: ProjectLayout, options: { includeTypes: boolean }): Graph {
  const root = layout.root;
  const files = walkFiles(root).filter(isSourceFile);
  const tsconfigFile = layout.tsconfig ? path.join(root, layout.tsconfig) : null;
  const aliases = tsconfigFile ? readPathAliases(tsconfigFile) : [];

  const resolver = new ResolverFactory({
    ...(tsconfigFile ? { tsconfig: { configFile: tsconfigFile, references: 'auto' as const } } : {}),
    extensions: SOURCE_EXTENSIONS,
    conditionNames: ['import', 'require', 'node', 'default'],
    mainFields: ['module', 'main'],
  });

  const rev = new Map<string, RevEdge[]>();
  const exportsOf = new Map<string, Set<string> | null>();
  const unresolved: UnresolvedImport[] = [];
  const parseErrors: ParseErrorItem[] = [];

  for (const rel of files) {
    const abs = path.join(root, rel);
    let source: string;
    try {
      source = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const parsed = parseSync(abs, source);
    if (parsed.errors.length > 0) {
      parseErrors.push({ file: rel, count: parsed.errors.length, message: parsed.errors[0]?.message ?? '' });
    }
    const requests: Request[] = [];

    for (const item of parsed.module.staticImports as unknown as StaticImport[]) {
      const wholeTypeOnly = /^import\s+type[\s{*]/.test(source.slice(item.start, item.end));
      const entries = item.entries;
      if (entries.length === 0) {
        requests.push({ specifier: item.moduleRequest.value, kind: 'static', names: ['*'], pairs: null });
        continue;
      }
      const valueNames = entries.filter((e) => !e.isType && !wholeTypeOnly).map((e) => nameOf(e.importName));
      const typeNames = entries.filter((e) => e.isType || wholeTypeOnly).map((e) => nameOf(e.importName));
      if (valueNames.length > 0) requests.push({ specifier: item.moduleRequest.value, kind: 'static', names: valueNames, pairs: null });
      if (typeNames.length > 0) requests.push({ specifier: item.moduleRequest.value, kind: 'type', names: typeNames, pairs: null });
    }

    const own = new Set<string>();
    let unknownExports = false;
    for (const item of parsed.module.staticExports as unknown as StaticExport[]) {
      for (const entry of item.entries) {
        if (entry.exportName.kind !== 'None') own.add(nameOf(entry.exportName));
        if (!entry.moduleRequest) continue;
        const star = entry.importName.kind === 'AllButDefault' || (entry.importName.kind === 'All' && entry.exportName.kind === 'None');
        if (star) unknownExports = true; // names come from another file
        requests.push({
          specifier: entry.moduleRequest.value,
          kind: entry.isType ? 'type' : 'reexport',
          names: null,
          pairs: star ? '*' : [[nameOf(entry.importName), nameOf(entry.exportName)]],
        });
      }
    }
    const hasEsm = parsed.module.staticImports.length > 0 || parsed.module.staticExports.length > 0;
    exportsOf.set(rel, unknownExports || !hasEsm || own.size === 0 ? null : own);

    for (const item of parsed.module.dynamicImports as unknown as DynamicImport[]) {
      const raw = source.slice(item.moduleRequest.start, item.moduleRequest.end).trim();
      const literal = /^(['"`])([^'"`$\\]*)\1$/.exec(raw);
      if (literal) requests.push({ specifier: literal[2] as string, kind: 'dynamic', names: ['*'], pairs: null });
      else unresolved.push({ file: rel, specifier: raw, reason: 'non-literal-dynamic-import' });
    }

    for (const request of requests) {
      if (request.kind === 'type' && !options.includeTypes) continue;
      const result = resolver.sync(path.dirname(abs), request.specifier);
      if (result.path) {
        const target = toPosix(path.relative(root, result.path));
        if (target.startsWith('..') || target.split('/').includes('node_modules')) continue;
        const list = rev.get(target) ?? [];
        list.push({ from: rel, kind: request.kind, names: request.names, pairs: request.pairs });
        rev.set(target, list);
      } else if (!isBarePackage(request.specifier) || matchesAlias(request.specifier, aliases)) {
        unresolved.push({ file: rel, specifier: request.specifier, reason: 'not-found' });
      }
    }
  }
  return { files, rev, exportsOf, unresolved, parseErrors };
}
