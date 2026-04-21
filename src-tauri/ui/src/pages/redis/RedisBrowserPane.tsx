import type { RefObject } from "react";
import type { I18nKey } from "../../i18n";
import type { RedisHashEntry, RedisKeyData, RedisKeyRef, RedisZsetEntry } from "../../services/types";
import { RedisKeyTreeNode } from "./RedisKeyTreeNode";
import { RedisTypedEditor } from "./RedisTypedEditor";
import type { RedisKeyTreeNode as RedisKeyTreeNodeModel } from "./redisTree";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  selected: boolean;
  pattern: string;
  groupDelimiter: string;
  scanLoading: boolean;
  scanCursor: number;
  keysLoaded: boolean;
  keys: RedisKeyRef[];
  keyTree: RedisKeyTreeNodeModel[];
  expandedGroups: Record<string, boolean>;
  selectedKeyData: RedisKeyData | null;
  ttlInput: string;
  saveResult: string | null;
  editorText: string;
  hashEntries: RedisHashEntry[];
  listItems: string[];
  setMembers: string[];
  setEditIndex: number | null;
  setDraft: string;
  zsetEntries: RedisZsetEntry[];
  resizingDataPane: boolean;
  zkDataWidth: number;
  browserBodyRef: RefObject<HTMLDivElement | null>;
  onPatternChange: (v: string) => void;
  onGroupDelimiterChange: (v: string) => void;
  onLoadKeys: (reset?: boolean) => void;
  onToggleGroup: (id: string) => void;
  onPickKey: (key: string) => void;
  onResizeDataPaneStart: () => void;
  onSaveValue: () => void;
  onTtlChange: (v: string) => void;
  onSaveTtl: () => void;
  onChangeEditorText: (value: string) => void;
  onChangeHashEntries: (updater: (prev: RedisHashEntry[]) => RedisHashEntry[]) => void;
  onChangeListItems: (updater: (prev: string[]) => string[]) => void;
  onChangeSetMembers: (updater: (prev: string[]) => string[]) => void;
  onChangeSetEditIndex: (value: number | null) => void;
  onChangeSetDraft: (value: string) => void;
  onChangeZsetEntries: (updater: (prev: RedisZsetEntry[]) => RedisZsetEntry[]) => void;
}

export function RedisBrowserPane(props: Props) {
  const {
    tr,
    selected,
    pattern,
    groupDelimiter,
    scanLoading,
    scanCursor,
    keysLoaded,
    keys,
    keyTree,
    expandedGroups,
    selectedKeyData,
    ttlInput,
    saveResult,
    editorText,
    hashEntries,
    listItems,
    setMembers,
    setEditIndex,
    setDraft,
    zsetEntries,
    resizingDataPane,
    zkDataWidth,
    browserBodyRef,
    onPatternChange,
    onGroupDelimiterChange,
    onLoadKeys,
    onToggleGroup,
    onPickKey,
    onResizeDataPaneStart,
    onSaveValue,
    onTtlChange,
    onSaveTtl,
    onChangeEditorText,
    onChangeHashEntries,
    onChangeListItems,
    onChangeSetMembers,
    onChangeSetEditIndex,
    onChangeSetDraft,
    onChangeZsetEntries,
  } = props;

  if (!selected) {
    return (
      <div className="terminal-main">
        <div className="empty-state">
          <div className="empty-title">{tr("redis.page.noSelection")}</div>
          <div className="empty-subtitle">{tr("redis.page.hint")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-main">
      <div className="zk-browser">
        <div className="zk-browser-header">
          <input value={pattern} onChange={(e) => onPatternChange(e.target.value)} placeholder={tr("redis.page.patternPlaceholder")} />
          <input value={groupDelimiter} onChange={(e) => onGroupDelimiterChange(e.target.value)} placeholder={tr("redis.page.groupDelimiterPlaceholder")} />
          <button className="btn btn-ghost" onClick={() => onLoadKeys()}>
            {scanLoading ? tr("redis.page.searching") : tr("redis.page.loadKeys")}
          </button>
        </div>
        <div
          className={`zk-browser-body ${resizingDataPane ? "resizing" : ""}`}
          ref={browserBodyRef}
          style={{ ["--zk-data-width" as string]: `${zkDataWidth}px` }}
        >
          <div className="zk-tree redis-key-tree">
            {keyTree.map((node) => (
              <RedisKeyTreeNode
                key={node.id}
                node={node}
                level={0}
                expandedGroups={expandedGroups}
                onToggle={onToggleGroup}
                onPick={(key) => onPickKey(key)}
                selectedKeyBase64={selectedKeyData?.key_base64}
              />
            ))}
            <div className="zk-node">
              <button className="btn btn-ghost zk-node-name" disabled={scanLoading || scanCursor === 0} onClick={() => onLoadKeys(false)}>
                {tr("redis.page.loadMore")}
              </button>
            </div>
            {keysLoaded && !scanLoading && keys.length === 0 ? <div className="card-subtitle">{tr("home.searchNoResults")}</div> : null}
          </div>
          <div className="zk-pane-splitter" onMouseDown={onResizeDataPaneStart} title={tr("redis.page.resizeDetailPaneHint")} />
          <div className="zk-data">
            <div className="zk-data-head">
              <div className="card-title">
                {selectedKeyData ? (selectedKeyData.key_utf8 ?? selectedKeyData.key_base64) : tr("redis.page.selectKeyHint")}
              </div>
              <button className="btn btn-primary" disabled={!selectedKeyData || selectedKeyData.payload.kind === "unsupported"} onClick={onSaveValue}>
                {tr("zk.page.save")}
              </button>
            </div>
            {selectedKeyData ? <div className="card-subtitle">{tr("redis.page.keyType", { type: selectedKeyData.key_type })}</div> : null}
            {selectedKeyData ? (
              <div className="zk-browser-header">
                <input placeholder={tr("redis.page.ttlPlaceholder")} value={ttlInput} onChange={(e) => onTtlChange(e.target.value)} />
                <button className="btn btn-ghost" onClick={onSaveTtl}>
                  {tr("redis.page.saveTtl")}
                </button>
              </div>
            ) : null}
            {saveResult ? <div className="zk-save-result">{saveResult}</div> : null}
            {selectedKeyData?.payload.kind === "unsupported" ? (
              <div className="card-subtitle">{tr("redis.page.unsupportedType", { type: selectedKeyData.payload.raw_type })}</div>
            ) : (
              <RedisTypedEditor
                selectedKeyData={selectedKeyData}
                editorText={editorText}
                hashEntries={hashEntries}
                listItems={listItems}
                setMembers={setMembers}
                setEditIndex={setEditIndex}
                setDraft={setDraft}
                zsetEntries={zsetEntries}
                tr={tr}
                onChangeEditorText={onChangeEditorText}
                onChangeHashEntries={onChangeHashEntries}
                onChangeListItems={onChangeListItems}
                onChangeSetMembers={onChangeSetMembers}
                onChangeSetEditIndex={onChangeSetEditIndex}
                onChangeSetDraft={onChangeSetDraft}
                onChangeZsetEntries={onChangeZsetEntries}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
