"use client";
import { createContext, useContext } from "react";

type CountsRefresher = () => void;

const CountsRefreshContext = createContext<CountsRefresher>(() => {});

export function CountsRefreshProvider({
  refresh,
  children,
}: {
  refresh: CountsRefresher;
  children: React.ReactNode;
}) {
  return <CountsRefreshContext.Provider value={refresh}>{children}</CountsRefreshContext.Provider>;
}

/** Call this after any action that changes the sidebar badge numbers
 *  (marking a notification read, deleting/completing a task, etc.) so the
 *  count updates immediately instead of waiting for the next navigation. */
export function useRefreshCounts() {
  return useContext(CountsRefreshContext);
}
