import { describe, expect, test } from "bun:test";
import { TurtapeSdk } from "@/modules/core";
import type { QueryResponse, TurtapeProvider } from "@/modules/core/types";
import type { Plugin } from "@/modules/plugin";

const emptyResult: QueryResponse = {
  header: { column_names: [], column_types: [] },
  data: [],
  time: 0,
};

const mockProvider = (): TurtapeProvider & { plugins: Plugin[] } => {
  const plugins: Plugin[] = [];
  const provider: TurtapeProvider & { plugins: Plugin[] } = {
    name: "mock",
    plugins,
    query: async () => emptyResult,
    reconnect: () => {},
    use(plugin) {
      plugins.push(plugin);
      return provider;
    },
  };
  return provider;
};

describe("TurtapeSdk", () => {
  test("queryRaw() delegates to the provider's query()", async () => {
    const provider = mockProvider();
    let seenCypher: string | undefined;
    let seenContext: unknown;
    provider.query = async (cypher, context) => {
      seenCypher = cypher;
      seenContext = context;
      return emptyResult;
    };

    const sdk = TurtapeSdk({ provider });
    const result = await sdk.queryRaw("LIST GRAPH", { graph: "g1" });

    expect(result).toEqual(emptyResult);
    expect(seenCypher).toBe("LIST GRAPH");
    expect(seenContext).toEqual({ graph: "g1" });
  });

  test("reconnect() delegates to the provider's reconnect()", () => {
    const provider = mockProvider();
    let called = false;
    provider.reconnect = () => {
      called = true;
    };

    TurtapeSdk({ provider }).reconnect();
    expect(called).toBe(true);
  });

  test("use() attaches a plugin to the provider -- not specific to any one provider", () => {
    const provider = mockProvider();
    const plugin: Plugin = async (request, next) => next(request);

    TurtapeSdk({ provider }).use(plugin);

    expect(provider.plugins).toEqual([plugin]);
  });

  test("use() returns the same sdk instance, so calls chain", () => {
    const sdk = TurtapeSdk({ provider: mockProvider() });
    const chained = sdk.use(async (request, next) => next(request));

    expect(chained).toBe(sdk);
  });

  test("defaults to a plain TuringDBProvider() when no config is given", () => {
    // Only confirms it constructs without throwing -- actual connectivity is covered by
    // turingdb-provider's own tests and core/index.integration.test.ts.
    expect(() => TurtapeSdk()).not.toThrow();
  });
});
