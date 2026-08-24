import { afterEach, mock } from "bun:test";

export async function captureRejection(
  promise: Promise<unknown>,
): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected promise to reject, but it resolved");
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const mockFetch = (
  impl: (url: URL, init: RequestInit) => Promise<Response>,
) => {
  globalThis.fetch = mock(impl) as unknown as typeof fetch;
};

/** Runs `fn`, capturing every `console.log` call (as its first argument, stringified) made
 * during it. Restores the original `console.log` afterward, even if `fn` throws/rejects. */
export async function captureConsoleLog(fn: () => unknown): Promise<string[]> {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => lines.push(String(args[0]));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}
