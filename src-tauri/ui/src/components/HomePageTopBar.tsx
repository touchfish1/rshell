import type { I18nKey, Lang } from "../i18n";
import { ColorThemeToggle } from "./ColorThemeToggle";

interface Props {
  lang: Lang;
  appVersion: string;
  connectingSessionId?: string | null;
  selectedSearchSession?: { id: string; name: string } | undefined;
  connected: boolean;
  upgradeChecking: boolean;
  environmentBusy: boolean;
  currentEnvironment: string;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onSwitchLang: (lang: Lang) => void;
  onConnect: () => void;
  onOnlineUpgrade: () => void;
  onOpenUnifiedCreate?: () => void;
  onOpenAudit: () => void;
  onOpenEnvironment: () => void;
}

export function HomePageTopBar({
  lang,
  appVersion,
  connectingSessionId,
  selectedSearchSession,
  connected,
  upgradeChecking,
  environmentBusy,
  currentEnvironment,
  tr,
  onSwitchLang,
  onConnect,
  onOnlineUpgrade,
  onOpenUnifiedCreate,
  onOpenAudit,
  onOpenEnvironment,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <div className="app-badge" aria-hidden="true">r</div>
        <div className="topbar-title-text">
          <div className="topbar-title-line">
            rshell
            {appVersion ? (
              <span className="topbar-app-version" title={tr("home.appVersionTitle")}>
                v{appVersion}
              </span>
            ) : null}
          </div>
          <div className="topbar-subtitle">{tr("top.subtitle")}</div>
        </div>
      </div>
      <div className="actions">
        <ColorThemeToggle tr={tr} />
        <div className="lang-switch" role="group" aria-label={tr("top.ariaLanguageSwitch")}>
          <button
            className={`btn btn-ghost ${lang === "zh-CN" ? "lang-active" : ""}`}
            onClick={() => onSwitchLang("zh-CN")}
            title={tr("lang.switchToZh")}
            aria-pressed={lang === "zh-CN"}
          >
            {tr("lang.zh")}
          </button>
          <button
            className={`btn btn-ghost ${lang === "en-US" ? "lang-active" : ""}`}
            onClick={() => onSwitchLang("en-US")}
            title={tr("lang.switchToEn")}
            aria-pressed={lang === "en-US"}
          >
            {tr("lang.en")}
          </button>
        </div>
        <button
          className="btn"
          onClick={onConnect}
          disabled={!selectedSearchSession || connectingSessionId === selectedSearchSession?.id}
          title={selectedSearchSession ? tr("session.connectTitle", { name: selectedSearchSession.name }) : tr("top.noHostSelected")}
        >
          {connectingSessionId === selectedSearchSession?.id ? tr("session.connectingAction") : tr("session.connect")}
        </button>
        <button className="btn btn-ghost" onClick={onOnlineUpgrade} disabled={upgradeChecking}>
          {upgradeChecking ? tr("top.upgradeChecking") : tr("top.upgrade")}
        </button>
        {onOpenUnifiedCreate ? (
          <button className="btn btn-ghost lang-active" onClick={onOpenUnifiedCreate}>
            {tr("top.addConnection")}
          </button>
        ) : null}
        <button className="btn btn-ghost" onClick={onOpenAudit}>
          {tr("home.audit")}
        </button>
        <span className={connected ? "pill pill-ok" : "pill"} aria-live="polite">
          {connected ? tr("top.online") : tr("top.offline")}
        </span>
        <button
          className="btn btn-ghost"
          disabled={environmentBusy}
          onClick={onOpenEnvironment}
          title={tr("top.environment")}
        >
          {tr("top.environmentCurrent", { name: currentEnvironment })}
        </button>
      </div>
    </header>
  );
}
