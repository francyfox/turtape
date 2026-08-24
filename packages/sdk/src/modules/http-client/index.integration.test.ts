import { describe, expect, test } from "bun:test";
import { TurtapeError } from "@/modules/core/errors";
import { createHttpClient } from "@/modules/http-client";
import {
  isTuringDBReachable,
  TURINGDB_HOST,
} from "@/utils/integration-support.ts";

// Runs against a real TuringDB daemon, not mockFetch --
// exercises the raw transport (real fetch, real headers, real JSON parsing)
// that the mocked *.unit.test.ts files only simulate.
const reachable = await isTuringDBReachable();

if (!reachable) {
  console.warn(
    `\nSkipping http-client integration tests: TuringDB not reachable at ${TURINGDB_HOST}.\n`,
  );
}

describe.skipIf(!reachable)("createHttpClient (integration)", () => {
  test("POSTs to a real server and parses the JSON response", async () => {
    const client = createHttpClient({ host: TURINGDB_HOST });
    const result = await client.request<{
      header: unknown;
      data: unknown;
      time: number | null;
    }>({ path: "/query", body: "LIST GRAPH" });

    expect(result.header).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.time).toBe("number");
  });

  test("a real non-POST request throws TurtapeError with the actual HTTP status (405)", async () => {
    const client = createHttpClient({ host: TURINGDB_HOST });
    const error = await client
      .request({ path: "/query", method: "GET" })
      .catch((e) => e);

    expect(error).toBeInstanceOf(TurtapeError);
    expect((error as TurtapeError).message).toContain("405");
  });
});
