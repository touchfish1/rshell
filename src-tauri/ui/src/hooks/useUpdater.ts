import { useCallback, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { I18nKey } from "../i18n";

export function useUpdater(opts: {
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}) {
  const { setStatus, setError, tr } = opts;
  const [upgradeChecking, setUpgradeChecking] = useState(false);

  const checkOnlineUpgrade = useCallback(async () => {
    if (upgradeChecking) return;
    setUpgradeChecking(true);
    setError(null);
    setStatus(tr("updater.checking"));
    try {
      const current = await getVersion();
      const update = await check();
      if (!update) {
        setStatus(tr("updater.latest", { current }));
        return;
      }

      const nextVersion = update.version;
      const shouldInstall = window.confirm(tr("updater.confirm", { next: nextVersion, current }));
      if (!shouldInstall) {
        setStatus(tr("updater.cancelled", { next: nextVersion }));
        return;
      }

      setStatus(tr("updater.downloading", { next: nextVersion }));
      let downloadedBytes = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            setStatus(tr("updater.startDownloading", { next: nextVersion }));
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (contentLength > 0) {
              const percent = Math.min(100, Math.floor((downloadedBytes / contentLength) * 100));
              setStatus(tr("updater.downloadingWithPercent", { next: nextVersion, percent }));
            } else {
              setStatus(tr("updater.downloading", { next: nextVersion }));
            }
            break;
          case "Finished":
            setStatus(tr("updater.downloadDoneInstalling", { next: nextVersion }));
            break;
          default:
            break;
        }
      });
      setStatus(tr("updater.installDoneRelaunch"));
      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("updater.failed", { message }));
      setStatus(tr("updater.failed", { message }));
    } finally {
      setUpgradeChecking(false);
    }
  }, [setError, setStatus, tr, upgradeChecking]);

  return {
    upgradeChecking,
    checkOnlineUpgrade,
  };
}

