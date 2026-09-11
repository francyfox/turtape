/**
 * Wire types and result shapes for the HTTP/JSON protocol.
 *
 * The server answers a query with a column-oriented payload:
 *
 *   {
 *     "time": <server-side execution time>,
 *     "header": { "column_names": [...], "column_types": [...] },
 *     "data": [ <chunk>, <chunk>, ... ]
 *   }
 *
 * Each chunk is itself column-oriented: an array of columns, one per header
 * column, and each column is an array of cell values. Rows are reconstructed by
 * zipping columns together (see `HTTPClient.parseChunks`).
 */

/** A single cell value as decoded from JSON. */
export type CellValue = string | number | boolean | null;

/** One column of a chunk. */
export type Column = CellValue[];

/** One chunk: an array of columns aligned with the header. */
export type Chunk = Column[];

/** The raw JSON envelope returned by the `query` endpoint. */
export interface QueryResponse {
  time?: number;
  header: {
    column_names: string[];
    column_types: string[];
  };
  data: Chunk[];
  error?: string;
  error_details?: string;
}

/** A single result row keyed by column name. */
export type Row = Record<string, CellValue>;

/**
 * Parsed query result, column-oriented as the server returns it. For
 * row-oriented access use `queryRows()` or run {@link convertToRows} on the
 * result.
 */
export interface QueryResult {
  /** Column names, in order. */
  columnNames: string[];
  /** Server-side type name for each column (e.g. "String", "Int64"). */
  columnTypes: string[];
  /** Column-oriented data: `columns[i]` is the full column for `columnNames[i]`. */
  columns: Column[];
  /** Number of rows in the result. */
  rowCount: number;
  /** Server-reported query execution time (as returned in the `time` field). */
  execTime: number | null;
  /** Client-measured round-trip time in milliseconds. */
  totalExecTime: number | null;
}

/**
 * Convert a column-oriented {@link QueryResult} into row objects keyed by
 * column name. Cells missing from a short column come back as `null`.
 */
export function convertToRows(
  result: Pick<QueryResult, "columnNames" | "columns">,
): Row[] {
  const { columnNames, columns } = result;
  const rowCount = columns[0]?.length ?? 0;
  const rows: Row[] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: Row = {};
    for (let c = 0; c < columnNames.length; c++) {
      row[columnNames[c]] = columns[c]?.[r] ?? null;
    }
    rows.push(row);
  }
  return rows;
}
