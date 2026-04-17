import { useEffect } from "react";
import { onDebugLog, onTerminalOutput, pullOutput } from "../services/bridge";
import type { Session } from "../services/types";
import type { I18nKey } from "../i18n";

const PULL_OUTPUT_INTERVAL_MS = 80;

function normalizeEncoding(encoding?: string) {
  const value = (encoding || "utf-8").trim().toLowerCase();
  if (value === "utf8") return "utf-8";
  if (value === "gb2312") return "gbk";
  if (value === "cp936") return "gbk";
  return value;
}

function decodeOutput(base64: string, sessionId: string, sessions: Session[]) {
  const session = sessions.find((item) => item.id === sessionId);
  const preferredEncoding = normalizeEncoding(session?.encoding);
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  try {
    return new TextDecoder(preferredEncoding).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function useTerminalOutput(opts: {
  sessions: Session[];
  connectedIds: string[];
  getTabsBySessionId: (sessionId: string) => Array<{ id: string }>;
  writeToTab: (tabId: string, text: string) => void;
  onError: (message: string) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}) {
  const { sessions, connectedIds, getTabsBySessionId, writeToTab, onError, tr } = opts;

  useEffect(() => {
    const unlistenPromise = onTerminalOutput((payload) => {
      const plain = decodeOutput(payload.data, payload.sessionId, sessions);
      const relatedTabs = getTabsBySessionId(payload.sessionId);
      relatedTabs.forEach((tab) => writeToTab(tab.id, plain));
    });
    const unlistenDebugPromise = onDebugLog((payload) => {
      const line = `[${new Date().toLocaleTimeString()}] [${payload.stage}] ${payload.sessionId} ${payload.message}`;
      console.debug("[frontend][debug-log]", line);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
      void unlistenDebugPromise.then((unlisten) => unlisten());
    };
  }, [getTabsBySessionId, sessions, writeToTab]);

  useEffect(() => {
    if (connectedIds.length === 0) return;
    let inflight = false;
    const timer = window.setInterval(() => {
      if (inflight) return;
      inflight = true;
      connectedIds.forEach((id) => {
        void pullOutput(id)
          .then((base64) => {
            if (!base64) return;
            const plain = decodeOutput(base64, id, sessions);
            const relatedTabs = getTabsBySessionId(id);
            relatedTabs.forEach((tab) => writeToTab(tab.id, plain));
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes("inactive session")) return;
            onError(tr("error.pullOutputFailed", { message }));
          });
      });
      inflight = false;
    }, PULL_OUTPUT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [connectedIds, getTabsBySessionId, onError, sessions, tr, writeToTab]);
}

