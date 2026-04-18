export type ThemeChoice = "dark" | "light" | "system";

const STORAGE_KEY = "rshell.theme";

function readChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function getThemeChoice(): ThemeChoice {
  return readChoice();
}

export function setThemeChoice(next: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  applyDocumentTheme(next);
  window.dispatchEvent(new CustomEvent("rshell-theme-changed"));
}

export function getEffectiveTheme(choice: ThemeChoice = readChoice()): "dark" | "light" {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** 将解析后的亮/暗写入 `document.documentElement`，供全局 CSS 与终端配色使用。 */
export function applyDocumentTheme(choice?: ThemeChoice): void {
  const eff = getEffectiveTheme(choice ?? readChoice());
  document.documentElement.setAttribute("data-theme", eff);
}

export function initDocumentThemeFromStorage(): void {
  applyDocumentTheme();
}
