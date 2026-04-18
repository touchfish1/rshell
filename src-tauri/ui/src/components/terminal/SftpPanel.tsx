import { useEffect, useRef, useState } from "react";
import type { HostMetrics, SftpEntry, SftpTextReadResult } from "../../services/types";
import { formatBytes, formatMtime, formatSize } from "./formatters";
import { SftpTextEditorModal } from "./SftpTextEditorModal";
import { useI18n } from "../../i18n-context";

interface Props {
  activeHostLabel: string;
  activeHostIp?: string;
  monitorSupported: boolean;
  monitorMetrics: HostMetrics | null;
  monitorError: string | null;
  monitorChecking: boolean;
  monitorCheckedAt: string;
  onRefreshMetrics: () => void;

  sftpEntries: SftpEntry[];
  sftpPath: string;
  sftpLoading: boolean;
  onSftpUp: () => void;
  onSftpOpenDir: (path: string) => void;
  onSftpDownload: (path: string) => void;
  onSftpUpload: (remoteDir: string, fileName: string, contentBase64: string) => Promise<void>;
  onSftpReadText: (path: string) => Promise<SftpTextReadResult>;
  onSftpSaveText: (path: string, content: string) => Promise<void>;
}

export function SftpPanel({
  activeHostLabel,
  activeHostIp,
  monitorSupported,
  monitorMetrics,
  monitorError,
  monitorChecking,
  monitorCheckedAt,
  onRefreshMetrics,
  sftpEntries,
  sftpPath,
  sftpLoading,
  onSftpUp,
  onSftpOpenDir,
  onSftpDownload,
  onSftpUpload,
  onSftpReadText,
  onSftpSaveText,
}: Props) {
  const { tr } = useI18n();
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyTimer, setCopyTimer] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPath, setEditorPath] = useState("");
  const [editorText, setEditorText] = useState("");
  const [editorOriginalText, setEditorOriginalText] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorWarning, setEditorWarning] = useState<string | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [editorMeta, setEditorMeta] = useState<{ loadedBytes: number; totalBytes: number } | null>(null);
  const editorTextRef = useRef<HTMLTextAreaElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadHint, setUploadHint] = useState<string | null>(null);

  const normalizedPath = sftpPath === "." ? "/" : sftpPath;
  const canGoUp = normalizedPath !== "/";

  const copyHostIp = async () => {
    if (!activeHostIp) return;
    try {
      await navigator.clipboard.writeText(activeHostIp);
      setCopied(true);
      if (copyTimer) window.clearTimeout(copyTimer);
      const timer = window.setTimeout(() => {
        setCopied(false);
        setCopyTimer(null);
      }, 1500);
      setCopyTimer(timer);
    } catch {
      // Ignore clipboard failures to keep monitor interactions lightweight.
    }
  };

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer) window.clearTimeout(copyTimer);
    };
  }, [copyTimer]);

  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorOpen]);

  useEffect(() => {
    if (!editorOpen) return;
    if (editorLoading) return;
    const node = editorTextRef.current;
    if (!node) return;
    node.focus();
    // Avoid accidental full-text selection caused by double-click focus transfer.
    const pos = Math.min(node.value.length, 0);
    node.setSelectionRange(pos, pos);
  }, [editorOpen, editorLoading]);

  const readAsBase64 = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunk));
    }
    return btoa(binary);
  };

  const runUpload = async (file: File) => {
    if (!monitorSupported) return;
    if (uploading) return;
    // 8MB soft limit to avoid UI freeze / large base64 payload
    const max = 8 * 1024 * 1024;
    if (file.size > max) {
      setUploadHint(tr("sftp.uploadTooLarge", { size: formatBytes(file.size) }));
      return;
    }
    setUploading(true);
    try {
      setUploadHint(tr("sftp.uploading"));
      const base64 = await readAsBase64(file);
      await onSftpUpload(normalizedPath, file.name, base64);
      setUploadHint(tr("sftp.uploadSuccess", { name: file.name }));
    } finally {
      setUploading(false);
    }
  };

  const pathCrumbs = (() => {
    const p = normalizedPath.replace(/\/+$/, "") || "/";
    if (p === "/") return [{ label: "/", path: "/" }] as { label: string; path: string }[];
    const segments = p.split("/").filter(Boolean);
    const out: { label: string; path: string }[] = [{ label: "/", path: "/" }];
    let acc = "";
    for (const seg of segments) {
      acc += `/${seg}`;
      out.push({ label: seg, path: acc });
    }
    return out;
  })();

  const getDisplayName = (entry: SftpEntry) => {
    if (entry.name && entry.name.trim()) return entry.name;
    const normalized = entry.path.replace(/\\/g, "/").replace(/\/+$/, "");
    const fallback = normalized.split("/").pop();
    return fallback && fallback.trim() ? fallback : tr("sftp.unnamed");
  };

  const openEditor = async (path: string) => {
    setEditorOpen(true);
    setEditorPath(path);
    setEditorText("");
    setEditorOriginalText("");
    setEditorError(null);
    setEditorWarning(null);
    setEditorReadOnly(false);
    setEditorMeta(null);
    setEditorLoading(true);
    try {
      const result = await onSftpReadText(path);
      if (result.too_large) {
        setEditorReadOnly(true);
        setEditorWarning(tr("sftp.editorTooLarge", { size: formatBytes(result.total_bytes) }));
        setEditorMeta({ loadedBytes: result.loaded_bytes, totalBytes: result.total_bytes });
        return;
      }
      setEditorText(result.content);
      setEditorOriginalText(result.content);
      setEditorMeta({ loadedBytes: result.loaded_bytes, totalBytes: result.total_bytes });
      if (result.truncated) {
        setEditorReadOnly(true);
        setEditorWarning(
          tr("sftp.editorTruncatedReadonly", {
            loaded: formatBytes(result.loaded_bytes),
            total: formatBytes(result.total_bytes),
          })
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditorError(tr("sftp.editorLoadFailed", { message }));
    } finally {
      setEditorLoading(false);
    }
  };

  const saveEditor = async () => {
    if (editorReadOnly || editorLoading || editorSaving) return;
    setEditorSaving(true);
    setEditorError(null);
    try {
      await onSftpSaveText(editorPath, editorText);
      setEditorOriginalText(editorText);
      setEditorWarning(tr("sftp.editorSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditorError(tr("sftp.editorSaveFailed", { message }));
    } finally {
      setEditorSaving(false);
    }
  };

  const editorDirty = editorText !== editorOriginalText;

  return (
    <aside className="terminal-sftp">
      <div className="sftp-monitor-card">
        <div className="sftp-monitor-head">
          <span>{tr("sftp.hostMonitor")}</span>
          <button onClick={onRefreshMetrics} disabled={!monitorSupported || monitorChecking}>
            {monitorChecking ? tr("sftp.refreshing") : tr("sftp.refresh")}
          </button>
        </div>
        <div className="sftp-monitor-host">
          <span>{activeHostLabel || tr("sftp.notConnected")}</span>
          {activeHostIp ? (
            <button
              className="copy-icon-btn"
              type="button"
              title={tr("sftp.copyIp")}
              aria-label={tr("sftp.copyIp")}
              onClick={copyHostIp}
            >
              {copied ? "✅" : "📋"}
            </button>
          ) : null}
          {copied ? <span className="copy-success-text">{tr("sftp.copied")}</span> : null}
        </div>
        {monitorError ? <div className="sftp-monitor-error">{monitorError}</div> : null}
        <div className="sftp-monitor-row">
          <span>{tr("sftp.cpu")}</span>
          <span>{monitorMetrics ? `${monitorMetrics.cpu_percent.toFixed(1)}%` : "-"}</span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.cpu_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-row">
          <span>{tr("sftp.memory")}</span>
          <span>
            {monitorMetrics
              ? `${formatBytes(monitorMetrics.memory_used_bytes)} / ${formatBytes(monitorMetrics.memory_total_bytes)}`
              : "-"}
          </span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.memory_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-row">
          <span>{tr("sftp.disk")}</span>
          <span>
            {monitorMetrics
              ? `${formatBytes(monitorMetrics.disk_used_bytes)} / ${formatBytes(monitorMetrics.disk_total_bytes)}`
              : "-"}
          </span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.disk_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-time">{tr("sftp.lastUpdated", { time: monitorCheckedAt || "-" })}</div>
      </div>

      <div className="sftp-file-list">
        <div className="panel-title">{tr("sftp.fileList")}</div>
        <div className="sftp-toolbar">
          <button onClick={onSftpUp} disabled={!canGoUp}>
            {tr("sftp.up")}
          </button>
          <button
            type="button"
            disabled={!monitorSupported || uploading}
            onClick={() => uploadInputRef.current?.click()}
            title={tr("sftp.upload")}
          >
            {tr("sftp.upload")}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void runUpload(f);
            }}
          />
          <div className="sftp-breadcrumbs" title={normalizedPath}>
            {pathCrumbs.map((c, i) => (
              <span key={c.path} className="sftp-bc-item">
                {i > 0 ? <span className="sftp-bc-sep">/</span> : null}
                <button type="button" className="sftp-bc-part" onClick={() => onSftpOpenDir(c.path)}>
                  {c.label}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="sftp-head">
          <span>{tr("sftp.fileName")}</span>
          <span>{tr("sftp.fileSize")}</span>
          <span>{tr("sftp.modifiedAt")}</span>
        </div>
        <ul
          className={dragOver ? "sftp-drop sftp-drop-active" : "sftp-drop"}
          onDragEnter={(e) => {
            if (!monitorSupported) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            if (!monitorSupported) return;
            e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (!monitorSupported) return;
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            if (!monitorSupported) return;
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void runUpload(f);
          }}
        >
          {sftpLoading ? (
            <li className="sftp-empty">{tr("sftp.loading")}</li>
          ) : sftpEntries.length === 0 ? (
            <li className="sftp-empty">{tr("sftp.emptyOrNoPermission")}</li>
          ) : (
            <>
              {canGoUp ? (
                <li className="sftp-row">
                  <button className="sftp-dir sftp-parent" onClick={onSftpUp} title={tr("sftp.backToParent")}>
                    <span className="sftp-col-name">
                      <span className="sftp-kind-icon folder">📁</span>
                      <span className="sftp-name-text">..</span>
                    </span>
                    <span className="sftp-col-size">-</span>
                    <span className="sftp-col-time">{tr("sftp.parent")}</span>
                  </button>
                </li>
              ) : null}
              {sftpEntries.map((entry) => (
                <li key={`${entry.path}:${entry.name}`} className="sftp-row">
                  <button
                    className={entry.is_dir ? "sftp-dir" : "sftp-file"}
                    onClick={() => entry.is_dir && onSftpOpenDir(entry.path)}
                    onContextMenu={(e) => {
                      if (entry.is_dir) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setMenu({ x: e.clientX, y: e.clientY, path: entry.path });
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (entry.is_dir) return;
                      void openEditor(entry.path);
                    }}
                    title={entry.path}
                  >
                    <span className="sftp-col-name">
                      <span className={`sftp-kind-icon ${entry.is_dir ? "folder" : "file"}`}>
                        {entry.is_dir ? "📁" : "📄"}
                      </span>
                      <span className="sftp-name-text">{getDisplayName(entry)}</span>
                    </span>
                    <span className="sftp-col-size">{entry.is_dir ? "-" : formatSize(entry.size)}</span>
                    <span className="sftp-col-time">{formatMtime(entry.mtime)}</span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
        {dragOver ? <div className="sftp-drop-hint">{tr("sftp.dropToUpload")}</div> : null}
        {uploadHint ? <div className="sftp-upload-hint">{uploadHint}</div> : null}
      </div>

      {menu ? (
        <div className="sftp-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            onClick={() => {
              onSftpDownload(menu.path);
              setMenu(null);
            }}
          >
            {tr("sftp.downloadFile")}
          </button>
          <button
            onClick={() => {
              void openEditor(menu.path);
              setMenu(null);
            }}
          >
            {tr("sftp.editTextFile")}
          </button>
        </div>
      ) : null}
      <SftpTextEditorModal
        open={editorOpen}
        editorPath={editorPath}
        editorText={editorText}
        onEditorTextChange={setEditorText}
        editorLoading={editorLoading}
        editorSaving={editorSaving}
        editorError={editorError}
        editorWarning={editorWarning}
        editorReadOnly={editorReadOnly}
        editorMeta={editorMeta}
        editorDirty={editorDirty}
        editorTextRef={editorTextRef}
        tr={tr}
        onClose={() => setEditorOpen(false)}
        onSave={saveEditor}
      />
    </aside>
  );
}

