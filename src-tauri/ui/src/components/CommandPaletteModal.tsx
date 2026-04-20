import { useEffect, useMemo, useRef, useState } from "react";
import type { I18nKey } from "../i18n";

export type CommandPaletteItem = {
  id: string;
  label: string;
  keywords?: string[];
  hint?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

interface Props {
  open: boolean;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  items: CommandPaletteItem[];
  onClose: () => void;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export function CommandPaletteModal({ open, tr, items, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return items;
    return items.filter((it) => {
      const hay = [it.label, ...(it.keywords ?? [])].map(normalize).join(" ");
      return hay.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    if (activeIndex > filtered.length - 1) setActiveIndex(0);
  }, [activeIndex, filtered.length, open]);

  const runAt = async (index: number) => {
    const it = filtered[index];
    if (!it || it.disabled) return;
    onClose();
    await it.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(filtered.length - 1, prev + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void runAt(activeIndex);
    }
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card cmdk-card" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="modal-header cmdk-header">
          <h4>{tr("commandPalette.title")}</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="cmdk-body">
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder={tr("commandPalette.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cmdk-list" ref={listRef} role="listbox" aria-label={tr("commandPalette.title")}>
            {filtered.length === 0 ? <div className="cmdk-empty">{tr("home.searchNoResults")}</div> : null}
            {filtered.map((it, index) => (
              <button
                key={it.id}
                type="button"
                className={`cmdk-item ${index === activeIndex ? "active" : ""}`}
                disabled={it.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void runAt(index)}
                role="option"
                aria-selected={index === activeIndex}
                data-cmd-index={index}
              >
                <span className="cmdk-item-label">{it.label}</span>
                {it.hint ? <span className="cmdk-item-hint">{it.hint}</span> : null}
              </button>
            ))}
          </div>
          <div className="cmdk-footer">
            <span className="cmdk-kbd">↑↓</span> <span className="cmdk-foot-text">{tr("commandPalette.nav")}</span>
            <span className="cmdk-dot">·</span>
            <span className="cmdk-kbd">Enter</span> <span className="cmdk-foot-text">{tr("commandPalette.run")}</span>
            <span className="cmdk-dot">·</span>
            <span className="cmdk-kbd">Esc</span> <span className="cmdk-foot-text">{tr("commandPalette.close")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

