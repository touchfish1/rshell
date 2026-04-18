import { openInFileManager } from "../../services/bridge";
import type { DownloadTask } from "../../hooks/useDownloadTasks";
import { useI18n } from "../../i18n-context";

interface Props {
  tasks: DownloadTask[];
  onError: (message: string) => void;
  onRetry?: (task: DownloadTask) => void;
  onDismiss?: (id: string) => void;
}

export function DownloadToastStack({ tasks, onError, onRetry, onDismiss }: Props) {
  const { tr } = useI18n();
  if (tasks.length === 0) return null;

  return (
    <div className="download-toast-stack">
      {tasks.map((task) => (
        <div key={task.id} className={`download-toast ${task.status}`}>
          <div className="download-title">
            <span className="download-name" title={task.name}>
              {task.name}
            </span>
            <span className="download-status">
              {task.status === "downloading"
                ? tr("toast.downloading")
                : task.status === "success"
                  ? tr("toast.done")
                  : tr("toast.failed")}
            </span>
            {task.status === "success" && task.localPath ? (
              <button
                className="download-open-btn"
                title={tr("toast.openFolder")}
                type="button"
                onClick={() => {
                  void openInFileManager(task.localPath!).catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    onError(tr("error.openFolderFailed", { message }));
                  });
                }}
              >
                📂
              </button>
            ) : null}
            {task.status === "error" && task.remotePath && task.sessionId && onRetry ? (
              <button type="button" className="download-retry-btn" onClick={() => onRetry(task)}>
                {tr("toast.retry")}
              </button>
            ) : null}
            {task.status === "error" && onDismiss ? (
              <button type="button" className="download-dismiss-btn" onClick={() => onDismiss(task.id)}>
                {tr("toast.dismiss")}
              </button>
            ) : null}
          </div>
          <div className="download-detail" title={task.detail}>
            {task.detail ?? tr("toast.downloadingHint")}
          </div>
          <div className="download-bar">
            <span style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
