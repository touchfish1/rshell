import type { RedisKeyTreeNode as RedisKeyTreeNodeModel } from "./redisTree";

interface Props {
  node: RedisKeyTreeNodeModel;
  level: number;
  expandedGroups: Record<string, boolean>;
  selectedKeyBase64?: string;
  onToggle: (id: string) => void;
  onPick: (keyBase64: string) => void;
}

export function RedisKeyTreeNode({ node, level, expandedGroups, selectedKeyBase64, onToggle, onPick }: Props) {
  const isLeaf = Boolean(node.keyBase64);
  const expanded = expandedGroups[node.id] ?? level < 1;
  return (
    <div style={{ paddingLeft: `${level * 12}px` }}>
      <div className={`zk-node ${node.keyBase64 && selectedKeyBase64 === node.keyBase64 ? "zk-node-selected" : ""}`}>
        {isLeaf ? (
          <button className="btn btn-ghost zk-node-name" title={node.label} onClick={() => node.keyBase64 && onPick(node.keyBase64)}>
            {node.label}
          </button>
        ) : (
          <button className="btn btn-ghost zk-node-name" title={node.label} onClick={() => onToggle(node.id)}>
            {expanded ? "▾" : "▸"} {node.label}
          </button>
        )}
      </div>
      {!isLeaf && expanded
        ? node.children.map((child) => (
            <RedisKeyTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedGroups={expandedGroups}
              selectedKeyBase64={selectedKeyBase64}
              onToggle={onToggle}
              onPick={onPick}
            />
          ))
        : null}
    </div>
  );
}
