/**
 * Minimal usage example. Run against a live daemon with:
 *
 *   npm run build
 *   node examples/basic.js   # after compiling, or use ts-node
 */
import { convertToRows, TuringDB, TuringDBException } from "../src";

async function main() {
  const db = new TuringDB({
    host: process.env.TURINGDB_HOST ?? "http://localhost:6666",
    token: process.env.TURINGDB_AUTH_TOKEN,
  });

  // Make sure the daemon is reachable.
  await db.tryReach(5000);

  console.log("Available graphs:", await db.listAvailableGraphs());

  db.setGraph("default");

  try {
    const result = await db.query("MATCH (n) RETURN n LIMIT 5");
    console.log(`Columns: ${result.columnNames.join(", ")}`);
    console.log(`Rows (${result.rowCount}):`);
    for (const row of convertToRows(result)) {
      console.log(row);
    }
    console.log(`Server exec time: ${result.execTime}`);
    console.log(`Round trip: ${result.totalExecTime} ms`);
  } catch (e) {
    if (e instanceof TuringDBException) {
      console.error("Query failed:", e.message);
    } else {
      throw e;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
