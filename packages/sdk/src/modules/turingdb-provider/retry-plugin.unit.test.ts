import { describe, expect, test } from "bun:test";
import { TuringDBProvider } from "@/modules/turingdb-provider";
import { retryPlugin } from "@/modules/turingdb-provider/retry-plugin";
import {
  captureRejection,
  jsonResponse,
  mockFetch,
} from "@/utils/test-support.ts";

const emptyResult = {
  header: { column_names: [], column_types: [] },
  data: [],
  time: 0,
};

describe("retryPlugin", () => {
  test("retries a transport failure and eventually succeeds", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      if (calls < 2) throw new Error("connection refused");
      return jsonResponse(emptyResult);
    });

    const result = await TuringDBProvider()
      .use(retryPlugin({ retries: 2, minDelayMs: 1, maxDelayMs: 2 }))
      .query("LIST GRAPH");

    expect(calls).toBe(2);
    expect(result).toEqual(emptyResult);
  });

  test("does not retry an application-level error (it's thrown after the request already succeeded)", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      return jsonResponse({ ...emptyResult, error: "PARSE_ERROR" });
    });

    await captureRejection(
      TuringDBProvider()
        .use(retryPlugin({ retries: 5 }))
        .query("NOT VALID"),
    );

    expect(calls).toBe(1);
  });

  test.each(["COMMIT", "  change submit  ", "CHANGE SUBMIT"])(
    "does not retry %j on a transport failure -- a retried submit could be a duplicate of one that already went through",
    async (cypher) => {
      let calls = 0;
      mockFetch(async () => {
        calls++;
        throw new Error("connection refused");
      });

      await captureRejection(
        TuringDBProvider()
          .use(retryPlugin({ retries: 5, minDelayMs: 1 }))
          .query(cypher, { change: "1" }),
      );

      expect(calls).toBe(1);
    },
  );

  test("still retries CHANGE NEW and reads on a transport failure", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      if (calls < 2) throw new Error("connection refused");
      return jsonResponse(emptyResult);
    });

    const result = await TuringDBProvider()
      .use(retryPlugin({ retries: 2, minDelayMs: 1, maxDelayMs: 2 }))
      .query("CHANGE NEW");

    expect(calls).toBe(2);
    expect(result).toEqual(emptyResult);
  });
});
