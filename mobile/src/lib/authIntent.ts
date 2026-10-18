type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// Supabase can retain an expired session when sign-out cannot refresh it.
// This separate device preference controls whether the app may restore it.
export function createAuthIntent(storage: Storage, key: string) {
  let blocked = true;
  let generation = 0;
  let writes: Promise<void> = Promise.resolve();
  const write = (operation: () => Promise<void>) => {
    const result = writes.then(operation);
    writes = result.catch(() => {});
    return result;
  };

  return {
    blocked: () => blocked,
    async restore() {
      const started = generation;
      const saved = await storage.getItem(key);
      if (started === generation) blocked = saved !== null;
    },
    markSignedOut() {
      blocked = true;
      generation++;
      return write(() => storage.setItem(key, '1'));
    },
    beginLogin() {
      blocked = true;
      return ++generation;
    },
    async completeLogin(attempt: number, hasSession: boolean) {
      if (!hasSession || attempt !== generation) return false;
      // Keep writes ordered: an older login must not erase a newer sign-out.
      await write(async () => { if (attempt === generation) await storage.removeItem(key); });
      if (attempt !== generation) return false;
      blocked = false;
      return true;
    },
  };
}
