import type { RefObject } from "react";
import type { I18nKey } from "../../i18n";
import { formatBytes } from "./formatters";

interface Props {
  open: boolean;
  editorPath: string;
  editorText: string;
  onEditorTextChange: (value: string) => void;
  editorLoading: boolean;
  editorSaving: boolean;
  editorError: string | null;
  editorWarning: string | null;
  editorReadOnly: boolean;
  editorMeta: { loadedBytes: number; totalBytes: number } | null;
  editorDirty: boolean;
  editorTextRef: RefObject<HTMLTextAreaElement>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  onSave: () => void;
}

export function SftpTextEditorModal({
  open,
  editorPath,
  editorText,
  onEditorTextChange,
  editorLoading,
  editorSaving,
  editorError,
  editorWarning,
  editorReadOnly,
  editorMeta,
  editorDirty,
  editorTextRef,
  tr,
  onClose,
  onSave,
}: Props) {
  if (!open) return null;
  return (
    <div className="sftp-editor-mask" onClick={onClose}>
      <div className="sftp-editor-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="sftp-editor-head">
          <strong>{tr("sftp.textEditor")}</strong>
          <span className="sftp-editor-path" title={editorPath}>
            {editorPath}
          </span>
        </div>
        {editorMeta ? (
          <div className="sftp-editor-meta">
            {tr("sftp.editorMeta", {
              loaded: formatBytes(editorMeta.loadedBytes),
              total: formatBytes(editorMeta.totalBytes),
            })}
          </div>
        ) : null}
        {editorWarning ? <div className="sftp-editor-warning">{editorWarning}</div> : null}
        {editorError ? <div className="sftp-editor-error">{editorError}</div> : null}
        <textarea
          ref={editorTextRef}
          className="sftp-editor-textarea"
          value={editorText}
          onChange={(event) => onEditorTextChange(event.target.value)}
          readOnly={editorReadOnly || editorLoading}
          spellCheck={false}
          placeholder={editorLoading ? tr("sftp.loading") : tr("sftp.editorPlaceholder")}
        />
        <div className="sftp-editor-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr("modal.close")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={editorReadOnly || editorLoading || editorSaving || !editorDirty}
            onClick={() => void onSave()}
          >
            {editorSaving ? tr("sftp.editorSaving") : tr("sftp.editorSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
