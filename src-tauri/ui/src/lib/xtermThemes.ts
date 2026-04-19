import type { ITheme } from "xterm";

/** 深色壳：与默认 UI 一致。 */
function xtermDark(): ITheme {
  return {
    background: "#101219",
    foreground: "#e7e8ea",
    cursor: "#e7e8ea",
    cursorAccent: "#101219",
    selectionBackground: "rgba(79, 131, 255, 0.35)",
    black: "#1b2230",
    brightBlack: "#6b7280",
    red: "#f87171",
    brightRed: "#fca5a5",
    green: "#4ade80",
    brightGreen: "#86efac",
    yellow: "#facc15",
    brightYellow: "#fde047",
    blue: "#60a5fa",
    brightBlue: "#93c5fd",
    magenta: "#c084fc",
    brightMagenta: "#d8b4fe",
    cyan: "#22d3ee",
    brightCyan: "#67e8f9",
    white: "#e5e7eb",
    brightWhite: "#f9fafb",
  };
}

/** 浅色壳：高对比，避免与浅色背景糊在一起。 */
function xtermLight(): ITheme {
  return {
    background: "#fafbfc",
    foreground: "#111827",
    cursor: "#111827",
    cursorAccent: "#fafbfc",
    selectionBackground: "rgba(37, 99, 235, 0.22)",
    black: "#111827",
    brightBlack: "#4b5563",
    red: "#b91c1c",
    brightRed: "#dc2626",
    green: "#15803d",
    brightGreen: "#16a34a",
    yellow: "#a16207",
    brightYellow: "#ca8a04",
    blue: "#1d4ed8",
    brightBlue: "#2563eb",
    magenta: "#7e22ce",
    brightMagenta: "#9333ea",
    cyan: "#0e7490",
    brightCyan: "#0891b2",
    white: "#374151",
    brightWhite: "#111827",
  };
}

export function getXtermITheme(variant: "light" | "dark" = "dark"): ITheme {
  return variant === "light" ? xtermLight() : xtermDark();
}
