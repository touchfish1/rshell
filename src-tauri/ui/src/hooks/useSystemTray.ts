import { useEffect, useRef } from "react";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon, type TrayIconEvent } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Options = {
  tooltip: string;
  showLabel: string;
  quitLabel: string;
  onRequestQuit: () => void;
};

async function showMainWindow() {
  const w = getCurrentWindow();
  await w.show();
  await w.setFocus();
}

function handleTrayAction(event: TrayIconEvent) {
  if (event.type === "DoubleClick" && event.button === "Left") {
    void showMainWindow();
  }
}

/**
 * 创建系统托盘：菜单「显示主窗口」「退出」；左键双击托盘图标显示窗口。
 * 关闭主窗口由 Rust 侧隐藏到托盘，退出走 onRequestQuit（与原先关闭确认一致）。
 */
export function useSystemTray({ tooltip, showLabel, quitLabel, onRequestQuit }: Options) {
  const onRequestQuitRef = useRef(onRequestQuit);
  onRequestQuitRef.current = onRequestQuit;

  useEffect(() => {
    let cancelled = false;
    let tray: TrayIcon | undefined;

    void (async () => {
      try {
        const icon = await defaultWindowIcon();
        const menu = await Menu.new({
          items: [
            {
              id: "tray-show",
              text: showLabel,
              action: () => {
                void showMainWindow();
              },
            },
            {
              id: "tray-quit",
              text: quitLabel,
              action: () => {
                onRequestQuitRef.current();
              },
            },
          ],
        });

        tray = await TrayIcon.new({
          icon: icon ?? undefined,
          menu,
          tooltip,
          action: handleTrayAction,
        });

        if (cancelled) {
          await tray.close();
        }
      } catch {
        // 非 Tauri 环境或平台不支持托盘时忽略
      }
    })();

    return () => {
      cancelled = true;
      void tray
        ?.close()
        .catch(() => {});
    };
  }, [tooltip, showLabel, quitLabel]);
}
