import { describe, expect, test } from "bun:test";
import { TurtapeError } from "@/modules/core/errors";
import { TuringDBProvider } from "@/modules/turingdb-provider";
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

describe("TuringDBProvider", () => {
  test("sends the Cypher statement as a raw text body to /query", async () => {
    let capturedUrl: URL | undefined;
    let capturedBody: unknown;
    mockFetch(async (url, init) => {
      capturedUrl = url;
      capturedBody = init.body;
      return jsonResponse(emptyResult);
    });

    await TuringDBProvider().query("LIST GRAPH");

    expect(capturedUrl?.pathname).toBe("/query");
    expect(capturedBody).toBe("LIST GRAPH");
  });

  test("sends graph/change/commit as query params, omitting the ones not set", async () => {
    let capturedUrl: URL | undefined;
    mockFetch(async (url) => {
      capturedUrl = url;
      return jsonResponse(emptyResult);
    });

    await TuringDBProvider().query("LIST GRAPH", {
      graph: "g1",
      change: "abc",
    });

    expect(capturedUrl?.searchParams.get("graph")).toBe("g1");
    expect(capturedUrl?.searchParams.get("change")).toBe("abc");
    expect(capturedUrl?.searchParams.has("commit")).toBe(false);
  });

  test("sends an Authorization header only when a token is configured", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    mockFetch(async (_url, init) => {
      capturedHeaders = init.headers as Record<string, string>;
      return jsonResponse(emptyResult);
    });

    await TuringDBProvider({ token: "secret" }).query("LIST GRAPH");
    expect(capturedHeaders?.authorization).toBe("Bearer secret");

    await TuringDBProvider({ token: "" }).query("LIST GRAPH");
    expect(capturedHeaders?.authorization).toBeUndefined();
  });

  test("throws TurtapeError with the server's error/error_details, even on HTTP 200", async () => {
    mockFetch(async () =>
      jsonResponse({
        ...emptyResult,
        error: "PARSE_ERROR",
        error_details: "syntax error",
      }),
    );

    const error = await captureRejection(TuringDBProvider().query("NOT VALID"));

    expect(error).toBeInstanceOf(TurtapeError);
    expect(error.message).toBe("PARSE_ERROR");
    expect((error as TurtapeError).details).toBe("syntax error");
  });

  test("returns the parsed body as-is when there's no error", async () => {
    const body = {
      header: { column_names: ["x"], column_types: ["Int64"] },
      data: [[[1]]],
      time: 0.5,
    };
    mockFetch(async () => jsonResponse(body));

    const result = await TuringDBProvider().query("RETURN 1");
    expect(result).toEqual(body);
  });

  test("does not retry a transport failure by default -- no plugin attached", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      throw new Error("connection refused");
    });

    await captureRejection(TuringDBProvider().query("LIST GRAPH"));
    expect(calls).toBe(1);
  });

  test("logs nothing by default -- no plugin attached", async () => {
    mockFetch(async () => jsonResponse(emptyResult));
    const lines = await captureConsoleLog(() =>
      TuringDBProvider().query("LIST GRAPH"),
    );
    expect(lines.some((l) => l.includes("[turtape]"))).toBe(false);
  });

  test("use() returns the same provider instance, so calls chain", async () => {
    const provider = TuringDBProvider();
    const chained = provider.use(async (request, next) => next(request));
    expect(chained).toBe(provider);
  });

  test("reconnect() is a no-op that does not throw", () => {
    expect(() => TuringDBProvider().reconnect()).not.toThrow();
  });

  test("name identifies the provider", () => {
    expect(TuringDBProvider().name).toBe("turingdb");
  });
});
