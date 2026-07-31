"use client";

import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme/provider";
import { useI18n } from "@/lib/i18n/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t.common.themeLight, icon: Sun },
    { value: "dark", label: t.common.themeDark, icon: Moon },
    { value: "system", label: t.common.themeSystem, icon: Monitor },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 h-8" />
        }
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="hidden sm:inline text-xs font-medium capitalize">
          {themeOptions.find((o) => o.value === theme)?.label ?? theme}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
            <option.icon className="h-4 w-4" />
            <span className={option.value === theme ? "font-bold" : ""}>
              {option.label}
            </span>
            {option.value === theme && <span className="ml-auto text-muted-foreground text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
