export interface TurtapeErrorOptions {
  code?: string;
  details?: string;
  cause?: unknown;
}

export class TurtapeError extends Error {
  readonly code?: string;
  readonly details?: string;

  constructor(message: string, options: TurtapeErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "TurtapeError";
    this.code = options.code;
    this.details = options.details;
  }
}
