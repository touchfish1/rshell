import { useCallback } from "react";
import type { Terminal } from "xterm";
import { adjustTerminalFontSize, TERMINAL_FONT_DEFAULT } from "../../lib/terminalFontSize";

export function useTerminalInput() {
  const pasteFromClipboard = useCallback((terminal: Terminal) => {
    void navigator.clipboard
      .readText()
      .then((text) => {
        if (text.length > 0) {
          terminal.paste(text);
        }
      })
      .catch(() => {});
  }, []);

  const attachCustomKeyHandler = useCallback(
    (terminal: Terminal, applyFontSize: (nextSize: number) => void) => {
      terminal.attachCustomKeyEventHandler((event) => {
        if (event.type === "keydown" && event.key === "Tab") {
          event.preventDefault();
          return true;
        }
        if (event.type === "keydown" && (event.ctrlKey || event.metaKey) && !event.altKey) {
          const code = event.code;
          if (code === "Equal" || code === "NumpadAdd") {
            event.preventDefault();
            applyFontSize(
              adjustTerminalFontSize(terminal.options.fontSize ?? TERMINAL_FONT_DEFAULT, 1)
            );
            return false;
          }
          if (code === "Minus" || code === "NumpadSubtract") {
            event.preventDefault();
            applyFontSize(
              adjustTerminalFontSize(terminal.options.fontSize ?? TERMINAL_FONT_DEFAULT, -1)
            );
            return false;
          }
          if (code === "Digit0" || code === "Numpad0") {
            event.preventDefault();
            applyFontSize(TERMINAL_FONT_DEFAULT);
            return false;
          }
        }

        const isModV =
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          (event.key === "v" || event.key === "V" || event.code === "KeyV");
        const isCtrlShiftV =
          event.type === "keydown" &&
          event.ctrlKey &&
          event.shiftKey &&
          !event.metaKey &&
          !event.altKey &&
          (event.key === "V" || event.key === "v" || event.code === "KeyV");
        const isShiftInsert =
          event.key === "Insert" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
        if (event.type === "keydown" && (isCtrlShiftV || (isModV && !event.shiftKey) || isShiftInsert)) {
          event.preventDefault();
          pasteFromClipboard(terminal);
          return false;
        }

        const isCopyCombo =
          event.type === "keydown" &&
          ((event.ctrlKey && !event.metaKey && !event.altKey) ||
            (event.metaKey && !event.ctrlKey && !event.altKey)) &&
          (event.key === "c" || event.key === "C" || event.code === "KeyC");
        if (isCopyCombo && terminal.hasSelection()) {
          void navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
          event.preventDefault();
          return false;
        }
        return true;
      });
    },
    [pasteFromClipboard]
  );

  return { pasteFromClipboard, attachCustomKeyHandler };
}

