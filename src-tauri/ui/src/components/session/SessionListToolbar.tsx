import type { I18nKey } from "../../i18n";

interface Props {
  hostQuery: string;
  onHostQueryChange: (value: string) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onOpenCreate: () => void;
}

export function SessionListToolbar({ hostQuery, onHostQueryChange, tr, onOpenCreate }: Props) {
  return (
    <>
      <div className="session-list-header">
        <h3>{tr("session.management")}</h3>
        <button className="btn btn-ghost" onClick={onOpenCreate} title={tr("session.addHost")}>
          {tr("session.addHost")}
        </button>
      </div>
      <div className="session-list-search-row">
        <input
          type="search"
          className="session-list-search-input"
          value={hostQuery}
          onChange={(e) => onHostQueryChange(e.target.value)}
          placeholder={tr("home.searchHostsPlaceholder")}
          aria-label={tr("home.searchHostsPlaceholder")}
        />
      </div>
    </>
  );
}
