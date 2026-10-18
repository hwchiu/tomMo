"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getRev, subscribe } from "@/api/live";

export interface QueryState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

export function useLiveQuery<T>(key: string, factory: () => Promise<T>): QueryState<T> {
  const rev = useSyncExternalStore(subscribe, getRev, getRev);
  const factoryRef = useRef(factory);
  const keyRef = useRef(key);
  useEffect(() => {
    factoryRef.current = factory;
  });
  const [state, setState] = useState<QueryState<T>>({ loading: true, error: null, data: null });

  useEffect(() => {
    let alive = true;
    const keyChanged = keyRef.current !== key;
    keyRef.current = key;
    setState((prev) => (keyChanged ? { loading: true, error: null, data: null } : { ...prev, loading: true, error: null }));
    factoryRef.current()
      .then((data) => {
        if (alive) setState({ loading: false, error: null, data });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        const message = error instanceof Error ? error.message : "讀取失敗";
        setState((prev) => ({ loading: false, error: message, data: keyChanged ? null : prev.data }));
      });
    return () => {
      alive = false;
    };
  }, [rev, key]);

  return state;
}
