import type {Db} from './domain.ts';
import type {UserId} from './split.ts';

export type RpcState = {db: Db; viewerId: UserId};

export class RpcError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = 'RpcError';
    this.status = status;
    this.code = code;
  }
}

type Options = {
  url: string;
  publishableKey?: string;
  getToken: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalidResponse = (status: number) =>
  new RpcError('The server returned an invalid response. Try again.', status, 'invalid_response');

// The server derives the actor from the token. Only the method's remaining arguments go over the wire.
export function createRpcClient(options: Options) {
  const send = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 15000;

  async function request<T>(method: string, args: unknown[] = []): Promise<T> {
    const controller = new AbortController();
    const timeoutError = new RpcError('The request timed out. Refresh to check whether it finished before trying again.', 0, 'timeout');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(timeoutError);
        controller.abort();
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        deadline,
        (async () => {
          const token = (await options.getToken())?.trim();
          if (controller.signal.aborted) throw timeoutError;
          if (!token) throw new RpcError('Your session has expired. Sign in again.', 401, 'session_expired');

          const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          };
          if (options.publishableKey) headers.apikey = options.publishableKey;
          const response = await send(options.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({method, args}),
            signal: controller.signal,
          });
          const raw = await response.text();
          let payload: unknown;
          try {
            payload = JSON.parse(raw);
          } catch {
            if (response.ok) throw invalidResponse(response.status);
          }
          if (!response.ok) {
            const code = record(payload) && typeof payload.code === 'string' ? payload.code : undefined;
            const message = response.status === 401
              ? 'Your session has expired. Sign in again.'
              : record(payload) && typeof payload.error === 'string' && payload.error.trim()
                ? payload.error
                : `The server could not complete the request (${response.status}). Try again.`;
            throw new RpcError(message, response.status, code);
          }
          return payload as T;
        })(),
      ]);
    } catch (error) {
      if (error instanceof RpcError) throw error;
      if (controller.signal.aborted) throw timeoutError;
      throw new RpcError('Could not connect to Split Bill. Check your connection and try again.', 0, 'network_error');
    } finally {
      clearTimeout(timer);
    }
  }

  async function state(method: string, args: unknown[] = []): Promise<RpcState> {
    const value = await request<unknown>(method, args);
    if (!record(value) || typeof value.viewerId !== 'string' || !record(value.db)) throw invalidResponse(200);
    const db = value.db;
    const lists = ['users', 'groups', 'cards', 'charges', 'budgetProposals', 'ledger', 'notifications'];
    if (!lists.every(key => Array.isArray(db[key])) || !Number.isSafeInteger(db.version)
      || !Number.isSafeInteger(db.seq) || !Number.isFinite(db.clockOffset)
      || !(db.users as unknown[]).some(user => record(user) && user.id === value.viewerId)) {
      throw invalidResponse(200);
    }
    return value as RpcState;
  }

  return {request, state};
}
