import { useCallback, useEffect, useState } from 'react';

type State<T> = { data: T | undefined; error: string | null; loading: boolean };
const cache = new Map<string, unknown>();

/** Fetch once per key, keep the result for the visit, refetch on demand. */
export function useData<T>(key: string, fetcher: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({
    data: cache.get(key) as T | undefined,
    error: null,
    loading: !cache.has(key),
  });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      cache.set(key, data);
      setState({ data, error: null, loading: false });
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : String(e),
        loading: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!cache.has(key)) load();
  }, [key, load]);
  return { ...state, reload: load };
}

export function invalidate(prefix: string) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
