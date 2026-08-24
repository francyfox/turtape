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
export { turingDBLogPlugin } from "@/modules/turingdb-provider/log-plugin";
export type { TuringDBRetryPluginOptions } from "@/modules/turingdb-provider/retry-plugin";
export { turingDBRetryPlugin } from "@/modules/turingdb-provider/retry-plugin";

export interface TuringDBProviderOptions {
  host?: string;
  token?: string;
}

export interface TuringDBProviderInstance extends TurtapeProvider {
  /**
   * Attach a plugin (retry, logging, or your own) to the underlying HTTP
   * client -- see `@/modules/plugin`. Nothing is attached by
   * default: pull in `turingDBRetryPlugin`/`turingDBLogPlugin` (or a custom
   * `Plugin`) and `.use()` only what you need, so an unused one doesn't end
   * up in the bundle. Returns the same instance so calls chain.
   */
  use(plugin: Plugin): TuringDBProviderInstance;
}

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

    // Confirmed against a live server: query errors (bad Cypher, write outside
    // a change, ...) come back as HTTP 200 with an `error` field, not a
    // non-2xx status -- so this has to be checked here, not inside the
    // generic transport.
    if (body.error) {
      throw new TurtapeError(body.error, {
        // `body.error` carries the raw status code string (e.g. "ANALYZE_ERROR"),
        // not a human-readable message -- see TuringDBErrorCode for the closed set.
        code: body.error as TuringDBErrorCode,
        details: body.error_details,
      });
    }

    return body;
  };

  const provider: TuringDBProviderInstance = {
    name: "turingdb",
    query,
    // No-op: fetch() opens a fresh connection per call, there's no persistent
    // socket/session to discard. Exists so callers can write transport-agnostic
    // recovery code (matches upstreams HTTPClient.reconnect()).
    reconnect: () => {},
    use(plugin) {
      http.use(plugin);
      return provider;
    },
  };

  return provider;
};
