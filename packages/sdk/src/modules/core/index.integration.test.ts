import { describe, expect, test } from "bun:test";
import { TurtapeSdk } from "@/modules/core";
import { TuringDBProvider } from "@/modules/turingdb-provider";
import { loggerPlugin } from "@/modules/turingdb-provider/log-plugin";
import {
  isTuringDBReachable,
  TURINGDB_HOST,
} from "@/utils/integration-support.ts";

// Confirms the public entry point actually wires up end to end against a
// real server, not just that `createTurtapeService` calls the right methods
// on a mocked provider (see index.unit.test.ts for that).
const reachable = await isTuringDBReachable();

if (!reachable) {
  console.warn(
    `\nSkipping core integration tests: TuringDB not reachable at ${TURINGDB_HOST}.\n`,
  );
}

describe.skipIf(!reachable)("TurtapeSdk (integration)", () => {
  test("queryRaw() reaches a real TuringDBProvider end-to-end", async () => {
    const sdk = TurtapeSdk({
      provider: TuringDBProvider({ host: TURINGDB_HOST }),
    });

    const result = await sdk.queryRaw("LIST GRAPH");
    expect(result.header.column_names).toContain("graphName");
  });

  test("reconnect() does not throw", () => {
    const sdk = TurtapeSdk({
      provider: TuringDBProvider({ host: TURINGDB_HOST }),
    });
    expect(() => sdk.reconnect()).not.toThrow();
  });

  test("use() attached on the sdk reaches the provider's real HTTP pipeline, not just a mock", async () => {
    const lines: string[] = [];
    const sdk = TurtapeSdk({
      provider: TuringDBProvider({ host: TURINGDB_HOST }),
    }).use(
      loggerPlugin((record, logger) =>
        logger(record).tty({ color: false, write: (l) => lines.push(l) }),
      ),
    );

    await sdk.queryRaw("LIST GRAPH");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("✓");
  });
});
