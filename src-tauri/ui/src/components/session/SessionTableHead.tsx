import { useI18n } from "../../i18n-context";

export function SessionTableHead() {
  const { tr } = useI18n();

  return (
    <div className="session-table-head">
      <span>{tr("session.name")}</span>
      <span>{tr("session.host")}</span>
      <span>{tr("session.user")}</span>
      <span>{tr("session.protocol")}</span>
      <span>{tr("session.port")}</span>
      <span>{tr("session.status")}</span>
      <span>{tr("session.actions")}</span>
    </div>
  );
}

