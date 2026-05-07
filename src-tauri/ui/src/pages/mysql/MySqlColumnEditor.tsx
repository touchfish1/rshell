import { type ColumnDraft } from "./types";
import type { I18nKey } from "../../i18n";
import { nextId } from "./sqlUtils";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  tableComment: string;
  setTableComment: (value: string) => void;
  columns: ColumnDraft[];
  setColumns: (updater: ColumnDraft[] | ((prev: ColumnDraft[]) => ColumnDraft[])) => void;
  columnTypeOptions: string[];
}

export function MySqlColumnEditor({ tr, tableComment, setTableComment, columns, setColumns, columnTypeOptions }: Props) {
  return (
    <>
      <div className="mysql-table-design-section">
        <div className="mysql-table-design-section-title">{tr("mysql.page.tableComment")}</div>
        <input
          className="mysql-field"
          value={tableComment}
          onChange={(e) => setTableComment(e.target.value)}
          placeholder={tr("mysql.page.tableComment")}
        />
      </div>

      <div className="mysql-table-design-section">
        <div className="mysql-table-design-section-title">{tr("mysql.page.columnsSection")}</div>
        <div className="mysql-table-design-grid columns">
          {columns.map((col) => (
            <div key={col.id} className={`mysql-table-design-row ${col.markedDrop ? "is-drop" : ""}`}>
              <input
                className="mysql-field"
                value={col.name}
                onChange={(e) =>
                  setColumns((prev) => prev.map((x) => (x.id === col.id ? { ...x, name: e.target.value } : x)))
                }
                placeholder={tr("mysql.page.columnName")}
              />
              <select
                className="mysql-field mysql-select"
                value={col.type.trim()}
                onChange={(e) =>
                  setColumns((prev) => prev.map((x) => (x.id === col.id ? { ...x, type: e.target.value } : x)))
                }
              >
                <option value="" disabled>
                  {tr("mysql.page.selectType")}
                </option>
                {col.type.trim() && !columnTypeOptions.includes(col.type.trim()) ? (
                  <option value={col.type.trim()}>{col.type.trim()}</option>
                ) : null}
                {columnTypeOptions.map((typeName) => (
                  <option key={typeName} value={typeName}>
                    {typeName}
                  </option>
                ))}
              </select>
              <input
                className="mysql-field"
                value={col.defaultValue}
                onChange={(e) =>
                  setColumns((prev) => prev.map((x) => (x.id === col.id ? { ...x, defaultValue: e.target.value } : x)))
                }
                placeholder={tr("mysql.page.defaultValuePlaceholder")}
              />
              <input
                className="mysql-field"
                value={col.comment}
                onChange={(e) =>
                  setColumns((prev) => prev.map((x) => (x.id === col.id ? { ...x, comment: e.target.value } : x)))
                }
                placeholder={tr("mysql.page.columnComment")}
              />
              <label className="mysql-table-design-check">
                <input
                  type="checkbox"
                  checked={col.nullable}
                  onChange={(e) =>
                    setColumns((prev) => prev.map((x) => (x.id === col.id ? { ...x, nullable: e.target.checked } : x)))
                  }
                />
                {tr("mysql.page.nullable")}
              </label>
              <label className="mysql-table-design-check">
                <input
                  type="checkbox"
                  checked={col.markedDrop}
                  onChange={(e) =>
                    setColumns((prev) =>
                      prev.map((x) => (x.id === col.id ? { ...x, markedDrop: e.target.checked } : x))
                    )
                  }
                />
                {tr("mysql.page.markDelete")}
              </label>
            </div>
          ))}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() =>
            setColumns((prev) => [
              ...prev,
              {
                id: nextId(),
                name: "",
                type: "",
                nullable: true,
                defaultValue: "",
                extra: "",
                comment: "",
                isNew: true,
                markedDrop: false,
              },
            ])
          }
        >
          {tr("mysql.page.addField")}
        </button>
      </div>
    </>
  );
}
