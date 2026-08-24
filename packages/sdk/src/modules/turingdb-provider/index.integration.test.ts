import { describe, expect, test } from "bun:test";
import { TurtapeError } from "@/modules/core/errors";
import { TuringDBProvider } from "@/modules/turingdb-provider";
import {
  isTuringDBReachable,
  TURINGDB_HOST,
  uniqueMarker,
} from "@/utils/integration-support.ts";

// Runs against a real TuringDB daemon, not mockFetch --
// exercises the actual wire protocol the mocked *.unit.test.ts files only simulate.
const reachable = await isTuringDBReachable();

if (!reachable) {
  console.warn(
    `\nSkipping turingdb-provider integration tests: TuringDB not reachable at ${TURINGDB_HOST}.\n`,
  );
}

const provider = () => TuringDBProvider({ host: TURINGDB_HOST });

describe.skipIf(!reachable)("TuringDBProvider (integration)", () => {
  test("LIST GRAPH returns the confirmed wire shape", async () => {
    const result = await provider().query("LIST GRAPH");

    expect(result.header.column_names).toContain("graphName");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.time).toBe("number");
  });

  test("a real PARSE_ERROR comes back as HTTP 200 with an error field, and turns into a TurtapeError", async () => {
    const error = await provider()
      .query("THIS IS NOT CYPHER")
      .catch((e) => e);

    expect(error).toBeInstanceOf(TurtapeError);
    expect((error as TurtapeError).code).toBe("PARSE_ERROR");
    expect((error as TurtapeError).details).toBeTruthy();
  });

  test("full write cycle (CHANGE NEW -> CREATE -> COMMIT -> CHANGE SUBMIT) makes data visible on the default graph without any change/commit context", async () => {
    const p = provider();
    const marker = uniqueMarker("turtape-integration");

    const newChange = await p.query("CHANGE NEW");
    const changeId = String(newChange.data[0]?.[0]?.[0]);
    expect(changeId.length).toBeGreaterThan(0);

    await p.query(`CREATE (n:IntegrationMarker {marker: "${marker}"})`, {
      change: changeId,
    });
    await p.query("COMMIT", { change: changeId });
    await p.query("CHANGE SUBMIT", { change: changeId });

    try {
      // No change/commit context -- reads off the default graph's main
      // line, confirming CHANGE SUBMIT actually merged the write (see
      // turingdb-issues/commit-not-visible: COMMIT alone does not).
      const result = await p.query(
        `MATCH (n:IntegrationMarker) WHERE n.marker = "${marker}" RETURN n.marker`,
      );
      expect(result.data[0]?.[0]).toEqual([marker]);
    } finally {
      // Best-effort cleanup, even if the assertion above threw.
      const cleanupChange = await p.query("CHANGE NEW");
      const cleanupChangeId = String(cleanupChange.data[0]?.[0]?.[0]);
      await p.query(
        `MATCH (n:IntegrationMarker) WHERE n.marker = "${marker}" DETACH DELETE n`,
        { change: cleanupChangeId },
      );
      await p.query("COMMIT", { change: cleanupChangeId });
      await p.query("CHANGE SUBMIT", { change: cleanupChangeId });
    }
  });

  test("reconnect() is a no-op that does not throw", () => {
    expect(() => provider().reconnect()).not.toThrow();
  });

  test("name identifies the provider", () => {
    expect(provider().name).toBe("turingdb");
  });
});
