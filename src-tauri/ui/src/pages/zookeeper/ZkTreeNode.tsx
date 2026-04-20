import type { I18nKey } from "../../i18n";

interface Props {
  path: string;
  name: string;
  selectedPath: string;
  expanded: Record<string, boolean>;
  treeState: Record<string, "idle" | "loading" | "ready" | "error">;
  childrenMap: Record<string, string[]>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onToggleExpand: (path: string, isExpanded: boolean, state: "idle" | "loading" | "ready" | "error") => void;
  onPickPath: (path: string) => void;
  joinPath: (parent: string, child: string) => string;
}

export function ZkTreeNode({
  path,
  name,
  selectedPath,
  expanded,
  treeState,
  childrenMap,
  tr,
  onToggleExpand,
  onPickPath,
  joinPath,
}: Props) {
  const isSelected = path === selectedPath;
  const isExpanded = expanded[path] === true;
  const state = treeState[path] ?? "idle";
  const children = childrenMap[path] ?? [];

  return (
    <div key={path} className={`zk-node ${isSelected ? "zk-node-selected" : ""}`}>
      <button
        type="button"
        className="btn btn-ghost zk-node-toggle"
        title={isExpanded ? tr("zk.tree.collapse") : tr("zk.tree.expand")}
        onClick={() => onToggleExpand(path, isExpanded, state)}
      >
        {isExpanded ? "▾" : "▸"}
      </button>
      <button type="button" className="btn btn-ghost zk-node-name" onClick={() => onPickPath(path)} title={path}>
        {name}
      </button>
      {state === "loading" ? <span className="pill pill-muted">{tr("sftp.loading")}</span> : null}
      {isExpanded ? (
        <div className="zk-node-children">
          {children.map((child) => (
            <ZkTreeNode
              key={joinPath(path, child)}
              path={joinPath(path, child)}
              name={child}
              selectedPath={selectedPath}
              expanded={expanded}
              treeState={treeState}
              childrenMap={childrenMap}
              tr={tr}
              onToggleExpand={onToggleExpand}
              onPickPath={onPickPath}
              joinPath={joinPath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
