"use client";

/**
 * lib/auth/AuthContext.tsx
 * ------------------------------------------------------------------
 * A small, hand-rolled authentication context.
 *
 * There's no real backend session here — this is a FRONTEND-ONLY demo,
 * so "logging in" just checks the username/password against the demo
 * accounts in lib/data/users.ts and remembers the logged-in user's id
 * in localStorage (so refreshing the page doesn't log you out).
 *
 * When the real Postgres + auth backend exists, only the `login`
 * function's body needs to change (call your login API instead of
 * `findUserByCredentials`) — every component that uses `useAuth()`
 * stays exactly the same.
 * ------------------------------------------------------------------
 */
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { findUserByCredentials, getUserById } from "@/lib/data/users";
import { AppUser } from "@/lib/types";

const STORAGE_KEY = "coursedekho_logged_in_user_id";

interface AuthContextValue {
  /** The currently logged-in user, or null if nobody is logged in. */
  user: AppUser | null;
  /** True until we've finished checking localStorage for a saved session. */
  isLoading: boolean;
  /** Attempts to log in. Returns { success: false, error } on failure. */
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On first mount (browser only), restore the previous session if there is one.
  useEffect(() => {
    try {
      const savedUserId = window.localStorage.getItem(STORAGE_KEY);
      if (savedUserId) {
        const savedUser = getUserById(savedUserId);
        if (savedUser) setUser(savedUser);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  function login(username: string, password: string) {
    const matchedUser = findUserByCredentials(username, password);

    if (!matchedUser) {
      return { success: false, error: "Incorrect username or password." };
    }

    setUser(matchedUser);
    window.localStorage.setItem(STORAGE_KEY, matchedUser.id);
    return { success: true };
  }

  function logout() {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook for reading auth state / calling login() & logout() from any component. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be called from inside <AuthProvider>.");
  }
  return context;
}
