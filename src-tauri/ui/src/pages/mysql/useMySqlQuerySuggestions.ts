import { useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { findRecentAliasBeforeCursor, isSubsequenceMatch, parseSqlTableRefs, stripSqlTicks } from "./sqlUtils";
import type { MySqlBrowseTab, MySqlQueryEditorState, SqlSuggestionState } from "./types";

const NAV_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Tab",
  "Escape",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

interface Params {
  activeBrowseTab: MySqlBrowseTab | null;
  activeSuggestionItems: string[];
  suggestionActiveIndex: number;
  queryEditorMap: Record<string, MySqlQueryEditorState>;
  queryEditorRef: RefObject<HTMLTextAreaElement>;
  databases: string[];
  setQueryEditorMap: Dispatch<SetStateAction<Record<string, MySqlQueryEditorState>>>;
  setQuerySuggestions: Dispatch<SetStateAction<SqlSuggestionState | null>>;
  setSuggestionActiveIndex: Dispatch<SetStateAction<number>>;
  ensureSchemaTables: (schema: string) => Promise<string[]>;
  ensureTableColumns: (schema: string, table: string) => Promise<string[]>;
}

export function useMySqlQuerySuggestions({
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
}: Params) {
  const buildSuggestionAnchor = useCallback((textarea: HTMLTextAreaElement, cursor: number) => {
    const style = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const marker = document.createElement("span");
    const textBeforeCursor = textarea.value.slice(0, cursor);
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflow = "hidden";
    mirror.style.boxSizing = "border-box";
    mirror.style.left = "-9999px";
    mirror.style.top = "0";
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.fontSize = style.fontSize;
    mirror.style.fontWeight = style.fontWeight;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.padding = style.padding;
    mirror.style.border = style.border;
    mirror.style.letterSpacing = style.letterSpacing;
    mirror.textContent = textBeforeCursor;
    marker.textContent = "\u200b";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    document.body.removeChild(mirror);
    return {
      x: markerRect.left - mirrorRect.left - textarea.scrollLeft + 14,
      y: markerRect.top - mirrorRect.top - textarea.scrollTop + Number.parseFloat(style.lineHeight || "20") + 10,
    };
  }, []);

  const updateSqlSuggestions = useCallback(async (
    tabId: string,
    schema: string,
    sql: string,
    cursor: number,
    anchor: { x: number; y: number }
  ) => {
    try {
      const beforeCursor = sql.slice(0, cursor);
      const dotMatch = beforeCursor.match(/`?([A-Za-z_][A-Za-z0-9_]*)`?\.\s*([A-Za-z_][A-Za-z0-9_]*)?$/);
      const prefixMatch = dotMatch ? null : beforeCursor.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!dotMatch && !prefixMatch) {
        setQuerySuggestions(null);
        setSuggestionActiveIndex(0);
        return;
      }
      const prefixRaw = dotMatch ? dotMatch[2] ?? "" : prefixMatch?.[1] ?? "";
      const prefix = prefixRaw.toLowerCase();
      const replaceStart = cursor - prefixRaw.length;
      const { aliasMap, aliasOrder, lastRef } = parseSqlTableRefs(beforeCursor, schema);
      const tables = await ensureSchemaTables(schema);
      const schemaNames = new Set([schema.toLowerCase(), ...databases.map((item) => item.toLowerCase())]);
      let columns: string[] = [];
      let dotCandidates: string[] | null = null;
      if (dotMatch) {
        const qualifier = stripSqlTicks(dotMatch[1]).toLowerCase();
        if (schemaNames.has(qualifier)) {
          dotCandidates = tables;
        } else {
          const target = aliasMap[qualifier];
          if (target) {
            columns = await ensureTableColumns(target.schema, target.table);
            dotCandidates = columns;
          } else if (tables.some((item) => item.toLowerCase() === qualifier)) {
            columns = await ensureTableColumns(schema, qualifier);
            dotCandidates = columns;
          }
        }
        if (!dotCandidates && lastRef) {
          columns = await ensureTableColumns(lastRef.schema, lastRef.table);
          dotCandidates = columns;
        }
      } else {
        const recentAlias = findRecentAliasBeforeCursor(beforeCursor, aliasOrder);
        if (recentAlias && aliasMap[recentAlias]) {
          const ref = aliasMap[recentAlias];
          columns = await ensureTableColumns(ref.schema, ref.table);
        } else if (lastRef) {
          columns = await ensureTableColumns(lastRef.schema, lastRef.table);
        }
      }
      const keywords = ["SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "GROUP BY", "LIMIT", "JOIN", "LEFT JOIN"];
      const candidates = dotMatch ? dotCandidates ?? [] : [...tables, ...columns, ...keywords];
      const merged = candidates
        .filter((item, idx, arr) => arr.indexOf(item) === idx)
        .filter((item) => isSubsequenceMatch(item.toLowerCase(), prefix))
        .slice(0, 12);
      if (merged.length === 0 || merged.some((item) => item.toLowerCase() === prefix)) {
        setQuerySuggestions(null);
        setSuggestionActiveIndex(0);
        return;
      }
      setQuerySuggestions({ tabId, start: replaceStart, end: cursor, x: anchor.x, y: anchor.y, items: merged });
      setSuggestionActiveIndex(0);
    } catch {
      setQuerySuggestions(null);
      setSuggestionActiveIndex(0);
    }
  }, [databases, ensureSchemaTables, ensureTableColumns, setQuerySuggestions, setSuggestionActiveIndex]);

  const applySuggestionItem = useCallback((querySuggestions: SqlSuggestionState | null, tabId: string, item: string) => {
    if (!querySuggestions) return;
    const current = queryEditorMap[tabId];
    if (!current) return;
    const nextSql = current.sql.slice(0, querySuggestions.start) + item + current.sql.slice(querySuggestions.end);
    const nextCursor = querySuggestions.start + item.length;
    setQueryEditorMap((prev) => ({
      ...prev,
      [tabId]: { ...(prev[tabId] ?? current), sql: nextSql, cursor: nextCursor },
    }));
    setQuerySuggestions(null);
    setSuggestionActiveIndex(0);
    window.requestAnimationFrame(() => {
      const editor = queryEditorRef.current;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(nextCursor, nextCursor);
    });
  }, [queryEditorMap, queryEditorRef, setQueryEditorMap, setQuerySuggestions, setSuggestionActiveIndex]);

  const handleSqlEditorChange = useCallback((value: string, cursor: number, textarea: HTMLTextAreaElement) => {
    if (!activeBrowseTab) return;
    const anchor = buildSuggestionAnchor(textarea, cursor);
    setQueryEditorMap((prev) => ({
      ...prev,
      [activeBrowseTab.id]: {
        ...(prev[activeBrowseTab.id] ?? { sql: "", cursor: 0, running: false, explaining: false, result: null, explainResult: null }),
        sql: value,
        cursor,
      },
    }));
    void updateSqlSuggestions(activeBrowseTab.id, activeBrowseTab.schema, value, cursor, anchor);
  }, [activeBrowseTab, buildSuggestionAnchor, setQueryEditorMap, updateSqlSuggestions]);

  const handleSqlEditorClick = useCallback((value: string, cursor: number) => {
    if (!activeBrowseTab) return;
    setQueryEditorMap((prev) => ({
      ...prev,
      [activeBrowseTab.id]: {
        ...(prev[activeBrowseTab.id] ?? { sql: value, cursor: 0, running: false, explaining: false, result: null, explainResult: null }),
        cursor,
      },
    }));
    setQuerySuggestions(null);
    setSuggestionActiveIndex(0);
  }, [activeBrowseTab, setQueryEditorMap, setQuerySuggestions, setSuggestionActiveIndex]);

  const handleSqlEditorKeyUp = useCallback((key: string, value: string, cursor: number, textarea: HTMLTextAreaElement) => {
    if (!activeBrowseTab || NAV_KEYS.has(key)) return;
    const anchor = buildSuggestionAnchor(textarea, cursor);
    void updateSqlSuggestions(activeBrowseTab.id, activeBrowseTab.schema, value, cursor, anchor);
  }, [activeBrowseTab, buildSuggestionAnchor, updateSqlSuggestions]);

  const handleSqlEditorKeyDown = useCallback((key: string, onApply: (item: string) => void) => {
    if (!activeBrowseTab || activeSuggestionItems.length === 0) return;
    if (key === "ArrowDown") {
      setSuggestionActiveIndex((prev) => (prev + 1) % activeSuggestionItems.length);
      return;
    }
    if (key === "ArrowUp") {
      setSuggestionActiveIndex((prev) => (prev - 1 + activeSuggestionItems.length) % activeSuggestionItems.length);
      return;
    }
    if (key === "Enter" || key === "Tab") {
      const selectedItem = activeSuggestionItems[Math.min(suggestionActiveIndex, activeSuggestionItems.length - 1)];
      if (selectedItem) onApply(selectedItem);
      return;
    }
    if (key === "Escape") {
      setQuerySuggestions(null);
      setSuggestionActiveIndex(0);
    }
  }, [activeBrowseTab, activeSuggestionItems, setQuerySuggestions, setSuggestionActiveIndex, suggestionActiveIndex]);

  return {
    handleSqlEditorChange,
    handleSqlEditorClick,
    handleSqlEditorKeyUp,
    handleSqlEditorKeyDown,
    applySuggestionItem,
    updateSqlSuggestions,
  };
}
