const STORAGE_KEY = "rshell.terminal.fontSize";
const DEFAULT = 13;
const MIN = 9;
const MAX = 26;

function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(n)));
}

export function getTerminalFontSize(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT;
    return clamp(n);
  } catch {
    return DEFAULT;
  }
}

export function persistTerminalFontSize(size: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clamp(size)));
  } catch {
    /* ignore */
  }
}

export function adjustTerminalFontSize(current: number, delta: number): number {
  return clamp(current + delta);
}

export { MIN as TERMINAL_FONT_MIN, MAX as TERMINAL_FONT_MAX, DEFAULT as TERMINAL_FONT_DEFAULT };
