"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import en from "./en.json";
import id from "./id.json";

export type Locale = "en" | "id";

const translations: Record<Locale, typeof en> = { en, id };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: typeof en;
  /** Simple string interpolation: tx("key", { name: "Budi" }) */
  tx: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("id");
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && saved !== locale) {
      setLocaleState(saved);
    }
    hydrated.current = true;
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  const t = translations[locale];

  const tx = useCallback((key: string, params?: Record<string, string | number>): string => {
    const value = getNestedValue(translations[locale] as Record<string, unknown>, key);
    if (typeof value !== "string") return key;
    if (!params) return value;
    return Object.entries(params).reduce(
      (result, [k, v]) => result.replaceAll(`{${k}}`, String(v)),
      value
    );
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tx }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
