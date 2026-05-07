import { useEffect, useRef, useState } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import { disconnectMySql, mySqlExecuteQuery, mySqlListColumns } from "../services/bridge";
import type { I18nKey } from "../i18n";
import type {
  MySqlColumnInfo,
  MySqlConnection,
  MySqlConnectionInput,
} from "../services/types";
import { MySqlBrowsePane } from "./mysql/MySqlBrowsePane";
import { MySqlConnectionModal } from "./mysql/MySqlConnectionModal";
import { MySqlContextMenus } from "./mysql/MySqlContextMenus";
import { MySqlSidebar } from "./mysql/MySqlSidebar";
import { escapeSqlIdentifier, escapeSqlValue, formatSqlText } from "./mysql/sqlUtils";
import {
  createEmptyCondition,
  FILTER_OPERATORS,
  type MySqlQueryEditorState,
  type MySqlTableDataState,
  type SqlSuggestionState,
} from "./mysql/types";
import { useMySqlDataLoader } from "./mysql/useMySqlDataLoader";
import { useMySqlConnectionForm } from "./mysql/useMySqlConnectionForm";
import { useMySqlQuerySuggestions } from "./mysql/useMySqlQuerySuggestions";
import { useMySqlTableFilters } from "./mysql/useMySqlTableFilters";
import { useMySqlTabsManager } from "./mysql/useMySqlTabsManager";
import { CommandStatusBar } from "../components/CommandStatusBar";

interface Props {
  connections: MySqlConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: MySqlConnectionInput, secret?: string) => Promise<MySqlConnection | null>;
  onUpdate: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onOpenUnifiedCreate?: () => void;
  hideHeader?: boolean;
}

export default function MySqlPage({
  connections,
  selectedId,
  status,
  error,
  onDismissError,
  onSelect,
  onCreate,
  onUpdate,
  onGetSecret,
  onDelete,
  onBack,
  tr,
  onOpenUnifiedCreate,
  hideHeader = false,
}: Props) {
  const selected = connections.find((c) => c.id === selectedId);
  const [, setColumns] = useState<MySqlColumnInfo[]>([]);
  const [activeSchema, setActiveSchema] = useState("");
  const [activeTable, setActiveTable] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connId: string } | null>(null);
  const [sidebarFeedback, setSidebarFeedback] = useState<string | null>(null);
  const [tableDataMap, setTableDataMap] = useState<Record<string, MySqlTableDataState>>({});
  const [queryEditorMap, setQueryEditorMap] = useState<Record<string, MySqlQueryEditorState>>({});
  const [querySuggestions, setQuerySuggestions] = useState<SqlSuggestionState | null>(null);
  const [suggestionActiveIndex, setSuggestionActiveIndex] = useState(0);
  const dataScrollRef = useRef<HTMLDivElement | null>(null);
  const queryEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    databases,
    tables,
    busy,
    tablesLoading,
    currentCommand,
    loadTablesForSchema,
    loadTableData,
    runQueryEditor,
    changeQueryOffset,
    explainQueryEditor,
    ensureSchemaTables,
    ensureTableColumns,
    loadSchema,
  } = useMySqlDataLoader({
    selected,
    connections,
    activeSchema,
    tr,
    setActiveSchema,
    setActiveTable,
    setLocalError,
    setColumns,
    tableDataMap,
    setTableDataMap,
    queryEditorMap,
    setQueryEditorMap,
  });

  const {
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
  } = useMySqlTabsManager({
    activeSchema,
    selectedDatabase: selected?.database ?? undefined,
    databases,
    tableDataMap,
    setTableDataMap,
    setQueryEditorMap,
    loadTablesForSchema,
    loadTableData,
    setActiveSchema,
    setActiveTable,
  });

  const activeTableData = activeBrowseTab ? tableDataMap[activeBrowseTab.id] : undefined;
  const activeQueryEditor = activeBrowseTab ? queryEditorMap[activeBrowseTab.id] : undefined;
  const activeSuggestionItems =
    querySuggestions && activeBrowseTab && querySuggestions.tabId === activeBrowseTab.id
      ? querySuggestions.items
      : [];
  const filterOperators = FILTER_OPERATORS.map((operator) => ({
    value: operator.value,
    label: operator.value === "contains" ? tr("mysql.page.filterContains") : operator.label,
  }));


  const {
    patchCondition,
    removeCondition,
    addCondition,
    queryCurrentTable,
  } = useMySqlTableFilters({
    activeBrowseTab,
    activeTableData,
    setTableDataMap,
    loadTableData,
  });

  const {
    handleSqlEditorChange,
    handleSqlEditorClick,
    handleSqlEditorKeyUp,
    handleSqlEditorKeyDown,
    applySuggestionItem,
  } = useMySqlQuerySuggestions({
    activeBrowseTab,
    activeSuggestionItems,
    suggestionActiveIndex,
    queryEditorMap,
    queryEditorRef,
    databases,
    setQueryEditorMap,
    setQuerySuggestions,
    setSuggestionActiveIndex,
    ensureSchemaTables,
    ensureTableColumns,
  });

  const {
    formOpen,
    editMode,
    secret,
    testing,
    testResult,
    form,
    setFormOpen,
    setSecret,
    setTesting,
    setTestResult,
    setForm,
    openCreate,
    openEdit,
    saveModalForm,
  } = useMySqlConnectionForm({
    selected,
    onCreate,
    onUpdate,
    onGetSecret,
    onSelect,
    setLocalError: (message) => setLocalError(message),
  });

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  useEffect(() => {
    if (!sidebarFeedback) return;
    const timer = window.setTimeout(() => setSidebarFeedback(null), 2000);
    return () => window.clearTimeout(timer);
  }, [sidebarFeedback]);

  // auto-connect when a MySQL connection is selected from the home page
  useEffect(() => {
    if (!selectedId) return;
    setActiveSchema("");
    setActiveTable("");
    void loadSchema(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <section className="workspace mysql-page">
      {hideHeader ? null : (
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">{tr("mysql.page.title")}</div>
            <div className="topbar-subtitle">{selected ? selected.name : tr("mysql.page.noSelection")}</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onBack}>{tr("terminal.back")}</button>
          {onOpenUnifiedCreate ? (
            <button className="btn btn-ghost" onClick={onOpenUnifiedCreate}>
              {tr("top.addConnection")}
            </button>
          ) : null}
          <button className="btn btn-ghost" onClick={openCreate}>{tr("mysql.page.addConnection")}</button>
          <button className="btn btn-ghost" onClick={openTopQueryTab} disabled={!selected}>
            {tr("mysql.page.newQuery")}
          </button>
          <button className="btn btn-ghost" onClick={() => void loadSchema()} disabled={!selected || busy}>{tr("mysql.page.refreshSchema")}</button>
          <button className="btn btn-ghost" onClick={() => selected && void disconnectMySql(selected.id)} disabled={!selected}>{tr("mysql.page.disconnect")}</button>
          <span className={selected ? "pill pill-ok" : "pill"}>{selected ? tr("top.online") : tr("top.offline")}</span>
          <span className="pill pill-muted">{busy ? tr("home.refreshStatusRunning") : status}</span>
        </div>
      </header>
      )}
      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}
      {localError ? <ErrorBanner message={localError} onDismiss={() => setLocalError(null)} /> : null}
      <div className="terminal-layout" style={{ gridTemplateColumns: "280px 8px minmax(0, 1fr)" }}>
        <div style={{ position: "relative" }}>
        <MySqlSidebar
          connections={connections}
          selectedId={selectedId}
          databases={databases}
          activeSchema={activeSchema}
          tables={tables}
          tablesLoading={tablesLoading}
          activeTable={activeTable}
          tr={tr}
          onSelect={onSelect}
          onOpenConnection={(id) => {
            onSelect(id);
            void loadSchema(id).catch((err) => {
                      const message = err instanceof Error ? err.message : String(err);
                      setLocalError(message);
                    });
                  }}
          onOpenContext={(x, y, connId) => setContextMenu({ x, y, connId })}
          onSelectSchema={(schema) => {
            setActiveSchema(schema);
            void loadTablesForSchema(schema);
          }}
          onOpenSchemaTab={(schema) => {
            setActiveSchema(schema);
            addDatabaseTab(schema);
            void loadTablesForSchema(schema);
          }}
          onSelectTable={(tableName) => {
            setActiveTable(tableName);
            if (!selected || !activeSchema) return;
            void mySqlListColumns(selected.id, activeSchema, tableName).then(setColumns).catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              setLocalError(message);
            });
          }}
          onOpenTableTab={(schema, table) => {
            if (!schema) return;
            addTableTab(schema, table);
          }}
          onOpenTableEdit={(schema, table) => {
            if (!schema || !table) return;
            addTableEditTab(schema, table);
          }}
          onImportDdl={async (schema, table) => {
            if (!selected) return;
            try {
              const sql = `SHOW CREATE TABLE \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\``;
              const result = await mySqlExecuteQuery(selected.id, sql);
              const ddl = result.rows[0]?.[1] ?? "";
              if (!ddl) throw new Error("Empty DDL result");
              await navigator.clipboard.writeText(ddl);
              setSidebarFeedback(tr("mysql.page.ddlCopied"));
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setLocalError(message);
            }
          }}
          onExportInserts={async (schema, table) => {
            if (!selected) return;
            try {
              const result = await mySqlExecuteQuery(selected.id, `SELECT * FROM \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\``, 5000);
              const columns = result.columns;
              const rows = result.rows;
              const inserts = rows.map((row) => {
                const colList = columns.map((c) => `\`${escapeSqlIdentifier(c)}\``).join(", ");
                const valList = row.map((v) => v === null ? "NULL" : `'${escapeSqlValue(v)}'`).join(", ");
                return `INSERT INTO \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(table)}\` (${colList}) VALUES (${valList});`;
              }).join("\n");
              await navigator.clipboard.writeText(inserts);
              setSidebarFeedback(tr("mysql.page.insExported", { count: rows.length }));
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setLocalError(message);
            }
          }}
          onOpenQueryWithSql={(schema, sql) => {
            addQueryTabWithSql(schema, sql);
          }}
          onImportDbDdl={async (schema) => {
            if (!selected) return;
            try {
              const ddls: string[] = [];
              for (const t of tables) {
                const result = await mySqlExecuteQuery(selected.id, `SHOW CREATE TABLE \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(t.name)}\``);
                if (result.rows[0]?.[1]) ddls.push(result.rows[0][1]);
              }
              const allDdl = ddls.join("\n\n");
              await navigator.clipboard.writeText(allDdl);
              setSidebarFeedback(tr("mysql.page.ddlCopied"));
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setLocalError(message);
            }
          }}
          onImportDbDml={(schema) => {
            const sqls = tables.map((t) => `SELECT * FROM \`${escapeSqlIdentifier(schema)}\`.\`${escapeSqlIdentifier(t.name)}\` LIMIT 1000;`).join("\n");
            addQueryTabWithSql(schema, sqls);
          }}
        />
          {sidebarFeedback ? (
            <div className="mysql-sidebar-feedback" key={sidebarFeedback}>{sidebarFeedback}</div>
          ) : null}
        </div>
        <div className="terminal-splitter redis-layout-splitter" />
        {selected ? (
        <MySqlBrowsePane
          browseTabs={browseTabs}
          activeBrowseTabId={activeBrowseTabId}
          activeBrowseTab={activeBrowseTab}
          activeSchema={activeSchema}
          activeTable={activeTable}
          selectedConnectionId={selected?.id}
          tables={tables}
          onCloseTab={closeBrowseTab}
          onCloseTabsLeft={closeTabsLeft}
          onCloseTabsRight={closeTabsRight}
          onCloseOtherTabs={closeOtherTabs}
          tablesLoading={tablesLoading}
          tableDataMap={tableDataMap}
          queryEditorMap={queryEditorMap}
          activeTableData={activeTableData}
          activeQueryEditor={activeQueryEditor}
          querySuggestions={querySuggestions}
          activeSuggestionItems={activeSuggestionItems}
          tr={tr}
          suggestionActiveIndex={suggestionActiveIndex}
          queryEditorRef={queryEditorRef}
          dataScrollRef={dataScrollRef}
          filterOperators={filterOperators}
          onSelectTab={selectBrowseTab}
          onSelectTable={(tableName) => {
            setActiveTable(tableName);
            if (!selected || !activeSchema) return;
            void mySqlListColumns(selected.id, activeSchema, tableName).then(setColumns).catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              setLocalError(message);
            });
          }}
          onOpenTableTab={(schema, table) => {
            if (!schema) return;
            addTableTab(schema, table);
          }}
          onOpenTableEdit={(schema, table) => {
            if (!schema || !table) return;
            addTableEditTab(schema, table);
          }}
          onChangeCondition={patchCondition}
          onDeleteCondition={removeCondition}
          onAddCondition={addCondition}
          onQueryTable={queryCurrentTable}
          onChangeTablePage={(page) => {
            if (!activeBrowseTab?.table) return;
                              const nextConditions = activeTableData?.conditions ?? [];
                          setTableDataMap((prev) => ({
                            ...prev,
                            [activeBrowseTab.id]: {
                ...(prev[activeBrowseTab.id] ?? {
                  loading: false,
                  conditions: [createEmptyCondition()],
                  columns: [],
                  rows: [],
                  page: 0,
                  pageSize: 100,
                  totalRows: 0,
                }),
                loading: true,
                error: undefined,
                            },
                          }));
            void loadTableData(
              activeBrowseTab.id,
              activeBrowseTab.schema,
              activeBrowseTab.table,
              nextConditions,
              page,
              activeTableData?.pageSize ?? 100
            );
          }}
          onChangePageSize={(pageSize) => {
                          if (!activeBrowseTab?.table) return;
                          const nextConditions = activeTableData?.conditions ?? [];
                          setTableDataMap((prev) => ({
                            ...prev,
                            [activeBrowseTab.id]: {
                ...(prev[activeBrowseTab.id] ?? {
                  loading: false,
                  conditions: [createEmptyCondition()],
                  columns: [],
                  rows: [],
                  page: 0,
                  pageSize: 100,
                  totalRows: 0,
                }),
                              loading: true,
                page: 0,
                pageSize,
                              error: undefined,
                            },
                          }));
            void loadTableData(
              activeBrowseTab.id,
              activeBrowseTab.schema,
              activeBrowseTab.table,
              nextConditions,
              0,
              pageSize
            );
          }}
          onFormatSql={() => {
            if (!activeBrowseTab) return;
                          const sql = activeQueryEditor?.sql ?? "";
                          setQueryEditorMap((prev) => ({
                            ...prev,
                            [activeBrowseTab.id]: {
        ...(prev[activeBrowseTab.id] ?? { sql: "", cursor: 0, running: false, explaining: false, result: null, explainResult: null, queryOffset: 0, queryLimit: 200 }),
                              sql: formatSqlText(sql),
                            },
                          }));
                        }}
          onExplainSql={() => {
            if (activeBrowseTab) void explainQueryEditor(activeBrowseTab.id, activeBrowseTab.schema);
          }}
          onRunSql={() => {
            if (activeBrowseTab) void runQueryEditor(activeBrowseTab.id, activeBrowseTab.schema);
          }}
          onChangeQueryOffset={(offset) => {
            if (activeBrowseTab) void changeQueryOffset(activeBrowseTab.id, activeBrowseTab.schema, offset);
          }}
          onSqlEditorChange={handleSqlEditorChange}
          onSqlEditorClick={handleSqlEditorClick}
          onSqlEditorKeyUp={handleSqlEditorKeyUp}
          onSqlEditorKeyDown={(key) => {
            handleSqlEditorKeyDown(key, (item) => {
              if (activeBrowseTab) applySuggestionItem(querySuggestions, activeBrowseTab.id, item);
            });
          }}
          onSqlEditorBlur={() => {
                        window.setTimeout(() => {
                          setQuerySuggestions(null);
                          setSuggestionActiveIndex(0);
                        }, 120);
                      }}
          onApplySuggestion={(item) => {
            if (activeBrowseTab) applySuggestionItem(querySuggestions, activeBrowseTab.id, item);
          }}
        />
        ) : (
          <div className="empty-state">
            <div className="empty-title">{tr("mysql.page.title")}</div>
            <div className="empty-subtitle">{tr("mysql.page.noSelection")}</div>
          </div>
        )}
                      </div>
      <MySqlConnectionModal
        open={formOpen}
        editMode={editMode}
        selectedId={selected?.id}
        form={form}
        secret={secret}
        testing={testing}
        testResult={testResult}
        tr={tr}
        onClose={() => setFormOpen(false)}
        onChangeForm={(updater) => setForm((prev) => updater(prev))}
        onChangeSecret={setSecret}
        setTesting={setTesting}
        setTestResult={setTestResult}
        onSave={saveModalForm}
      />
      <CommandStatusBar command={currentCommand} label={tr("cmdBar.title")} />
      {contextMenu ? (
        <MySqlContextMenus
          contextMenu={contextMenu}
          connections={connections}
          tr={tr}
          onCloseContext={() => setContextMenu(null)}
          onSelect={onSelect}
          onDelete={(id) => void onDelete(id)}
          onEdit={(nextForm) => {
            openEdit(nextForm);
          }}
        />
      ) : null}
    </section>
  );
}
