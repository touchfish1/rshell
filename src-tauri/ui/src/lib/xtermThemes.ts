import type { ITheme } from "xterm";

/** 与固定深色应用壳一致的 xterm 配色。 */
export function getXtermITheme(): ITheme {
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
