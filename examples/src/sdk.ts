import { loggerPlugin, TuringDBProvider, TurtapeSdk } from "@turtape/sdk";

let timer = 0;
function startTimer() {
  timer = 0;
  timer = performance.now();
}

function stopTimer(fnName: string) {
  console.log(`[${fnName}] ${performance.now() - timer} ms`);
}
const sdk = TurtapeSdk({
  provider: TuringDBProvider(),
}).use(loggerPlugin());

// console.log(await sdk.queryRaw("LIST GRAPH"));
// const hasPam = await sdk.queryRaw(
//   'MATCH (p:Person {name: "Pam"}) RETURN count(p) > 0 AS exists',
// );
// console.log(hasPam);

async function createPam() {
  const newChange = await sdk.queryRaw("CHANGE NEW");
  const changeId = String(newChange.data[0]?.[0]?.[0]);

  const query = await sdk.queryRaw(
    'CREATE (pam:Person {name: "Pam"}),\n' +
      '  (tom:Person {name: "Tom"}),\n' +
      '  (kate:Person {name: "Kate"}),\n' +
      '  (mary:Person {name: "Mary"}),\n' +
      '  (bob:Person {name: "Bob"}),\n' +
      '  (liz:Person {name: "Liz"}),\n' +
      '  (dick:Person {name: "Dick"}),\n' +
      '  (ann:Person {name: "Ann"}),\n' +
      '  (pat:Person {name: "Pat"}),\n' +
      '  (jack:Person {name: "Jack"}),\n' +
      '  (jim:Person {name: "Jim"}),\n' +
      '  (joli:Person {name: "Joli"}),\n' +
      "  (pam)-[:PARENT]->(bob),\n" +
      "  (tom)-[:PARENT]->(bob),\n" +
      "  (tom)-[:PARENT]->(liz),\n" +
      "  (kate)-[:PARENT]->(liz),\n" +
      "  (mary)-[:PARENT]->(ann),\n" +
      "  (bob)-[:PARENT]->(ann),\n" +
      "  (bob)-[:PARENT]->(pat),\n" +
      "  (dick)-[:PARENT]->(jim),\n" +
      "  (ann)-[:PARENT]->(jim),\n" +
      "  (pat)-[:PARENT]->(joli),\n" +
      "  (jack)-[:PARENT]->(joli)",
    { change: changeId },
  );

  await sdk.queryRaw("COMMIT", { change: changeId });
  await sdk.queryRaw("CHANGE SUBMIT", { change: changeId });
}

await createPam();
process.exit(0);
