import type { HttpRequestOptions, Plugin } from "@/modules/plugin";
import {
  type RetryPluginOptions,
  retryPlugin,
} from "@/modules/plugin/plugin.retry.ts";

// `COMMIT` and `CHANGE SUBMIT` mutate server state, and `CHANGE SUBMIT` in
// particular can take long enough to respond that the client sees a
// transport error (dropped connection, timeout) *after* the write already
// went through server-side -- confirmed against a live server: retrying it
// then re-submits an already-applied change, and the server rightly answers
// `CHANGE_NOT_FOUND` for the duplicate, which looks like a failure even
// though the original write succeeded (see docs/turingdb-issues). Every
// other query here is either read-only or `CHANGE NEW`, neither of which has
// this half-applied-then-repeated-request risk, so they stay safe to retry
// blindly on any transport error.
const NON_IDEMPOTENT = /^\s*(commit|change\s+submit)\b/i;

const isRetryable = (_error: unknown, request: HttpRequestOptions) =>
  !(typeof request.body === "string" && NON_IDEMPOTENT.test(request.body));

export type TuringDBRetryPluginOptions = RetryPluginOptions;

/**
 * `retryPlugin` pre-configured with TuringDB's write semantics: exempts
 * `COMMIT` and `CHANGE SUBMIT` from retry by default (see `NON_IDEMPOTENT`
 * above). Not attached automatically -- opt in with
 * `TuringDBProvider(...).use(turingDBRetryPlugin())`.
 */
export const turingDBRetryPlugin = (
  options: TuringDBRetryPluginOptions = {},
): Plugin => retryPlugin({ isRetryable, ...options });
