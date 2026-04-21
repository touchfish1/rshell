export type MySqlBrowseTab = {
  id: string;
  kind: "database" | "table" | "query";
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
  error?: string;
};

export type MySqlQueryEditorState = {
  sql: string;
  cursor: number;
  running: boolean;
  explaining: boolean;
  result: import("../../services/types").MySqlQueryResult | null;
  explainResult: import("../../services/types").MySqlQueryResult | null;
  error?: string;
};

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
  { value: "contains", label: "包含" },
  { value: "eq", label: "=" },
  { value: "ne", label: "!=" },
  { value: "gt", label: ">" },
  { value: "ge", label: ">=" },
  { value: "lt", label: "<" },
  { value: "le", label: "<=" },
];

export function createEmptyCondition(): MySqlFilterCondition {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    column: "",
    operator: "contains",
    value: "",
  };
}
