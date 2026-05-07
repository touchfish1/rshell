import { useEffect, useRef, useState } from "react";

function inputTypeForColumn(columnType: string): string {
  const ct = columnType.toLowerCase();
  if (ct.startsWith("datetime") || ct.startsWith("timestamp")) return "datetime-local";
  if (ct.startsWith("date")) return "date";
  if (ct.startsWith("time")) return "time";
  if (ct.startsWith("bigint") || ct.startsWith("int") || ct.startsWith("smallint") || ct.startsWith("tinyint") || ct.startsWith("mediumint")) return "number";
  if (ct.startsWith("decimal") || ct.startsWith("float") || ct.startsWith("double") || ct.startsWith("real")) return "number";
  return "text";
}

/** Convert a MySQL datetime value to the format expected by <input type="datetime-local"> */
function toInputFormat(value: string, inputType: string): string {
  if (inputType === "datetime-local") {
    // MySQL format: "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm"
    const match = value.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
    if (match) return match[0].replace(" ", "T");
    return value;
  }
  return value;
}

/** Convert an input value back to MySQL format */
function toDbFormat(value: string, inputType: string): string {
  if (inputType === "datetime-local") {
    // "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss" → "YYYY-MM-DD HH:mm:ss"
    return value.replace("T", " ");
  }
  return value;
}

interface Props {
  columns: string[];
  rows: Array<Array<string | null>>;
  columnTypes?: Record<string, string>;
  edits?: Record<string, string>;
  onCellEdit?: (rowIndex: number, colIndex: number, value: string) => void;
  selectedRow?: number;
  onSelectRow?: (rowIndex: number) => void;
}

export function MySqlDataGrid({ columns, rows, columnTypes, edits, onCellEdit, selectedRow, onSelectRow }: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const getColumnType = (colIndex: number) => columnTypes?.[columns[colIndex] ?? ""] ?? "";
  const getInputType = (colIndex: number) => inputTypeForColumn(getColumnType(colIndex));

  const startEditing = (rowIndex: number, colIndex: number) => {
    if (!onCellEdit) return;
    const raw = rows[rowIndex]?.[colIndex] ?? "";
    const inputType = getInputType(colIndex);
    setEditingCell({ row: rowIndex, col: colIndex });
    setEditValue(inputType !== "text" ? toInputFormat(raw, inputType) : raw);
  };

  const confirmEdit = () => {
    if (!editingCell || !onCellEdit) return;
    const inputType = getInputType(editingCell.col);
    const dbValue = inputType !== "text" ? toDbFormat(editValue, inputType) : editValue;
    onCellEdit(editingCell.row, editingCell.col, dbValue);
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  useEffect(() => {
    if (!editingCell) return;
    const inputType = getInputType(editingCell.col);
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (inputType === "date" || inputType === "datetime-local" || inputType === "time") {
      try { el.showPicker(); } catch { /* not supported */ }
    }
  }, [editingCell]);

  const isReadOnly = !onCellEdit;

  const handleRowClick = (rowIndex: number) => {
    if (editingCell) return;
    onSelectRow?.(rowIndex);
  };

  return (
    <div className="mysql-data-grid-inner">
      <table className="mysql-data-grid">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={selectedRow === rowIndex ? "is-selected" : undefined}
              onClick={isReadOnly ? undefined : () => handleRowClick(rowIndex)}
            >
              {row.map((cell, colIndex) => {
                const cellKey = `${rowIndex}:${colIndex}`;
                const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                const isModified = edits ? cellKey in edits : false;
                const displayValue = isModified && edits ? edits[cellKey] : cell;

                let className = "";
                if (isEditing) className += " is-editing";
                if (isModified) className += " is-modified";

                return (
                  <td
                    key={colIndex}
                    className={className || undefined}
                    onDoubleClick={isReadOnly ? undefined : () => startEditing(rowIndex, colIndex)}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        className="mysql-cell-editor"
                        type={getInputType(colIndex)}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={confirmEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmEdit();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                          if (e.key === "Tab") {
                            e.preventDefault();
                            confirmEdit();
                          }
                        }}
                      />
                    ) : (
                      displayValue ?? "NULL"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
