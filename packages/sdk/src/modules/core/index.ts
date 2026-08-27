import {
  createTurtapeService,
  type TurtapeService,
} from "@/modules/core/service.ts";
import type { TurtapeConfig } from "@/modules/core/types";
import { TuringDBProvider } from "@/modules/turingdb-provider";

/**
 * The SDK's **entry point**. Defaults to a plain `TuringDBProvider()` (no plugins,
 * `http://localhost:6666`) when no config is given. Plugins (retry, logging, ...) attach here,
 * not on the provider directly — `.use()` just forwards to it, so this works with any provider.
 *
 * @example
 * ```ts
 * const sdk = TurtapeSdk({ provider: TuringDBProvider({ host, token }) })
 *   .use(loggerPlugin())
 *   .use(retryPlugin());
 * const result = await sdk.queryRaw("MATCH (n) RETURN n");
 * ```
 */
export const TurtapeSdk = (
  { provider }: TurtapeConfig = {
    provider: TuringDBProvider(),
  },
): TurtapeService => {
  return createTurtapeService({ provider });
};

export type { TurtapeConfig, TurtapeService };
