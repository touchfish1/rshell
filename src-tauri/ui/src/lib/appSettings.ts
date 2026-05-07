/**
 * Centralized app settings — persists to localStorage, dispatches
 * `CustomEvent("rshell-settings-changed")` on any write so terminal
 * instances and other consumers can react.
 */

export type CursorStyle = "block" | "underline" | "bar";
export type BellStyle = "none" | "visual" | "sound";

export interface AppSettings {
  theme: "light" | "dark" | "system";
  lang: string;
  terminalFontFamily: "ui" | "mono" | "classic";
  terminalFontSize: number;
  terminalFgColor: string;
  terminalBgColor: string;
  terminalCursorColor: string;
  terminalCursorStyle: CursorStyle;
  terminalCursorBlink: boolean;
  terminalScrollback: number;
  confirmBeforeClose: boolean;
  terminalCursorWidth: number;
  terminalOpacity: number;
  pingInterval: number;
  autoCopySelection: boolean;
  terminalLineHeight: number;
  terminalLetterSpacing: number;
  terminalBellStyle: BellStyle;
  confirmTabClose: boolean;
  confirmPaste: boolean;
}

const DEFAULTS: AppSettings = {
  theme: "dark",
  lang: "zh-CN",
  terminalFontFamily: "ui",
  terminalFontSize: 13,
  terminalFgColor: "#e7e8ea",
  terminalBgColor: "#101219",
  terminalCursorColor: "#e7e8ea",
  terminalCursorStyle: "block",
  terminalCursorBlink: true,
  terminalScrollback: 1000,
  confirmBeforeClose: true,
  terminalCursorWidth: 1,
  terminalOpacity: 100,
  pingInterval: 10,
  autoCopySelection: false,
  terminalLineHeight: 1.0,
  terminalLetterSpacing: 0,
  terminalBellStyle: "sound",
  confirmTabClose: false,
  confirmPaste: true,
};

const KEYS: Record<keyof AppSettings, string> = {
  theme: "rshell.color-theme",
  lang: "rshell.lang",
  terminalFontFamily: "rshell.terminal.fontFamily",
  terminalFontSize: "rshell.terminal.fontSize",
  terminalFgColor: "rshell.terminal.fgColor",
  terminalBgColor: "rshell.terminal.bgColor",
  terminalCursorColor: "rshell.terminal.cursorColor",
  terminalCursorStyle: "rshell.terminal.cursorStyle",
  terminalCursorBlink: "rshell.terminal.cursorBlink",
  terminalScrollback: "rshell.terminal.scrollback",
  confirmBeforeClose: "rshell.confirmBeforeClose",
  terminalCursorWidth: "rshell.terminal.cursorWidth",
  terminalOpacity: "rshell.terminal.opacity",
  pingInterval: "rshell.pingInterval",
  autoCopySelection: "rshell.terminal.autoCopySelection",
  terminalLineHeight: "rshell.terminal.lineHeight",
  terminalLetterSpacing: "rshell.terminal.letterSpacing",
  terminalBellStyle: "rshell.terminal.bellStyle",
  confirmTabClose: "rshell.confirmTabClose",
  confirmPaste: "rshell.confirmPaste",
};

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function getAllSettings(): AppSettings {
  return {
    theme: read(KEYS.theme, DEFAULTS.theme) as AppSettings["theme"],
    lang: read(KEYS.lang, DEFAULTS.lang),
    terminalFontFamily: read(KEYS.terminalFontFamily, DEFAULTS.terminalFontFamily) as AppSettings["terminalFontFamily"],
    terminalFontSize: Number(read(KEYS.terminalFontSize, String(DEFAULTS.terminalFontSize))),
    terminalFgColor: read(KEYS.terminalFgColor, DEFAULTS.terminalFgColor),
    terminalBgColor: read(KEYS.terminalBgColor, DEFAULTS.terminalBgColor),
    terminalCursorColor: read(KEYS.terminalCursorColor, DEFAULTS.terminalCursorColor),
    terminalCursorStyle: read(KEYS.terminalCursorStyle, DEFAULTS.terminalCursorStyle) as CursorStyle,
    terminalCursorBlink: read(KEYS.terminalCursorBlink, String(DEFAULTS.terminalCursorBlink)) === "true",
    terminalScrollback: Number(read(KEYS.terminalScrollback, String(DEFAULTS.terminalScrollback))),
    confirmBeforeClose: read(KEYS.confirmBeforeClose, String(DEFAULTS.confirmBeforeClose)) === "true",
    terminalCursorWidth: Number(read(KEYS.terminalCursorWidth, String(DEFAULTS.terminalCursorWidth))),
    terminalOpacity: Number(read(KEYS.terminalOpacity, String(DEFAULTS.terminalOpacity))),
    pingInterval: Number(read(KEYS.pingInterval, String(DEFAULTS.pingInterval))),
    autoCopySelection: read(KEYS.autoCopySelection, String(DEFAULTS.autoCopySelection)) === "true",
    terminalLineHeight: Number(read(KEYS.terminalLineHeight, String(DEFAULTS.terminalLineHeight))),
    terminalLetterSpacing: Number(read(KEYS.terminalLetterSpacing, String(DEFAULTS.terminalLetterSpacing))),
    terminalBellStyle: read(KEYS.terminalBellStyle, DEFAULTS.terminalBellStyle) as BellStyle,
    confirmTabClose: read(KEYS.confirmTabClose, String(DEFAULTS.confirmTabClose)) === "true",
    confirmPaste: read(KEYS.confirmPaste, String(DEFAULTS.confirmPaste)) === "true",
  };
}

export function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  try {
    localStorage.setItem(KEYS[key], String(value));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("rshell-settings-changed", { detail: { key, value } }));
}

export function resetAllSettings(): void {
  for (const [k, storageKey] of Object.entries(KEYS)) {
    const key = k as keyof AppSettings;
    try {
      localStorage.setItem(storageKey, String(DEFAULTS[key]));
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(ANSI_COLORS_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("rshell-settings-changed", { detail: { reset: true } }));
}

export function getTerminalCustomColors(): { foreground: string; background: string; cursor: string } {
  const s = getAllSettings();
  return {
    foreground: s.terminalFgColor,
    background: s.terminalBgColor,
    cursor: s.terminalCursorColor,
  };
}

const ANSI_COLORS_KEY = "rshell.terminal.ansiColors";

export function getAnsiColors(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(ANSI_COLORS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

export function setAnsiColors(colors: Record<string, string>): void {
  try {
    localStorage.setItem(ANSI_COLORS_KEY, JSON.stringify(colors));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("rshell-settings-changed", { detail: { key: "ansiColors" } }));
}

export const ANSI_COLOR_DEFAULTS: Record<string, string> = {
  black: "#1b2230", red: "#f87171", green: "#4ade80", yellow: "#facc15",
  blue: "#60a5fa", magenta: "#c084fc", cyan: "#22d3ee", white: "#e5e7eb",
  brightBlack: "#6b7280", brightRed: "#fca5a5", brightGreen: "#86efac",
  brightYellow: "#fde047", brightBlue: "#93c5fd", brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9", brightWhite: "#f9fafb",
};

const ANSI_COLOR_NAMES = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

export { ANSI_COLOR_NAMES };
export type AnsiColorName = (typeof ANSI_COLOR_NAMES)[number];
