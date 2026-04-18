import type { ITheme } from "xterm";

export function getXtermITheme(): ITheme {
  const isLight = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) {
    return {
      background: "#fafafa",
      foreground: "#141820",
      cursor: "#141820",
      cursorAccent: "#fafafa",
      selectionBackground: "rgba(64, 120, 255, 0.28)",
      black: "#141820",
      brightBlack: "#5a6578",
      red: "#c42b2b",
      brightRed: "#e04848",
      green: "#1a7f37",
      brightGreen: "#2dac5a",
      yellow: "#8a6400",
      brightYellow: "#b58900",
      blue: "#2563eb",
      brightBlue: "#5b8cff",
      magenta: "#9333ea",
      brightMagenta: "#b565f0",
      cyan: "#0d9488",
      brightCyan: "#2dd4bf",
      white: "#dce3ef",
      brightWhite: "#f1f5fb",
    };
  }
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
