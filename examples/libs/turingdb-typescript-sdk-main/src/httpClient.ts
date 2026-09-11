import { TuringDBException } from "./exceptions";
import {
  Chunk,
  convertToRows,
  QueryResponse,
  QueryResult,
  Row,
} from "./protocol";

export interface HTTPClientOptions {
  /** Base URL of the TuringDB daemon. Defaults to `http://localhost:6666`. */
  host?: string;
  /**
   * Bearer token sent on every request. An explicit value (including the empty
   * string, which deliberately suppresses auth) wins over the
   * `TURINGDB_AUTH_TOKEN` environment variable.
   */
  token?: string;
}

const DEFAULT_HOST = "http://localhost:6666";

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * HTTP/JSON client for a TuringDB daemon.
 *
 * A direct port of the Python SDK's `HTTPClient`: it POSTs Cypher statements
 * to the daemon's `/query` endpoint (the only endpoint), carries the current
 * `graph` / `change` / `commit` selection as query parameters, and parses
 * query responses into a {@link QueryResult}.
 */
export class HTTPClient {
  readonly host: string;

  private readonly headers: Record<string, string>;
  private params: Record<string, string> = { graph: "default" };

  private queryExecTime: number | null = null;
  private totalExecTime: number | null = null;

  constructor(options: HTTPClientOptions = {}) {
    this.host = (options.host ?? DEFAULT_HOST).replace(/\/+$/, "");

    // Copy the defaults so per-instance auth headers don't leak into the shared
    // object.
    this.headers = { ...DEFAULT_HEADERS };
    const token =
      options.token !== undefined
        ? options.token
        : process.env.TURINGDB_AUTH_TOKEN;
    if (token) {
      this.headers["Authorization"] = `Bearer ${token}`;
    }
  }

  /**
   * No-op for HTTP: a fresh connection is opened per request. Exists for parity
   * with a binary transport so callers can write transport-agnostic recovery
   * code via the {@link TuringDB} facade.
   */
  reconnect(): void {
    /* no-op */
  }

  /** Probe reachability by listing available graphs, bounded by `timeoutMs`. */
  async tryReach(timeoutMs = 5000): Promise<void> {
    await this.listAvailableGraphs(timeoutMs);
  }

  /** Warm the daemon by issuing `LIST GRAPH`, bounded by `timeoutMs`. */
  async warmup(timeoutMs = 5000): Promise<void> {
    await this.query("LIST GRAPH", timeoutMs);
  }

  /**
   * List graphs available on disk (issues `LIST AVAILABLE GRAPHS`). Sent
   * without the graph/change/commit selection so it works regardless of the
   * selected graph's load state.
   */
  async listAvailableGraphs(timeoutMs?: number): Promise<string[]> {
    const res = await this.queryGraphless("LIST AVAILABLE GRAPHS", timeoutMs);
    return graphNameColumn(res);
  }

  /** List graphs currently loaded in memory (issues `LIST GRAPH`). */
  async listLoadedGraphs(): Promise<string[]> {
    const res = await this.queryGraphless("LIST GRAPH");
    return graphNameColumn(res);
  }

  /** Whether the currently selected graph is loaded in memory. */
  async isGraphLoaded(): Promise<boolean> {
    const loaded = await this.listLoadedGraphs();
    return loaded.includes(this.getGraph());
  }

  /**
   * Load a graph into memory (issues `LOAD GRAPH`). Idempotent: loading an
   * already-loaded graph is a no-op that returns `undefined`.
   */
  async loadGraph(graphName: string): Promise<QueryResult | undefined> {
    try {
      return await this.queryGraphless(`LOAD GRAPH ${graphName}`);
    } catch (e) {
      if (
        e instanceof TuringDBException &&
        e.message.includes("Graph already loaded")
      ) {
        return undefined;
      }
      throw e;
    }
  }

  async createGraph(graphName: string): Promise<QueryResult> {
    return this.query(`create graph ${graphName}`);
  }

  /** Run a query and return a parsed {@link QueryResult}. */
  async query(query: string, timeoutMs?: number): Promise<QueryResult> {
    const json = await this.sendRequest("query", {
      data: query,
      params: this.params,
      timeoutMs,
    });
    if (typeof json !== "object" || json === null) {
      throw new TuringDBException("Invalid response from the server");
    }
    return this.parseChunks(json as QueryResponse);
  }

  /** Run a query and return row objects keyed by column name. */
  async queryRows(query: string, timeoutMs?: number): Promise<Row[]> {
    return convertToRows(await this.query(query, timeoutMs));
  }

  /** Run a query and return the raw JSON envelope from the server. */
  async queryRaw(query: string, timeoutMs?: number): Promise<QueryResponse> {
    const json = await this.sendRequest("query", {
      data: query,
      params: this.params,
      timeoutMs,
    });
    if (typeof json !== "object" || json === null) {
      throw new TuringDBException("Invalid response from the server");
    }
    return json as QueryResponse;
  }

  /**
   * Run a graph-management statement without the graph/change/commit
   * selection params.
   */
  private async queryGraphless(
    query: string,
    timeoutMs?: number,
  ): Promise<QueryResult> {
    const json = await this.sendRequest("query", { data: query, timeoutMs });
    if (typeof json !== "object" || json === null) {
      throw new TuringDBException("Invalid response from the server");
    }
    return this.parseChunks(json as QueryResponse);
  }

  setCommit(commit: string): void {
    this.params.commit = commit;
  }

  setChange(change: number | string): void {
    this.params.change =
      typeof change === "number" ? change.toString(16) : change;
  }

  /**
   * Select a change and commit. `change = "main"` clears any change selection;
   * `commit = "HEAD"` clears any commit selection (otherwise the commit is
   * loaded via `LOAD COMMIT` and then pinned).
   */
  async checkout(
    change: number | "main" = "main",
    commit = "HEAD",
  ): Promise<void> {
    if (change === "main") {
      delete this.params.change;
    } else {
      this.setChange(change);
    }

    if (commit === "HEAD") {
      delete this.params.commit;
    } else {
      await this.query(`LOAD COMMIT '${commit}'`);
      this.setCommit(commit);
    }
  }

  /** Open a new change and select it, returning its numeric id. */
  async newChange(): Promise<number> {
    if (this.params.change != null) {
      throw new TuringDBException(
        "Cannot create a new change while working on one",
      );
    }
    if (this.params.commit != null) {
      throw new TuringDBException(
        "Cannot create a new change while working on a commit",
      );
    }

    const res = await this.queryRows("CHANGE NEW");
    const changeId = Number(res[0]?.["changeID"]);
    this.setChange(changeId);
    return changeId;
  }

  setGraph(graphName: string): void {
    this.params.graph = graphName;
  }

  getGraph(): string {
    return this.params.graph;
  }

  getQueryExecTime(): number | null {
    return this.queryExecTime;
  }

  getTotalExecTime(): number | null {
    return this.totalExecTime;
  }

  get currentGraph(): string {
    return this.params.graph;
  }

  get currentCommit(): string {
    return this.params.commit ?? "HEAD";
  }

  get currentChange(): string {
    return this.params.change ?? "main";
  }

  private async sendRequest(
    path: string,
    opts: {
      data?: Record<string, unknown> | string;
      params?: Record<string, string>;
      timeoutMs?: number;
    } = {},
  ): Promise<unknown> {
    this.queryExecTime = null;
    this.totalExecTime = null;
    const t0 = Date.now();

    const url = new URL(`${this.host}/${path}`);
    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        url.searchParams.set(key, value);
      }
    }

    const init: RequestInit = {
      method: "POST",
      headers: this.headers,
    };
    if (opts.timeoutMs != null) {
      init.signal = AbortSignal.timeout(opts.timeoutMs);
    }

    const data = opts.data ?? "";
    init.body = typeof data === "string" ? data : JSON.stringify(data);

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (e) {
      throw new TuringDBException(
        `Request to ${url.toString()} failed: ${(e as Error).message}`,
      );
    }

    const text = await response.text();

    if (!response.ok) {
      // Prefer a structured server error message if one is present.
      const serverError = tryExtractError(text);
      throw new TuringDBException(
        serverError ??
          `HTTP ${response.status} ${response.statusText} from ${url.toString()}`,
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new TuringDBException(
        `Invalid response from the server: ${(e as Error).message}`,
      );
    }

    if (typeof json === "object" && json !== null && "error" in json) {
      const obj = json as { error?: unknown; error_details?: unknown };
      if (obj.error != null) {
        const err =
          obj.error_details != null
            ? `${obj.error}: ${obj.error_details}`
            : String(obj.error);
        throw new TuringDBException(err);
      }
    }

    this.totalExecTime = Date.now() - t0;
    return json;
  }

  private parseChunks(json: QueryResponse): QueryResult {
    this.queryExecTime = json.time ?? null;

    const columnNames = json.header.column_names;
    const columnTypes = json.header.column_types;

    if (columnNames.length !== columnTypes.length) {
      throw new TuringDBException(
        "Query response column names and types do not match",
      );
    }

    const columns: Chunk = columnNames.map(() => []);
    for (const chunk of json.data) {
      for (let c = 0; c < columnNames.length; c++) {
        const col = chunk[c] ?? [];
        for (let r = 0; r < col.length; r++) {
          columns[c].push(col[r]);
        }
      }
    }

    return {
      columnNames,
      columnTypes,
      columns,
      rowCount: columns[0]?.length ?? 0,
      execTime: this.queryExecTime,
      totalExecTime: this.totalExecTime,
    };
  }
}

/** Best-effort extraction of a server `error`/`error_details` from a body. */
function tryExtractError(text: string): string | null {
  try {
    const json = JSON.parse(text) as {
      error?: unknown;
      error_details?: unknown;
    };
    if (json && json.error != null) {
      return json.error_details != null
        ? `${json.error}: ${json.error_details}`
        : String(json.error);
    }
  } catch {
    /* not JSON; fall through */
  }
  return null;
}

/** The `graphName` column of a graph-management statement result. */
function graphNameColumn(res: QueryResult): string[] {
  return (res.columns[res.columnNames.indexOf("graphName")] ?? []) as string[];
}
