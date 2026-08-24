import type { QueryContext, TurtapeConfig } from "@/modules/core/types";
import type { Plugin } from "@/modules/plugin";

export const createTurtapeService = (config: TurtapeConfig) => {
  const service = {
    queryRaw: (cypher: string, context?: QueryContext) =>
      config.provider.query(cypher, context),
    reconnect: () => config.provider.reconnect(),
    use: (plugin: Plugin) => {
      config.provider.use(plugin);
      return service;
    },
  };

  return service;
};
