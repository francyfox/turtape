import type { QueryResponse } from "@/modules/core/types";
import type { Plugin } from "@/modules/plugin";
import {
  type LoggerFactory,
  type LogRecord,
  logger,
} from "@/modules/plugin/plugin.logger.ts";

// The operation's own verb (`MATCH`, `COMMIT`, `CHANGE`, ...), not the
// transport method -- that's what's actually informative here, and it's
// always the first token of the Cypher text carried as the request body.
const extractVerb = (body: unknown): string => {
  const cypher = typeof body === "string" ? body : "";
  return cypher.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? cypher;
};

export type TuringDBLogHandler = (
  record: LogRecord,
  logger: LoggerFactory,
) => void;

const defaultHandler: TuringDBLogHandler = (record, logger) =>
  logger(record).tty();

/**
 * Builds a `LogRecord` for each query -- verb, duration, graph/change/commit
 * context, and outcome (success, TuringDB error, or transport error) -- and
 * hands it to `handler`. Not attached automatically -- opt in with
 * `TuringDBProvider(...).use(turingDBLogPlugin())`.
 *
 * `handler` decides what happens to the record: the default renders it to
 * the terminal via `logger(record).tty()`, but any handler works --
 * `.format()` the record before `.tty()`, write `JSON.stringify(record)` to
 * a file, or ship it to a log pipeline instead.
 *
 * `serverMs`/`networkMs` come from the response's own `time` field --
 * confirmed present on both success and the HTTP-200-with-`error` shape, but
 * its unit isn't documented upstream; assumed milliseconds (matches the
 * scale of observed values against a live server, and every other duration
 * in this SDK). Absent on a transport failure, since no response ever came
 * back to report it.
 *
 * Confirmed against a live server: a TuringDB query error (bad Cypher, write
 * outside a change, ...) comes back as HTTP 200 with an `error` field, not a
 * non-2xx status -- this plugin checks for that, not just a thrown error, so
 * the record reflects the true end-to-end outcome, and tags it `errorKind:
 * "application"` (fix the query) rather than `"transport"` (network/server
 * problem, safe to consider retrying).
 *
 * Attach this *before* `turingDBRetryPlugin` (i.e. `.use(turingDBLogPlugin()).use(turingDBRetryPlugin())`)
 * to log once per `query()` call, after retries settle -- attach it after to
 * log every individual retried attempt instead.
 */
export const turingDBLogPlugin = (
  handler: TuringDBLogHandler = defaultHandler,
): Plugin => {
  return async (request, next) => {
    const verb = extractVerb(request.body);
    const start = performance.now();
    const graph = request.params?.graph;
    const change = request.params?.change;
    const commit = request.params?.commit;

    const toRecord = (
      level: LogRecord["level"],
      options: {
        serverMs?: number;
        errorKind?: LogRecord["errorKind"];
        detail?: string;
      },
    ): LogRecord => {
      const durationMs = performance.now() - start;
      return {
        time: new Date().toISOString(),
        level,
        tag: "turtape",
        verb,
        durationMs,
        serverMs: options.serverMs,
        networkMs:
          options.serverMs !== undefined
            ? durationMs - options.serverMs
            : undefined,
        graph,
        change,
        commit,
        errorKind: options.errorKind,
        detail: options.detail,
      };
    };

    try {
      const body = (await next(request)) as QueryResponse;
      const serverMs = body?.time ?? undefined;
      handler(
        body?.error
          ? toRecord("error", {
              serverMs,
              errorKind: "application",
              detail: body.error,
            })
          : toRecord("info", { serverMs }),
        logger,
      );
      return body;
    } catch (error) {
      handler(
        toRecord("error", {
          errorKind: "transport",
          detail: error instanceof Error ? error.message : String(error),
        }),
        logger,
      );
      throw error;
    }
  };
};
