"use client";

import { useTheme } from "@/lib/theme/provider";

interface NotifinLogoProps {
  className?: string;
}

export function NotifinLogo({ className = "" }: NotifinLogoProps) {
  const { resolvedTheme } = useTheme();
  const src =
    resolvedTheme === "dark" ? "/notifin-logo.svg" : "/notifin-logo-dark.svg";

  return (
    <img
      src={src}
      alt="NOTIFIN"
      width={800}
      height={218}
      className={className}
    />
  );
}
