"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

export function useDatabaseData<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  initialValue: T
) {
  const loaderRef = useRef(loader);
  const refreshRef = useRef<() => void>(() => undefined);
  const [state, setState] = useState({ key, data: initialValue, isLoading: true, error: null as string | null });
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    loaderRef.current = loader;
    initialValueRef.current = initialValue;
  }, [loader, initialValue]);

  const setData = useCallback((update: SetStateAction<T>) => {
    setState(current => {
      if (current.key !== key) return current;
      const data = typeof update === 'function' ? (update as (previous: T) => T)(current.data) : update;
      return { ...current, data };
    });
  }, [key]);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function load() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      try {
        const value = await loaderRef.current(requestController.signal);
        if (active && !requestController.signal.aborted) {
          setState({ key, data: value, error: null, isLoading: false });
        }
      } catch (requestError) {
        if (active && !requestController.signal.aborted) {
          setState(current => ({
            key,
            data: current.key === key ? current.data : initialValueRef.current,
            isLoading: false,
            error: requestError instanceof Error ? requestError.message : "Unable to load database data.",
          }));
        }
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
  return {
    data: state.key === key ? state.data : initialValue,
    setData,
    isLoading: state.key !== key || state.isLoading,
    error: state.key === key ? state.error : null,
    refresh,
  };
}
