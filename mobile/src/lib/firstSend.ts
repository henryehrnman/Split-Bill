export type FirstSend<Result> = (operation: () => Promise<Result | null>) => Promise<Result | null>;
type Options<Result> = {canSend: () => boolean; sendDefault: () => Promise<Result | null>};

// A null result from Store.run may mean failure, busy, or an invalidated account.
// Only a successful result completes the send; retries happen on a later leave.
export function createFirstSendController<Result>(options: Options<Result>) {
  let pending = false;
  let completed = false;
  let away = false;

  async function attemptDefault(): Promise<Result | null> {
    if (!away || pending || completed || !options.canSend()) return null;
    pending = true;
    try {
      const result = await options.sendDefault();
      if (result !== null) completed = true;
      return result;
    } catch {
      // Store.run reports errors. Cleanup must not leave an unhandled rejection.
      return null;
    } finally {
      pending = false;
    }
  }

  const manual: FirstSend<Result> = async operation => {
    if (pending) return null;
    pending = true;
    try {
      const result = await operation();
      if (result !== null) completed = true;
      return result;
    } finally {
      pending = false;
      // If leaving interrupted a failed manual send, try the idempotent default
      // once. A failed default stays retryable without a recursive retry loop.
      await attemptDefault();
    }
  };

  return {
    manual,
    update(next: Options<Result>) {
      options = next;
    },
    leave() {
      away = true;
      return attemptDefault();
    },
    returnToScreen() {
      away = false;
    },
  };
}
