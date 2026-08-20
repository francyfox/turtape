import { describe, expect, test } from "bun:test";
import { withRetry } from "@/modules/http-client/retry";
import { captureRejection } from "@/utils/test-support.ts";

describe("withRetry", () => {
  test("returns the result on first success without retrying", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  test("does not retry by default, even on a thrown error", async () => {
    let calls = 0;
    const error = await captureRejection(
      withRetry(async () => {
        calls++;
        throw new Error("boom");
      }),
    );
    expect(error.message).toBe("boom");
    expect(calls).toBe(1);
  });

  test("retries up to `retries` times when isRetryable says so", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("transient");
        return "ok";
      },
      { retries: 3, minDelayMs: 1, maxDelayMs: 2, isRetryable: () => true },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  test("stops retrying and throws once `retries` is exhausted", async () => {
    let calls = 0;
    const error = await captureRejection(
      withRetry(
        async () => {
          calls++;
          throw new Error("always fails");
        },
        { retries: 2, minDelayMs: 1, maxDelayMs: 2, isRetryable: () => true },
      ),
    );
    expect(error.message).toBe("always fails");
    expect(calls).toBe(3); // initial attempt + 2 retries
  });

  test("does not retry an error isRetryable rejects", async () => {
    let calls = 0;
    class AppError extends Error {}
    const error = await captureRejection(
      withRetry(
        async () => {
          calls++;
          throw new AppError("not transient");
        },
        { retries: 5, isRetryable: (error) => !(error instanceof AppError) },
      ),
    );
    expect(error.message).toBe("not transient");
    expect(calls).toBe(1);
  });
});
