"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/context";

interface ImportVariablesPickerProps {
  onInsert: (variable: string) => void;
}

export function ImportVariablesPicker({ onInsert }: ImportVariablesPickerProps) {
  const { t, tx } = useI18n();
  const [importKeys, setImportKeys] = useState<
    { key: string; name: string; rowFields: string[] }[]
  >([]);

  useEffect(() => {
    fetch("/api/imports/variable-keys")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setImportKeys(data.data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <Label className="text-xs">{t.templates.form.importVars}</Label>
      {importKeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.templates.form.importVarsEmpty}</p>
      ) : (
        <div className="space-y-2">
          {importKeys.map((k) => (
            <div key={k.key} className="space-y-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="font-mono font-medium">{k.key}</span>
                <span className="text-muted-foreground truncate">({k.name})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { v: "pendingCount", l: t.templates.form.importField.pendingCount },
                  { v: "pendingList", l: t.templates.form.importField.pendingList },
                  { v: "currentTw", l: t.templates.form.importField.currentTw },
                  { v: "currentTwList", l: t.templates.form.importField.currentTwList },
                  { v: "currentTwCount", l: t.templates.form.importField.currentTwCount },
                  { v: "summary.itemCount", l: t.templates.form.importField.itemCount },
                  ...[1, 2, 3, 4].map((tw) => ({
                    v: `summary.pendingPerTriwulan.${tw}`,
                    l: tx("templates.form.pendingTw", { tw }),
                  })),
                  { v: "fileName", l: t.templates.form.importField.fileName },
                  { v: "period", l: t.templates.form.importField.period },
                ].map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    className="h-6 text-[11px] px-2 rounded-md border text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                    onClick={() => onInsert(`imports.${k.key}.${f.v}`)}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
              {k.rowFields.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] text-muted-foreground">
                    {t.templates.form.importRowFields}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {k.rowFields.map((field) => (
                      <button
                        key={field}
                        type="button"
                        className="h-6 text-[11px] px-2 rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-foreground transition-colors font-mono"
                        onClick={() => onInsert(`{{#each imports.${k.key}.rows}}\n{{${field}}}\n{{/each}}`)}
                        title={`{{#each imports.${k.key}.rows}} ... {{${field}}} ... {{/each}}`}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
