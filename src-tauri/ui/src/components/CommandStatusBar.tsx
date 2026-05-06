interface Props {
  command: string | null;
  label: string;
}

export function CommandStatusBar({ command, label }: Props) {
  return (
    <div className="command-status-bar">
      <span className="command-status-label">{label}</span>
      <span className={`command-status-text${command ? "" : " idle"}`}>{command ?? "—"}</span>
    </div>
  );
}
