"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { Activity, AlertTriangle, CheckCircle } from "lucide-react";

interface QueueHealthProps {
  stats: {
    whatsapp: { waiting: number; active: number; completed: number; failed: number; delayed: number };
    email: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  };
}

export function QueueHealth({ stats }: QueueHealthProps) {
  const { t, tx } = useI18n();

  const getHealthStatus = (queue: QueueHealthProps["stats"]["whatsapp"]) => {
    if (queue.failed > 0) return { status: "warning", label: t.dashboard.issues, icon: AlertTriangle, color: "text-amber-400" };
    if (queue.active > 0 || queue.waiting > 0) return { status: "active", label: t.common.active, icon: Activity, color: "text-sky-400" };
    return { status: "healthy", label: t.dashboard.healthy, icon: CheckCircle, color: "text-emerald-400" };
  };

  const waHealth = getHealthStatus(stats.whatsapp);
  const emailHealth = getHealthStatus(stats.email);

  return (
    <Card className="nf-card rounded-2xl shadow-xl shadow-black/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-nf-on-surface">
          {t.dashboard.queueHealth}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <waHealth.icon className={`h-5 w-5 ${waHealth.color}`} />
            <div>
              <p className="font-medium">{t.dashboard.whatsappQueue}</p>
              <p className="text-sm text-nf-on-surface-variant/70">
                {tx("dashboard.waiting", { count: stats.whatsapp.waiting })}, {tx("dashboard.active", { count: stats.whatsapp.active })}
              </p>
            </div>
          </div>
          <Badge variant={waHealth.status === "healthy" ? "default" : "secondary"}>
            {waHealth.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <emailHealth.icon className={`h-5 w-5 ${emailHealth.color}`} />
            <div>
              <p className="font-medium">{t.dashboard.emailQueue}</p>
              <p className="text-sm text-nf-on-surface-variant/70">
                {tx("dashboard.waiting", { count: stats.email.waiting })}, {tx("dashboard.active", { count: stats.email.active })}
              </p>
            </div>
          </div>
          <Badge variant={emailHealth.status === "healthy" ? "default" : "secondary"}>
            {emailHealth.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
