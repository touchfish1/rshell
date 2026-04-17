import { useI18n } from "../../i18n-context";

interface Props {
  onResizeNameStart: (clientX: number) => void;
  onResizeHostStart: (clientX: number) => void;
}

export function SessionTableHead({ onResizeNameStart, onResizeHostStart }: Props) {
  const { tr } = useI18n();

  return (
    <div className="session-table-head">
      <div className="session-table-head-main">
        <span className="resizable-head-cell">
          {tr("session.name")}
          <i
            className="col-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label={tr("session.name")}
            onMouseDown={(e) => {
              e.preventDefault();
              onResizeNameStart(e.clientX);
            }}
          />
        </span>
        <span className="resizable-head-cell">
          {tr("session.host")}
          <i
            className="col-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label={tr("session.host")}
            onMouseDown={(e) => {
              e.preventDefault();
              onResizeHostStart(e.clientX);
            }}
          />
        </span>
        <span>{tr("session.user")}</span>
        <span>{tr("session.protocol")}</span>
        <span>{tr("session.port")}</span>
        <span>{tr("session.status")}</span>
      </div>
      <span className="session-table-head-actions">{tr("session.actions")}</span>
    </div>
  );
}

