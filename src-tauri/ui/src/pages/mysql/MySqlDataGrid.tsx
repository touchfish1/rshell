interface Props {
  columns: string[];
  rows: Array<Array<string | null>>;
}

export function MySqlDataGrid({ columns, rows }: Props) {
  return (
    <div className="mysql-data-grid-inner">
      <table className="mysql-data-grid">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell ?? "NULL"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
