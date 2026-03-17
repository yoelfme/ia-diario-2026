export class HttpError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.message === 'string' ? payload.message : 'Request failed');
    this.status = status;
    this.payload = payload;
  }
}

