export interface RedisKeyTreeNode {
  id: string;
  label: string;
  keyBase64?: string;
  children: RedisKeyTreeNode[];
}

export function parseRedisAddress(address: string): { host: string; port: number | null } {
  const raw = address.trim();
  if (!raw) return { host: "", port: null };
  const lastColon = raw.lastIndexOf(":");
  if (lastColon <= 0) return { host: raw, port: null };
  const host = raw.slice(0, lastColon).trim();
  const portRaw = raw.slice(lastColon + 1).trim();
  const portNum = Number(portRaw);
  if (!host) return { host: raw, port: null };
  if (!Number.isFinite(portNum) || !Number.isInteger(portNum) || portNum <= 0) return { host: raw, port: null };
  return { host, port: portNum };
}

export function formatRedisAddress(host: string, port: number | null): string {
  const h = host.trim();
  if (!h) return "";
  if (port && Number.isFinite(port) && port > 0) return `${h}:${port}`;
  return h;
}

function insertKeyNode(
  nodes: RedisKeyTreeNode[],
  parts: string[],
  keyBase64: string,
  fullDisplay: string,
  pathPrefix: string[] = []
) {
  if (parts.length === 0) return;
  const [head, ...rest] = parts;
  const nextPath = [...pathPrefix, head];
  const isLeaf = rest.length === 0;
  const nodeId = isLeaf ? `leaf:${keyBase64}` : `group:${nextPath.join("\u0001")}`;
  let node = nodes.find((item) => item.id === nodeId);
  if (!node) {
    node = {
      id: nodeId,
      label: isLeaf ? (parts.length === 1 && pathPrefix.length === 0 ? fullDisplay : head) : head,
      keyBase64: isLeaf ? keyBase64 : undefined,
      children: [],
    };
    nodes.push(node);
  }
  if (!isLeaf) {
    insertKeyNode(node.children, rest, keyBase64, fullDisplay, nextPath);
  }
}

function sortTreeNodes(nodes: RedisKeyTreeNode[]): RedisKeyTreeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTreeNodes(node.children) }))
    .sort((a, b) => {
      const aGroup = a.keyBase64 ? 1 : 0;
      const bGroup = b.keyBase64 ? 1 : 0;
      if (aGroup !== bGroup) return aGroup - bGroup;
      return a.label.localeCompare(b.label);
    });
}

export function normalizeRedisMatchPattern(input: string): string {
  const raw = input.trim();
  if (!raw) return "*";
  if (!/[*?\[\]]/.test(raw)) return `*${raw}*`;
  return raw;
}

export function buildRedisKeyTree(
  keys: Array<{ key_base64: string; key_utf8: string | null }>,
  groupDelimiter: string
): RedisKeyTreeNode[] {
  const roots: RedisKeyTreeNode[] = [];
  const delim = groupDelimiter.trim();
  for (const item of keys) {
    const display = item.key_utf8 ?? item.key_base64;
    const rawParts = delim ? display.split(delim) : [display];
    const parts = rawParts.filter((part) => part.length > 0);
    const normalized = parts.length > 0 ? parts : [display];
    const finalParts = normalized.length > 1 ? normalized : ["未分组", normalized[0]];
    insertKeyNode(roots, finalParts, item.key_base64, display);
  }
  return sortTreeNodes(roots);
}
