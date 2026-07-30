"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/context";
import { Plus, X } from "lucide-react";
import type { User } from "@/types";

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
}

const timezones = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Pontianak",
  "Asia/Banjarmasin",
];

export function UserForm({ user, onSuccess }: UserFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [timezone, setTimezone] = useState(user?.timezone || "Asia/Jakarta");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const [metadata, setMetadata] = useState<Array<{ key: string; value: string }>>(() => {
    const meta = user?.metadata as Record<string, unknown> | undefined;
    if (!meta || Object.keys(meta).length === 0) return [];
    return Object.entries(meta).map(([k, v]) => ({ key: k, value: String(v ?? "") }));
  });

  const addMetadataField = () => {
    setMetadata((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeMetadataField = (index: number) => {
    setMetadata((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMetadataField = (index: number, field: "key" | "value", val: string) => {
    setMetadata((prev) => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const metadataObj: Record<string, string> = {};
    metadata.forEach(({ key, value }) => {
      if (key.trim()) metadataObj[key.trim()] = value;
    });

    const body = {
      name,
      phone: phone || null,
      email: email || null,
      timezone,
      isActive,
      metadata: Object.keys(metadataObj).length > 0 ? metadataObj : null,
    };

    try {
      const url = user ? `/api/users/${user.id}` : "/api/users";
      const method = user ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onSuccess();
    } catch (error) {
      console.error("Gagal menyimpan pengguna:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t.users.form.name}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.users.form.namePlaceholder}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">{t.users.form.phone}</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.users.form.phonePlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t.users.form.email}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.users.form.emailPlaceholder}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.users.form.timezone}</Label>
        <Select value={timezone} onValueChange={(v) => setTimezone(v ?? "Asia/Jakarta")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <Label htmlFor="active">{t.users.form.active}</Label>
      </div>

      {/* Metadata Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t.users.form.metadata}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addMetadataField} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> {t.users.form.addField}
          </Button>
        </div>
        {metadata.length > 0 && (
          <div className="space-y-2">
            {metadata.map((field, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={field.key}
                  onChange={(e) => updateMetadataField(i, "key", e.target.value)}
                  placeholder={t.users.form.metadataKey}
                  className="h-8 text-sm flex-1"
                />
                <Input
                  value={field.value}
                  onChange={(e) => updateMetadataField(i, "value", e.target.value)}
                  placeholder={t.users.form.metadataValue}
                  className="h-8 text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeMetadataField(i)}
                  className="p-1 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t.users.form.metadataHint}
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? t.common.saving : user ? t.common.update : t.common.create}
        </Button>
      </div>
    </form>
  );
}
