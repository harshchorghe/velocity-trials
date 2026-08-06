/** Error carrying an HTTP status and a stable machine-readable code. */
export class GameError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'GameError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new GameError(400, code, message, details);

export const unauthorized = (message = 'Missing or invalid session token') =>
  new GameError(401, 'UNAUTHORIZED', message);

export const forbidden = (code: string, message: string) => new GameError(403, code, message);

export const notFound = (code: string, message: string) => new GameError(404, code, message);

export const conflict = (code: string, message: string) => new GameError(409, code, message);
