import { useMemo, useState } from "react";
import { useI18n } from "../../i18n-context";
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
  const { tr } = useI18n();
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
    const tab: MySqlBrowseTab = {
      id: `query:${schema}:${Date.now()}`,
      kind: "query",
      schema,
      title: tr("mysql.page.queryTabTitle", { schema }),
    };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
    setQueryEditorMap((prev) => ({
      ...prev,
      [tab.id]: {
        sql: tr("mysql.page.defaultSqlTemplate"),
        cursor: 0,
        running: false,
        explaining: false,
        result: null,
        explainResult: null,
        queryOffset: 0,
        queryLimit: 200,
      },
    }));
  };

  const addTableEditTab = (schema: string, table: string) => {
    const tab: MySqlBrowseTab = {
      id: `table-edit:${schema}.${table}:${Date.now()}`,
      kind: "table-edit",
      schema,
      table,
      title: tr("mysql.page.editTabTitle", { schema, table }),
    };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
  };

  const addQueryTabWithSql = (schema: string, sql: string) => {
    const tab: MySqlBrowseTab = {
      id: `query:${schema}:${Date.now()}`,
      kind: "query",
      schema,
      title: tr("mysql.page.queryTabTitle", { schema }),
    };
    setBrowseTabs((prev) => [...prev, tab]);
    setActiveBrowseTabId(tab.id);
    setQueryEditorMap((prev) => ({
      ...prev,
      [tab.id]: {
        sql,
        cursor: sql.length,
        running: false,
        explaining: false,
        result: null,
        explainResult: null,
        queryOffset: 0,
        queryLimit: 200,
      },
    }));
  };

  const openTopQueryTab = () => {
    const schema = activeSchema || selectedDatabase || databases[0] || "default";
    addQueryTab(schema);
  };

  const closeBrowseTab = (tabId: string) => {
    setBrowseTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;
      const next = prev.filter((t) => t.id !== tabId);
      if (activeBrowseTabId === tabId && next.length > 0) {
        const newIdx = Math.min(idx, next.length - 1);
        const newTab = next[newIdx];
        setActiveBrowseTabId(newTab.id);
        setActiveSchema(newTab.schema);
      } else if (next.length === 0) {
        setActiveBrowseTabId(null);
      }
      setTableDataMap((prevMap) => {
        const copy = { ...prevMap };
        delete copy[tabId];
        return copy;
      });
      setQueryEditorMap((prevMap) => {
        const copy = { ...prevMap };
        delete copy[tabId];
        return copy;
      });
      return next;
    });
  };

  const closeTabsLeft = (tabId: string) => {
    setBrowseTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;
      const removed = prev.slice(0, idx);
      const next = prev.slice(idx);
      removed.forEach((t) => {
        setTableDataMap((prevMap) => { const c = { ...prevMap }; delete c[t.id]; return c; });
        setQueryEditorMap((prevMap) => { const c = { ...prevMap }; delete c[t.id]; return c; });
      });
      if (activeBrowseTabId && removed.some((t) => t.id === activeBrowseTabId)) {
        setActiveBrowseTabId(tabId);
        const tab = prev[idx];
        setActiveSchema(tab.schema);
      }
      return next;
    });
  };

  const closeTabsRight = (tabId: string) => {
    setBrowseTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;
      const next = prev.slice(0, idx + 1);
      const removed = prev.slice(idx + 1);
      removed.forEach((t) => {
        setTableDataMap((prevMap) => { const c = { ...prevMap }; delete c[t.id]; return c; });
        setQueryEditorMap((prevMap) => { const c = { ...prevMap }; delete c[t.id]; return c; });
      });
      if (activeBrowseTabId && removed.some((t) => t.id === activeBrowseTabId)) {
        setActiveBrowseTabId(tabId);
      }
      return next;
    });
  };

  const closeOtherTabs = (tabId: string) => {
    setBrowseTabs((prev) => {
      const target = prev.find((t) => t.id === tabId);
      if (!target) return prev;
      const removed = prev.filter((t) => t.id !== tabId);
      removed.forEach((t) => {
        setTableDataMap((prevMap) => { const c = { ...prevMap }; delete c[t.id]; return c; });
        setQueryEditorMap((prevMap) => { const c = { ...prevMap }; delete c[t.id]; return c; });
      });
      setActiveBrowseTabId(tabId);
      setActiveSchema(target.schema);
      return [target];
    });
  };

  const selectBrowseTab = (tab: MySqlBrowseTab) => {
    setActiveBrowseTabId(tab.id);
    setActiveSchema(tab.schema);
    if (tab.kind === "database") {
      void loadTablesForSchema(tab.schema);
      return;
    }
    if (tab.kind === "query" || tab.kind === "table-edit") return;
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
    addTableEditTab,
    addQueryTab,
    addQueryTabWithSql,
    openTopQueryTab,
    selectBrowseTab,
    closeBrowseTab,
    closeTabsLeft,
    closeTabsRight,
    closeOtherTabs,
  };
}
