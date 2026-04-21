import { useMemo, useState } from "react";
import { createEmptyCondition, type MySqlBrowseTab, type MySqlQueryEditorState, type MySqlTableDataState } from "./types";

interface Params {
  activeSchema: string;
  selectedDatabase?: string;
  databases: string[];
  tableDataMap: Record<string, MySqlTableDataState>;
  setTableDataMap: React.Dispatch<React.SetStateAction<Record<string, MySqlTableDataState>>>;
  setQueryEditorMap: React.Dispatch<React.SetStateAction<Record<string, MySqlQueryEditorState>>>;
  loadTablesForSchema: (schema: string) => Promise<void>;
  loadTableData: (tabId: string, schema: string, table: string) => Promise<void>;
  setActiveSchema: (schema: string) => void;
  setActiveTable: (table: string) => void;
}

export function useMySqlTabsManager({
  activeSchema,
  selectedDatabase,
  databases,
  tableDataMap,
  setTableDataMap,
  setQueryEditorMap,
  loadTablesForSchema,
  loadTableData,
  setActiveSchema,
  setActiveTable,
}: Params) {
  const [browseTabs, setBrowseTabs] = useState<MySqlBrowseTab[]>([]);
  const [activeBrowseTabId, setActiveBrowseTabId] = useState<string | null>(null);

  const activeBrowseTab = useMemo(
    () => browseTabs.find((item) => item.id === activeBrowseTabId) ?? null,
    [browseTabs, activeBrowseTabId]
  );

  const addDatabaseTab = (schema: string) => {
    const tab: MySqlBrowseTab = { id: `db:${schema}:${Date.now()}`, kind: "database", schema, title: schema };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
  };

  const addTableTab = (schema: string, table: string) => {
    const tab: MySqlBrowseTab = {
      id: `table:${schema}.${table}:${Date.now()}`,
      kind: "table",
      schema,
      table,
      title: `${schema}.${table}`,
    };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
    setTableDataMap((prev) => ({
      ...prev,
      [tab.id]: {
        loading: true,
        conditions: [createEmptyCondition()],
        columns: [],
        rows: [],
        page: 0,
        pageSize: 100,
        totalRows: 0,
      },
    }));
    void loadTableData(tab.id, schema, table);
  };

  const addQueryTab = (schema: string) => {
    const tab: MySqlBrowseTab = { id: `query:${schema}:${Date.now()}`, kind: "query", schema, title: `${schema} SQL` };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
    setQueryEditorMap((prev) => ({
      ...prev,
      [tab.id]: {
        sql: "SELECT * FROM <table_name> LIMIT 100;",
        cursor: 0,
        running: false,
        explaining: false,
        result: null,
        explainResult: null,
      },
    }));
  };

  const openTopQueryTab = () => {
    const schema = activeSchema || selectedDatabase || databases[0] || "default";
    addQueryTab(schema);
  };

  const selectBrowseTab = (tab: MySqlBrowseTab) => {
    setActiveBrowseTabId(tab.id);
    setActiveSchema(tab.schema);
    if (tab.kind === "database") {
      void loadTablesForSchema(tab.schema);
      return;
    }
    if (tab.kind === "query") return;
    if (tab.table) {
      setActiveTable(tab.table);
      if (!tableDataMap[tab.id] || tableDataMap[tab.id].rows.length === 0) {
        setTableDataMap((prev) => ({
          ...prev,
          [tab.id]: {
            ...(prev[tab.id] ?? {
              loading: false,
              conditions: [createEmptyCondition()],
              columns: [],
              rows: [],
              page: 0,
              pageSize: 100,
              totalRows: 0,
            }),
            loading: true,
            columns: [],
            rows: [],
          },
        }));
        void loadTableData(tab.id, tab.schema, tab.table);
      }
    }
  };

  return {
    browseTabs,
    activeBrowseTabId,
    activeBrowseTab,
    addDatabaseTab,
    addTableTab,
    addQueryTab,
    openTopQueryTab,
    selectBrowseTab,
  };
}
