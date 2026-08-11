"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";

interface Category {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean | null;
  createdAt: string | null;
}

interface FormState {
  id?: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
}

const emptyForm: FormState = { key: "", name: "", description: "", isActive: true };

export function ImportCategoriesManager() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/imports/categories");
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openNew = () => {
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setForm({
      id: cat.id,
      key: cat.key,
      name: cat.name,
      description: cat.description || "",
      isActive: cat.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.key.trim() || !form.name.trim()) {
      toast.add({ title: t.common.error, description: "Key & Nama wajib diisi", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/imports/categories/${form.id}` : "/api/imports/categories";
      const method = form.id ? "PATCH" : "POST";
      const body = form.id
        ? { name: form.name.trim(), description: form.description.trim() || null, isActive: form.isActive }
        : { key: form.key.trim(), name: form.name.trim(), description: form.description.trim() || null, isActive: form.isActive };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.success, description: t.importCategories.saved, type: "success" });
        setDialogOpen(false);
        fetchCategories();
      } else {
        toast.add({ title: t.common.error, description: data.error || t.importCategories.createFailed, type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: t.importCategories.createFailed, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(t.importCategories.deleteConfirm.replace("{name}", cat.name))) return;
    try {
      const res = await fetch(`/api/imports/categories/${cat.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.deleted, description: t.importCategories.deleteCategory, type: "success" });
        fetchCategories();
      }
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="h-5 w-5" />
          {t.importCategories.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.importCategories.description}</p>

        {loading ? (
          <div className="py-6 text-center text-muted-foreground text-sm">{t.common.loading}</div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{cat.name}</span>
                    <Badge variant="secondary" className="font-mono">{cat.key}</Badge>
                    <Badge variant={cat.isActive ? "default" : "secondary"}>
                      {cat.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </div>
                  {cat.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{cat.description}</div>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cat)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> {t.importCategories.addCategory}
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? t.importCategories.editCategory : t.importCategories.addCategory}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.importCategories.key}</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                placeholder="monev"
                disabled={!!form.id}
              />
              {form.id && (
                <p className="text-xs text-muted-foreground">{t.importCategories.keyImmutable}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t.importCategories.name}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.importCategories.namePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.importCategories.description}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t.importCategories.descriptionPlaceholder}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>{t.importCategories.active}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
