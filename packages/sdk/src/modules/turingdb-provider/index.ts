import * as console from "node:console";
import { TurtapeError } from "@/modules/core/errors";
import type {
  QueryContext,
  QueryResponse,
  TurtapeProvider,
} from "@/modules/core/types";
import { createHttpClient } from "@/modules/http-client";
import {
  type HttpRequestOptions,
  type RetryMiddlewareOptions,
  retryMiddleware,
} from "@/modules/http-client/middleware";
import type { TuringDBErrorCode } from "@/modules/turingdb-provider/status";

export interface TuringDBProviderOptions {
  host?: string;
  token?: string;
  retry?: RetryMiddlewareOptions;
}

// `COMMIT` and `CHANGE SUBMIT` mutate server state, and `CHANGE SUBMIT` in
// particular can take long enough to respond that the client sees a
// transport error (dropped connection, timeout) *after* the write already
// went through server-side -- confirmed against a live server: retrying it
// then re-submits an already-applied change, and the server rightly answers
// `CHANGE_NOT_FOUND` for the duplicate, which looks like a failure even
// though the original write succeeded (see docs/turingdb-issues). Every
// other query here is either read-only or `CHANGE NEW`, neither of which has
// this half-applied-then-repeated-request risk, so they stay safe to retry
// blindly on any transport error.
const NON_IDEMPOTENT = /^\s*(commit|change\s+submit)\b/i;

const isRetryable = (_error: unknown, request: HttpRequestOptions) =>
  !(typeof request.body === "string" && NON_IDEMPOTENT.test(request.body));

export const TuringDBProvider = (
  options: TuringDBProviderOptions = {},
): TurtapeProvider => {
  const host = options.host ?? "http://localhost:6666";
  const token = options.token ?? "";

  const http = createHttpClient({
    host,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  }).use(retryMiddleware({ isRetryable, ...options.retry }));

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
    console.log(cypher);

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
