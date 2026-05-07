import { useEffect, useRef, useState } from "react";

export function useRedisResizeHandlers() {
  const [connPanelWidth, setConnPanelWidth] = useState(320);
  const [resizingConnPanel, setResizingConnPanel] = useState(false);
  const [commandPanelHeight, setCommandPanelHeight] = useState(156);
  const [resizingCommandPanel, setResizingCommandPanel] = useState(false);
  const [zkDataWidth, setZkDataWidth] = useState(460);
  const [resizingDataPane, setResizingDataPane] = useState(false);
  const terminalLayoutRef = useRef<HTMLDivElement | null>(null);
  const redisPageRef = useRef<HTMLElement | null>(null);
  const browserBodyRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!resizingConnPanel) return;
    const onMouseMove = (event: MouseEvent) => {
      const root = terminalLayoutRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const next = event.clientX - rect.left;
      const min = 240;
      const max = Math.max(360, rect.width * 0.46);
      const clamped = Math.max(min, Math.min(max, next));
      setConnPanelWidth(Math.round(clamped));
    };
    const onMouseUp = () => setResizingConnPanel(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingConnPanel]);

  useEffect(() => {
    if (!resizingCommandPanel) return;
    const onMouseMove = (event: MouseEvent) => {
      const root = redisPageRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const next = rect.bottom - event.clientY;
      const min = 120;
      const max = Math.max(260, rect.height * 0.45);
      const clamped = Math.max(min, Math.min(max, next));
      setCommandPanelHeight(Math.round(clamped));
    };
    const onMouseUp = () => setResizingCommandPanel(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingCommandPanel]);

  return {
    connPanelWidth,
    setConnPanelWidth,
    resizingConnPanel,
    setResizingConnPanel,
    commandPanelHeight,
    setCommandPanelHeight,
    resizingCommandPanel,
    setResizingCommandPanel,
    zkDataWidth,
    setZkDataWidth,
    resizingDataPane,
    setResizingDataPane,
    terminalLayoutRef,
    redisPageRef,
    browserBodyRef,
  };
}
