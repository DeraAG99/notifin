"use client";

import { ImportCategoriesManager } from "@/components/imports/import-categories-manager";
import { useI18n } from "@/lib/i18n/context";

export default function ImportCategoriesPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.importCategories.title}</h1>
        <p className="text-muted-foreground">{t.importCategories.description}</p>
      </div>
      <ImportCategoriesManager />
    </div>
  );
}
