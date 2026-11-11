import { en } from './i18n/en.js';
import type { MsgId } from './i18n/en.js';

export type MsgParams = Record<string, string | number>;

/**
 * Error with a catalog message id and parameters. The library never formats user-facing text itself:
 * the CLI renders `code` + `params` in the user's language. `message` is the English rendering.
 * exitCode: 1 = runtime failure, 2 = usage error.
 */
export class ImpactError extends Error {
  readonly code: MsgId;
  readonly params: MsgParams;
  readonly exitCode: 1 | 2;

  constructor(code: MsgId, params: MsgParams = {}, exitCode: 1 | 2 = 1) {
    super(fill(en[code], params));
    this.name = 'ImpactError';
    this.code = code;
    this.params = params;
    this.exitCode = exitCode;
  }
}

/** Replace `{name}` placeholders. Unknown names are left untouched. */
export function fill(template: string, params: MsgParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
