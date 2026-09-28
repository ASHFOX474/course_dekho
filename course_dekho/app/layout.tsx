import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "CourseDekho — Your Complete Learning Companion",
  description: "Centralized course & resource platform for CSE students in Bangladesh.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = (await cookies()).get("course_dekho_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" className="h-full antialiased" data-theme={theme} suppressHydrationWarning>
      <body className="h-full bg-slate-50 text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
