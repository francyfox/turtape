import { describe, expect, test } from "bun:test";
import { TurtapeError } from "@/modules/core/errors";
import { createHttpClient } from "@/modules/http-client";
import { retryPlugin } from "@/modules/plugin/plugin.retry.ts";
import {
  captureRejection,
  jsonResponse,
  mockFetch,
} from "@/utils/test-support.ts";

describe("createHttpClient", () => {
  test("POSTs to host+path with the given body and merged headers", async () => {
    let capturedUrl: URL | undefined;
    let capturedInit: RequestInit | undefined;
    mockFetch(async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse({ ok: true });
    });

    const client = createHttpClient({
      host: "http://localhost:6666",
      headers: { authorization: "Bearer x" },
    });
    const result = await client.request<{ ok: boolean }>({
      path: "/query",
      body: "LIST GRAPH",
    });

    expect(result).toEqual({ ok: true });
    expect(capturedUrl?.toString()).toBe("http://localhost:6666/query");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toMatchObject({ authorization: "Bearer x" });
    expect(capturedInit?.body).toBe("LIST GRAPH");
  });

  test("per-request headers override client-level headers", async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch(async (_url, init) => {
      capturedInit = init;
      return jsonResponse({});
    });

    const client = createHttpClient({
      host: "http://localhost:6666",
      headers: { authorization: "Bearer client" },
    });
    await client.request({
      path: "/query",
      headers: { authorization: "Bearer override" },
    });

    expect(capturedInit?.headers).toMatchObject({
      authorization: "Bearer override",
    });
  });

  test("sets defined params and omits undefined ones", async () => {
    let capturedUrl: URL | undefined;
    mockFetch(async (url) => {
      capturedUrl = url;
      return jsonResponse({});
    });

    const client = createHttpClient({ host: "http://localhost:6666" });
    await client.request({
      path: "/query",
      params: { graph: "default", change: undefined },
    });

    expect(capturedUrl?.searchParams.get("graph")).toBe("default");
    expect(capturedUrl?.searchParams.has("change")).toBe(false);
  });

  test("throws TurtapeError on a non-2xx response", async () => {
    mockFetch(async () => jsonResponse({}, 500));

    const client = createHttpClient({ host: "http://localhost:6666" });
    const error = await captureRejection(client.request({ path: "/query" }));

    expect(error).toBeInstanceOf(TurtapeError);
    expect(error.message).toContain("500");
  });

  test("throws TurtapeError on a non-JSON body", async () => {
    mockFetch(async () => new Response("not json", { status: 200 }));

    const client = createHttpClient({ host: "http://localhost:6666" });
    const error = await captureRejection(client.request({ path: "/query" }));

    expect(error).toBeInstanceOf(TurtapeError);
  });

  test("does not retry by default", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      throw new Error("connection refused");
    });

    const client = createHttpClient({ host: "http://localhost:6666" });
    await captureRejection(client.request({ path: "/query" }));

    expect(calls).toBe(1);
  });

  test("retries when configured to, and succeeds once fetch stops failing", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      if (calls < 3) throw new Error("connection refused");
      return jsonResponse({ ok: true });
    });

    const client = createHttpClient({ host: "http://localhost:6666" }).use(
      retryPlugin({
        retries: 3,
        minDelayMs: 1,
        maxDelayMs: 2,
        isRetryable: () => true,
      }),
    );
    const result = await client.request<{ ok: boolean }>({ path: "/query" });

    expect(result).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  test("use() returns the same client, so calls chain", async () => {
    mockFetch(async () => jsonResponse({ ok: true }));

    const client = createHttpClient({ host: "http://localhost:6666" });
    const chained = client.use(async (request, next) => next(request));

    expect(chained).toBe(client);
  });
});
