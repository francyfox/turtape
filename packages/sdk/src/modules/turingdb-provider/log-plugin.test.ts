import { describe, expect, test } from "bun:test";
import { TuringDBProvider } from "@/modules/turingdb-provider";
import { turingDBLogPlugin } from "@/modules/turingdb-provider/log-plugin";
import { turingDBRetryPlugin } from "@/modules/turingdb-provider/retry-plugin";
import {
  captureConsoleLog,
  captureRejection,
  jsonResponse,
  mockFetch,
} from "@/utils/test-support.ts";

const emptyResult = {
  header: { column_names: [], column_types: [] },
  data: [],
  time: 0,
};

describe("turingDBLogPlugin", () => {
  test("default handler renders a ✓ line for a real success", async () => {
    mockFetch(async () => jsonResponse(emptyResult));
    const lines: string[] = [];

    await TuringDBProvider()
      .use(
        turingDBLogPlugin((record, logger) =>
          logger(record).tty({ color: false, write: (l) => lines.push(l) }),
        ),
      )
      .query("LIST GRAPH");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("✓");
    expect(lines[0]).toContain("LIST");
  });

  test("record.level is 'error' for a TuringDB query error, not a false 'info' -- the request itself was HTTP 200", async () => {
    mockFetch(async () =>
      jsonResponse({ ...emptyResult, error: "PARSE_ERROR" }),
    );
    let seen: { level: string; verb: string; detail?: string } | undefined;

    await captureRejection(
      TuringDBProvider()
        .use(
          turingDBLogPlugin((record) => {
            seen = record;
          }),
        )
        .query("NOT VALID"),
    );

    expect(seen?.level).toBe("error");
    expect(seen?.verb).toBe("NOT");
    expect(seen?.detail).toBe("PARSE_ERROR");
  });

  test("record.level is 'error' for a transport failure, with the transport error as detail", async () => {
    mockFetch(async () => {
      throw new Error("connection refused");
    });
    let seen: { level: string; detail?: string } | undefined;

    await captureRejection(
      TuringDBProvider()
        .use(
          turingDBLogPlugin((record) => {
            seen = record;
          }),
        )
        .query("LIST GRAPH"),
    );

    expect(seen?.level).toBe("error");
    expect(seen?.detail).toBe("connection refused");
  });

  test("record.errorKind is 'application' for a TuringDB query error", async () => {
    mockFetch(async () =>
      jsonResponse({ ...emptyResult, error: "PARSE_ERROR" }),
    );
    let seen: { errorKind?: string } | undefined;

    await captureRejection(
      TuringDBProvider()
        .use(
          turingDBLogPlugin((record) => {
            seen = record;
          }),
        )
        .query("NOT VALID"),
    );

    expect(seen?.errorKind).toBe("application");
  });

  test("record.errorKind is 'transport' for a transport failure", async () => {
    mockFetch(async () => {
      throw new Error("connection refused");
    });
    let seen: { errorKind?: string } | undefined;

    await captureRejection(
      TuringDBProvider()
        .use(
          turingDBLogPlugin((record) => {
            seen = record;
          }),
        )
        .query("LIST GRAPH"),
    );

    expect(seen?.errorKind).toBe("transport");
  });

  test("record.serverMs/networkMs come from body.time on success; both absent on a transport failure", async () => {
    mockFetch(async () => jsonResponse({ ...emptyResult, time: 5 }));
    let onSuccess:
      | { serverMs?: number; networkMs?: number; durationMs: number }
      | undefined;

    await TuringDBProvider()
      .use(
        turingDBLogPlugin((record) => {
          onSuccess = record;
        }),
      )
      .query("LIST GRAPH");

    expect(onSuccess?.serverMs).toBe(5);
    // networkMs is durationMs - serverMs, precomputed -- not necessarily >= 0
    // (a mocked, near-instant fetch can resolve "faster" than the mocked
    // server time), but it must equal that subtraction exactly.
    expect(onSuccess?.networkMs).toBeCloseTo(
      (onSuccess?.durationMs ?? 0) - 5,
      5,
    );

    mockFetch(async () => {
      throw new Error("connection refused");
    });
    let onFailure: { serverMs?: number; networkMs?: number } | undefined;

    await captureRejection(
      TuringDBProvider()
        .use(
          turingDBLogPlugin((record) => {
            onFailure = record;
          }),
        )
        .query("LIST GRAPH"),
    );

    expect(onFailure?.serverMs).toBeUndefined();
    expect(onFailure?.networkMs).toBeUndefined();
  });

  test("record carries the graph/change/commit context the query was sent with", async () => {
    mockFetch(async () => jsonResponse(emptyResult));
    let seen: { graph?: string; change?: string; commit?: string } | undefined;

    await TuringDBProvider()
      .use(
        turingDBLogPlugin((record) => {
          seen = record;
        }),
      )
      .query("MATCH (n) RETURN n", { graph: "social", change: "c1" });

    expect(seen?.graph).toBe("social");
    expect(seen?.change).toBe("c1");
    expect(seen?.commit).toBeUndefined();
  });

  test("record is plain JSON-serializable data -- a handler can ship it anywhere, not just to .tty()", async () => {
    mockFetch(async () => jsonResponse(emptyResult));
    let seen: unknown;

    await TuringDBProvider()
      .use(
        turingDBLogPlugin((record) => {
          seen = JSON.parse(JSON.stringify(record));
        }),
      )
      .query("LIST GRAPH");

    expect(seen).toMatchObject({ level: "info", tag: "turtape", verb: "LIST" });
  });

  test("attached before turingDBRetryPlugin, logs once per query() call after retries settle", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      if (calls < 3) throw new Error("connection refused");
      return jsonResponse(emptyResult);
    });
    const records: unknown[] = [];

    await TuringDBProvider()
      .use(
        turingDBLogPlugin((record) => {
          records.push(record);
        }),
      )
      .use(turingDBRetryPlugin({ retries: 3, minDelayMs: 1, maxDelayMs: 2 }))
      .query("LIST GRAPH");

    expect(calls).toBe(3);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ level: "info" });
  });

  test("with no handler, defaults to logger(record).tty()", async () => {
    mockFetch(async () => jsonResponse(emptyResult));

    const lines = await captureConsoleLog(() =>
      TuringDBProvider().use(turingDBLogPlugin()).query("LIST GRAPH"),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[turtape]");
  });
});
