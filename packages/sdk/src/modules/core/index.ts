import { createTurtapeService } from "@/modules/core/service.ts";
import type { TurtapeConfig } from "@/modules/core/types";
import { TuringDBProvider } from "@/modules/turingdb-provider";

export const TurtapeSdk = (
  { provider }: TurtapeConfig = {
    provider: TuringDBProvider(),
  },
) => {
  return createTurtapeService({ provider });
};

export type { TurtapeConfig };
