"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Save, MessageSquare, Globe, Smartphone, AlertTriangle, Lock, RefreshCw, PhoneOff } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

type WaProvider = "fonnte" | "openwa" | "baileys";

const providerIcons: Record<string, typeof MessageSquare> = {
  fonnte: MessageSquare,
  openwa: Globe,
  baileys: Smartphone,
};

function safeTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "Asia/Jakarta";
  }
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";
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
    smtpSecure: "starttls" as "ssl" | "starttls" | "none",
    emailProvider: "smtp" as "smtp" | "resend",
    emailFrom: "",
    emailFromName: "",
    defaultTimezone: "Asia/Jakarta",
  });
  const [health, setHealth] = useState({
    wa: false,
    email: false,
    emailDetail: null as string | null,
    redis: true,
    database: true,
  });
  const [serverClock, setServerClock] = useState<{ time: string; tz: string } | null>(null);
  const [serverNow, setServerNow] = useState(() => Date.now());
  const serverOffsetRef = useRef(0);
  const [baileysStatus, setBaileysStatus] = useState<{
    connected: boolean;
    reconnecting: boolean;
    qr: string | null;
    lastSeen: string | null;
    phone: string | null;
    error: string | null;
  }>({ connected: false, reconnecting: false, qr: null, lastSeen: null, phone: null, error: null });
  const [baileysConnecting, setBaileysConnecting] = useState(false);
  const [baileysDisconnecting, setBaileysDisconnecting] = useState(false);
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
        setServerClock({
          time: data.data.serverTime || "",
          tz: data.data.serverTimezone || "",
        });
        if (data.data.serverTime) {
          serverOffsetRef.current = Date.now() - new Date(data.data.serverTime).getTime();
        }
        setServerNow(Date.now());
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
          smtpSecure:
            (data.data.smtpSecure as "ssl" | "starttls" | "none") ||
            (data.data.smtpPort === 465 ? "ssl" : "starttls"),
          emailFrom: data.data.emailFrom || "",
          emailFromName: data.data.emailFromName || "",
          emailProvider: (data.data.emailProvider as "smtp" | "resend") || "smtp",
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

  useEffect(() => {
    const id = setInterval(() => setServerNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchBaileysStatus = async () => {
    try {
      const res = await fetch("/api/baileys/status");
      const data = await res.json();
      if (data.success) {
        setBaileysStatus({
          connected: data.data.connected,
          reconnecting: data.data.reconnecting,
          qr: data.data.qr || null,
          lastSeen: data.data.lastSeen || null,
          phone: data.data.phone || null,
          error: data.data.error || null,
        });
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (settings.waProvider !== "baileys") return;
    fetchBaileysStatus();
    const interval = setInterval(fetchBaileysStatus, 4000);
    return () => clearInterval(interval);
  }, [settings.waProvider]);

  const handleBaileysConnect = async () => {
    setBaileysConnecting(true);
    try {
      const res = await fetch("/api/baileys/connect", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.error || t.settings.baileysConnectFailed);
      }
      await fetchBaileysStatus();
    } catch {
      setMessage(t.settings.baileysConnectFailed);
    } finally {
      setBaileysConnecting(false);
    }
  };

  const handleBaileysDisconnect = async () => {
    if (!confirm(t.settings.baileysDisconnectConfirm)) return;
    setBaileysDisconnecting(true);
    try {
      const res = await fetch("/api/baileys/disconnect", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.error || t.settings.baileysDisconnectFailed);
      }
      await fetchBaileysStatus();
    } catch {
      setMessage(t.settings.baileysDisconnectFailed);
    } finally {
      setBaileysDisconnecting(false);
    }
  };

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
      body.smtpSecure = settings.smtpSecure;
      body.emailProvider = settings.emailProvider;
      if (settings.emailFrom) body.emailFrom = settings.emailFrom;
      if (settings.emailFromName) body.emailFromName = settings.emailFromName;
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
        if (settings.waProvider === "baileys") {
          handleBaileysConnect();
        }
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
    { value: "baileys", label: t.settings.providerBaileys, desc: t.settings.providerBaileysDesc },
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
          <div className={`grid grid-cols-2 gap-4 ${isSuper ? "md:grid-cols-4" : ""}`}>
            {            [
              {
                label: t.settings.whatsapp,
                ok: health.wa,
                sub: settings.waProvider === "fonnte" ? "Fonnte" : settings.waProvider === "openwa" ? "OpenWA" : "Baileys",
              },
              {
                label: settings.emailProvider === "resend" ? t.settings.emailPlatform : t.settings.email,
                ok: health.email,
                sub: settings.emailProvider === "resend" ? t.settings.emailProviderResend : undefined,
                detail: health.emailDetail || undefined,
              },
              ...(isSuper
                ? [
                    { label: t.settings.redis, ok: health.redis },
                    { label: t.settings.database, ok: health.database },
                  ]
                : []),
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                {item.ok ? (
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm">{item.label}</div>
                  {item.sub && <div className="text-xs text-muted-foreground truncate">{item.sub}</div>}
                  {!item.ok && item.detail && (
                    <div className="text-xs text-destructive break-words">{item.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {serverClock?.time && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
              <span>
                {t.settings.serverTime}:{" "}
                <span className="font-medium text-foreground">
                  {new Date(serverNow - serverOffsetRef.current).toLocaleString("id-ID", {
                    timeZone: safeTimezone(settings.defaultTimezone),
                  })}
                </span>
              </span>
              <span>
                {t.settings.timezone}:{" "}
                <span className="font-medium text-foreground">{safeTimezone(settings.defaultTimezone)}</span>
              </span>
            </div>
          )}
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

          {settings.waProvider === "baileys" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">{t.settings.baileysWarningTitle}</p>
                    <p>{t.settings.baileysWarning1}</p>
                    <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                      <li>{t.settings.baileysWarning2}</li>
                      <li>{t.settings.baileysWarning3}</li>
                      <li>{t.settings.baileysWarning4}</li>
                      <li>{t.settings.baileysWarning5}</li>
                      <li>{t.settings.baileysWarning6}</li>
                    </ul>
                    <p className="text-xs font-medium">{t.settings.baileysWarningFooter}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {baileysStatus.connected ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      {t.settings.baileysStatus}:{" "}
                      {baileysStatus.connected
                        ? t.settings.baileysConnected
                        : baileysStatus.reconnecting
                        ? t.settings.baileysReconnecting
                        : t.settings.baileysNotConnected}
                    </span>
                  </div>
                  {!baileysStatus.connected && (
                    <Button
                      onClick={handleBaileysConnect}
                      disabled={baileysConnecting}
                      size="sm"
                    >
                      {baileysConnecting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Smartphone className="h-4 w-4 mr-2" />
                      )}
                      {baileysConnecting ? t.settings.baileysConnecting : t.settings.baileysConnect}
                    </Button>
                  )}
                  {baileysStatus.connected && (
                    <Button
                      onClick={handleBaileysDisconnect}
                      disabled={baileysDisconnecting}
                      size="sm"
                      variant="destructive"
                    >
                      {baileysDisconnecting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PhoneOff className="h-4 w-4 mr-2" />
                      )}
                      {baileysDisconnecting ? t.settings.baileysDisconnecting : t.settings.baileysDisconnect}
                    </Button>
                  )}
                </div>

                {baileysStatus.connected && baileysStatus.phone && (
                  <p className="text-xs text-muted-foreground">
                    {t.settings.baileysConnectedAs}:{" "}
                    <span className="font-medium text-foreground">+{baileysStatus.phone}</span>
                  </p>
                )}

                {!baileysStatus.connected && baileysStatus.error && (
                  <p className="text-xs text-destructive break-words">{baileysStatus.error}</p>
                )}

                {!baileysStatus.connected && !baileysStatus.qr && !baileysStatus.error && (
                  <p className="text-xs text-muted-foreground">{t.settings.baileysQrPendingHint}</p>
                )}

                {baileysStatus.qr && !baileysStatus.connected && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <img
                      src={baileysStatus.qr}
                      alt="WhatsApp QR"
                      className="w-56 h-56 rounded-lg border bg-white p-2"
                    />
                    <p className="text-xs text-muted-foreground text-center max-w-sm">
                      {t.settings.baileysScanHint}
                    </p>
                  </div>
                )}

                {baileysStatus.lastSeen && (
                  <p className="text-xs text-muted-foreground">
                    {t.settings.baileysLastSeen}: {new Date(baileysStatus.lastSeen).toLocaleString("id-ID")}
                  </p>
                )}

                {isSuper && (
                  <p className="text-xs text-muted-foreground">
                    {t.settings.baileysPerAdmin}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {settings.emailProvider === "resend" ? t.settings.emailPlatform : t.settings.email}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.settings.emailProvider}</Label>
            <Select
              value={settings.emailProvider}
              onValueChange={(v) =>
                setSettings({ ...settings, emailProvider: (v || "smtp") as "smtp" | "resend" })
              }
            >
              <SelectTrigger>
                <span>
                  {settings.emailProvider === "resend"
                    ? t.settings.emailProviderResend
                    : t.settings.emailProviderSmtp}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smtp">{t.settings.emailProviderSmtp}</SelectItem>
                <SelectItem value="resend">{t.settings.emailProviderResend}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.emailProvider === "resend" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              {t.settings.resendInfo}
            </div>
          )}

          {settings.emailProvider === "smtp" ? (
            <>
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.settings.smtpSecure}</Label>
                  <Select
                    value={settings.smtpSecure}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        smtpSecure: (v || "starttls") as "ssl" | "starttls" | "none",
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ssl">{t.settings.smtpSecureSsl}</SelectItem>
                      <SelectItem value="starttls">{t.settings.smtpSecureStarttls}</SelectItem>
                      <SelectItem value="none">{t.settings.smtpSecureNone}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.settings.fromAddress}</Label>
                  <Input
                    value={settings.emailFrom}
                    onChange={(e) => setSettings({ ...settings, emailFrom: e.target.value })}
                    placeholder={t.settings.fromAddressPlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.settings.fromName}</Label>
                  <Input
                    value={settings.emailFromName}
                    onChange={(e) => setSettings({ ...settings, emailFromName: e.target.value })}
                    placeholder={t.settings.fromNamePlaceholder}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>{t.settings.fromName}</Label>
              <Input
                value={settings.emailFromName}
                onChange={(e) => setSettings({ ...settings, emailFromName: e.target.value })}
                placeholder={t.settings.fromNamePlaceholder}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.general}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t.settings.defaultTimezone}</Label>
            <Select
              value={settings.defaultTimezone}
              onValueChange={(v) => setSettings({ ...settings, defaultTimezone: v || "Asia/Jakarta" })}
            >
              <SelectTrigger className="w-full">
                <span>
                  {TIMEZONE_OPTIONS.find((o) => o.value === settings.defaultTimezone)?.label ||
                    settings.defaultTimezone}
                </span>
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <span className={`text-sm ${passwordMessage.includes("berhasil") ? "text-primary" : "text-destructive"}`}>
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
