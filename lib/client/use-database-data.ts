"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useDatabaseData<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  initialValue: T
) {
  const loaderRef = useRef(loader);
  const refreshRef = useRef<() => void>(() => undefined);
  const [data, setData] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const value = await loaderRef.current(controller.signal);
        if (active) {
          setData(value);
          setError(null);
        }
      } catch (requestError) {
        if (active && !controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load database data.");
        }
      } finally {
        if (active && !controller.signal.aborted) setIsLoading(false);
      }
    }

    refreshRef.current = () => void load();
    void load();
    const interval = window.setInterval(load, 15_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      refreshRef.current = () => undefined;
    };
  }, [key]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { data, setData, isLoading, error, refresh };
}
