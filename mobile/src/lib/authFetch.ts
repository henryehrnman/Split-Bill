type Options = {fetch?: typeof fetch; timeoutMs?: number};

export class AuthTimeoutError extends Error {
  constructor() {
    super('Account access timed out. Check your connection and try again.');
    this.name = 'AuthTimeoutError';
  }
}

// Auth parses the body after fetch resolves. Buffer it within the same deadline so
// a late response cannot sign someone in after the UI has reported a timeout.
export function createAuthFetch({fetch: send = globalThis.fetch, timeoutMs = 15000}: Options = {}): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const upstream = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
    let cancellation: Error | null = null;
    let rejectInterrupted!: (error: Error) => void;
    const interrupted = new Promise<never>((_, reject) => { rejectInterrupted = reject; });
    const cancel = (error: Error) => {
      if (cancellation) return;
      cancellation = error;
      rejectInterrupted(error);
      controller.abort();
    };
    const abort = () => {
      const error = new Error('Account request cancelled. Please try again.');
      error.name = 'AbortError';
      cancel(error);
    };
    const check = () => { if (cancellation) throw cancellation; };
    upstream?.addEventListener('abort', abort, {once: true});
    if (upstream?.aborted) abort();
    const timer = setTimeout(() => cancel(new AuthTimeoutError()), timeoutMs);
    try {
      return await Promise.race([
        interrupted,
        (async () => {
          check();
          const response = await send(input, {...init, signal: controller.signal});
          check();
          const body = await response.text();
          check();
          return new Response([204, 205, 304].includes(response.status) ? null : body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        })(),
      ]);
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', abort);
    }
  };
}
