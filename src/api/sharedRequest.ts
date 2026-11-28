const inFlight = new Map<string, Promise<unknown>>();

/**
 * Shares one pending request between callers using the same key, so remounts
 * and sibling components do not repeat or cancel it. The signal only detaches
 * the individual caller; the shared request itself is never aborted.
 */
export function sharedRequest<T>(
  key: string,
  request: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let shared = inFlight.get(key) as Promise<T> | undefined;
  if (!shared) {
    const created: Promise<T> = request().finally(() => {
      if (inFlight.get(key) === created) inFlight.delete(key);
    });
    inFlight.set(key, created);
    shared = created;
  }
  if (!signal) return shared;

  const pending = shared;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    pending
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
