import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { cookies } from "next/headers";
import { authService } from '@/lib/server/auth/runtime';
import { workspaceService } from '@/lib/server/workspace/runtime';
import { loadWorkspaceSession } from '@/lib/server/auth/workspace-session';
import { SESSION_COOKIE_NAME } from '@/lib/server/auth/session';

export const metadata: Metadata = {
  title: "CourseDekho — Your Complete Learning Companion",
  description: "Centralized course & resource platform for CSE students in Bangladesh.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await loadWorkspaceSession((await cookies()).get(SESSION_COOKIE_NAME)?.value, authService, workspaceService);
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-slate-50 text-slate-900">
        <AuthProvider initialUser={session.user} initialTheme={session.theme}>{children}</AuthProvider>
      </body>
    </html>
  );
}
