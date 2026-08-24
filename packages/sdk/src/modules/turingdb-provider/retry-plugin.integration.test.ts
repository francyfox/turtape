import { describe, expect, test } from "bun:test";
import { TuringDBProvider } from "@/modules/turingdb-provider";
import { turingDBRetryPlugin } from "@/modules/turingdb-provider/retry-plugin";
import {
  isTuringDBReachable,
  TURINGDB_HOST,
} from "@/utils/integration-support.ts";

const reachable = await isTuringDBReachable();

if (!reachable) {
  console.warn(
    `\nSkipping retry-plugin integration tests: TuringDB not reachable at ${TURINGDB_HOST}.\n`,
  );
}

describe.skipIf(!reachable)("turingDBRetryPlugin (integration)", () => {
  test("doesn't interfere with a normal successful request against a real server", async () => {
    const result = await TuringDBProvider({ host: TURINGDB_HOST })
      .use(turingDBRetryPlugin())
      .query("LIST GRAPH");

    expect(result.header.column_names).toContain("graphName");
  });

  test("does not retry a real PARSE_ERROR (it's an application error, not a transport failure)", async () => {
    let calls = 0;
    const provider = TuringDBProvider({ host: TURINGDB_HOST }).use(
      turingDBRetryPlugin({ retries: 5 }),
    );

    // Wrap fetch to count attempts without breaking the real request.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      calls++;
      return originalFetch(...args);
    }) as typeof fetch;

    try {
      await provider.query("THIS IS NOT CYPHER").catch(() => {});
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toBe(1);
  });
});
