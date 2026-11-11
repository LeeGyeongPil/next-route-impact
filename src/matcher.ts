import { readFileSync } from 'node:fs';
import { parseSync } from 'oxc-parser';

/**
 * What a proxy.ts / middleware.ts file says about the URLs it runs on:
 *  - "all": no config (or no matcher) means every request, nothing is uncertain
 *  - "patterns": a static matcher
 *  - "unknown": the matcher is not a literal we can read, so we assume every request (and report it)
 */
export type MatcherInfo =
  | { type: 'all' }
  | { type: 'patterns'; sources: string[] }
  | { type: 'unknown' };

interface AstNode {
  type: string;
  [field: string]: unknown;
}

const NOT_STATIC = Symbol('not-static');

function unwrap(node: AstNode): AstNode {
  let current = node;
  while (['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(current.type)) {
    current = current.expression as AstNode;
  }
  return current;
}

function propertyName(prop: AstNode): string | null {
  const nameNode = prop.key as AstNode | undefined;
  if (!nameNode) return null;
  if (nameNode.type === 'Identifier') return nameNode.name as string;
  if (nameNode.type === 'Literal' && typeof nameNode.value === 'string') return nameNode.value;
  return null;
}

function stringValue(node: AstNode): string | typeof NOT_STATIC {
  const n = unwrap(node);
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral') {
    const quasis = n.quasis as Array<{ value: { cooked: string | null } }>;
    if ((n.expressions as unknown[]).length === 0 && quasis.length === 1) return quasis[0]?.value.cooked ?? NOT_STATIC;
  }
  return NOT_STATIC;
}

function matcherEntry(node: AstNode): string | typeof NOT_STATIC {
  const n = unwrap(node);
  if (n.type === 'ObjectExpression') {
    for (const prop of n.properties as AstNode[]) {
      if (prop.type !== 'Property') return NOT_STATIC; // spread etc.
      if (propertyName(prop) === 'source') return stringValue(prop.value as AstNode);
    }
    return NOT_STATIC;
  }
  return stringValue(n);
}

/** Read `export const config = { matcher: ... }` from the file with the oxc AST. */
export function readMatcher(absFile: string): MatcherInfo {
  const source = readFileSync(absFile, 'utf8');
  const program = parseSync(absFile, source).program as unknown as { body: AstNode[] };
  let configInit: AstNode | null = null;
  let exportedElsewhere = false;

  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    const declaration = statement.declaration as AstNode | null;
    if (declaration && declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations as AstNode[]) {
        const id = declarator.id as AstNode;
        if (id.type === 'Identifier' && id.name === 'config') configInit = (declarator.init as AstNode | null) ?? null;
      }
    }
    for (const specifier of (statement.specifiers as AstNode[] | undefined) ?? []) {
      const exported = specifier.exported as AstNode;
      if (exported.name === 'config' || exported.value === 'config') exportedElsewhere = true;
    }
  }

  if (exportedElsewhere) return { type: 'unknown' };
  if (configInit === null) return { type: 'all' };
  const config = unwrap(configInit);
  if (config.type !== 'ObjectExpression') return { type: 'unknown' };

  for (const prop of config.properties as AstNode[]) {
    if (prop.type !== 'Property') return { type: 'unknown' };
    if (propertyName(prop) !== 'matcher') continue;
    const value = unwrap(prop.value as AstNode);
    const items = value.type === 'ArrayExpression' ? (value.elements as Array<AstNode | null>) : [value];
    const sources: string[] = [];
    for (const item of items) {
      if (item === null || item.type === 'SpreadElement') return { type: 'unknown' };
      const text = matcherEntry(item);
      if (text === NOT_STATIC) return { type: 'unknown' };
      sources.push(text);
    }
    return { type: 'patterns', sources };
  }
  return { type: 'all' };
}

/**
 * Convert a Next.js matcher source (path-to-regexp subset) into a RegExp:
 * literals, :name, :name*, :name+, :name?, :name(regex), and (regex) groups.
 * Throws when the syntax is not understood.
 */
export function matcherToRegExp(source: string): RegExp {
  if (!source.startsWith('/')) throw new Error('matcher must start with /');
  let out = '';
  let i = 0;
  const readGroup = (): string => {
    // source[i] === "(" ; returns the inner text and moves past the closing ")"
    let depth = 0;
    const start = i + 1;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '\\') i++;
      else if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          i++;
          return source.slice(start, i - 1);
        }
      }
    }
    throw new Error('unbalanced group');
  };
  const modifier = (rawBody: string): string => {
    const body = '(?:' + rawBody + ')';
    const ch = source[i];
    if (ch === '*') {
      i++;
      return '(?:/' + body + ')*';
    }
    if (ch === '+') {
      i++;
      return '(?:/' + body + ')+';
    }
    if (ch === '?') {
      i++;
      return '(?:/' + body + ')?';
    }
    return '/' + body;
  };

  while (i < source.length) {
    const ch = source[i] as string;
    const next = source[i + 1];
    if (ch === '/' && next === ':') {
      i += 2;
      const nameStart = i;
      while (i < source.length && /\w/.test(source[i] as string)) i++;
      if (i === nameStart) throw new Error('empty parameter name');
      const body = source[i] === '(' ? readGroup() : '[^/]+';
      out += modifier(body);
    } else if (ch === '/' && next === '(') {
      i += 1;
      out += modifier(readGroup());
    } else if (ch === ':') {
      i += 1;
      const nameStart = i;
      while (i < source.length && /\w/.test(source[i] as string)) i++;
      if (i === nameStart) throw new Error('empty parameter name');
      out += source[i] === '(' ? '(?:' + readGroup() + ')' : '[^/]+';
    } else if (ch === '(') {
      out += '(?:' + readGroup() + ')';
    } else if (ch === '*' || ch === '+' || ch === '?') {
      out += ch;
      i++;
    } else {
      out += ch.replace(/[.+^$()|[\]\\{}]/g, '\\$&');
      i++;
    }
  }
  return new RegExp('^' + out + '/?$');
}

/** Concrete URLs a route pattern such as /shop/[[...filters]] can stand for, used to test matchers. */
export function sampleUrls(pattern: string): string[] {
  const segments = pattern.split('/').filter((s) => s !== '');
  let variants: string[][] = [[]];
  for (const segment of segments) {
    let options: string[][];
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) options = [[], ['x'], ['x', 'y']];
    else if (/^\[\.\.\..+\]$/.test(segment)) options = [['x'], ['x', 'y']];
    else if (/^\[.+\]$/.test(segment)) options = [['x']];
    else options = [[segment]];
    variants = variants.flatMap((prefix) => options.map((option) => [...prefix, ...option]));
  }
  return variants.map((parts) => '/' + parts.join('/'));
}

export function patternMatches(regexps: RegExp[], routeUrl: string): boolean {
  return sampleUrls(routeUrl).some((sample) => regexps.some((re) => re.test(sample)));
}
