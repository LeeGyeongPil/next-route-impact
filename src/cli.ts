#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { ImpactError } from './errors.js';
import { walkFiles, toPosix } from './fsutil.js';
import { gitChangedFiles } from './git.js';
import { isLang, resolveLang, tr } from './i18n/index.js';
import type { Lang } from './i18n/index.js';
import { analyzeSync } from './impact.js';
import { loadProject } from './project.js';
import { renderJson } from './report/json.js';
import { renderMarkdown } from './report/markdown.js';
import { uncertainCount } from './report/shared.js';
import { renderTable, renderTestFiles } from './report/table.js';
import { selectTests } from './select.js';
import type { ChangedFile } from './types.js';

export interface Streams {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const OPTIONS = {
  git: { type: 'boolean' },
  base: { type: 'string' },
  root: { type: 'string' },
  config: { type: 'string' },
  json: { type: 'boolean' },
  markdown: { type: 'boolean' },
  tests: { type: 'boolean' },
  'include-types': { type: 'boolean' },
  'fail-on-uncertain': { type: 'boolean' },
  lang: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

/** Find a valid --lang value before parseArgs runs, so that parse errors can already be shown in that language. */
function scanLangFlag(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--') break;
    if (arg === '--lang') return argv[i + 1];
    if (arg.startsWith('--lang=')) return arg.slice('--lang='.length);
  }
  return undefined;
}

/** Turn a parseArgs failure into a catalog error (Node's English text is never shown). */
function usageError(error: unknown): ImpactError {
  const code = (error as { code?: string }).code;
  const message = (error as Error).message ?? '';
  const option = /'(-[^'\s<]+)/.exec(message)?.[1] ?? '?';
  if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') return new ImpactError('error.unknownOption', { option }, 2);
  if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
    return /argument missing/.test(message)
      ? new ImpactError('error.missingValue', { option }, 2)
      : new ImpactError('error.unexpectedValue', { option }, 2);
  }
  return new ImpactError('error.unknownOption', { option }, 2);
}

function readVersion(): string {
  const file = new URL('../package.json', import.meta.url);
  return (JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version;
}

/** Positional inputs: files or folders, relative to --root (or to the current folder when that is where they exist). */
function inputFiles(positionals: string[], root: string, cwd: string): ChangedFile[] {
  const out: ChangedFile[] = [];
  for (const given of positionals) {
    const underRoot = path.resolve(root, given);
    const underCwd = path.resolve(cwd, given);
    const absolute = existsSync(underRoot) || !existsSync(underCwd) ? underRoot : underCwd;
    if (existsSync(absolute) && statSync(absolute).isDirectory()) {
      for (const file of walkFiles(absolute)) {
        out.push({ path: toPosix(path.relative(root, path.join(absolute, file))), status: 'modified' });
      }
    } else {
      if (!existsSync(absolute)) throw new ImpactError('error.fileNotFound', { file: given }, 2);
      out.push({ path: toPosix(path.relative(root, absolute)), status: 'modified' });
    }
  }
  return out;
}

export async function run(argv: string[], env: NodeJS.ProcessEnv, io: Streams, cwd: string = process.cwd()): Promise<number> {
  const lang: Lang = resolveLang(scanLangFlag(argv), env);
  try {
    let parsed;
    try {
      parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    } catch (error) {
      throw usageError(error);
    }
    const { values, positionals } = parsed;

    if (values.lang !== undefined && !isLang(values.lang)) throw new ImpactError('error.invalidLang', { value: values.lang }, 2);
    if (values.help) {
      io.stdout(tr(lang, 'help.text') + '\n');
      return 0;
    }
    if (values.version) {
      io.stdout(readVersion() + '\n');
      return 0;
    }
    if (values.json && values.markdown) throw new ImpactError('error.formatConflict', {}, 2);
    if (!values.git && positionals.length === 0) throw new ImpactError('error.noInput', {}, 2);

    const rootGiven = values.root ?? '.';
    const layout = loadProject(path.resolve(cwd, rootGiven), undefined, rootGiven);
    const config = loadConfig(layout.root, values.config === undefined ? undefined : path.resolve(cwd, values.config));
    if (values.tests && Object.keys(config.tests).length === 0) throw new ImpactError('error.testsNoMapping', {}, 2);

    const changed: ChangedFile[] = [];
    if (values.git) changed.push(...gitChangedFiles(layout.root, values.base));
    changed.push(...inputFiles(positionals, layout.root, cwd));

    const report = analyzeSync({ root: layout.root, changed, includeTypes: values['include-types'] ?? false, config });
    const selection = values.tests ? selectTests(report, config, layout.root) : undefined;

    if (values.json) io.stdout(renderJson(report, lang, selection));
    else if (values.markdown) io.stdout(renderMarkdown(report, lang, selection));
    else if (selection) {
      io.stdout(renderTestFiles(selection));
      if (selection.runAll) {
        io.stderr(tr(lang, 'tests.runAllStderr', { files: selection.runAllReasons.map((reason) => reason.file).join(', ') }) + '\n');
      }
    } else io.stdout(renderTable(report, lang));

    const count = uncertainCount(report);
    if (values['fail-on-uncertain'] && count > 0) {
      io.stderr(tr(lang, 'fail.uncertain', { count }) + '\n');
      return 3;
    }
    return 0;
  } catch (error) {
    if (error instanceof ImpactError) {
      io.stderr(tr(lang, error.code, error.params) + '\n');
      return error.exitCode;
    }
    io.stderr(tr(lang, 'error.unexpected', { detail: error instanceof Error ? error.message : String(error) }) + '\n');
    return 1;
  }
}

const argv = process.argv.slice(2);
const code = await run(
  argv,
  process.env,
  { stdout: (text) => void process.stdout.write(text), stderr: (text) => void process.stderr.write(text) },
);
process.exitCode = code;
