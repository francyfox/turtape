import type { Plugin } from "@/modules/plugin";

export type CellValue = string | number | boolean | null;

/** One request's worth of data, as the server sends it: chunks -> columns -> values. */
export type QueryChunks = CellValue[][][];

export interface QueryResponse {
  header: {
    column_names: string[];
    column_types: string[];
  };
  data: QueryChunks;
  /** Server-side execution time in **milliseconds**, or `null` if the server didn't report one. */
  time: number | null;
  /** The provider's own error code (e.g. `"PARSE_ERROR"`), set only when the query failed. */
  error?: string;
  /** Human-readable detail for `error`, when the provider sends one. */
  error_details?: string;
}

export interface QueryContext {
  /** Graph to run against. Defaults to the provider's own default graph when omitted. */
  graph?: string;
  /** Change to run inside (from `CHANGE NEW`). Omit for a plain read against the main line. */
  change?: string;
  /** Commit to read from. Omit to read the current head. */
  commit?: string;
}

export interface TurtapeProvider {
  name: string;
  query(cypher: string, context?: QueryContext): Promise<QueryResponse>;
  /** Discard any held connection state. A no-op for stateless transports (HTTP). */
  reconnect(): void;
  /** Attaches a plugin (retry, logging, or your own) to this provider's request pipeline.
   * Returns the same provider so calls chain. Normally called via `TurtapeSdk(...).use(...)`
   * rather than directly — see `@/modules/core/service`. */
  use(plugin: Plugin): TurtapeProvider;
}

export interface TurtapeConfig {
  /** ⚠️ **Not read** by `TurtapeSdk` today — each provider takes its own `host` instead
   * (e.g. `TuringDBProvider({ host })`). */
  host?: string;
  /** ⚠️ **Not read** by `TurtapeSdk` today — each provider takes its own `token` instead
   * (e.g. `TuringDBProvider({ token })`). */
  token?: string;
  /** The backend this SDK instance talks to, e.g. `TuringDBProvider()`. */
  provider: TurtapeProvider;
}
