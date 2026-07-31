"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Check } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Password confirmation doesn't match");
      return;
    }
    if (!terms) {
      setError("Please accept the Terms & Conditions to continue");
      return;
    }

    setSubmitting(true);
    const result = await register(name, email, password);
    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error || "Registration failed");
    }
    setSubmitting(false);
  }

  return (
    <main className="login-reveal relative z-10 w-full max-w-[460px]">
      <div className="glass-panel rounded-3xl p-6 md:p-16 flex flex-col gap-6 shadow-2xl shadow-black/50">
        {/* Logo Section */}
        <header className="flex flex-col items-center gap-4">
          <div className="w-40 hover:scale-105 transition-transform duration-500">
            <img
              src="/notifin-logo.svg"
              alt="NOTIFIN"
              className="w-full h-auto rounded-lg"
            />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight hero-title-text">
              Create Account
            </h1>
            <p className="mt-1 text-base text-nf-on-surface-variant/80">
              Start managing your automated notifications
            </p>
          </div>
        </header>

        {/* Register Form */}
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          {/* Full Name Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="name"
              className="font-label text-sm text-nf-on-surface-variant ml-1"
            >
              Full Name
            </label>
            <div className="relative group">
              <User
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-nf-outline group-focus-within:text-nf-secondary transition-colors pointer-events-none"
              />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
                className="form-input w-full pl-12 pr-4 py-3.5 rounded-xl text-base text-nf-on-surface placeholder:text-nf-outline/40"
              />
            </div>
          </div>

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
            <label
              htmlFor="password"
              className="font-label text-sm text-nf-on-surface-variant ml-1"
            >
              Password
            </label>
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
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                autoComplete="new-password"
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

          {/* Confirm Password Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirmPassword"
              className="font-label text-sm text-nf-on-surface-variant ml-1"
            >
              Confirm Password
            </label>
            <div className="relative group">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-nf-outline group-focus-within:text-nf-secondary transition-colors pointer-events-none"
              />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={6}
                autoComplete="new-password"
                className="form-input w-full pl-12 pr-4 py-3.5 rounded-xl text-base text-nf-on-surface placeholder:text-nf-outline/40"
              />
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-center py-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="peer appearance-none size-5 border border-white/10 rounded-lg bg-white/5 checked:bg-nf-secondary checked:border-nf-secondary transition-all cursor-pointer"
                />
                <Check
                  size={16}
                  className="absolute text-nf-bg opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                />
              </div>
              <span className="text-base text-nf-on-surface-variant/80 group-hover:text-nf-on-surface transition-colors">
                I agree to the{" "}
                <span className="text-nf-secondary font-semibold hover:text-nf-primary transition-colors">
                  Terms &amp; Conditions
                </span>
              </span>
            </label>
          </div>

          {/* CTA Button */}
          <button
            type="submit"
            disabled={submitting}
            className="brand-gradient btn-shine w-full py-4 rounded-xl font-bold text-2xl text-white flex items-center justify-center gap-2 mt-1 shadow-xl shadow-nf-primary-container/30 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{submitting ? "Creating..." : "Create Account"}</span>
            <ArrowRight size={22} />
          </button>
        </form>

        {/* Footer Meta */}
        <footer className="text-center">
          <p className="text-base text-nf-on-surface-variant/70">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-nf-secondary font-bold hover:text-nf-primary transition-colors ml-1"
            >
              Log In
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
