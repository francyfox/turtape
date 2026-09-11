export interface TurtapeErrorOptions {
  /** The provider's own error code, when it has one (e.g. TuringDB's `"PARSE_ERROR"`). */
  code?: string;
  /** Extra human-readable detail beyond `message`, when the provider sends one. */
  details?: string;
  /** The underlying error this one wraps, if any. Passed through to `Error.cause`. */
  cause?: unknown;
}

/**
 * The **one error type** every `@turtape/sdk` call can throw — covers both transport failures
 * (network, non-2xx HTTP) and provider-level query errors.
 *
 * @example
 * ```ts
 * try {
 *   await sdk.queryRaw("MATCH (n) RETURN n");
 * } catch (error) {
 *   if (error instanceof TurtapeError) console.error(error.code, error.message);
 * }
 * ```
 */
export class TurtapeError extends Error {
  readonly code?: string;

  constructor(message: string, options: TurtapeErrorOptions = {}) {
    super(`${message}\n${options.details}`, { cause: options.cause });
    this.name = "TurtapeError";
  }
}
