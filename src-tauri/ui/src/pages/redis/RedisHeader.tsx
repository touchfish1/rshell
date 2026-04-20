import type { I18nKey } from "../../i18n";
import type { RedisConnection } from "../../services/types";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  selected: RedisConnection | null;
  connected: boolean;
  status: string;
  onBack: () => void;
  onOpenCreate: () => void;
  onDisconnect: () => void;
}

export function RedisHeader({ tr, selected, connected, status, onBack, onOpenCreate, onDisconnect }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <div className="topbar-title-text">
          <div className="topbar-title-line">{tr("redis.page.title")}</div>
          <div className="topbar-subtitle">{selected ? selected.name : tr("redis.page.noSelection")}</div>
        </div>
      </div>
      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack}>
          {tr("terminal.back")}
        </button>
        <button className="btn btn-ghost" onClick={onOpenCreate}>
          {tr("redis.page.addConnection")}
        </button>
        <button className="btn btn-ghost" disabled={!selected || !connected} onClick={onDisconnect}>
          {tr("zk.page.disconnect")}
        </button>
        <span className={connected ? "pill pill-ok" : "pill"}>{connected ? tr("top.online") : tr("top.offline")}</span>
        <span className="pill pill-muted">{status}</span>
      </div>
    </header>
  );
}
