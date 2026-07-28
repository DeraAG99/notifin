"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TemplateForm } from "@/components/templates/template-form";

export default function NewTemplatePage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Buat Template Baru</h1>
          <p className="text-muted-foreground">Buat template notifikasi baru</p>
        </div>
      </div>

      <TemplateForm
        onSuccess={() => router.push("/templates")}
      />
    </div>
  );
}
