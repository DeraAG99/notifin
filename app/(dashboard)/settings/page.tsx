"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Save } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    fonnteToken: "",
    fonnteRateLimit: 100,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    emailFrom: "",
    defaultTimezone: "Asia/Jakarta",
  });
  const [health, setHealth] = useState({
    fonnte: false,
    email: false,
    redis: true,
    database: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.success) {
          setHealth(data.data.health);
          setSettings({
            fonnteToken: "",
            fonnteRateLimit: data.data.fonnteRateLimit || 100,
            smtpHost: "",
            smtpPort: 587,
            smtpUser: "",
            smtpPass: "",
            emailFrom: data.data.emailFrom || "",
            defaultTimezone: data.data.defaultTimezone || "Asia/Jakarta",
          });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {};
      if (settings.fonnteToken) body.fonnteToken = settings.fonnteToken;
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
        setMessage("Settings saved successfully");
      } else {
        setMessage(data.error || "Failed to save settings");
      }
    } catch (error) {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your notification system</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "WhatsApp (Fonnte)", ok: health.fonnte },
              { label: "Email (SMTP)", ok: health.email },
              { label: "Redis", ok: health.redis },
              { label: "Database", ok: health.database },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.ok ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp (Fonnte)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Token</Label>
            <Input
              type="password"
              value={settings.fonnteToken}
              onChange={(e) => setSettings({ ...settings, fonnteToken: e.target.value })}
              placeholder="Enter new token (leave blank to keep current)"
            />
          </div>
          <div className="space-y-2">
            <Label>Rate Limit (per minute)</Label>
            <Input
              type="number"
              value={settings.fonnteRateLimit}
              onChange={(e) => setSettings({ ...settings, fonnteRateLimit: parseInt(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email (SMTP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                placeholder="smtp.provider.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input
                type="number"
                value={settings.smtpPort}
                onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP User</Label>
              <Input
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password</Label>
              <Input
                type="password"
                value={settings.smtpPass}
                onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                placeholder="Enter new password (leave blank to keep current)"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>From Address</Label>
            <Input
              value={settings.emailFrom}
              onChange={(e) => setSettings({ ...settings, emailFrom: e.target.value })}
              placeholder="notifications@yourdomain.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Default Timezone</Label>
            <Input
              value={settings.defaultTimezone}
              onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {message && (
          <span className={`text-sm ${message.includes("success") ? "text-green-600" : "text-destructive"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
