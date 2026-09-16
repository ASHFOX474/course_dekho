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
    fieldErrors?: Record<string, string[]>;
  };
}

interface AuthResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// register() never signs anyone in: learner/contributor accounts start
// "pending" and cannot log in until an admin approves them. `pending: true`
// on success tells the sign-up form to show a confirmation message instead
// of redirecting to the dashboard.
interface RegisterResult {
  success: boolean;
  pending?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface RegisterInput {
  name: string;
  email: string;
  username: string;
  password: string;
  role: "learner" | "contributor";
  universityId: string;
  department?: string;
  yearOfStudy?: number;
}

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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

async function readError(
  response: Response,
  fallback: string
): Promise<{ message: string; fieldErrors?: Record<string, string[]> }> {
  try {
    const body = (await response.json()) as ErrorResponse;
    return {
      message: body.error?.message || fallback,
      fieldErrors: body.error?.fieldErrors,
    };
  } catch {
    return { message: fallback };
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
        // Covers wrong credentials as well as ACCOUNT_PENDING_APPROVAL /
        // ACCOUNT_REJECTED (403s with a specific message) from the server.
        const { message, fieldErrors } = await readError(response, "Unable to sign in.");
        return { success: false, error: message, fieldErrors };
      }

      setUser(toAppUser((await response.json()) as UserResponse));
      return { success: true };
    } catch {
      return { success: false, error: "Unable to reach the authentication service." };
    }
  }

  // Does NOT call setUser() on success: the server never sets a session
  // cookie for this request, since a new learner/contributor account is
  // always "pending" until an admin approves it.
  async function register(input: RegisterInput): Promise<RegisterResult> {
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const { message, fieldErrors } = await readError(response, "Unable to create your account.");
        return { success: false, error: message, fieldErrors };
      }

      return { success: true, pending: true };
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

  async function refreshUser(): Promise<void> {
    const response = await fetch('/api/v1/session', { cache: 'no-store', credentials: 'same-origin' });
    if (response.ok) setUser(toAppUser(await response.json() as UserResponse));
    else if (response.status === 401) setUser(null);
    else throw new Error('Unable to refresh your account.');
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
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
