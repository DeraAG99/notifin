"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/layouts/language-switcher";
import { ThemeToggle } from "@/components/layouts/theme-toggle";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const linkClass =
    "text-nf-on-surface-variant font-semibold text-lg py-3 border-b border-nf-outline/20 hover:text-nf-secondary transition-colors";

  return (
    <>
      <button
        className="md:hidden p-2 rounded-lg text-nf-on-surface-variant hover:bg-black/5 dark:hover:bg-white/5 hover:text-nf-on-surface transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.landing.nav.toggleMenu}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 nav-glass border-t border-nf-outline/20 px-6 py-6 flex flex-col z-50">
          <a
            href="#features"
            onClick={() => setOpen(false)}
            className={linkClass}
          >
            {t.landing.nav.features}
          </a>
          <a
            href="#solutions"
            onClick={() => setOpen(false)}
            className={linkClass}
          >
            {t.landing.nav.solutions}
          </a>
          <div className="flex items-center justify-center gap-2 pt-5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-nf-on-surface font-semibold text-base text-center py-3 hover:text-nf-primary transition-colors"
            >
              {t.landing.nav.logIn}
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="brand-gradient btn-shine text-white px-6 py-3.5 rounded-xl font-bold text-base text-center"
            >
              {t.landing.nav.getStarted}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
