/**
 * Error raised for any TuringDB-level failure: transport errors, non-2xx HTTP
 * responses, malformed server payloads, and server-reported query errors.
 *
 * Mirrors the Python SDK's `TuringDBException`.
 */
export class TuringDBException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TuringDBException";
    // Restore the prototype chain for instanceof checks when compiled to ES5/CJS.
    Object.setPrototypeOf(this, TuringDBException.prototype);
  }
}
