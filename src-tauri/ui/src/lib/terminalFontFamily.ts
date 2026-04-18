const STORAGE_KEY = "rshell.terminal.fontFamily";

export type TerminalFontPresetId = "ui" | "mono" | "classic";

const PRESETS: Record<TerminalFontPresetId, string> = {
  ui: 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Monaco, Consolas, monospace',
  mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, "Courier New", monospace',
  classic: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export function getTerminalFontPreset(): TerminalFontPresetId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "mono" || raw === "classic" || raw === "ui") return raw;
  } catch {
    /* ignore */
  }
  return "ui";
}

export function setTerminalFontPreset(id: TerminalFontPresetId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("rshell-terminal-font-changed"));
}

export function getTerminalFontFamily(): string {
  return PRESETS[getTerminalFontPreset()];
}

export const TERMINAL_FONT_PRESET_IDS: TerminalFontPresetId[] = ["ui", "mono", "classic"];
