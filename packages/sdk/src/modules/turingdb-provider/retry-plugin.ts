import type { HttpRequestOptions, Plugin } from "@/modules/plugin";
import {
  retryPlugin as genericRetryPlugin,
  type RetryPluginOptions,
} from "@/modules/plugin/plugin.retry.ts";

// ⚠️ Don't drop this: `COMMIT`/`CHANGE SUBMIT` can time out *after* the write already went
// through server-side, and retrying re-submits it -- the server then answers CHANGE_NOT_FOUND
// for the duplicate, which looks like a failure even though the original write succeeded (see
// docs/turingdb-issues). Every other query here is safe to retry blindly.
const NON_IDEMPOTENT = /^\s*(commit|change\s+submit)\b/i;

const isRetryable = (_error: unknown, request: HttpRequestOptions) =>
  !(typeof request.body === "string" && NON_IDEMPOTENT.test(request.body));

export type TuringDBRetryPluginOptions = RetryPluginOptions;

/**
 * `retryPlugin` pre-configured with TuringDB's write semantics: exempts `COMMIT` and
 * `CHANGE SUBMIT` from retry by default (see `NON_IDEMPOTENT` above). **Not attached
 * automatically** — opt in with `.use()`.
 *
 * @example
 * ```ts
 * TurtapeSdk({ provider: TuringDBProvider() }).use(retryPlugin({ retries: 3 }));
 * ```
 */
export const retryPlugin = (options: TuringDBRetryPluginOptions = {}): Plugin =>
  genericRetryPlugin({ isRetryable, ...options });
