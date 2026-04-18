import { useEffect, useRef, useState } from "react";

export interface DownloadTask {
  id: string;
  name: string;
  progress: number;
  status: "downloading" | "success" | "error";
  detail?: string;
  localPath?: string;
  /** 用于失败重试 */
  remotePath?: string;
  sessionId?: string;
}

export function useDownloadTasks() {
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const downloadTimerRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return () => {
      downloadTimerRef.current.forEach((timer) => window.clearInterval(timer));
      downloadTimerRef.current.clear();
    };
  }, []);

  const createDownloadTask = (remotePath: string, sessionId: string) => {
    const normalized = remotePath.replace(/\\/g, "/");
    const name = normalized.split("/").pop() || normalized;
    const id = `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setDownloadTasks((prev) => [
      ...prev,
      { id, name, progress: 6, status: "downloading", remotePath: normalized, sessionId },
    ]);
    const timer = window.setInterval(() => {
      setDownloadTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id || task.status !== "downloading") return task;
          const next = Math.min(92, task.progress + Math.floor(Math.random() * 9 + 3));
          return { ...task, progress: next };
        })
      );
    }, 220);
    downloadTimerRef.current.set(id, timer);
    return id;
  };

  const finishDownloadTask = (id: string, ok: boolean, detail: string, localPath?: string) => {
    const timer = downloadTimerRef.current.get(id);
    if (timer) {
      window.clearInterval(timer);
      downloadTimerRef.current.delete(id);
    }
    setDownloadTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, progress: 100, status: ok ? "success" : "error", detail, localPath } : task
      )
    );
    if (ok) {
      window.setTimeout(() => {
        setDownloadTasks((prev) => prev.filter((task) => task.id !== id));
      }, 2200);
    }
  };

  const dismissDownloadTask = (id: string) => {
    const timer = downloadTimerRef.current.get(id);
    if (timer) {
      window.clearInterval(timer);
      downloadTimerRef.current.delete(id);
    }
    setDownloadTasks((prev) => prev.filter((task) => task.id !== id));
  };

  return {
    downloadTasks,
    createDownloadTask,
    finishDownloadTask,
    dismissDownloadTask,
  };
}
