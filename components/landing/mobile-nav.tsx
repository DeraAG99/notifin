"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  const linkClass =
    "text-nf-on-surface-variant font-semibold text-lg py-3 border-b border-white/5 hover:text-nf-secondary transition-colors";

  return (
    <>
      <button
        className="md:hidden p-2 rounded-lg text-white/80 hover:bg-white/5 hover:text-white transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 nav-glass border-t border-white/5 px-6 py-6 flex flex-col z-50">
          <a
            href="#features"
            onClick={() => setOpen(false)}
            className={linkClass}
          >
            Features
          </a>
          <a
            href="#solutions"
            onClick={() => setOpen(false)}
            className={linkClass}
          >
            Solutions
          </a>
          <div className="flex flex-col gap-3 pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-nf-on-surface font-semibold text-base text-center py-3 hover:text-nf-primary transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="brand-gradient btn-shine text-white px-6 py-3.5 rounded-xl font-bold text-base text-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
