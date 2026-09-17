"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, CheckCircle2, Compass, Eye, EyeOff, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthContext";
import { listPublicUniversities } from "@/lib/client/catalog-api";
import type { UniversitySummaryDto } from "@/lib/server/api/dtos";
import { Logo } from "@/components/ui/Logo";
import Link from 'next/link';

// Use learner theme for public login page
const loginTheme = {
  inputBorder: 'border-blue-200',
  inputFocusBorder: 'focus:border-blue-400',
  inputFocusRing: 'focus:ring-2 focus:ring-blue-100',
  primaryBg: 'bg-blue-600',
  primaryHover: 'hover:bg-blue-700',
  accentBg: 'bg-blue-50',
  accentText: 'text-blue-600',
};

const featureBullets = [
  { icon: Compass, text: "Organized Roadmaps" },
  { icon: Sparkles, text: "Quality Resources" },
  { icon: TrendingUp, text: "Track Progress" },
  { icon: BookMarked, text: "Smart Bookmarks" },
];

type Mode = "login" | "signup";
type SignupRole = "learner" | "contributor";

export default function LoginPage() {
  const { user, isLoading, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Shown after a successful sign-up instead of the form: the account is
  // "pending" and cannot log in yet, so there is nothing to redirect to.
  const [pendingApprovalName, setPendingApprovalName] = useState<string | null>(null);

  // Login fields
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("learner");
  const [universityId, setUniversityId] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");

  const [universities, setUniversities] = useState<UniversitySummaryDto[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState(false);
  const [universitiesError, setUniversitiesError] = useState("");

  // Already logged in? Skip straight to the dashboard.
  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [isLoading, user, router]);

  // Load the university picker whenever someone switches to Sign up.
  //
  // Deliberately depends only on `mode` — NOT on `universitiesLoading` or
  // `universities.length`. Including loading/result state here would make the effect
  // re-fire the instant it calls setUniversitiesLoading(true), whose cleanup would then
  // abort the very request it just started (permanently stuck "Loading..." with no error).
  //
  // The `ignore` flag (not the AbortController's `aborted` flag) is what gates state
  // updates. This is the React-recommended pattern specifically because Next.js's App
  // Router runs in Strict Mode in dev, which double-invokes every effect once
  // (mount -> cleanup -> mount) to surface exactly this class of bug. A ref-based
  // "only fetch once" guard would break under that double-invoke too: the first
  // (throwaway) invocation would mark the ref done and abort its request, and the
  // guard would then block the second, real invocation from ever retrying. Using a
  // fresh `ignore` closure per effect run means the throwaway first run's aborted
  // fetch is simply ignored, while the second run's fetch proceeds and completes.
  useEffect(() => {
    if (mode !== "signup") return;

    let ignore = false;
    const controller = new AbortController();

    listPublicUniversities(controller.signal)
      .then((data) => {
        if (ignore) return;
        setUniversities(data);
        setUniversityId((current) => current || data[0]?.id || "");
      })
      .catch(() => {
        if (!ignore) setUniversitiesError("Couldn't load the university list. Refresh and try again.");
      })
      .finally(() => {
        if (!ignore) setUniversitiesLoading(false);
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [mode]);

  function switchMode(next: Mode) {
    if (next === "signup") { setUniversitiesLoading(true); setUniversitiesError(""); }
    setMode(next);
    setError("");
    setFieldErrors({});
    setPendingApprovalName(null);
  }

  function fieldError(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setFieldErrors({});
    const result = await login(identifier, loginPassword);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.push("/dashboard");
  }

  async function handleSignupSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!universityId) {
      setError("Select your university before creating an account.");
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      name,
      email,
      username,
      password: signupPassword,
      role,
      universityId,
      ...(role === "learner" && yearOfStudy ? { yearOfStudy: Number(yearOfStudy) } : {}),
    });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    // No session was created — the account is pending admin approval.
    // Show a confirmation instead of redirecting to the dashboard.
    setPendingApprovalName(name);
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

          {mode === "signup" && pendingApprovalName ? (
            <div className="text-center">
              <div className={cn("mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full", loginTheme.accentBg, loginTheme.accentText)}>
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Account created</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Thanks, {pendingApprovalName}. Your account is waiting for an admin to review and
                approve it — you won&apos;t be able to log in until then. Check back soon.
              </p>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={cn("mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors", loginTheme.primaryBg, loginTheme.primaryHover)}
              >
                Back to Login
              </button>
            </div>
          ) : mode === "login" ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Welcome Back!</h2>
              <p className="mb-6 text-sm text-slate-500">Login to continue to CourseDekho</p>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="identifier" className="mb-1 block text-sm font-medium text-slate-700">
                    Username or Email
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter username or email"
                    className={cn("w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className={cn("w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm focus:outline-none", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
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
                    <Link href="/forgot-password" className={cn("text-xs font-medium underline", loginTheme.accentText)}>Forgot password?</Link>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn("w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-wait disabled:opacity-60", loginTheme.primaryBg, loginTheme.primaryHover)}
                >
                  {isSubmitting ? "Signing in..." : "Login"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={cn("font-medium hover:underline", loginTheme.accentText)}
                >
                  Sign up
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
              <p className="mb-6 text-sm text-slate-500">
                Join CourseDekho as a learner or contributor. An admin reviews every new account
                before it can log in.
              </p>

              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    maxLength={120}
                    className={cn("w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
                  />
                  {fieldError("name") && <p className="mt-1 text-xs text-rose-600">{fieldError("name")}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    maxLength={254}
                    className={cn("w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
                  />
                  {fieldError("email") && <p className="mt-1 text-xs text-rose-600">{fieldError("email")}</p>}
                </div>

                <div>
                  <label htmlFor="signup-username" className="mb-1 block text-sm font-medium text-slate-700">
                    Username
                  </label>
                  <input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="lowercase letters, numbers, underscore"
                    maxLength={32}
                    className={cn("w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
                  />
                  {fieldError("username") && (
                    <p className="mt-1 text-xs text-rose-600">{fieldError("username")}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      maxLength={128}
                      className={cn("w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm focus:outline-none", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
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
                  {fieldError("password") && (
                    <p className="mt-1 text-xs text-rose-600">{fieldError("password")}</p>
                  )}
                </div>

                <div>
                  <span className="mb-1 block text-sm font-medium text-slate-700">I am a</span>
                  <div className="grid grid-cols-2 gap-3">
                    {(["learner", "contributor"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setRole(option)}
                        className={cn(`rounded-lg border px-3.5 py-2.5 text-sm font-medium capitalize transition-colors`, role === option ? cn(loginTheme.inputFocusBorder, loginTheme.accentBg, loginTheme.accentText) : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="university" className="mb-1 block text-sm font-medium text-slate-700">
                    University
                  </label>
                  <select
                    id="university"
                    value={universityId}
                    onChange={(e) => setUniversityId(e.target.value)}
                    disabled={universitiesLoading || universities.length === 0}
                    className={cn("w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
                  >
                    {universitiesLoading && <option>Loading universities...</option>}
                    {!universitiesLoading && universities.length === 0 && (
                      <option>No universities available</option>
                    )}
                    {universities.map((university) => (
                      <option key={university.id} value={university.id}>
                        {university.name}
                      </option>
                    ))}
                  </select>
                  {universitiesError && (
                    <p className="mt-1 text-xs text-rose-600">{universitiesError}</p>
                  )}
                  {fieldError("universityId") && (
                    <p className="mt-1 text-xs text-rose-600">{fieldError("universityId")}</p>
                  )}
                </div>

                {role === "learner" && (
                  <div>
                    <label htmlFor="year-of-study" className="mb-1 block text-sm font-medium text-slate-700">
                      Year of study{" "}
                      <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="year-of-study"
                      type="number"
                      min={1}
                      max={6}
                      value={yearOfStudy}
                      onChange={(e) => setYearOfStudy(e.target.value)}
                      placeholder="1–6"
                      className={cn("w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none", loginTheme.inputBorder, loginTheme.inputFocusBorder, loginTheme.inputFocusRing)}
                    />
                    {fieldError("yearOfStudy") && (
                      <p className="mt-1 text-xs text-rose-600">{fieldError("yearOfStudy")}</p>
                    )}
                  </div>
                )}

                {error && (
                  <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || universitiesLoading || universities.length === 0}
                  className={cn("w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60", loginTheme.primaryBg, loginTheme.primaryHover)}
                >
                  {isSubmitting ? "Creating account..." : "Sign up"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={cn("font-medium hover:underline", loginTheme.accentText)}
                >
                  Login
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
