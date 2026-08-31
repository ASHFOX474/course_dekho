"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import type { AppUser, UserRole } from "@/lib/types";

interface UserResponse {
  data: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: UserRole;
  };
}

interface ErrorResponse {
  error?: {
    message?: string;
  };
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function toAppUser(response: UserResponse): AppUser {
  return {
    ...response.data,
    avatarInitials: avatarInitials(response.data.name),
  };
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ErrorResponse;
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function restoreSession() {
      try {
        const response = await fetch("/api/v1/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (response.ok) {
          setUser(toAppUser((await response.json()) as UserResponse));
        } else if (response.status === 401) {
          setUser(null);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setUser(null);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, []);

  async function login(identifier: string, password: string): Promise<AuthResult> {
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: await readError(response, "Unable to sign in."),
        };
      }

      setUser(toAppUser((await response.json()) as UserResponse));
      return { success: true };
    } catch {
      return { success: false, error: "Unable to reach the authentication service." };
    }
  }

  async function logout(): Promise<void> {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be called from inside <AuthProvider>.");
  }
  return context;
}
