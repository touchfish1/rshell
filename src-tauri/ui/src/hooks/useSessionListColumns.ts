import { useEffect, useRef, useState, type CSSProperties } from "react";

const NAME_COL_MIN = 100;
const NAME_COL_MAX = 420;
const HOST_COL_MIN = 140;
const HOST_COL_MAX = 560;
const NAME_COL_STORAGE_KEY = "rshell.sessionList.nameColWidth";
const HOST_COL_STORAGE_KEY = "rshell.sessionList.hostColWidth";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function loadStoredWidth(key: string, fallback: number, min: number, max: number) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

export function useSessionListColumns() {
  const [nameColWidth, setNameColWidth] = useState(() =>
    loadStoredWidth(NAME_COL_STORAGE_KEY, 140, NAME_COL_MIN, NAME_COL_MAX)
  );
  const [hostColWidth, setHostColWidth] = useState(() =>
    loadStoredWidth(HOST_COL_STORAGE_KEY, 220, HOST_COL_MIN, HOST_COL_MAX)
  );
  const dragRef = useRef<{
    col: "name" | "host";
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = event.clientX - dragRef.current.startX;
      const next = dragRef.current.startWidth + delta;
      if (dragRef.current.col === "name") {
        setNameColWidth(clamp(next, NAME_COL_MIN, NAME_COL_MAX));
      } else {
        setHostColWidth(clamp(next, HOST_COL_MIN, HOST_COL_MAX));
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(NAME_COL_STORAGE_KEY, String(nameColWidth));
  }, [nameColWidth]);

  useEffect(() => {
    localStorage.setItem(HOST_COL_STORAGE_KEY, String(hostColWidth));
  }, [hostColWidth]);

  const gridStyle = {
    "--session-col-name": `${nameColWidth}px`,
    "--session-col-host": `${hostColWidth}px`,
  } as CSSProperties;

  return {
    gridStyle,
    onResizeNameStart: (clientX: number) => {
      dragRef.current = { col: "name", startX: clientX, startWidth: nameColWidth };
    },
    onResizeHostStart: (clientX: number) => {
      dragRef.current = { col: "host", startX: clientX, startWidth: hostColWidth };
    },
  };
}
