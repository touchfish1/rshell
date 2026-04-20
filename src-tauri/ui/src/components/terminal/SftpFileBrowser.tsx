import type { RefObject } from "react";
import type { SftpEntry } from "../../services/types";
import type { I18nKey } from "../../i18n";
import { formatMtime, formatSize } from "./formatters";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  monitorSupported: boolean;
  uploading: boolean;
  dragOver: boolean;
  uploadHint: string | null;
  sftpLoading: boolean;
  sftpEntries: SftpEntry[];
  canGoUp: boolean;
  normalizedPath: string;
  pathCrumbs: Array<{ label: string; path: string }>;
  menu: { x: number; y: number; path: string } | null;
  uploadInputRef: RefObject<HTMLInputElement>;
  onSftpUp: () => void;
  onSftpOpenDir: (path: string) => void;
  onSetDragOver: (value: boolean) => void;
  onRunUpload: (file: File) => void;
  onOpenEditor: (path: string) => void;
  onOpenContextMenu: (x: number, y: number, path: string) => void;
  onCloseContextMenu: () => void;
  onSftpDownload: (path: string) => void;
  getDisplayName: (entry: SftpEntry) => string;
}

export function SftpFileBrowser({
  tr,
  monitorSupported,
  uploading,
  dragOver,
  uploadHint,
  sftpLoading,
  sftpEntries,
  canGoUp,
  normalizedPath,
  pathCrumbs,
  menu,
  uploadInputRef,
  onSftpUp,
  onSftpOpenDir,
  onSetDragOver,
  onRunUpload,
  onOpenEditor,
  onOpenContextMenu,
  onCloseContextMenu,
  onSftpDownload,
  getDisplayName,
}: Props) {
  return (
    <div className="sftp-file-list">
      <div className="panel-title">{tr("sftp.fileList")}</div>
      <div className="sftp-toolbar">
        <button onClick={onSftpUp} disabled={!canGoUp}>
          {tr("sftp.up")}
        </button>
        <button type="button" disabled={!monitorSupported || uploading} onClick={() => uploadInputRef.current?.click()} title={tr("sftp.upload")}>
          {tr("sftp.upload")}
        </button>
        <input
          ref={uploadInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onRunUpload(f);
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
          onSetDragOver(true);
        }}
        onDragOver={(e) => {
          if (!monitorSupported) return;
          e.preventDefault();
        }}
        onDragLeave={(e) => {
          if (!monitorSupported) return;
          e.preventDefault();
          onSetDragOver(false);
        }}
        onDrop={(e) => {
          if (!monitorSupported) return;
          e.preventDefault();
          onSetDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onRunUpload(f);
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
                    onOpenContextMenu(e.clientX, e.clientY, entry.path);
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (entry.is_dir) return;
                    onOpenEditor(entry.path);
                  }}
                  title={entry.path}
                >
                  <span className="sftp-col-name">
                    <span className={`sftp-kind-icon ${entry.is_dir ? "folder" : "file"}`}>{entry.is_dir ? "📁" : "📄"}</span>
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
      {menu ? (
        <div className="sftp-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            onClick={() => {
              onSftpDownload(menu.path);
              onCloseContextMenu();
            }}
          >
            {tr("sftp.downloadFile")}
          </button>
          <button
            onClick={() => {
              onOpenEditor(menu.path);
              onCloseContextMenu();
            }}
          >
            {tr("sftp.editTextFile")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
