import { type IndexDraft } from "./types";
import type { I18nKey } from "../../i18n";
import { nextId } from "./sqlUtils";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  indexes: IndexDraft[];
  setIndexes: (updater: IndexDraft[] | ((prev: IndexDraft[]) => IndexDraft[])) => void;
  availableIndexColumns: string[];
}

function parseIndexColumns(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MySqlIndexEditor({ tr, indexes, setIndexes, availableIndexColumns }: Props) {
  const updateIndexColumns = (id: string, nextCols: string[]) => {
    setIndexes((prev) =>
      prev.map((idx) => (idx.id === id ? { ...idx, columns: nextCols.join(", ") } : idx))
    );
  };

  return (
    <div className="mysql-table-design-section">
      <div className="mysql-table-design-section-title">{tr("mysql.page.indexesSection")}</div>
      <div className="mysql-table-design-grid indexes">
        {indexes.map((idx) => {
          const cols = parseIndexColumns(idx.columns);
          const selectableCols = availableIndexColumns.filter((name) => !cols.includes(name));
          return (
            <div key={idx.id} className={`mysql-table-design-index-card ${idx.markedDrop ? "is-drop" : ""}`}>
              <div className="mysql-table-design-index-head">
                <input
                  className="mysql-field"
                  value={idx.name}
                  onChange={(e) =>
                    setIndexes((prev) => prev.map((x) => (x.id === idx.id ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder={tr("mysql.page.indexName")}
                  disabled={idx.name === "PRIMARY"}
                />
                <select
                  className="mysql-field mysql-select"
                  value={idx.kind}
                  onChange={(e) =>
                    setIndexes((prev) =>
                      prev.map((x) =>
                        x.id === idx.id ? { ...x, kind: e.target.value as IndexDraft["kind"] } : x
                      )
                    )
                  }
                  disabled={idx.name === "PRIMARY"}
                >
                  <option value="INDEX">{tr("mysql.page.indexKindNormal")}</option>
                  <option value="UNIQUE">{tr("mysql.page.indexKindUnique")}</option>
                  <option value="PRIMARY">{tr("mysql.page.indexKindPrimary")}</option>
                </select>
                <label className="mysql-table-design-check">
                  <input
                    type="checkbox"
                    checked={idx.markedDrop}
                    disabled={idx.name === "PRIMARY"}
                    onChange={(e) =>
                      setIndexes((prev) =>
                        prev.map((x) => (x.id === idx.id ? { ...x, markedDrop: e.target.checked } : x))
                      )
                    }
                  />
                  {tr("mysql.page.markDelete")}
                </label>
              </div>
              <div className="mysql-index-columns-editor">
                <div className="mysql-index-columns-list">
                  {cols.length === 0 ? <span className="mysql-table-empty">{tr("mysql.page.noIndexColumns")}</span> : null}
                  {cols.map((colName, index) => (
                    <span key={`${colName}-${index}`} className="mysql-index-col-chip">
                      <span>{colName}</span>
                      <button
                        type="button"
                        className="btn btn-ghost mysql-index-chip-btn"
                        disabled={index <= 0}
                        onClick={() => {
                          const next = [...cols];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          updateIndexColumns(idx.id, next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost mysql-index-chip-btn"
                        disabled={index >= cols.length - 1}
                        onClick={() => {
                          const next = [...cols];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          updateIndexColumns(idx.id, next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost mysql-index-chip-btn"
                        onClick={() => updateIndexColumns(idx.id, cols.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  className="mysql-field mysql-select"
                  value=""
                  onChange={(e) => {
                    const picked = e.target.value;
                    if (!picked) return;
                    updateIndexColumns(idx.id, [...cols, picked]);
                  }}
                >
                  <option value="">{tr("mysql.page.addFieldToIndex")}</option>
                  {selectableCols.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <button
        className="btn btn-ghost"
        onClick={() =>
          setIndexes((prev) => [
            ...prev,
            {
              id: nextId(),
              name: "",
              kind: "INDEX" as const,
              columns: "",
              method: "BTREE",
              isNew: true,
              markedDrop: false,
            },
          ])
        }
      >
        {tr("mysql.page.addIndex")}
      </button>
    </div>
  );
}
