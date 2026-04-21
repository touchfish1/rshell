import { ColorThemeToggle } from "../../components/ColorThemeToggle";
import type { I18nKey, Lang } from "../../i18n";
import type { RedisConnection } from "../../services/types";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  selected: RedisConnection | null;
  connected: boolean;
  status: string;
  lang: Lang;
  onSwitchLang: (lang: Lang) => void;
  onBack: () => void;
  onOpenCreate: () => void;
  onDisconnect: () => void;
}

export function RedisHeader({
  tr,
  selected,
  connected,
  status,
  lang,
  onSwitchLang,
  onBack,
  onOpenCreate,
  onDisconnect,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <div className="topbar-title-text">
          <div className="topbar-title-line">{tr("redis.page.title")}</div>
          <div className="topbar-subtitle">{selected ? selected.name : tr("redis.page.noSelection")}</div>
        </div>
      </div>
      <div className="actions">
        <ColorThemeToggle tr={tr} />
        <div className="lang-switch" role="group" aria-label={tr("top.ariaLanguageSwitch")}>
          <button
            className={`btn btn-ghost ${lang === "zh-CN" ? "lang-active" : ""}`}
            onClick={() => onSwitchLang("zh-CN")}
            title={tr("lang.switchToZh")}
          >
            {tr("lang.zh")}
          </button>
          <button
            className={`btn btn-ghost ${lang === "en-US" ? "lang-active" : ""}`}
            onClick={() => onSwitchLang("en-US")}
            title={tr("lang.switchToEn")}
          >
            {tr("lang.en")}
          </button>
        </div>
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
