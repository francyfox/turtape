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
