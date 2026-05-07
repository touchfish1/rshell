import React from "react";
import type { I18nKey } from "../i18n";
import { t, type Lang } from "../i18n/runtime";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
  info: React.ErrorInfo | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[rshell-ui] uncaught render error", error, info);
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const details = [error.stack || String(error), info?.componentStack].filter(Boolean).join("\n\n");
    const lang: Lang = (() => { try { const v = localStorage.getItem("rshell.lang"); return v === "zh-CN" || v === "en-US" ? v : "zh-CN"; } catch { return "zh-CN"; } })();
    const tr = (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars);

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b0f17",
          color: "#e7e8ea",
          padding: 16,
          fontFamily: "Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontFamily: "Segoe UI, system-ui, sans-serif" }}>{tr("error.renderTitle")}</h2>
        <p style={{ margin: "0 0 12px", color: "#9aa3b2", fontFamily: "Segoe UI, system-ui, sans-serif" }}>
          {tr("error.renderInstruction")}
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 12,
          }}
        >
          {details || String(error)}
        </pre>
      </div>
    );
  }
}

