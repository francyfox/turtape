export interface HttpRequestOptions {
  path: string;
  method?: string;
  body?: RequestInit["body"];
  headers?: Record<string, string>;
  /** Query params; `undefined` values are omitted, not sent as `"undefined"`. */
  params?: Record<string, string | undefined>;
}

/** Terminal handler a plugin chain bottoms out at, or the next plugin up the chain. */
export type NextFn = (request: HttpRequestOptions) => Promise<unknown>;

/**
 * Angular `HttpInterceptor`-style hook, minus the DI: a plain function that
 * can inspect/rewrite the outgoing request, call `next` to continue the
 * chain, and inspect/rewrite (or catch) the result before returning it.
 * `compose()` nests them outer-to-inner around a terminal handler. Nothing
 * is attached by default -- a caller opts into a plugin with `.use()`, so
 * one that's never imported never ends up in the bundle.
 */
export type Plugin = (
  request: HttpRequestOptions,
  next: NextFn,
) => Promise<unknown>;

export const compose = (plugins: Plugin[], handler: NextFn): NextFn =>
  plugins.reduceRight<NextFn>(
    (next, plugin) => (request) => plugin(request, next),
    handler,
  );
