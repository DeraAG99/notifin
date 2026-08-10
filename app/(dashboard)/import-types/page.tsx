"use client";

import { ImportTypesManager } from "@/components/imports/import-types-manager";
import { useI18n } from "@/lib/i18n/context";

export default function ImportTypesPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.importTypes.title}</h1>
        <p className="text-muted-foreground">{t.importTypes.description}</p>
      </div>
      <ImportTypesManager />
    </div>
  );
}
