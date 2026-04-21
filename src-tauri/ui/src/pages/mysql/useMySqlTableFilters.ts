import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createEmptyCondition, type MySqlBrowseTab, type MySqlFilterCondition, type MySqlTableDataState } from "./types";

interface Params {
  activeBrowseTab: MySqlBrowseTab | null;
  activeTableData: MySqlTableDataState | undefined;
  setTableDataMap: Dispatch<SetStateAction<Record<string, MySqlTableDataState>>>;
  loadTableData: (
    tabId: string,
    schema: string,
    table: string,
    queryConditions?: MySqlFilterCondition[],
    page?: number,
    pageSize?: number
  ) => Promise<void>;
}

export function useMySqlTableFilters({
  activeBrowseTab,
  activeTableData,
  setTableDataMap,
  loadTableData,
}: Params) {
  const patchCondition = useCallback((conditionId: string, patch: Partial<MySqlFilterCondition>) => {
    if (!activeBrowseTab) return;
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
        conditions: (prev[activeBrowseTab.id]?.conditions ?? []).map((item) =>
          item.id === conditionId ? { ...item, ...patch } : item
        ),
      },
    }));
  }, [activeBrowseTab, setTableDataMap]);

  const removeCondition = useCallback((conditionId: string) => {
    if (!activeBrowseTab) return;
    setTableDataMap((prev) => {
      const current = prev[activeBrowseTab.id]?.conditions ?? [];
      const next = current.filter((item) => item.id !== conditionId);
      return {
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
          conditions: next.length > 0 ? next : [createEmptyCondition()],
        },
      };
    });
  }, [activeBrowseTab, setTableDataMap]);

  const addCondition = useCallback(() => {
    if (!activeBrowseTab) return;
    setTableDataMap((prev) => ({
      ...prev,
      [activeBrowseTab.id]: {
        ...(prev[activeBrowseTab.id] ?? {
          loading: false,
          conditions: [],
          columns: [],
          rows: [],
          page: 0,
          pageSize: 100,
          totalRows: 0,
        }),
        conditions: [...(prev[activeBrowseTab.id]?.conditions ?? []), createEmptyCondition()],
      },
    }));
  }, [activeBrowseTab, setTableDataMap]);

  const queryCurrentTable = useCallback(() => {
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
      0,
      activeTableData?.pageSize ?? 100
    );
  }, [activeBrowseTab, activeTableData, loadTableData, setTableDataMap]);

  return { patchCondition, removeCondition, addCondition, queryCurrentTable };
}
