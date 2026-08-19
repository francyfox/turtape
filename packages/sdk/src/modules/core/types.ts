export type CellValue = string | number | boolean | null;

/** One request's worth of data, as the server sends it: chunks -> columns -> values. */
export type QueryChunks = CellValue[][][];

export interface QueryResponse {
  header: {
    column_names: string[];
    column_types: string[];
  };
  data: QueryChunks;
  time: number | null;
  error?: string;
  error_details?: string;
}

export interface QueryContext {
  graph?: string;
  change?: string;
  commit?: string;
}

export interface TurtapeProvider {
  name: string;
  query(cypher: string, context?: QueryContext): Promise<QueryResponse>;
  /** Discard any held connection state. A no-op for stateless transports (HTTP). */
  reconnect(): void;
}

export interface TurtapeConfig {
  provider: TurtapeProvider;
}
