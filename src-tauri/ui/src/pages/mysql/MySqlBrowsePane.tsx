import { useEffect, useState } from "react";
import type { I18nKey } from "../../i18n";
import type { MySqlTableInfo } from "../../services/types";
import { MySqlTableDesignEditor } from "./MySqlTableDesignEditor";
import type {
  MySqlBrowseTab,
  MySqlFilterCondition,
  MySqlFilterOperator,
  MySqlQueryEditorState,
  MySqlTableDataState,
  SqlSuggestionState,
} from "./types";
import { MySqlTableBrowser } from "./MySqlTableBrowser";
import { MySqlQueryBrowser } from "./MySqlQueryBrowser";

interface Props {
  browseTabs: MySqlBrowseTab[];
  activeBrowseTabId: string | null;
  activeBrowseTab: MySqlBrowseTab | null;
  activeSchema: string;
  activeTable: string;
  selectedConnectionId?: string;
  tables: MySqlTableInfo[];
  tablesLoading: boolean;
  tableDataMap: Record<string, MySqlTableDataState>;
  queryEditorMap: Record<string, MySqlQueryEditorState>;
  activeTableData?: MySqlTableDataState;
  activeQueryEditor?: MySqlQueryEditorState;
  querySuggestions: SqlSuggestionState | null;
  activeSuggestionItems: string[];
  suggestionActiveIndex: number;
  queryEditorRef: React.RefObject<HTMLTextAreaElement>;
  dataScrollRef: React.RefObject<HTMLDivElement>;
  filterOperators: Array<{ value: MySqlFilterOperator; label: string }>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onSelectTab: (tab: MySqlBrowseTab) => void;
  onSelectTable: (table: string) => void;
  onOpenTableTab: (schema: string, table: string) => void;
  onOpenTableEdit: (schema: string, table: string) => void;
  onChangeCondition: (conditionId: string, patch: Partial<MySqlFilterCondition>) => void;
  onDeleteCondition: (conditionId: string) => void;
  onAddCondition: () => void;
  onQueryTable: () => void;
  onChangeTablePage: (page: number) => void;
  onChangePageSize: (pageSize: number) => void;
  onFormatSql: () => void;
  onExplainSql: () => void;
  onRunSql: () => void;
  onChangeQueryOffset: (offset: number) => void;
  onSqlEditorChange: (value: string, cursor: number, textarea: HTMLTextAreaElement) => void;
  onSqlEditorClick: (value: string, cursor: number) => void;
  onSqlEditorKeyUp: (key: string, value: string, cursor: number, textarea: HTMLTextAreaElement) => void;
  onSqlEditorKeyDown: (key: string) => void;
  onSqlEditorBlur: () => void;
  onApplySuggestion: (item: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseTabsLeft: (tabId: string) => void;
  onCloseTabsRight: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
}

export function MySqlBrowsePane(props: Props) {
  const {
    browseTabs,
    activeBrowseTabId,
    activeBrowseTab,
    activeSchema,
    activeTable,
    tables,
    tablesLoading,
    activeTableData,
    activeQueryEditor,
    querySuggestions,
    activeSuggestionItems,
    suggestionActiveIndex,
    queryEditorRef,
    dataScrollRef,
    filterOperators,
    tr,
  } = props;
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; table: string } | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  useEffect(() => {
    if (!tableContextMenu) return;
    const close = () => setTableContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [tableContextMenu]);

  useEffect(() => {
    if (!tabContextMenu) return;
    const close = () => setTabContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [tabContextMenu]);

  return (
    <div className="redis-browser-pane">
      <div className="redis-browser-toolbar mysql-browse-tabs">
        {browseTabs.length === 0 ? <div className="mysql-toolbar-label">{tr("mysql.page.tabHint")}</div> : null}
        {browseTabs.map((tab) => (
          <div
            key={tab.id}
            className={`mysql-data-tab ${activeBrowseTabId === tab.id ? "is-selected" : ""}`}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
            }}
          >
            <button className="mysql-data-tab-main" onClick={() => props.onSelectTab(tab)}>
              {tab.title}
            </button>
            <button
              className="mysql-data-tab-close"
              onClick={(e) => { e.stopPropagation(); props.onCloseTab(tab.id); }}
              title={tr("session.close")}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {tabContextMenu ? (
        <div className="mysql-context-menu mysql-tab-context-menu" style={{ left: tabContextMenu.x, top: tabContextMenu.y }}>
          <button className="mysql-context-item" onClick={() => { props.onCloseTab(tabContextMenu.tabId); setTabContextMenu(null); }}>
            {tr("session.close")}
          </button>
          <button className="mysql-context-item" onClick={() => { props.onCloseTabsLeft(tabContextMenu.tabId); setTabContextMenu(null); }}>
            {tr("mysql.page.closeTabsLeft")}
          </button>
          <button className="mysql-context-item" onClick={() => { props.onCloseTabsRight(tabContextMenu.tabId); setTabContextMenu(null); }}>
            {tr("mysql.page.closeTabsRight")}
          </button>
          <button className="mysql-context-item" onClick={() => { props.onCloseOtherTabs(tabContextMenu.tabId); setTabContextMenu(null); }}>
            {tr("mysql.page.closeOtherTabs")}
          </button>
        </div>
      ) : null}
      <div className="redis-browser-body">
        <div>
          {activeBrowseTab?.kind === "table" ? (
            <MySqlTableBrowser
              activeBrowseTab={activeBrowseTab}
              activeTableData={activeTableData}
              selectedConnectionId={props.selectedConnectionId}
              filterOperators={filterOperators}
              dataScrollRef={dataScrollRef}
              tr={tr}
              onChangeCondition={props.onChangeCondition}
              onDeleteCondition={props.onDeleteCondition}
              onAddCondition={props.onAddCondition}
              onQueryTable={props.onQueryTable}
              onChangeTablePage={props.onChangeTablePage}
              onChangePageSize={props.onChangePageSize}
            />
          ) : activeBrowseTab?.kind === "query" ? (
            <MySqlQueryBrowser
              activeBrowseTab={activeBrowseTab}
              activeQueryEditor={activeQueryEditor}
              querySuggestions={querySuggestions}
              activeSuggestionItems={activeSuggestionItems}
              suggestionActiveIndex={suggestionActiveIndex}
              queryEditorRef={queryEditorRef}
              tr={tr}
              onFormatSql={props.onFormatSql}
              onExplainSql={props.onExplainSql}
              onRunSql={props.onRunSql}
              onChangeQueryOffset={props.onChangeQueryOffset}
              onSqlEditorChange={props.onSqlEditorChange}
              onSqlEditorClick={props.onSqlEditorClick}
              onSqlEditorKeyUp={props.onSqlEditorKeyUp}
              onSqlEditorKeyDown={props.onSqlEditorKeyDown}
              onSqlEditorBlur={props.onSqlEditorBlur}
              onApplySuggestion={props.onApplySuggestion}
            />
          ) : activeBrowseTab?.kind === "table-edit" ? (
            <div className="mysql-data-view">
              <div className="mysql-data-grid-wrap">
                <MySqlTableDesignEditor connectionId={props.selectedConnectionId} schema={activeBrowseTab.schema} table={activeBrowseTab.table ?? ""} />
              </div>
            </div>
          ) : (
            <div className="mysql-table-panel">
              <h4>{tr("mysql.page.tablePanelTitle")}</h4>
              <div className="mysql-table-list">
                {tablesLoading ? <div className="mysql-table-empty">{tr("sftp.loading")}</div> : null}
                {!tablesLoading && tables.length === 0 ? <div className="mysql-table-empty">{tr("mysql.page.selectDbToViewTables")}</div> : null}
                {tables.map((table) => (
                  <button
                    key={table.name}
                    className={`mysql-table-item ${activeTable === table.name ? "is-selected" : ""}`}
                    onClick={() => props.onSelectTable(table.name)}
                    onDoubleClick={() => props.onOpenTableTab(activeSchema, table.name)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setTableContextMenu({ x: event.clientX, y: event.clientY, table: table.name });
                    }}
                  >
                    {table.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {tableContextMenu ? (
        <div className="mysql-context-menu" style={{ left: tableContextMenu.x, top: tableContextMenu.y }}>
          <button
            className="mysql-context-item"
            onClick={() => {
              props.onOpenTableEdit(activeSchema, tableContextMenu.table);
              setTableContextMenu(null);
            }}
          >
            {tr("mysql.page.editTable")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
