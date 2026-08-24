import { describe, expect, test } from "bun:test";
import { type LogRecord, logger } from "@/modules/plugin/plugin.logger.ts";

const record = (overrides: Partial<LogRecord> = {}): LogRecord => ({
  time: "2026-08-21T10:24:34.001Z",
  level: "info",
  tag: "turtape",
  verb: "MATCH",
  durationMs: 12.4,
  ...overrides,
});

describe("logger(record).tty()", () => {
  test("formats a plain (fast, non-slow) line with no color codes", () => {
    const lines: string[] = [];
    logger(record()).tty({ color: false, write: (l) => lines.push(l) });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \[turtape\] ✓ MATCH {3}12ms$/,
    );
  });

  test("level: error marks the line with ✗ and appends the detail", () => {
    const lines: string[] = [];
    logger(
      record({ level: "error", verb: "COMMIT", durationMs: 5, detail: "boom" }),
    ).tty({ color: false, write: (l) => lines.push(l) });

    expect(lines[0]).toContain("✗");
    expect(lines[0]).toContain("COMMIT");
    expect(lines[0]).toEndWith("boom");
  });

  test("marks durations at/above slowMs with the slow marker", () => {
    const lines: string[] = [];
    logger(record({ durationMs: 50 })).tty({
      color: false,
      slowMs: 100,
      write: (l) => lines.push(l),
    });
    logger(record({ durationMs: 150 })).tty({
      color: false,
      slowMs: 100,
      write: (l) => lines.push(l),
    });

    expect(lines[0]).not.toContain("slow");
    expect(lines[1]).toContain("⚡ slow");
  });

  test("formats durations >= 1s in seconds", () => {
    const lines: string[] = [];
    logger(record({ durationMs: 1234 })).tty({
      color: false,
      write: (l) => lines.push(l),
    });

    expect(lines[0]).toContain("1.2s");
  });

  test("color: true wraps segments in ANSI escape codes", () => {
    const lines: string[] = [];
    logger(record()).tty({ color: true, write: (l) => lines.push(l) });

    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting ANSI codes are present
    expect(lines[0]).toMatch(/\x1b\[\d+m/);
  });

  test("defaults to console.log when no write is given", () => {
    expect(() => logger(record()).tty({ color: false })).not.toThrow();
  });

  test("shows a server/net split when serverMs is present", () => {
    const lines: string[] = [];
    logger(record({ durationMs: 20, serverMs: 12, networkMs: 8 })).tty({
      color: false,
      write: (l) => lines.push(l),
    });

    expect(lines[0]).toContain("(server 12ms, net 8ms)");
  });

  test("omits the server/net split when serverMs is absent", () => {
    const lines: string[] = [];
    logger(record()).tty({ color: false, write: (l) => lines.push(l) });

    expect(lines[0]).not.toContain("server");
  });

  test("appends graph/change/commit context when present", () => {
    const lines: string[] = [];
    logger(record({ graph: "social", change: "c1" })).tty({
      color: false,
      write: (l) => lines.push(l),
    });

    expect(lines[0]).toContain("graph=social change=c1");
    expect(lines[0]).not.toContain("commit=");
  });

  test("appends [errorKind] for an error record", () => {
    const lines: string[] = [];
    logger(
      record({ level: "error", errorKind: "transport", detail: "boom" }),
    ).tty({ color: false, write: (l) => lines.push(l) });

    expect(lines[0]).toContain("[transport]");
  });
});

describe("logger(record).format(fn).tty()", () => {
  test("uses the custom formatter instead of the built-in one, unmodified", () => {
    const lines: string[] = [];
    logger(record({ verb: "COMMIT", durationMs: 42 }))
      .format((r) => `${r.tag}/${r.verb}/${r.durationMs}`)
      .tty({ write: (l) => lines.push(l) });

    expect(lines).toEqual(["turtape/COMMIT/42"]);
  });

  test("format() returns the same builder, so calls chain", () => {
    const builder = logger(record());
    const chained = builder.format((r) => r.verb);
    expect(chained).toBe(builder);
  });
});
