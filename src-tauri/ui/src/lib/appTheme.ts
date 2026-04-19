/**
 * 应用颜色主题：`localStorage`（`COLOR_THEME_STORAGE_KEY`）与 `document.documentElement[data-theme]`。
 * 首屏在 `main.tsx` 调用 `initAppShellTheme()`，运行时由 `ThemeProvider` 与系统 `prefers-color-scheme` 同步。
 */

export type ColorThemeMode = "light" | "dark" | "system";

export const COLOR_THEME_STORAGE_KEY = "rshell.color-theme";

export function getStoredColorThemeMode(): ColorThemeMode {
  try {
    const v = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "dark";
}

export function prefersColorSchemeDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveColorTheme(mode: ColorThemeMode): "light" | "dark" {
  if (mode === "system") {
    return prefersColorSchemeDark() ? "dark" : "light";
  }
  return mode;
}

export function applyResolvedColorTheme(resolved: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function persistColorThemeMode(mode: ColorThemeMode): void {
  try {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** 首屏前调用：从存储恢复并写入 `data-theme`，避免浅色闪屏。 */
export function initAppShellTheme(): void {
  const mode = getStoredColorThemeMode();
  applyResolvedColorTheme(resolveColorTheme(mode));
}
