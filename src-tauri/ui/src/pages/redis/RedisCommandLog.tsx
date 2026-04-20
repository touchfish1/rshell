interface Props {
  logs: string[];
  height: number;
  onResizeStart: () => void;
}

export function RedisCommandLog({ logs, height, onResizeStart }: Props) {
  return (
    <>
      <div className="redis-log-splitter" onMouseDown={onResizeStart} title="拖动调整日志面板高度" />
      <section className="redis-command-panel" style={{ flex: `0 0 ${height}px` }}>
        <div className="redis-command-panel-header">Redis Commands</div>
        <div className="redis-command-panel-body">
          {logs.length === 0 ? (
            <div className="card-subtitle">暂无命令记录。</div>
          ) : (
            logs.map((line, index) => (
              <div key={`${line}-${index}`} className="redis-command-line" title={line}>
                {line}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
