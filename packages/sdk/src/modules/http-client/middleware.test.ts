import { describe, expect, test } from "bun:test";
import {
  compose,
  type HttpRequestOptions,
  type Middleware,
  retryMiddleware,
} from "@/modules/http-client/middleware";
import { captureRejection } from "@/utils/test-support.ts";

const request: HttpRequestOptions = { path: "/query" };

describe("compose", () => {
  test("runs middlewares outer-to-inner around the terminal handler", async () => {
    const order: string[] = [];
    const tag =
      (name: string): Middleware =>
      async (req, next) => {
        order.push(`${name}:before`);
        const result = await next(req);
        order.push(`${name}:after`);
        return result;
      };

    const pipeline = compose([tag("a"), tag("b")], async () => {
      order.push("handler");
      return "ok";
    });

    const result = await pipeline(request);

    expect(result).toBe("ok");
    expect(order).toEqual([
      "a:before",
      "b:before",
      "handler",
      "b:after",
      "a:after",
    ]);
  });

  test("with no middlewares, just calls the handler", async () => {
    const pipeline = compose([], async (req) => req.path);
    expect(await pipeline(request)).toBe("/query");
  });
});

describe("retryMiddleware", () => {
  test("does not retry by default, even on a thrown error", async () => {
    let calls = 0;
    const pipeline = compose([retryMiddleware()], async () => {
      calls++;
      throw new Error("boom");
    });

    await captureRejection(pipeline(request));
    expect(calls).toBe(1);
  });

  test("isRetryable sees the request that failed, not just the error", async () => {
    let calls = 0;
    const seenPaths: string[] = [];
    const pipeline = compose(
      [
        retryMiddleware({
          retries: 2,
          minDelayMs: 1,
          maxDelayMs: 2,
          isRetryable: (_error, req) => {
            seenPaths.push(req.path);
            return req.path !== "/no-retry";
          },
        }),
      ],
      async () => {
        calls++;
        throw new Error("transient");
      },
    );

    await captureRejection(pipeline({ path: "/no-retry" }));
    expect(calls).toBe(1);
    expect(seenPaths).toEqual(["/no-retry"]);
  });
});
