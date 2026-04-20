import { useEffect, useRef, useState } from "react";
import type { HostMetrics, SftpEntry, SftpTextReadResult } from "../../services/types";
import { formatBytes } from "./formatters";
import { SftpTextEditorModal } from "./SftpTextEditorModal";
import { useI18n } from "../../i18n-context";
import { SftpMonitorCard } from "./SftpMonitorCard";
import { SftpFileBrowser } from "./SftpFileBrowser";
import { buildSftpPathCrumbs, getSftpDisplayName, readFileAsBase64 } from "./sftpHelpers";

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
      const base64 = await readFileAsBase64(file);
      await onSftpUpload(normalizedPath, file.name, base64);
      setUploadHint(tr("sftp.uploadSuccess", { name: file.name }));
    } finally {
      setUploading(false);
    }
  };

  const pathCrumbs = buildSftpPathCrumbs(normalizedPath);

  const getDisplayName = (entry: SftpEntry) => getSftpDisplayName(entry, tr("sftp.unnamed"));

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
      <SftpMonitorCard
        tr={tr}
        activeHostLabel={activeHostLabel}
        activeHostIp={activeHostIp}
        monitorSupported={monitorSupported}
        monitorMetrics={monitorMetrics}
        monitorError={monitorError}
        monitorChecking={monitorChecking}
        monitorCheckedAt={monitorCheckedAt}
        copied={copied}
        onCopyHostIp={() => void copyHostIp()}
        onRefreshMetrics={onRefreshMetrics}
      />

      <SftpFileBrowser
        tr={tr}
        monitorSupported={monitorSupported}
        uploading={uploading}
        dragOver={dragOver}
        uploadHint={uploadHint}
        sftpLoading={sftpLoading}
        sftpEntries={sftpEntries}
        canGoUp={canGoUp}
        normalizedPath={normalizedPath}
        pathCrumbs={pathCrumbs}
        menu={menu}
        uploadInputRef={uploadInputRef}
        onSftpUp={onSftpUp}
        onSftpOpenDir={onSftpOpenDir}
        onSetDragOver={setDragOver}
        onRunUpload={(file) => void runUpload(file)}
        onOpenEditor={(path) => void openEditor(path)}
        onOpenContextMenu={(x, y, path) => setMenu({ x, y, path })}
        onCloseContextMenu={() => setMenu(null)}
        onSftpDownload={onSftpDownload}
        getDisplayName={getDisplayName}
      />
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

