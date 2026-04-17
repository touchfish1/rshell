import { useCallback, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function useUpdater(opts: { setStatus: (text: string) => void; setError: (text: string | null) => void }) {
  const { setStatus, setError } = opts;
  const [upgradeChecking, setUpgradeChecking] = useState(false);

  const checkOnlineUpgrade = useCallback(async () => {
    if (upgradeChecking) return;
    setUpgradeChecking(true);
    setError(null);
    setStatus("检查新版本中...");
    try {
      const current = await getVersion();
      const update = await check();
      if (!update) {
        setStatus(`当前已是最新版本 v${current}`);
        return;
      }

      const nextVersion = update.version;
      const shouldInstall = window.confirm(
        `检测到新版本 v${nextVersion}（当前 v${current}）。\n是否立即下载并自动安装重启？`
      );
      if (!shouldInstall) {
        setStatus(`发现新版本 v${nextVersion}，已取消升级`);
        return;
      }

      setStatus(`正在下载更新 v${nextVersion}...`);
      let downloadedBytes = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            setStatus(`开始下载 v${nextVersion}...`);
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (contentLength > 0) {
              const percent = Math.min(100, Math.floor((downloadedBytes / contentLength) * 100));
              setStatus(`下载更新中 v${nextVersion}... ${percent}%`);
            } else {
              setStatus(`下载更新中 v${nextVersion}...`);
            }
            break;
          case "Finished":
            setStatus(`更新包下载完成，正在安装 v${nextVersion}...`);
            break;
          default:
            break;
        }
      });
      setStatus("安装完成，应用即将重启...");
      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`在线升级检查失败: ${message}`);
      setStatus("在线升级检查失败");
    } finally {
      setUpgradeChecking(false);
    }
  }, [setError, setStatus, upgradeChecking]);

  return {
    upgradeChecking,
    checkOnlineUpgrade,
  };
}

