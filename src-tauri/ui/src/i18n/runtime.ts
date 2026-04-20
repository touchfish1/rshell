import type { I18nKey, Lang } from "./keys";
import { enUSMessages } from "./messages/enUS";
import { zhCNMessages } from "./messages/zhCN";

type Dict = Record<I18nKey, string>;

const dictionaries: Record<Lang, Dict> = {
  "zh-CN": zhCNMessages,
  "en-US": enUSMessages,
};

export function detectInitialLang(): Lang {
  const saved = localStorage.getItem("rshell.lang");
  if (saved === "zh-CN" || saved === "en-US") return saved;
  const locale = navigator.language.toLowerCase();
  return locale.startsWith("zh") ? "zh-CN" : "en-US";
}

export function setLangStorage(lang: Lang) {
  localStorage.setItem("rshell.lang", lang);
}

export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[lang][key];
  if (!vars) return text;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  }
  return text;
}
