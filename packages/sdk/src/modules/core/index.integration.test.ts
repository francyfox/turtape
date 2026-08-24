import { describe, expect, test } from "bun:test";
import { TurtapeSdk } from "@/modules/core";
import { TuringDBProvider } from "@/modules/turingdb-provider";
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
});
