export const TURINGDB_HOST = "http://localhost:6666";

/**
 * Probes whether a real TuringDB is listening. Every `*.integration.test.ts`
 * file uses this to `describe.skipIf(!reachable)` its suite -- so running
 * `bun run test` (or `test:integration`) when nothing's listening on
 * `TURINGDB_HOST` skips those tests with a clear message instead of failing
 * the build, however that instance got started (local, CI service container,
 * ...).
 */
export async function isTuringDBReachable(
  host: string = TURINGDB_HOST,
): Promise<boolean> {
  try {
    const response = await fetch(`${host}/query`, {
      method: "POST",
      body: "LIST GRAPH",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * A marker unique to this test run, so writes from parallel/repeated runs
 * don't collide and cleanup can find (only) what this run created.
 */
export const uniqueMarker = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
