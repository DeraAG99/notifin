"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await login(email, password);
    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error || "Login gagal");
    }
    setSubmitting(false);
  }

  return (
    <main className="login-reveal relative z-10 w-full max-w-[460px]">
      <div className="glass-panel rounded-3xl p-6 md:p-16 flex flex-col gap-6 shadow-2xl shadow-black/20 dark:shadow-black/50">
        {/* Logo Section */}
        <header className="flex flex-col items-center gap-4">
          <div className="w-40 hover:scale-105 transition-transform duration-500">
            <img
              src="/notifin-logo.svg"
              alt="NOTIFIN"
              className="nf-logo w-full h-auto rounded-lg"
            />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight hero-title-text">
              Welcome Back
            </h1>
            <p className="mt-1 text-base text-nf-on-surface-variant/80">
              Log in to manage your automated notifications
            </p>
          </div>
        </header>

        {/* Login Form */}
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          {/* Email Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="font-label text-sm text-nf-on-surface-variant ml-1"
            >
              Work Email
            </label>
            <div className="relative group">
              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-nf-outline group-focus-within:text-nf-secondary transition-colors pointer-events-none"
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                autoComplete="email"
                className="form-input w-full pl-12 pr-4 py-3.5 rounded-xl text-base text-nf-on-surface placeholder:text-nf-outline/40"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center ml-1">
              <label
                htmlFor="password"
                className="font-label text-sm text-nf-on-surface-variant"
              >
                Password
              </label>
              <a
                href="#"
                className="font-label text-sm text-nf-secondary hover:text-nf-primary transition-colors font-semibold"
              >
                Forgot?
              </a>
            </div>
            <div className="relative group">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-nf-outline group-focus-within:text-nf-secondary transition-colors pointer-events-none"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="form-input w-full pl-12 pr-12 py-3.5 rounded-xl text-base text-nf-on-surface placeholder:text-nf-outline/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-nf-outline hover:text-nf-on-surface transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center py-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer appearance-none size-5 border border-nf-outline/30 rounded-lg bg-black/5 dark:bg-white/5 checked:bg-nf-secondary checked:border-nf-secondary transition-all cursor-pointer"
                />
                <Check
                  size={16}
                  className="absolute text-nf-on-secondary-container opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                />
              </div>
              <span className="text-base text-nf-on-surface-variant/80 group-hover:text-nf-on-surface transition-colors">
                Keep me signed in
              </span>
            </label>
          </div>

          {/* CTA Button */}
          <button
            type="submit"
            disabled={submitting}
            className="brand-gradient btn-shine w-full py-4 rounded-xl font-bold text-2xl text-white flex items-center justify-center gap-2 mt-1 shadow-xl shadow-nf-primary-container/30 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{submitting ? "Signing in..." : "Sign In"}</span>
            <ArrowRight size={22} />
          </button>
        </form>

        {/* Footer Meta */}
        <footer className="text-center">
          <p className="text-base text-nf-on-surface-variant/70">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-nf-secondary font-bold hover:text-nf-primary transition-colors ml-1"
            >
              Get Started
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
