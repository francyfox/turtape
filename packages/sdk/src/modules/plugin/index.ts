export interface HttpRequestOptions {
  path: string;
  method?: string;
  body?: RequestInit["body"];
  headers?: Record<string, string>;
  /** Query params; `undefined` values are omitted, not sent as `"undefined"`. */
  params?: Record<string, string | undefined>;
}

/** The next plugin in the chain, or the terminal handler once the chain ends. */
export type NextFn = (request: HttpRequestOptions) => Promise<unknown>;

/**
 * A function that can inspect/rewrite a request, call `next` to continue the chain, and
 * inspect/rewrite (or catch) the result before returning it. **Nothing is attached by default** —
 * a caller opts in with `.use()`.
 *
 * @example
 * ```ts
 * const logPlugin: Plugin = async (request, next) => {
 *   console.log("->", request.path);
 *   return next(request);
 * };
 * ```
 */
export type Plugin = (
  request: HttpRequestOptions,
  next: NextFn,
) => Promise<unknown>;

/**
 * Nests plugins outer-to-inner around a terminal handler. Used internally by `HttpClient.use()` —
 * *most callers won't need to call this directly.*
 *
 * @example
 * ```ts
 * const run = compose([logPlugin, retryPlugin()], sendRequest);
 * await run({ path: "/query", body: "LIST GRAPH" });
 * ```
 */
export const compose = (plugins: Plugin[], handler: NextFn): NextFn =>
  plugins.reduceRight<NextFn>(
    (next, plugin) => (request) => plugin(request, next),
    handler,
  );
