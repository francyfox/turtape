const http = require("http");
const assert = require("assert");
const { TuringDB, HTTPClient, TuringDBException, convertToRows } = require("../dist/index.js");

const requests = [];

// Mock TuringDB daemon.
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://localhost");
    requests.push({
      path: url.pathname,
      params: Object.fromEntries(url.searchParams),
      body,
      auth: req.headers["authorization"],
    });
    res.setHeader("Content-Type", "application/json");

    if (url.pathname === "/query") {
      // Two chunks, column-oriented: columns [name(String), age(Int64)].
      if (body === "CHANGE NEW") {
        return res.end(
          JSON.stringify({
            time: 1.5,
            header: { column_names: ["changeID"], column_types: ["Int64"] },
            data: [[[255]]],
          }),
        );
      }
      if (body === "LIST GRAPH") {
        return res.end(
          JSON.stringify({
            time: 0.5,
            header: { column_names: ["graphName"], column_types: ["String"] },
            data: [[["g1", "mygraph"]]],
          }),
        );
      }
      if (body === "LIST AVAILABLE GRAPHS") {
        return res.end(
          JSON.stringify({
            time: 0.5,
            header: {
              column_names: ["graphName", "isLoaded", "isLoading"],
              column_types: ["String", "Bool", "Bool"],
            },
            data: [[["g1", "g2"], [true, false], [false, false]]],
          }),
        );
      }
      if (body === "LOAD GRAPH g1") {
        return res.end(
          JSON.stringify({
            error: "Failed to load graph 'g1': Graph already loaded",
          }),
        );
      }
      if (body.startsWith("LOAD GRAPH ")) {
        return res.end(
          JSON.stringify({
            time: 0.5,
            header: { column_names: ["graphName"], column_types: ["String"] },
            data: [[[body.slice("LOAD GRAPH ".length)]]],
          }),
        );
      }
      if (body === "BAD") {
        return res.end(
          JSON.stringify({ error: "PARSE_ERROR", error_details: "unexpected token" }),
        );
      }
      return res.end(
        JSON.stringify({
          time: 2.25,
          header: { column_names: ["name", "age"], column_types: ["String", "Int64"] },
          data: [
            [["alice", "bob"], [30, 40]],
            [["carol"], [50]],
          ],
        }),
      );
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "NOT_FOUND" }));
  });
});

async function main() {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const host = `http://localhost:${port}`;

  // --- facade + auth token ---
  const db = new TuringDB({ host, token: "secret" });
  assert.ok(db.impl instanceof HTTPClient);

  // --- query parsing (multi-chunk) ---
  const r = await db.query("MATCH (n) RETURN n.name, n.age");
  assert.deepStrictEqual(r.columnNames, ["name", "age"]);
  assert.deepStrictEqual(r.columnTypes, ["String", "Int64"]);
  assert.strictEqual(r.rowCount, 3);
  assert.deepStrictEqual(r.columns, [["alice", "bob", "carol"], [30, 40, 50]]);
  assert.strictEqual(r.rows, undefined); // query() is column-oriented only
  assert.strictEqual(r.execTime, 2.25);
  assert.strictEqual(typeof r.totalExecTime, "number");
  assert.strictEqual(db.getQueryExecTime(), 2.25);

  // --- row-oriented access: queryRows and convertToRows ---
  const expectedRows = [
    { name: "alice", age: 30 },
    { name: "bob", age: 40 },
    { name: "carol", age: 50 },
  ];
  assert.deepStrictEqual(await db.queryRows("MATCH (n) RETURN n.name, n.age"), expectedRows);
  assert.deepStrictEqual(convertToRows(r), expectedRows);

  // auth header sent
  const qReq = requests.find((x) => x.path === "/query");
  assert.strictEqual(qReq.auth, "Bearer secret");
  assert.strictEqual(qReq.params.graph, "default");

  // --- graph selection reflected in params ---
  db.setGraph("mygraph");
  assert.strictEqual(db.currentGraph, "mygraph");
  await db.query("X");
  assert.strictEqual(requests[requests.length - 1].params.graph, "mygraph");

  // --- change lifecycle: newChange sets hex change param ---
  assert.strictEqual(db.currentChange, "main");
  const changeId = await db.newChange();
  assert.strictEqual(changeId, 255);
  assert.strictEqual(db.currentChange, "ff"); // 255 -> hex
  await db.query("Y");
  assert.strictEqual(requests[requests.length - 1].params.change, "ff");

  // newChange while on a change throws
  await assert.rejects(() => db.newChange(), /Cannot create a new change while working on one/);

  // checkout main clears change
  await db.checkout("main");
  assert.strictEqual(db.currentChange, "main");

  // --- server error surfaces as TuringDBException with details ---
  await assert.rejects(
    () => db.query("BAD"),
    (e) => e instanceof TuringDBException && e.message === "PARSE_ERROR: unexpected token",
  );

  // --- list available graphs via LIST AVAILABLE GRAPHS (graphless) ---
  assert.deepStrictEqual(await db.listAvailableGraphs(), ["g1", "g2"]);
  assert.strictEqual(requests[requests.length - 1].body, "LIST AVAILABLE GRAPHS");
  assert.strictEqual(requests[requests.length - 1].params.graph, undefined);

  // --- loaded graphs via LIST GRAPH (graphless) ---
  assert.deepStrictEqual(await db.listLoadedGraphs(), ["g1", "mygraph"]);
  assert.strictEqual(requests[requests.length - 1].body, "LIST GRAPH");
  assert.strictEqual(requests[requests.length - 1].params.graph, undefined);

  // --- isGraphLoaded checks membership of the current graph ---
  assert.strictEqual(db.currentGraph, "mygraph");
  assert.strictEqual(await db.isGraphLoaded(), true);
  db.setGraph("other");
  assert.strictEqual(await db.isGraphLoaded(), false);
  db.setGraph("mygraph");

  // --- loadGraph issues LOAD GRAPH ---
  const lg = await db.loadGraph("g3");
  assert.strictEqual(requests[requests.length - 1].body, "LOAD GRAPH g3");
  assert.deepStrictEqual(lg.columns, [["g3"]]);

  // idempotent: an already-loaded graph is a no-op, not an error
  assert.strictEqual(await db.loadGraph("g1"), undefined);

  // --- token suppression via empty string ---
  const noAuth = new HTTPClient({ host, token: "" });
  await noAuth.listAvailableGraphs();
  assert.strictEqual(requests[requests.length - 1].auth, undefined);

  console.log("ALL E2E ASSERTIONS PASSED");
  server.close();
}

main().catch((e) => {
  console.error("FAILED:", e);
  server.close();
  process.exit(1);
});
