import type { RefObject } from "react";
import type { I18nKey } from "../../i18n";
import type { ZkNodeData } from "../../services/types";
import { ZkTreeNode } from "./ZkTreeNode";

type LoadState = "idle" | "loading" | "ready" | "error";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  selected: boolean;
  selectedPath: string;
  expanded: Record<string, boolean>;
  treeState: Record<string, LoadState>;
  childrenMap: Record<string, string[]>;
  resizingDataPane: boolean;
  zkDataWidth: number;
  browserBodyRef: RefObject<HTMLDivElement | null>;
  nodeData: ZkNodeData | null;
  editorText: string;
  savingNode: boolean;
  saveResult: string | null;
  onToggleExpand: (path: string, isExpanded: boolean, state: LoadState) => void;
  onPickPath: (path: string) => void;
  onRefreshRoot: () => void;
  onResizeDataPaneStart: () => void;
  onSaveNode: () => void;
  onChangeEditorText: (value: string) => void;
  joinPath: (parent: string, child: string) => string;
}

export function ZkBrowserPane({
  tr,
  selected,
  selectedPath,
  expanded,
  treeState,
  childrenMap,
  resizingDataPane,
  zkDataWidth,
  browserBodyRef,
  nodeData,
  editorText,
  savingNode,
  saveResult,
  onToggleExpand,
  onPickPath,
  onRefreshRoot,
  onResizeDataPaneStart,
  onSaveNode,
  onChangeEditorText,
  joinPath,
}: Props) {
  if (!selected) {
    return (
      <div className="terminal-main">
        <div className="empty-state">
          <div className="empty-title">{tr("zk.page.noSelection")}</div>
          <div className="empty-subtitle">{tr("zk.page.hint")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-main">
      <div className="zk-browser">
        <div className="zk-browser-header">
          <div className="pill pill-muted">{tr("zk.page.currentPath", { path: selectedPath })}</div>
          <button type="button" className="btn btn-ghost" onClick={onRefreshRoot}>
            {tr("zk.page.refreshRoot")}
          </button>
        </div>
        <div
          className={`zk-browser-body ${resizingDataPane ? "resizing" : ""}`}
          ref={browserBodyRef}
          style={{ ["--zk-data-width" as string]: `${zkDataWidth}px` }}
        >
          <div className="zk-tree">
            <ZkTreeNode
              path="/"
              name="/"
              selectedPath={selectedPath}
              expanded={expanded}
              treeState={treeState}
              childrenMap={childrenMap}
              tr={tr}
              onToggleExpand={onToggleExpand}
              onPickPath={onPickPath}
              joinPath={joinPath}
            />
          </div>
          <div className="zk-pane-splitter" onMouseDown={onResizeDataPaneStart} title={tr("zk.page.resizeDataPaneHint")} />
          <div className="zk-data">
            <div className="zk-data-head">
              <div className="card-title">{tr("zk.page.nodeData")}</div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!nodeData || nodeData.data_utf8 == null || savingNode}
                onClick={onSaveNode}
              >
                {savingNode ? tr("zk.page.saving") : tr("zk.page.save")}
              </button>
            </div>
            {nodeData ? (
              <>
                <div className="card-subtitle">{tr("zk.page.nodeBytes", { bytes: nodeData.total_bytes })}</div>
                {saveResult ? <div className="zk-save-result">{saveResult}</div> : null}
                <textarea
                  className="zk-data-textarea"
                  readOnly={nodeData.data_utf8 == null || savingNode}
                  value={nodeData.data_utf8 != null ? editorText : nodeData.data_base64}
                  onChange={(e) => onChangeEditorText(e.target.value)}
                />
                {nodeData.data_utf8 ? <div className="hint">{tr("zk.page.utf8Hint")}</div> : <div className="hint">{tr("zk.page.base64Hint")}</div>}
              </>
            ) : (
              <div className="card-subtitle">{tr("zk.page.selectNodeHint")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
