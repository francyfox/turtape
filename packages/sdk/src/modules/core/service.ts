import type { QueryContext, TurtapeConfig } from "@/modules/core/types";

export const createTurtapeService = (config: TurtapeConfig) => {
  return {
    queryRaw: (cypher: string, context?: QueryContext) =>
      config.provider.query(cypher, context),
    reconnect: () => config.provider.reconnect(),
  };
};
