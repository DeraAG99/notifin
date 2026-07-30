"use client";

import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeLabels: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

const localeFlags: Record<Locale, string> = {
  en: "EN",
  id: "ID",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5 h-8" />}>
        <Globe className="h-4 w-4" />
        <span className="text-xs font-medium">{localeFlags[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(localeLabels) as Locale[]).map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLocale(l)}>
            <span className={l === locale ? "font-bold" : ""}>
              {localeLabels[l]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
