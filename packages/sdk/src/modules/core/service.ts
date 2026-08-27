import type {
  QueryContext,
  QueryResponse,
  TurtapeConfig,
} from "@/modules/core/types";
import type { Plugin } from "@/modules/plugin";

/**
 * The object `TurtapeSdk()` returns. Spelled out explicitly (rather than left to inference) so
 * `.use()` keeps its real signature in the published `.d.ts` — `use`'s return type is `service`
 * itself, and declaration bundlers give up on that kind of self-reference when it's inferred,
 * emitting `any` instead.
 */
export interface TurtapeService {
  /**
   * Runs a Cypher query and returns the provider's raw {@link QueryResponse} — including the
   * `chunks -> columns -> values` nesting in `data`. Reach for this when you need the raw
   * envelope (timing, column types, ...); use a higher-level query method when you just want
   * rows.
   *
   * @example
   * ```ts
   * const { data } = await service.queryRaw("MATCH (n:Person) RETURN n.name");
   * const names = data[0][0]; // first chunk, first column
   * ```
   */
  queryRaw(cypher: string, context?: QueryContext): Promise<QueryResponse>;
  reconnect(): void;
  use(plugin: Plugin): TurtapeService;
}

export const createTurtapeService = (config: TurtapeConfig): TurtapeService => {
  const service: TurtapeService = {
    queryRaw: (cypher, context) => config.provider.query(cypher, context),
    reconnect: () => config.provider.reconnect(),
    use: (plugin) => {
      config.provider.use(plugin);
      return service;
    },
  };

  return service;
};
