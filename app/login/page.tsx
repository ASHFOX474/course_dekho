"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, Compass, Eye, EyeOff, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { demoAccounts } from "@/lib/data/users";
import { Logo } from "@/components/ui/Logo";

const featureBullets = [
  { icon: Compass, text: "Organized Roadmaps" },
  { icon: Sparkles, text: "Quality Resources" },
  { icon: TrendingUp, text: "Track Progress" },
  { icon: BookMarked, text: "Smart Bookmarks" },
];

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already logged in? Skip straight to the dashboard.
  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [isLoading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    const result = await login(username, password);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard");
  }

  async function handleDemoLogin(demoUsername: string, demoPassword: string) {
    setUsername(demoUsername);
    setPassword(demoPassword);
    setError("");
    setIsSubmitting(true);
    const result = await login(demoUsername, demoPassword);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel — hidden on small screens */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#191238] p-10 text-white lg:flex">
        <Logo variant="dark" />

        <div>
          <h1 className="mb-3 text-3xl font-bold leading-tight">
            Your Complete
            <br />
            Learning Companion
          </h1>
          <p className="mb-8 max-w-sm text-sm text-white/60">
            For CSE students in Bangladesh — every roadmap, resource and past question, organized in one place.
          </p>
          <ul className="space-y-3">
            {featureBullets.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/30">© {new Date().getFullYear()} CourseDekho</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center bg-white p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Welcome Back!</h2>
          <p className="mb-6 text-sm text-slate-500">Login to continue to CourseDekho</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
                Username or Email
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username or email"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 pr-10 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-1 text-right">
                <span className="text-xs font-medium text-violet-600">Forgot Password?</span>
              </div>
            </div>

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            or continue with
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              title="Not wired up in this demo — use the form above"
              className="cursor-not-allowed rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-400"
            >
              Google
            </button>
            <button
              type="button"
              disabled
              title="Not wired up in this demo — use the form above"
              className="cursor-not-allowed rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-400"
            >
              Microsoft
            </button>
          </div>

          {/* Quick demo-login shortcuts — handy for your presentation */}
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick demo login</p>
            <div className="flex flex-wrap gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleDemoLogin(account.username, account.password)}
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <span className="font-medium text-violet-600" title="Registration isn't wired up in this demo">
              Sign up
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
