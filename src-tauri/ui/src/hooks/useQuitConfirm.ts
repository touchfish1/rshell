import { useCallback, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disconnectSession } from "../services/bridge";
import { getAllSettings } from "../lib/appSettings";

export function useQuitConfirm(connectedIds: string[]) {
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const connectedIdsRef = useRef<string[]>([]);
  connectedIdsRef.current = connectedIds;

  const requestQuitOrDestroy = useCallback(() => {
    const settings = getAllSettings();
    if (connectedIdsRef.current.length === 0 || !settings.confirmBeforeClose) {
      void getCurrentWindow()
        .destroy()
        .catch(() => {});
      return;
    }
    setCloseConfirmOpen(true);
  }, []);

  const confirmQuitApp = useCallback(async () => {
    setCloseConfirmOpen(false);
    const ids = [...connectedIdsRef.current];
    await Promise.all(ids.map((id) => disconnectSession(id).catch(() => {})));
    await getCurrentWindow()
      .destroy()
      .catch(() => {});
  }, []);

  return {
    closeConfirmOpen,
    setCloseConfirmOpen,
    requestQuitOrDestroy,
    confirmQuitApp,
  };
}

