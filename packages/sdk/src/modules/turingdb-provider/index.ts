import { TurtapeError } from "@/modules/core/errors";
import type {
  QueryContext,
  QueryResponse,
  TurtapeProvider,
} from "@/modules/core/types";
import { createHttpClient } from "@/modules/http-client";
import type { Plugin } from "@/modules/plugin";
import type { TuringDBErrorCode } from "@/modules/turingdb-provider/status";

export type { TuringDBLogHandler } from "@/modules/turingdb-provider/log-plugin";
export { loggerPlugin } from "@/modules/turingdb-provider/log-plugin";
export type { TuringDBRetryPluginOptions } from "@/modules/turingdb-provider/retry-plugin";
export { retryPlugin } from "@/modules/turingdb-provider/retry-plugin";

export interface TuringDBProviderOptions {
  /** Daemon base URL. Default: `http://localhost:6666`. */
  host?: string;
  /** Bearer token for the `authorization` header. Omit for no auth. */
  token?: string;
}

export interface TuringDBProviderInstance extends TurtapeProvider {
  /**
   * Attaches a plugin (retry, logging, or your own) to this provider's HTTP client. **Nothing
   * is attached by default.** Returns the same instance so calls chain. Usually called via
   * `TurtapeSdk(...).use(...)` instead of directly — this exists so the provider also works
   * standalone, without the `TurtapeSdk` wrapper.
   *
   * @example
   * ```ts
   * TuringDBProvider().use(loggerPlugin()).use(retryPlugin());
   * ```
   */
  use(plugin: Plugin): TuringDBProviderInstance;
}

/**
 * Creates a `TurtapeProvider` for TuringDB, talking to its HTTP/JSON `/query` endpoint.
 *
 * @example
 * ```ts
 * const provider = TuringDBProvider({ host: "http://localhost:6666", token });
 * const result = await provider.query("MATCH (n) RETURN n");
 * ```
 */
export const TuringDBProvider = (
  options: TuringDBProviderOptions = {},
): TuringDBProviderInstance => {
  const host = options.host ?? "http://localhost:6666";
  const token = options.token ?? "";

  const http = createHttpClient({
    host,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });

  const query = async (
    cypher: string,
    context: QueryContext = {},
  ): Promise<QueryResponse> => {
    const body = await http.request<QueryResponse>({
      path: "/query",
      body: cypher,
      params: {
        graph: context.graph,
        change: context.change,
        commit: context.commit,
      },
    });

    // Query errors (bad Cypher, write outside a change, ...) come back as HTTP 200 with an
    // `error` field, not a non-2xx status -- so this has to be checked here, not in the client.
    if (body.error) {
      throw new TurtapeError(body.error, {
        // `body.error` is the raw status code (e.g. "ANALYZE_ERROR"), not a message --
        // see TuringDBErrorCode for the closed set.
        code: body.error as TuringDBErrorCode,
        details: body.error_details,
      });
    }

    return body;
  };

  const provider: TuringDBProviderInstance = {
    name: "turingdb",
    query,
    // No-op: fetch() opens a fresh connection per call, nothing to discard. Exists for
    // transport-agnostic recovery code (mirrors upstream's HTTPClient.reconnect()).
    reconnect: () => {},
    use(plugin) {
      http.use(plugin);
      return provider;
    },
  };

  return provider;
};
