"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/context";
import type { Admin } from "@/types";

interface AdminFormProps {
  admin?: Admin | null;
  onSuccess: () => void;
}

export function AdminForm({ admin, onSuccess }: AdminFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(admin?.name || "");
  const [email, setEmail] = useState(admin?.email || "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(admin?.isActive ?? true);
  const [expiresAt, setExpiresAt] = useState(
    admin?.expiresAt ? new Date(admin.expiresAt).toISOString().slice(0, 10) : ""
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body: Record<string, unknown> = {
      name,
      email,
      isActive,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (!admin) {
      if (!password) {
        setError(t.admins.form.passwordRequired);
        setLoading(false);
        return;
      }
      body.password = password;
    } else if (password) {
      body.password = password;
    }

    try {
      const url = admin ? `/api/admins/${admin.id}` : "/api/admins";
      const method = admin ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || (admin ? t.admins.updateFailed : t.admins.createFailed));
      }
    } catch {
      setError(admin ? t.admins.updateFailed : t.admins.createFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="admin-name">{t.admins.form.name}</Label>
        <Input
          id="admin-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.admins.form.namePlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-email">{t.admins.form.email}</Label>
        <Input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.admins.form.emailPlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password">
          {admin ? t.admins.form.resetPassword : t.admins.form.password}
        </Label>
        <Input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            admin
              ? t.admins.form.resetPasswordPlaceholder
              : t.admins.form.passwordPlaceholder
          }
          required={!admin}
          minLength={6}
          autoComplete="new-password"
        />
        {admin && (
          <p className="text-xs text-muted-foreground">{t.admins.form.resetPasswordHint}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-expires">
          {t.admins.form.expiresAt}
        </Label>
        <Input
          id="admin-expires"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
        />
        <p className="text-xs text-muted-foreground">{t.admins.form.expiresAtHint}</p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="admin-active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <Label htmlFor="admin-active">{t.admins.form.active}</Label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? t.common.saving : admin ? t.common.update : t.common.create}
        </Button>
      </div>
    </form>
  );
}
