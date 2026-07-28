"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle } from "lucide-react";

interface QueueHealthProps {
  stats: {
    whatsapp: { waiting: number; active: number; completed: number; failed: number; delayed: number };
    email: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  };
}

export function QueueHealth({ stats }: QueueHealthProps) {
  const getHealthStatus = (queue: QueueHealthProps["stats"]["whatsapp"]) => {
    if (queue.failed > 0) return { status: "warning", label: "Masalah", icon: AlertTriangle, color: "text-yellow-600" };
    if (queue.active > 0 || queue.waiting > 0) return { status: "active", label: "Aktif", icon: Activity, color: "text-blue-600" };
    return { status: "healthy", label: "Sehat", icon: CheckCircle, color: "text-green-600" };
  };

  const waHealth = getHealthStatus(stats.whatsapp);
  const emailHealth = getHealthStatus(stats.email);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Kesehatan Antrean
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <waHealth.icon className={`h-5 w-5 ${waHealth.color}`} />
            <div>
              <p className="font-medium">Antrean WhatsApp</p>
              <p className="text-sm text-muted-foreground">
                {stats.whatsapp.waiting} menunggu, {stats.whatsapp.active} aktif
              </p>
            </div>
          </div>
          <Badge variant={waHealth.status === "healthy" ? "default" : "secondary"}>
            {waHealth.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <emailHealth.icon className={`h-5 w-5 ${emailHealth.color}`} />
            <div>
              <p className="font-medium">Antrean Email</p>
              <p className="text-sm text-muted-foreground">
                {stats.email.waiting} menunggu, {stats.email.active} aktif
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
