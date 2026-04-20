import type { I18nKey } from "../keys";

type Dict = Record<I18nKey, string>;

export function splitByPrefix(source: Dict, prefixes: string[]): Partial<Dict> {
  const next: Partial<Dict> = {};
  for (const [key, value] of Object.entries(source) as Array<[I18nKey, string]>) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      next[key] = value;
    }
  }
  return next;
}

