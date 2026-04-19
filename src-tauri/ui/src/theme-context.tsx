import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyResolvedColorTheme,
  getStoredColorThemeMode,
  persistColorThemeMode,
  resolveColorTheme,
  type ColorThemeMode,
} from "./lib/appTheme";

export type { ColorThemeMode };

type ThemeContextValue = {
  /** 用户选择：浅色 / 深色 / 跟随系统 */
  mode: ColorThemeMode;
  /** 实际应用到页面与终端的配色 */
  resolved: "light" | "dark";
  setMode: (mode: ColorThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribePreferredDark(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getPreferredDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getPreferredDarkServerSnapshot(): boolean {
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorThemeMode>(() => getStoredColorThemeMode());
  const prefersDark = useSyncExternalStore(
    subscribePreferredDark,
    getPreferredDarkSnapshot,
    getPreferredDarkServerSnapshot
  );

  const resolved = useMemo(() => {
    if (mode === "system") {
      return prefersDark ? "dark" : "light";
    }
    return resolveColorTheme(mode);
  }, [mode, prefersDark]);

  useEffect(() => {
    applyResolvedColorTheme(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ColorThemeMode) => {
    setModeState(next);
    persistColorThemeMode(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}
