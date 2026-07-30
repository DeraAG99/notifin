"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Save, MessageSquare, Globe, AlertTriangle, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

type WaProvider = "fonnte" | "openwa";

const providerIcons: Record<string, typeof MessageSquare> = {
  fonnte: MessageSquare,
  openwa: Globe,
};

export default function SettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState({
    waProvider: "fonnte" as WaProvider,
    fonnteToken: "",
    fonnteRateLimit: 100,
    openwaBaseUrl: "",
    openwaApiKey: "",
    openwaSession: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    emailFrom: "",
    defaultTimezone: "Asia/Jakarta",
  });
  const [health, setHealth] = useState({
    wa: false,
    email: false,
    redis: true,
    database: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success) {
        setHealth(data.data.health);
        setSettings({
          waProvider: data.data.waProvider || "fonnte",
          fonnteToken: data.data.fonnteToken || "",
          fonnteRateLimit: data.data.fonnteRateLimit || 100,
          openwaBaseUrl: data.data.openwaBaseUrl || "",
          openwaApiKey: data.data.openwaApiKey || "",
          openwaSession: data.data.openwaSession || "",
          smtpHost: data.data.smtpHost || "",
          smtpPort: data.data.smtpPort || 587,
          smtpUser: data.data.smtpUser || "",
          smtpPass: "",
          emailFrom: data.data.emailFrom || "",
          defaultTimezone: data.data.defaultTimezone || "Asia/Jakarta",
        });
      }
    } catch (error) {
      console.error("Gagal memuat pengaturan:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        waProvider: settings.waProvider,
      };

      if (settings.fonnteToken && !settings.fonnteToken.startsWith("****")) {
        body.fonnteToken = settings.fonnteToken;
      }
      body.fonnteRateLimit = settings.fonnteRateLimit;

      if (settings.openwaBaseUrl) body.openwaBaseUrl = settings.openwaBaseUrl;
      if (settings.openwaApiKey && !settings.openwaApiKey.startsWith("****")) {
        body.openwaApiKey = settings.openwaApiKey;
      }
      if (settings.openwaSession) body.openwaSession = settings.openwaSession;

      if (settings.smtpHost) body.smtpHost = settings.smtpHost;
      if (settings.smtpPort) body.smtpPort = settings.smtpPort;
      if (settings.smtpUser) body.smtpUser = settings.smtpUser;
      if (settings.smtpPass) body.smtpPass = settings.smtpPass;
      if (settings.emailFrom) body.emailFrom = settings.emailFrom;
      if (settings.defaultTimezone) body.defaultTimezone = settings.defaultTimezone;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(t.settings.saved);
        setLoading(true);
        fetchSettings();
      } else {
        setMessage(data.error || t.settings.saveFailed);
      }
    } catch {
      setMessage(t.settings.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const providers: { value: WaProvider; label: string; desc: string }[] = [
    { value: "fonnte", label: "Fonnte", desc: "WhatsApp Gateway API cloud" },
    { value: "openwa", label: "OpenWA", desc: "WhatsApp Gateway API" },
  ];

  if (loading) return <div className="p-8">{t.common.loading}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.settings.title}</h1>
        <p className="text-muted-foreground">{t.settings.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.systemHealth}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t.settings.whatsapp, ok: health.wa, sub: settings.waProvider === "fonnte" ? "Fonnte" : "OpenWA" },
              { label: t.settings.email, ok: health.email },
              { label: t.settings.redis, ok: health.redis },
              { label: t.settings.database, ok: health.database },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                {item.ok ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm">{item.label}</div>
                  {item.sub && <div className="text-xs text-muted-foreground truncate">{item.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.whatsapp}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
              <Label className="mb-2 block">Provider</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {providers.map((p) => {
                const Icon = providerIcons[p.value];
                const isActive = settings.waProvider === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSettings({ ...settings, waProvider: p.value })}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {settings.waProvider === "fonnte" && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 space-y-2 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">⚠️ Resiko Nomor WhatsApp dibatasi — Baca Sebelum Pakai</p>
                    <p>Fonnte adalah gateway tidak resmi (<span className="font-mono text-xs">unofficial API</span>). Akun WhatsApp bisa dibatasi terutama kalo langsung blast tanpa persiapan.</p>
                    <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                      <li><strong>Gunakan nomor khusus</strong> — jangan pake nomor utama/pribadi/bisnis</li>
                      <li><strong>Warmup dulu</strong> — jangan blast di hari pertama, biasakan nomor dipakai dulu</li>
                      <li><strong>Jangan cold blast</strong> — kirim ke nomor yang belum pernah chat duluan = resiko banned tinggi</li>
                      <li><strong>Atur rate</strong> — kasih jeda antar pesan, jangan kirim ribuan per jam</li>
                      <li><strong>Siapkan fallback</strong> — untuk notif penting/critical, siapkan jalur SMS atau Email</li>
                    </ul>
                    <p className="text-xs font-medium">Resiko banned tetap ada meskipun semua langkah diikuti. Gunakan dengan bijak.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.settings.apiToken}</Label>
                <Input
                  type="password"
                  value={settings.fonnteToken}
                  onChange={(e) => setSettings({ ...settings, fonnteToken: e.target.value })}
                  placeholder={t.settings.apiTokenPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.settings.rateLimit}</Label>
                <Input
                  type="number"
                  value={settings.fonnteRateLimit}
                  onChange={(e) => setSettings({ ...settings, fonnteRateLimit: parseInt(e.target.value) || 100 })}
                />
              </div>
            </>
          )}

          {settings.waProvider === "openwa" && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">⚠️ Resiko Nomor WhatsApp dibatasi — Baca Sebelum Pakai</p>
                    <p>OpenWA adalah gateway tidak resmi (<span className="font-mono text-xs">unofficial API</span>). Akun WhatsApp bisa dibatasi terutama kalo langsung blast tanpa persiapan.</p>
                    <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                      <li><strong>Gunakan nomor khusus</strong> — jangan pake nomor utama/pribadi/bisnis</li>
                      <li><strong>Warmup dulu</strong> — scan QR, chat beberapa kontak, join grup, biarkan 3-7 hari sebelum blast</li>
                      <li><strong>Jangan cold blast</strong> — kirim ke nomor yang belum pernah chat duluan = resiko banned tinggi</li>
                      <li><strong>Atur rate</strong> — jangan kirim ribuan pesan per jam, kasih jeda antar pesan</li>
                      <li><strong>Siapkan fallback</strong> — untuk notif penting/critical, siapkan jalur SMS atau Email</li>
                    </ul>
                    <p className="text-xs font-medium">Resiko banned tetap ada meskipun semua langkah diikuti. Gunakan dengan bijak.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Server URL</Label>
                <Input
                  value={settings.openwaBaseUrl}
                  onChange={(e) => setSettings({ ...settings, openwaBaseUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={settings.openwaApiKey}
                  onChange={(e) => setSettings({ ...settings, openwaApiKey: e.target.value })}
                  placeholder="OpenWA API key"
                />
              </div>
              <div className="space-y-2">
                <Label>Session Name</Label>
                <Input
                  value={settings.openwaSession}
                  onChange={(e) => setSettings({ ...settings, openwaSession: e.target.value })}
                  placeholder="notifin-session"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.settings.smtpHost}</Label>
              <Input
                value={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                placeholder="smtp.provider.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.smtpPort}</Label>
              <Input
                type="number"
                value={settings.smtpPort}
                onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.settings.smtpUser}</Label>
              <Input
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                placeholder={t.settings.smtpUserPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.smtpPassword}</Label>
              <Input
                type="password"
                value={settings.smtpPass}
                onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                placeholder={t.settings.smtpPasswordPlaceholder}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.settings.fromAddress}</Label>
            <Input
              value={settings.emailFrom}
              onChange={(e) => setSettings({ ...settings, emailFrom: e.target.value })}
              placeholder={t.settings.fromAddressPlaceholder}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.general}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t.settings.defaultTimezone}</Label>
            <Input
              value={settings.defaultTimezone}
              onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Ganti Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Password Saat Ini</Label>
            <Input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              placeholder="Masukkan password saat ini"
            />
          </div>
          <div className="space-y-2">
            <Label>Password Baru</Label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder="Minimal 6 karakter"
            />
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={async () => {
                setPasswordSaving(true);
                setPasswordMessage("");
                try {
                  const res = await fetch("/api/auth/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(passwordForm),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setPasswordMessage("Password berhasil diubah");
                    setPasswordForm({ currentPassword: "", newPassword: "" });
                  } else {
                    setPasswordMessage(data.error || "Gagal mengubah password");
                  }
                } catch {
                  setPasswordMessage("Gagal mengubah password");
                } finally {
                  setPasswordSaving(false);
                }
              }}
              disabled={passwordSaving}
              variant="outline"
            >
              <Lock className="h-4 w-4 mr-2" />
              {passwordSaving ? "Menyimpan..." : "Ubah Password"}
            </Button>
            {passwordMessage && (
              <span className={`text-sm ${passwordMessage.includes("berhasil") ? "text-green-600" : "text-destructive"}`}>
                {passwordMessage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? t.common.saving : t.settings.saveSettings}
        </Button>
        {message && (
          <span className={`text-sm ${message.includes("berhasil") || message.includes("success") ? "text-green-600" : "text-destructive"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
