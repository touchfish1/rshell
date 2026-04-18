/**
 * 工作区顶部的会话标签栏：切换、关闭、右键菜单（复制标题、关闭到左/右等）、中键关闭。
 */
import type { WorkspaceTab } from "../../services/types";
import { useI18n } from "../../i18n-context";

interface Props {
  tabs: WorkspaceTab[];
  activeTabId?: string;
  connectedIds: string[];
  menu: { x: number; y: number; tabId: string } | null;
  onSetMenu: (next: { x: number; y: number; tabId: string } | null) => void;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onDuplicateTab: (id: string) => void;
  onCloseTabsToLeft: (id: string) => void;
  onCloseTabsToRight: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
}

export function SessionTabs({
  tabs,
  activeTabId,
  connectedIds,
  menu,
  onSetMenu,
  onSwitchTab,
  onCloseTab,
  onDuplicateTab,
  onCloseTabsToLeft,
  onCloseTabsToRight,
  onCloseOtherTabs,
}: Props) {
  const { tr } = useI18n();
  const menuTabIndex = menu ? tabs.findIndex((tab) => tab.id === menu.tabId) : -1;
  const hasLeftTabs = menuTabIndex > 0;
  const hasRightTabs = menuTabIndex >= 0 && menuTabIndex < tabs.length - 1;
  const hasOtherTabs = tabs.length > 1;

  return (
    <>
      <div className="session-tabs">
        {tabs.length === 0 ? (
          <div className="session-tab-empty">{tr("terminal.noOpenedSession")}</div>
        ) : (
          tabs.map((tab) => {
            const active = tab.id === activeTabId;
            const backendConnected = connectedIds.includes(tab.sessionId);
            const linkState = tab.linkState ?? "ready";
            const dotClass =
              linkState === "failed"
                ? "err"
                : linkState === "connecting"
                  ? "pending"
                  : backendConnected
                    ? "on"
                    : "off";
            return (
              <div
                key={tab.id}
                className={`session-tab ${active ? "active" : ""}`}
                title={tr("terminal.closeTabMiddleHint")}
                onMouseDown={(e) => {
                  if (e.button === 1) e.preventDefault();
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
              >
                <button
                  className="session-tab-main"
                  onClick={() => onSwitchTab(tab.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSetMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                  }}
                >
                  {tab.title}
                  <span className={`session-dot ${dotClass}`} />
                </button>
                <button className="session-tab-close" onClick={() => onCloseTab(tab.id)} title={tr("terminal.closeTab")}>
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      {menu ? (
        <div className="session-tab-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            onClick={() => {
              onDuplicateTab(menu.tabId);
              onSetMenu(null);
            }}
          >
            {tr("terminal.duplicateSession")}
          </button>
          <button
            disabled={!hasRightTabs}
            onClick={() => {
              if (!hasRightTabs) return;
              onCloseTabsToRight(menu.tabId);
              onSetMenu(null);
            }}
          >
            {tr("terminal.closeRight")}
          </button>
          <button
            disabled={!hasLeftTabs}
            onClick={() => {
              if (!hasLeftTabs) return;
              onCloseTabsToLeft(menu.tabId);
              onSetMenu(null);
            }}
          >
            {tr("terminal.closeLeft")}
          </button>
          <button
            disabled={!hasOtherTabs}
            onClick={() => {
              if (!hasOtherTabs) return;
              onCloseOtherTabs(menu.tabId);
              onSetMenu(null);
            }}
          >
            {tr("terminal.closeOthers")}
          </button>
        </div>
      ) : null}
    </>
  );
}

