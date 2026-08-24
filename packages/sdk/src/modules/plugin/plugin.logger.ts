const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
} as const;

// Colors are opt-in via TTY detection, never forced on a stream that can't render them --
// a piped/redirected log file full of escape codes is worse than no color at all.
const detectColorSupport = (): boolean => {
  try {
    return Boolean(
      typeof process !== "undefined" &&
        process.stdout?.isTTY &&
        !process.env?.NO_COLOR,
    );
  } catch {
    return false;
  }
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// `record.time` is ISO 8601 (right for the JSON record), but that's noisy on a terminal --
// reparsed here into a shorter local-time display.
const formatTtyTimestamp = (iso: string): string => {
  const date = new Date(iso);
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${String(
      date.getMilliseconds(),
    ).padStart(3, "0")}`
  );
};

const formatDuration = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;

/**
 * A plugin's log line as plain, JSON-serializable data. A protocol-specific plugin (e.g.
 * `loggerPlugin`) builds one of these per event and hands it to a handler you provide —
 * see `logger()` for what happens to it from there.
 */
export interface LogRecord {
  /** ISO 8601. */
  time: string;
  /** Whether the event succeeded (`"info"`) or failed (`"error"`). */
  level: "info" | "error";
  /** Namespaces the line, shown as `[tag]` by the default tty format. */
  tag: string;
  /** The operation's own verb, not the transport method -- e.g. the first token of a Cypher
   * query (`MATCH`, `COMMIT`, `CHANGE`), not `POST`. That's what's actually informative here. */
  verb: string;
  /** End-to-end, client-measured: network + server exec + response parsing. */
  durationMs: number;
  /** Server-reported exec time in milliseconds (assumed unit — not documented upstream), when
   * the response carried one. Absent on a transport failure. */
  serverMs?: number;
  /** `durationMs - serverMs`, precomputed so a reader doesn't have to do the subtraction --
   * only present alongside `serverMs`. */
  networkMs?: number;
  /** The graph the query ran against, when set. */
  graph?: string;
  /** The change the query ran inside, when set. */
  change?: string;
  /** The commit the query read from, when set. */
  commit?: string;
  /** Only set when `level` is `"error"`. `"application"`: the server responded (possibly HTTP
   * 200) but the query itself failed — **fix the query**, retrying won't help. `"transport"`:
   * the request never got a response — network/server problem, **safe to consider retrying**. */
  errorKind?: "application" | "transport";
  /** Extra detail appended to the line, e.g. an error message. */
  detail?: string;
}

export interface TtyOptions {
  /** Duration at or above which a line gets the "⚡ slow" marker. Default: 500ms. */
  slowMs?: number;
  /** Where a formatted line goes. Default: `console.log`. */
  write?: (line: string) => void;
  /** Force color on/off. Default: auto-detect (TTY stdout, no `NO_COLOR`). */
  color?: boolean;
}

export interface LoggerBuilder {
  /**
   * Overrides how `.tty()` turns the record into a line — **full control** (coloring, padding,
   * field selection), no template syntax to learn. Once set, `.tty()` just writes what this
   * returns; the built-in `[tag] ✓ VERB   12ms` formatting no longer applies.
   */
  format(formatter: (record: LogRecord) => string): LoggerBuilder;
  /**
   * Renders the record as one line and writes it (default: `console.log`). Uses the formatter
   * from `.format()` if one was set, otherwise the built-in colored one-liner
   * (`2026-08-21 10:24:34.001 [turtape] ✓ MATCH   12ms`).
   */
  tty(options?: TtyOptions): void;
}

const defaultFormat = (
  record: LogRecord,
  slowMs: number,
  useColor: boolean,
): string => {
  const ok = record.level !== "error";
  const isSlow = record.durationMs >= slowMs;
  const color = (code: string, text: string) =>
    useColor ? `${code}${text}${ANSI.reset}` : text;

  const parts = [
    color(ANSI.dim, formatTtyTimestamp(record.time)),
    color(ANSI.cyan, `[${record.tag}]`),
    color(ok ? ANSI.green : ANSI.red, ok ? "✓" : "✗"),
    color(ANSI.bold, record.verb.padEnd(7)),
    color(isSlow ? ANSI.yellow : ANSI.green, formatDuration(record.durationMs)),
  ];

  if (record.serverMs !== undefined) {
    const networkMs = record.networkMs ?? record.durationMs - record.serverMs;
    parts.push(
      color(
        ANSI.dim,
        `(server ${formatDuration(record.serverMs)}, net ${formatDuration(Math.max(networkMs, 0))})`,
      ),
    );
  }

  const context = [
    record.graph && `graph=${record.graph}`,
    record.change && `change=${record.change}`,
    record.commit && `commit=${record.commit}`,
  ]
    .filter(Boolean)
    .join(" ");
  if (context) parts.push(color(ANSI.dim, context));

  if (isSlow) parts.push(color(ANSI.yellow, "⚡ slow"));
  if (record.errorKind) parts.push(color(ANSI.red, `[${record.errorKind}]`));
  if (record.detail) parts.push(color(ANSI.red, record.detail));
  return parts.join(" ");
};

/**
 * Wraps a `LogRecord` for rendering. Not a plugin by itself — a protocol-specific plugin builds
 * the record and calls this to render or ship it.
 *
 * @example
 * ```ts
 * logger(record).tty();                        // colored line on stdout
 * logger(record).format((r) => r.verb).tty();  // your own format
 * ```
 */
export const logger = (record: LogRecord): LoggerBuilder => {
  let formatter: ((record: LogRecord) => string) | undefined;

  const builder: LoggerBuilder = {
    format(fn) {
      formatter = fn;
      return builder;
    },
    tty(options = {}) {
      const write = options.write ?? ((line: string) => console.log(line));
      const line = formatter
        ? formatter(record)
        : defaultFormat(
            record,
            options.slowMs ?? 500,
            options.color ?? detectColorSupport(),
          );
      write(line);
    },
  };

  return builder;
};

export type LoggerFactory = typeof logger;
