import { useCallback, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disconnectSession } from "../services/bridge";

export function useQuitConfirm(connectedIds: string[]) {
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const connectedIdsRef = useRef<string[]>([]);
  connectedIdsRef.current = connectedIds;

  const requestQuitOrDestroy = useCallback(() => {
    if (connectedIdsRef.current.length === 0) {
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

