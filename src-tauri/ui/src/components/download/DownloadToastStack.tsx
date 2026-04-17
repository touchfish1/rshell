import { openInFileManager } from "../../services/bridge";
import type { DownloadTask } from "../../hooks/useDownloadTasks";

interface Props {
  tasks: DownloadTask[];
  onError: (message: string) => void;
}

export function DownloadToastStack({ tasks, onError }: Props) {
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
              {task.status === "downloading" ? "下载中" : task.status === "success" ? "完成" : "失败"}
            </span>
            {task.status === "success" && task.localPath ? (
              <button
                className="download-open-btn"
                title="打开文件目录"
                onClick={() => {
                  void openInFileManager(task.localPath!).catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    onError(`打开目录失败: ${message}`);
                  });
                }}
              >
                📂
              </button>
            ) : null}
          </div>
          <div className="download-detail" title={task.detail}>
            {task.detail ?? "正在下载到本地..."}
          </div>
          <div className="download-bar">
            <span style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

