import { useEffect, useMemo, useRef, useState } from "react";
import type { ZkNodeData, ZookeeperConnection, ZookeeperConnectionInput } from "../services/types";
import { connectZookeeper, disconnectZookeeper, zkGetData, zkListChildren, zkSetData } from "../services/bridge";
import { ZkConnectionList } from "../components/zookeeper/ZkConnectionList";
import { ErrorBanner } from "../components/ErrorBanner";
import type { I18nKey } from "../i18n";
import { ZkBrowserPane } from "./zookeeper/ZkBrowserPane";

interface Props {
  connections: ZookeeperConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: ZookeeperConnectionInput, secret?: string) => Promise<ZookeeperConnection | null>;
  onUpdate: (id: string, input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTest: (input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

type LoadState = "idle" | "loading" | "ready" | "error";

function joinPath(parent: string, child: string) {
  if (parent === "/") return `/${child}`;
  return `${parent}/${child}`;
}

export default function ZookeeperPage({
  connections,
  selectedId,
  status,
  error,
  onDismissError,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onTest,
  onGetSecret,
  onBack,
  tr,
}: Props) {
  const selected = useMemo(() => connections.find((c) => c.id === selectedId) ?? null, [connections, selectedId]);
  const [connected, setConnected] = useState(false);
  const [treeState, setTreeState] = useState<Record<string, LoadState>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "/": true });
  const [selectedPath, setSelectedPath] = useState("/");
  const [nodeData, setNodeData] = useState<ZkNodeData | null>(null);
  const [editorText, setEditorText] = useState("");
  const [savingNode, setSavingNode] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [zkDataWidth, setZkDataWidth] = useState(460);
  const [resizingDataPane, setResizingDataPane] = useState(false);
  const browserBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConnected(false);
    setTreeState({});
    setChildrenMap({});
    setExpanded({ "/": true });
    setSelectedPath("/");
    setNodeData(null);
    setEditorText("");
    setSavingNode(false);
    setSaveResult(null);
  }, [selectedId]);

  const ensureConnected = async () => {
    if (!selected) throw new Error(tr("zk.error.noConnectionSelected"));
    if (connected) return;
    await connectZookeeper(selected.id);
    setConnected(true);
  };

  const loadChildren = async (path: string) => {
    if (!selected) return;
    setTreeState((prev) => ({ ...prev, [path]: "loading" }));
    try {
      await ensureConnected();
      const children = await zkListChildren(selected.id, path);
      children.sort((a, b) => a.localeCompare(b));
      setChildrenMap((prev) => ({ ...prev, [path]: children }));
      setTreeState((prev) => ({ ...prev, [path]: "ready" }));
    } catch (e) {
      setTreeState((prev) => ({ ...prev, [path]: "error" }));
      const message = e instanceof Error ? e.message : String(e);
      setSaveResult(tr("zk.page.saveFailed", { message }));
      throw e;
    }
  };

  useEffect(() => {
    if (!selected) return;
    void loadChildren("/").catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const onPickPath = async (path: string) => {
    if (!selected) return;
    setSelectedPath(path);
    setNodeData(null);
    setEditorText("");
    setSaveResult(null);
    try {
      await ensureConnected();
      const data = await zkGetData(selected.id, path);
      setNodeData(data);
      setEditorText(data.data_utf8 ?? "");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveResult(tr("zk.page.saveFailed", { message }));
      setNodeData(null);
    }
  };

  const saveNodeData = async () => {
    if (!selected || !nodeData || nodeData.data_utf8 == null) return;
    setSavingNode(true);
    setSaveResult(null);
    try {
      await ensureConnected();
      await zkSetData(selected.id, selectedPath, editorText);
      const refreshed = await zkGetData(selected.id, selectedPath);
      setNodeData(refreshed);
      setEditorText(refreshed.data_utf8 ?? "");
      setSaveResult(tr("zk.page.saveSuccess"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveResult(tr("zk.page.saveFailed", { message }));
    } finally {
      setSavingNode(false);
    }
  };

  useEffect(() => {
    if (!resizingDataPane) return;
    const onMouseMove = (event: MouseEvent) => {
      const root = browserBodyRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const minTree = 260;
      const minData = 320;
      const nextDataWidth = rect.right - event.clientX;
      const maxData = Math.max(minData, rect.width - minTree - 8);
      const clamped = Math.max(minData, Math.min(nextDataWidth, maxData));
      setZkDataWidth(Math.round(clamped));
    };
    const onMouseUp = () => setResizingDataPane(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingDataPane]);

  const onToggleExpand = (path: string, isExpanded: boolean, state: LoadState) => {
    setExpanded((prev) => ({ ...prev, [path]: !isExpanded }));
    if (!isExpanded && state === "idle") {
      void loadChildren(path).catch(() => undefined);
    }
  };

  return (
    <section className="workspace zk-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">{tr("zk.page.title")}</div>
            <div className="topbar-subtitle">{selected ? selected.name : tr("zk.page.noSelection")}</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onBack}>
            {tr("terminal.back")}
          </button>
          <button
            className="btn btn-ghost"
            disabled={!selected || !connected}
            onClick={() => {
              if (!selected) return;
              void disconnectZookeeper(selected.id).finally(() => setConnected(false));
            }}
          >
            {tr("zk.page.disconnect")}
          </button>
          <span className={connected ? "pill pill-ok" : "pill"}>{connected ? tr("top.online") : tr("top.offline")}</span>
          <span className="pill pill-muted">{status}</span>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}

      <div className="terminal-layout">
        <ZkConnectionList
          connections={connections}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onTest={onTest}
          onGetSecret={onGetSecret}
        />
        <ZkBrowserPane
          tr={tr}
          selected={Boolean(selected)}
          selectedPath={selectedPath}
          expanded={expanded}
          treeState={treeState}
          childrenMap={childrenMap}
          resizingDataPane={resizingDataPane}
          zkDataWidth={zkDataWidth}
          browserBodyRef={browserBodyRef}
          nodeData={nodeData}
          editorText={editorText}
          savingNode={savingNode}
          saveResult={saveResult}
          onToggleExpand={onToggleExpand}
          onPickPath={(path) => void onPickPath(path)}
          onRefreshRoot={() => void loadChildren("/").catch(() => undefined)}
          onResizeDataPaneStart={() => setResizingDataPane(true)}
          onSaveNode={() => void saveNodeData()}
          onChangeEditorText={setEditorText}
          joinPath={joinPath}
        />
      </div>
    </section>
  );
}

