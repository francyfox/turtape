import type { QueryResponse } from "@/modules/core/types";
import type { Plugin } from "@/modules/plugin";
import {
  type LoggerFactory,
  type LogRecord,
  logger,
} from "@/modules/plugin/plugin.logger.ts";

// The first token of the Cypher text, e.g. `MATCH`/`COMMIT`/`CHANGE` -- what's actually
// informative in a log line, not the transport method.
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
 * Builds a `LogRecord` for each query and hands it to `handler`. **Not attached automatically** —
 * opt in with `.use()`. Attach *before* `retryPlugin` to log once per `query()` call, after
 * retries settle; attach *after* it to log every retried attempt instead.
 *
 * @example
 * ```ts
 * sdk.use(loggerPlugin());                              // colored stdout line
 * sdk.use(loggerPlugin((record) => sendToLogs(record))); // your own handler
 * ```
 */
export const loggerPlugin = (
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
      // TuringDB query errors come back as HTTP 200 with an `error` field (see
      // turingdb-provider/index.ts), so this needs checking too, not just `catch` below.
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
