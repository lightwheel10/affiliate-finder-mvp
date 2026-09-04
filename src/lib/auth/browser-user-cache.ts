export function buildBrowserUserCacheKey(
  authUserId: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const normalizedId = authUserId?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedId || !normalizedEmail) return null;
  return `${normalizedId}:${normalizedEmail}`;
}

/**
 * One browser-wide cache shared by all useSupabaseUser hook instances.
 * A generation check prevents a late response for a previous login from being
 * published after logout, account switching, or a confirmed email change.
 */
export class IdentityBoundAsyncCache<T> {
  private key: string | null = null;
  private value: T | null = null;
  private generation = 0;
  private inFlight: { key: string; promise: Promise<T | null> } | null = null;

  select(key: string): { changed: boolean; value: T | null } {
    if (this.key === key) return { changed: false, value: this.value };
    this.key = key;
    this.value = null;
    this.inFlight = null;
    this.generation += 1;
    return { changed: true, value: null };
  }

  isCurrent(key: string): boolean {
    return this.key === key;
  }

  clear(): void {
    this.key = null;
    this.value = null;
    this.inFlight = null;
    this.generation += 1;
  }

  set(key: string, value: T): boolean {
    if (!this.isCurrent(key)) return false;
    this.value = value;
    return true;
  }

  async load(
    key: string,
    loader: () => Promise<T>,
    options: { force?: boolean; onCommit?: (value: T) => void } = {},
  ): Promise<T | null> {
    const selected = this.select(key);
    if (!options.force && selected.value !== null) return selected.value;
    if (this.inFlight?.key === key) return this.inFlight.promise;

    const generation = this.generation;
    const request = (async () => {
      const loaded = await loader();
      if (this.key !== key || this.generation !== generation) return null;
      this.value = loaded;
      options.onCommit?.(loaded);
      return loaded;
    })();
    this.inFlight = { key, promise: request };
    void request.then(
      () => {
        if (this.inFlight?.promise === request) this.inFlight = null;
      },
      () => {
        if (this.inFlight?.promise === request) this.inFlight = null;
      },
    );
    return request;
  }
}
