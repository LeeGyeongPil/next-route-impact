import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ImpactError } from './errors.js';
import { isFile } from './fsutil.js';
import type { Config } from './types.js';

export const CONFIG_FILE_NAME = 'next-route-impact.config.json';

export const DEFAULT_RUN_ALL_ON = [
  'next.config.*',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'tsconfig*.json',
  '.env*',
  'tailwind.config.*',
  'postcss.config.*',
];

export const DEFAULT_IGNORE = ['**/*.md', '.github/**'];

export function defaultConfig(): Config {
  return { tests: {}, runAllOn: [...DEFAULT_RUN_ALL_ON], ignore: [...DEFAULT_IGNORE] };
}

const KNOWN_FIELDS = new Set(['tests', 'runAllOn', 'ignore', 'tsconfig']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Validate a parsed config object. Throws ImpactError(error.configShape) naming the bad field. */
export function parseConfig(raw: unknown, fileLabel: string): Config {
  const fail = (field: string): never => {
    throw new ImpactError('error.configShape', { file: fileLabel, field }, 1);
  };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail('(root)');
  const obj = raw as Record<string, unknown>;
  for (const name of Object.keys(obj)) {
    if (!KNOWN_FIELDS.has(name)) fail(name);
  }
  const config = defaultConfig();
  if (obj.tests !== undefined) {
    if (typeof obj.tests !== 'object' || obj.tests === null || Array.isArray(obj.tests)) fail('tests');
    const tests: Record<string, string[]> = {};
    for (const [urlGlob, value] of Object.entries(obj.tests as Record<string, unknown>)) {
      if (typeof value === 'string') tests[urlGlob] = [value];
      else if (isStringArray(value)) tests[urlGlob] = value;
      else fail('tests.' + urlGlob);
    }
    config.tests = tests;
  }
  if (obj.runAllOn !== undefined) {
    if (!isStringArray(obj.runAllOn)) fail('runAllOn');
    config.runAllOn = obj.runAllOn as string[];
  }
  if (obj.ignore !== undefined) {
    if (!isStringArray(obj.ignore)) fail('ignore');
    config.ignore = obj.ignore as string[];
  }
  if (obj.tsconfig !== undefined) {
    if (typeof obj.tsconfig !== 'string') fail('tsconfig');
    config.tsconfig = obj.tsconfig as string;
  }
  return config;
}

function readJson(file: string, label: string): unknown {
  const text = readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new ImpactError('error.configSyntax', { file: label }, 1);
  }
}

/**
 * Load the config: an explicit --config path, else <root>/next-route-impact.config.json,
 * else the "nextRouteImpact" field of <root>/package.json, else defaults.
 */
export function loadConfig(root: string, explicitPath?: string): Config {
  if (explicitPath !== undefined) {
    const file = path.resolve(explicitPath);
    if (!isFile(file)) throw new ImpactError('error.configNotFound', { file: explicitPath }, 1);
    return parseConfig(readJson(file, explicitPath), explicitPath);
  }
  const standalone = path.join(root, CONFIG_FILE_NAME);
  if (isFile(standalone)) return parseConfig(readJson(standalone, CONFIG_FILE_NAME), CONFIG_FILE_NAME);

  const pkg = path.join(root, 'package.json');
  if (isFile(pkg)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(pkg, 'utf8'));
    } catch {
      return defaultConfig(); // an unreadable package.json is not our file; ignore it
    }
    const section = (parsed as Record<string, unknown> | null)?.nextRouteImpact;
    if (section !== undefined) return parseConfig(section, 'package.json "nextRouteImpact"');
  }
  return defaultConfig();
}

/** Merge a partial config (library callers) over the defaults. */
export function withDefaults(partial: Partial<Config> | undefined): Config {
  return { ...defaultConfig(), ...(partial ?? {}) };
}
