import { useEffect, useState } from "react";
import type { HostMetrics, Session } from "../../services/types";
import type { I18nKey } from "../../i18n";

export function useTerminalMetrics(args: {
  activeSession?: Session;
  onGetHostMetrics: (session: Session) => Promise<HostMetrics>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}) {
  const { activeSession, onGetHostMetrics, tr } = args;
  const monitorSupported = activeSession?.protocol === "ssh";
  const [monitorMetrics, setMonitorMetrics] = useState<HostMetrics | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [monitorChecking, setMonitorChecking] = useState(false);
  const [monitorCheckedAt, setMonitorCheckedAt] = useState<string>("");

  const refreshMetrics = async (session: Session) => {
    setMonitorChecking(true);
    try {
      const metrics = await onGetHostMetrics(session);
      setMonitorMetrics(metrics);
      setMonitorError(null);
      setMonitorCheckedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setMonitorError(err instanceof Error ? err.message : String(err));
      setMonitorMetrics(null);
    } finally {
      setMonitorChecking(false);
    }
  };

  useEffect(() => {
    if (!activeSession || !monitorSupported) {
      setMonitorMetrics(null);
      setMonitorError(activeSession && activeSession.protocol !== "ssh" ? tr("terminal.onlySshMonitor") : null);
      setMonitorCheckedAt("");
      return;
    }
    let cancelled = false;
    const run = async () => {
      setMonitorChecking(true);
      try {
        const metrics = await onGetHostMetrics(activeSession);
        if (cancelled) return;
        setMonitorMetrics(metrics);
        setMonitorError(null);
        setMonitorCheckedAt(new Date().toLocaleTimeString());
      } catch (err) {
        if (cancelled) return;
        setMonitorError(err instanceof Error ? err.message : String(err));
        setMonitorMetrics(null);
      } finally {
        if (!cancelled) setMonitorChecking(false);
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSession, monitorSupported, onGetHostMetrics, tr]);

  return {
    monitorSupported,
    monitorMetrics,
    monitorError,
    monitorChecking,
    monitorCheckedAt,
    refreshMetrics,
  };
}

