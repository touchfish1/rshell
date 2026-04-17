import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface Props {
  connected: boolean;
  onInput: (text: string) => void;
  onResize: (cols: number, rows: number) => void;
  registerWriter: (writer: (content: string) => void) => void;
}

export default function TerminalPane({ connected, onInput, onResize, registerWriter }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const connectedRef = useRef(connected);
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);
  const registerWriterRef = useRef(registerWriter);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    registerWriterRef.current = registerWriter;
  }, [registerWriter]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      theme: { background: "#101219" },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type === "keydown" && event.key === "Tab") {
        // Keep Tab inside terminal for remote shell completion.
        event.preventDefault();
        return true;
      }
      return true;
    });
    fitAddon.fit();
    terminal.focus();

    registerWriterRef.current((content) => terminal.write(content));

    const disposeInput = terminal.onData((value) => {
      // 连接后只显示远端回显，避免本地/远端双写叠加。
      if (!connectedRef.current) {
        terminal.write(value);
      }
      if (connectedRef.current) {
        onInputRef.current(value);
      }
    });

    const onWindowResize = () => {
      fitAddon.fit();
      onResizeRef.current(terminal.cols, terminal.rows);
    };

    window.addEventListener("resize", onWindowResize);
    onWindowResize();

    return () => {
      window.removeEventListener("resize", onWindowResize);
      disposeInput.dispose();
      terminal.dispose();
    };
  }, []);

  return <div className="terminal-pane" ref={containerRef} />;
}
