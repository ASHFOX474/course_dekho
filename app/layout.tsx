import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { DataProvider } from "@/lib/store/DataContext";

export const metadata: Metadata = {
  title: "CourseDekho — Your Complete Learning Companion",
  description: "Centralized course & resource platform for CSE students in Bangladesh.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-slate-50 text-slate-900">
        {/*
          Provider order matters: DataProvider reads the logged-in user
          from AuthProvider (to know who's creating a submission /
          bookmark), so AuthProvider must wrap it.
        */}
        <AuthProvider>
          <DataProvider>{children}</DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
