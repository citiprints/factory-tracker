"use client";
import { createContext, useContext } from "react";
import type { SafeUser } from "@/lib/session";

const UserContext = createContext<SafeUser | null>(null);

// The user is already resolved server-side once, in layout.tsx.
// Pages read it from here instead of each firing their own
// `/api/auth/me` fetch on mount -- that pattern was previously
// duplicated across 8 different pages, each adding an extra network
// round-trip (and a loading flash) before the page's real data could
// even start loading.
export function UserProvider({
  user,
  children,
}: {
  user: SafeUser | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
