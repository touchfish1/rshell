export type MySqlBrowseTab = {
  id: string;
  kind: "database" | "table" | "query" | "table-edit";
  schema: string;
  table?: string;
  title: string;
};

export type MySqlFilterOperator = "contains" | "eq" | "ne" | "gt" | "ge" | "lt" | "le";

export type MySqlFilterCondition = {
  id: string;
  column: string;
  operator: MySqlFilterOperator;
  value: string;
};

export type MySqlTableDataState = {
  loading: boolean;
  conditions: MySqlFilterCondition[];
  columns: string[];
  rows: Array<Array<string | null>>;
  page: number;
  pageSize: number;
  totalRows: number;
  lastSql?: string;
  error?: string;
  columnInfos?: import("../../services/types").MySqlColumnInfo[];
};

export type MySqlQueryEditorState = {
  sql: string;
  cursor: number;
  running: boolean;
  explaining: boolean;
  result: import("../../services/types").MySqlQueryResult | null;
  explainResult: import("../../services/types").MySqlQueryResult | null;
  queryOffset: number;
  queryLimit: number;
  error?: string;
};

export const DEFAULT_QUERY_LIMIT = 200;

export type MySqlDbContextMenuState = {
  x: number;
  y: number;
  schema: string;
};

export type SqlSuggestionState = {
  tabId: string;
  start: number;
  end: number;
  x: number;
  y: number;
  items: string[];
};

export const FILTER_OPERATORS: Array<{ value: MySqlFilterOperator; label: string }> = [
  { value: "contains", label: "contains" },
  { value: "eq", label: "=" },
  { value: "ne", label: "!=" },
  { value: "gt", label: ">" },
  { value: "ge", label: ">=" },
  { value: "lt", label: "<" },
  { value: "le", label: "<=" },
];

export type ColumnDraft = {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  extra: string;
  comment: string;
  isNew: boolean;
  markedDrop: boolean;
  original?: Omit<ColumnDraft, "id" | "isNew" | "markedDrop" | "original">;
};

export type IndexDraft = {
  id: string;
  name: string;
  kind: "PRIMARY" | "UNIQUE" | "INDEX";
  columns: string;
  method: string;
  isNew: boolean;
  markedDrop: boolean;
  original?: Omit<IndexDraft, "id" | "isNew" | "markedDrop" | "original">;
};

export function createEmptyCondition(): MySqlFilterCondition {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    column: "",
    operator: "contains",
    value: "",
  };
}
