import { describe, expect, test } from "bun:test";
import type { LogRecord } from "@/modules/plugin/plugin.logger.ts";
import { TuringDBProvider } from "@/modules/turingdb-provider";
import { loggerPlugin } from "@/modules/turingdb-provider/log-plugin";
import {
  isTuringDBReachable,
  TURINGDB_HOST,
} from "@/utils/integration-support.ts";

const reachable = await isTuringDBReachable();

if (!reachable) {
  console.warn(
    `\nSkipping log-plugin integration tests: TuringDB not reachable at ${TURINGDB_HOST}.\n`,
  );
}

describe.skipIf(!reachable)("loggerPlugin (integration)", () => {
  test("serverMs comes from a real body.time, smaller than the measured durationMs", async () => {
    let seen: LogRecord | undefined;

    await TuringDBProvider({ host: TURINGDB_HOST })
      .use(
        loggerPlugin((record) => {
          seen = record;
        }),
      )
      .query("LIST GRAPH");

    // Confirms `body.time` is milliseconds, not seconds -- a seconds
    // reading would make serverMs regularly exceed durationMs against a
    // fast local server.
    expect(seen?.serverMs).toBeGreaterThan(0);
    expect(seen?.serverMs).toBeLessThan(seen?.durationMs ?? 0);
    expect(seen?.networkMs).toBeGreaterThanOrEqual(0);
  });

  test("default handler (logger(record).tty()) writes a real line to console.log", async () => {
    const original = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => lines.push(String(args[0]));

    try {
      await TuringDBProvider({ host: TURINGDB_HOST })
        .use(loggerPlugin())
        .query("LIST GRAPH");
    } finally {
      console.log = original;
    }

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[turtape]");
    expect(lines[0]).toContain("✓");
  });
});
