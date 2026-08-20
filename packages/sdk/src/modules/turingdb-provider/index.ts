import { TurtapeError } from "@/modules/core/errors";
import type {
  QueryContext,
  QueryResponse,
  TurtapeProvider,
} from "@/modules/core/types";
import { createHttpClient } from "@/modules/http-client";
import type { RetryOptions } from "@/modules/http-client/retry";
import type { TuringDBErrorCode } from "@/modules/turingdb-provider/status";

export interface TuringDBProviderOptions {
  host?: string;
  token?: string;
  retry?: RetryOptions;
}

// Everything createHttpClient's `request()` throws is a transport-level
// problem (network failure, malformed JSON, non-2xx) -- TuringDB's own query
// errors (`body.error`) are checked below, *after* request() has already
// resolved, so they never enter the retry loop. Safe to retry anything here.
const isTransportError = () => true;

export const TuringDBProvider = (
  options: TuringDBProviderOptions = {},
): TurtapeProvider => {
  const host = options.host ?? "http://localhost:6666";
  const token = options.token ?? "";

  const http = createHttpClient({
    host,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    retry: { isRetryable: isTransportError, ...options.retry },
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

  return {
    name: "turingdb",
    query,
    // No-op: fetch() opens a fresh connection per call, there's no persistent
    // socket/session to discard. Exists so callers can write transport-agnostic
    // recovery code (matches upstream's HTTPClient.reconnect()).
    reconnect: () => {},
  };
};
