import { HTTPClient } from "./httpClient";
import { QueryResponse, QueryResult, Row } from "./protocol";

export interface TuringDBOptions {
  /** Daemon base URL. Defaults to `http://localhost:6666`. */
  host?: string;
  /** Bearer token sent on every request. */
  token?: string;
}

/**
 * Unified TuringDB client.
 *
 * Mirrors the Python SDK's `TuringDB` facade over the HTTP/JSON protocol.
 * Reach the underlying {@link HTTPClient} via `.impl` for transport-specific
 * functionality.
 */
export class TuringDB {
  private readonly _impl: HTTPClient;

  constructor(options: TuringDBOptions = {}) {
    this._impl = new HTTPClient({ host: options.host, token: options.token });
  }

  /** The underlying transport client. */
  get impl(): HTTPClient {
    return this._impl;
  }

  query(query: string): Promise<QueryResult> {
    return this._impl.query(query);
  }

  /** Run a query and return row objects keyed by column name. */
  queryRows(query: string): Promise<Row[]> {
    return this._impl.queryRows(query);
  }

  queryRaw(query: string): Promise<QueryResponse> {
    return this._impl.queryRaw(query);
  }

  setGraph(graphName: string): void {
    this._impl.setGraph(graphName);
  }

  getGraph(): string {
    return this._impl.getGraph();
  }

  setChange(change: number | string): void {
    this._impl.setChange(change);
  }

  setCommit(commit: string): void {
    this._impl.setCommit(commit);
  }

  checkout(change: number | "main" = "main", commit = "HEAD"): Promise<void> {
    return this._impl.checkout(change, commit);
  }

  newChange(): Promise<number> {
    return this._impl.newChange();
  }

  createGraph(graphName: string): Promise<QueryResult> {
    return this._impl.createGraph(graphName);
  }

  listLoadedGraphs(): Promise<string[]> {
    return this._impl.listLoadedGraphs();
  }

  listAvailableGraphs(): Promise<string[]> {
    return this._impl.listAvailableGraphs();
  }

  isGraphLoaded(): Promise<boolean> {
    return this._impl.isGraphLoaded();
  }

  loadGraph(graphName: string): Promise<QueryResult | undefined> {
    return this._impl.loadGraph(graphName);
  }

  reconnect(): void {
    this._impl.reconnect();
  }

  tryReach(timeoutMs = 5000): Promise<void> {
    return this._impl.tryReach(timeoutMs);
  }

  warmup(timeoutMs = 5000): Promise<void> {
    return this._impl.warmup(timeoutMs);
  }

  getQueryExecTime(): number | null {
    return this._impl.getQueryExecTime();
  }

  getTotalExecTime(): number | null {
    return this._impl.getTotalExecTime();
  }

  get currentGraph(): string {
    return this._impl.currentGraph;
  }

  get currentCommit(): string {
    return this._impl.currentCommit;
  }

  get currentChange(): string {
    return this._impl.currentChange;
  }
}
