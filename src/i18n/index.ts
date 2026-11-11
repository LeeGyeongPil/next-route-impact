import { en } from './en.js';
import type { MsgId } from './en.js';
import { ko } from './ko.js';
import { fill } from '../errors.js';
import type { MsgParams } from '../errors.js';

export type Lang = 'en' | 'ko';
export type { MsgId };

export const catalogs: Record<Lang, Record<MsgId, string>> = { en, ko };

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'ko';
}

/**
 * Pick the output language. Precedence: an explicit valid `flag` (--lang) wins, then the first
 * non-empty of ROUTE_IMPACT_LANG, LC_ALL, LC_MESSAGES, LANG. A value starting with "ko" means Korean,
 * anything else (C, POSIX, fr_FR, unset) means English.
 */
export function resolveLang(flag: string | undefined, env: NodeJS.ProcessEnv): Lang {
  if (isLang(flag)) return flag;
  for (const name of ['ROUTE_IMPACT_LANG', 'LC_ALL', 'LC_MESSAGES', 'LANG']) {
    const value = env[name];
    if (value !== undefined && value !== '') return value.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  }
  return 'en';
}

/** Translate a message id for a language and fill its {placeholders}. */
export function tr(lang: Lang, id: MsgId, params: MsgParams = {}): string {
  return fill(catalogs[lang][id], params);
}

/** Look up an id that is built at run time (e.g. "expand.layout"); falls back to the id itself. */
export function trDynamic(lang: Lang, id: string, params: MsgParams = {}): string {
  const template = (catalogs[lang] as Record<string, string>)[id];
  return template === undefined ? id : fill(template, params);
}
