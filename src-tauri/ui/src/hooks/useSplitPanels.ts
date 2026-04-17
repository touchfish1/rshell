import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type DragState =
  | {
      type: "hosts";
      startX: number;
      startHosts: number;
    }
  | {
      type: "sftp";
      startX: number;
      startSftp: number;
    };

export function useSplitPanels() {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [hostsWidth, setHostsWidth] = useState(240);
  const [sftpWidth, setSftpWidth] = useState(320);

  const clamp = useMemo(() => {
    return (nextHosts: number, nextSftp: number) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      const total = rect?.width ?? window.innerWidth;
      const minHosts = 170;
      const maxHosts = Math.max(320, total * 0.4);
      const minSftp = 220;
      const maxSftp = Math.max(420, total * 0.55);
      return {
        hosts: Math.max(minHosts, Math.min(maxHosts, nextHosts)),
        sftp: Math.max(minSftp, Math.min(maxSftp, nextSftp)),
      };
    };
  }, []);

  const onDragStartHosts = (clientX: number) => {
    dragRef.current = { type: "hosts", startX: clientX, startHosts: hostsWidth };
  };

  const onDragStartSftp = (clientX: number) => {
    dragRef.current = { type: "sftp", startX: clientX, startSftp: sftpWidth };
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      if (drag.type === "hosts") {
        const next = clamp(drag.startHosts + delta, sftpWidth);
        setHostsWidth(next.hosts);
      } else {
        const next = clamp(hostsWidth, drag.startSftp - delta);
        setSftpWidth(next.sftp);
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
  }, [clamp, hostsWidth, sftpWidth]);

  const workspaceStyle = useMemo(() => {
    return {
      "--host-width": `${hostsWidth}px`,
      "--sftp-width": `${sftpWidth}px`,
    } as CSSProperties;
  }, [hostsWidth, sftpWidth]);

  return {
    workspaceRef,
    workspaceStyle,
    onDragStartHosts,
    onDragStartSftp,
  };
}

