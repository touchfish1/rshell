import { useEffect, useRef, useState } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import { disconnectMySql, mySqlListColumns } from "../services/bridge";
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
import { formatSqlText } from "./mysql/sqlUtils";
import {
  createEmptyCondition,
  FILTER_OPERATORS,
  type MySqlBrowseTab,
  type MySqlDbContextMenuState,
  type MySqlQueryEditorState,
  type MySqlTableDataState,
  type SqlSuggestionState,
} from "./mysql/types";
import { useMySqlDataLoader } from "./mysql/useMySqlDataLoader";
import { useMySqlConnectionForm } from "./mysql/useMySqlConnectionForm";
import { useMySqlQuerySuggestions } from "./mysql/useMySqlQuerySuggestions";
import { useMySqlTableFilters } from "./mysql/useMySqlTableFilters";
import { useMySqlTabsManager } from "./mysql/useMySqlTabsManager";

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
}: Props) {
  const selected = connections.find((c) => c.id === selectedId);
  const [, setColumns] = useState<MySqlColumnInfo[]>([]);
  const [activeSchema, setActiveSchema] = useState("");
  const [activeTable, setActiveTable] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connId: string } | null>(null);
  const [dbContextMenu, setDbContextMenu] = useState<MySqlDbContextMenuState | null>(null);
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
    loadTablesForSchema,
    loadTableData,
    runQueryEditor,
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
    openTopQueryTab,
    selectBrowseTab,
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
    if (!dbContextMenu) return;
    const close = () => setDbContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [dbContextMenu]);

  return (
    <section className="workspace mysql-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">{tr("mysql.page.title")}</div>
            <div className="topbar-subtitle">{selected ? selected.name : tr("mysql.page.noSelection")}</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onBack}>{tr("terminal.back")}</button>
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
      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}
      {localError ? <ErrorBanner message={localError} onDismiss={() => setLocalError(null)} /> : null}
      <div className="terminal-layout" style={{ gridTemplateColumns: "280px 8px minmax(0, 1fr)" }}>
        <MySqlSidebar
          connections={connections}
          selectedId={selectedId}
          databases={databases}
          activeSchema={activeSchema}
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
          onOpenDbContext={(x, y, schema) => setDbContextMenu({ x, y, schema })}
        />
        <div className="terminal-splitter redis-layout-splitter" />
        <MySqlBrowsePane
          browseTabs={browseTabs}
          activeBrowseTabId={activeBrowseTabId}
          activeBrowseTab={activeBrowseTab}
          activeSchema={activeSchema}
          activeTable={activeTable}
          selectedConnectionId={selected?.id}
          tables={tables}
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
                                  ...(prev[activeBrowseTab.id] ?? { sql: "", cursor: 0, running: false, explaining: false, result: null, explainResult: null }),
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
      <MySqlContextMenus
        contextMenu={contextMenu}
        dbContextMenu={dbContextMenu}
        connections={connections}
        tr={tr}
        onCloseContext={() => setContextMenu(null)}
        onCloseDbContext={() => setDbContextMenu(null)}
        onSelect={onSelect}
        onDelete={(id) => void onDelete(id)}
        onEdit={(nextForm) => {
          openEdit(nextForm);
        }}
        onCreateQuery={(schema) => addQueryTab(schema)}
      />
    </section>
  );
}
