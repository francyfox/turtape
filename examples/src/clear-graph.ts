import { TuringDBProvider, TurtapeSdk } from "@turtape/sdk";

const sdk = TurtapeSdk({
  provider: TuringDBProvider(),
});

/**
 * TuringDB has no DROP/DELETE GRAPH command -- confirmed against both the
 * query grammar and the docs' own command cheatsheet: CREATE GRAPH, LOAD
 * GRAPH, and LIST GRAPH exist, nothing to remove one. This empties a graph's
 * contents instead (every node, and every edge via DETACH), through the
 * required CHANGE NEW -> COMMIT -> CHANGE SUBMIT cycle. The graph itself
 * keeps existing afterward, just with no data in it.
 */
export async function clearGraph(graphName?: string) {
  const context = graphName ? { graph: graphName } : {};

  const newChange = await sdk.queryRaw("CHANGE NEW", context);
  const changeId = String(newChange.data[0]?.[0]?.[0]);
  const changeContext = { ...context, change: changeId };

  await sdk.queryRaw("MATCH (n) DETACH DELETE n", changeContext);
  await sdk.queryRaw("COMMIT", changeContext);
  await sdk.queryRaw("CHANGE SUBMIT", changeContext);
}

if (import.meta.main) {
  await clearGraph();
  console.log("Graph cleared.");
  process.exit(0);
}
