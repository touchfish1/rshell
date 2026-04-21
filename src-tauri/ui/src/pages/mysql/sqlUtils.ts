export function stripSqlTicks(token: string): string {
  return token.replace(/`/g, "").trim();
}

export function isSubsequenceMatch(text: string, pattern: string): boolean {
  if (!pattern) return true;
  let cursor = 0;
  for (let i = 0; i < text.length && cursor < pattern.length; i += 1) {
    if (text[i] === pattern[cursor]) cursor += 1;
  }
  return cursor === pattern.length;
}

export function parseSqlTableRefs(sqlText: string, defaultSchema: string): {
  aliasMap: Record<string, { schema: string; table: string }>;
  aliasOrder: string[];
  lastRef: { schema: string; table: string } | null;
} {
  const aliasMap: Record<string, { schema: string; table: string }> = {};
  const aliasOrder: string[] = [];
  let lastRef: { schema: string; table: string } | null = null;
  const regex =
    /\b(?:from|join)\s+(`?[A-Za-z_][A-Za-z0-9_]*`?(?:\s*\.\s*`?[A-Za-z_][A-Za-z0-9_]*`?)?)\s*(?:as\s+)?(`?[A-Za-z_][A-Za-z0-9_]*`?)?/gi;
  let match = regex.exec(sqlText);
  while (match) {
    const tableToken = (match[1] ?? "").replace(/\s+/g, "");
    const aliasToken = match[2] ?? "";
    const parts = tableToken.split(".");
    const table = stripSqlTicks(parts.length > 1 ? parts[1] : parts[0]);
    const schema = stripSqlTicks(parts.length > 1 ? parts[0] : defaultSchema);
    if (table) {
      const ref = { schema, table };
      const alias = stripSqlTicks(aliasToken) || table;
      aliasMap[alias.toLowerCase()] = ref;
      aliasMap[table.toLowerCase()] = ref;
      aliasOrder.push(alias.toLowerCase());
      lastRef = ref;
    }
    match = regex.exec(sqlText);
  }
  return { aliasMap, aliasOrder, lastRef };
}

export function findRecentAliasBeforeCursor(sqlText: string, knownAliases: string[]): string | null {
  if (knownAliases.length === 0) return null;
  const aliasSet = new Set(knownAliases.map((item) => item.toLowerCase()));
  const aliasRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\./g;
  let recentAlias: string | null = null;
  let match = aliasRegex.exec(sqlText);
  while (match) {
    const alias = (match[1] ?? "").toLowerCase();
    if (aliasSet.has(alias)) recentAlias = alias;
    match = aliasRegex.exec(sqlText);
  }
  return recentAlias;
}

export function escapeSqlIdentifier(raw: string): string {
  return raw.replace(/`/g, "``");
}

export function escapeSqlValue(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

export function formatSqlText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\bfrom\b/gi, "\nFROM")
    .replace(/\bwhere\b/gi, "\nWHERE")
    .replace(/\band\b/gi, "\n  AND")
    .replace(/\border by\b/gi, "\nORDER BY")
    .replace(/\bgroup by\b/gi, "\nGROUP BY")
    .replace(/\blimit\b/gi, "\nLIMIT")
    .replace(/\bselect\b/gi, "SELECT")
    .trim();
}
