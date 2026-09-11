import {
  loggerPlugin,
  TuringDBProvider,
  TurtapeError,
  TurtapeSdk,
} from "@turtape/sdk";

const GRAPH = "big";
const NODE_COUNT = 100_000;

const sdk = TurtapeSdk({
  provider: TuringDBProvider(),
}).use(loggerPlugin());

/**
 * Populates a dedicated `big` graph with `nodeCount` nodes so large-result-set behavior --
 * multi-chunk responses in particular, see `QueryChunks` in `@turtape/sdk` -- can be observed
 * against real data instead of the handful of rows the other examples use. Safe to re-run:
 * skips creation if the graph already has data.
 */
async function ensureBigGraph(nodeCount = NODE_COUNT) {
  const graphs = await sdk.queryRaw("LIST GRAPH");
  const exists = graphs.data[0]?.[0]?.includes(GRAPH);
  if (!exists) await sdk.queryRaw(`CREATE GRAPH ${GRAPH}`);

  // A graph with no `Datapoint` node yet doesn't just return 0 -- the label isn't in the
  // schema, so TuringDB rejects the query with ANALYZE_ERROR "Unknown label".
  let existingCount = 0;
  try {
    const result = await sdk.queryRaw("MATCH (n:Datapoint) RETURN count(n)", {
      graph: GRAPH,
    });
    existingCount = Number(result.data[0]?.[0]?.[0]) || 0;
  } catch (error) {
    if (!(error instanceof TurtapeError) || error.code !== "ANALYZE_ERROR") {
      throw error;
    }
  }
  if (existingCount > 0) return;

  const context = { graph: GRAPH };
  const newChange = await sdk.queryRaw("CHANGE NEW", context);
  const changeId = String(newChange.data[0]?.[0]?.[0]);
  const changeContext = { ...context, change: changeId };

  const ids = Array.from({ length: nodeCount }, (_, i) => i).join(",");
  await sdk.queryRaw(
    `UNWIND [${ids}] AS i CREATE (:Datapoint {id: i, value: i * i})`,
    changeContext,
  );

  await sdk.queryRaw("COMMIT", changeContext);
  await sdk.queryRaw("CHANGE SUBMIT", changeContext);
}

if (import.meta.main) {
  await ensureBigGraph();

  const result = await sdk.queryRaw(
    "MATCH (n:Datapoint) RETURN n.id, n.value",
    { graph: GRAPH },
  );

  // Row count per chunk, read off the first column -- every column in a chunk is the same length.
  const chunkSizes = result.data.map((chunk) => chunk[0]?.length ?? 0);
  console.log(
    `chunks: ${result.data.length} (sizes: ${chunkSizes.join(", ")})`,
  );
  console.log(`rows: ${chunkSizes.reduce((a, b) => a + b, 0)}`);
  console.log(`server time: ${result.time}ms`);

  process.exit(0);
}
