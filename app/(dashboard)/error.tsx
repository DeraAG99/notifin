"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">{t.error.title}</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>{t.common.tryAgain}</Button>
    </div>
  );
}
