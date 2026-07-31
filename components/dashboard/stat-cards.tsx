"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { Send, CheckCircle, XCircle, Clock } from "lucide-react";

interface StatCardsProps {
  stats: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalPending: number;
    sentToday: number;
  };
}

export function StatCards({ stats }: StatCardsProps) {
  const { t, tx } = useI18n();

  const cards = [
    {
      title: t.dashboard.totalSent,
      value: stats.totalSent,
      icon: Send,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
    },
    {
      title: t.dashboard.delivered,
      value: stats.totalDelivered,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: t.dashboard.failed,
      value: stats.totalFailed,
      icon: XCircle,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
    },
    {
      title: t.dashboard.pending,
      value: stats.totalPending,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="nf-card rounded-2xl shadow-xl shadow-black/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nf-on-surface-variant/80">
              {card.title}
            </CardTitle>
            <div className={`p-2.5 rounded-xl border border-white/10 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-nf-on-surface">{card.value.toLocaleString()}</div>
            {card.title === t.dashboard.totalSent && stats.sentToday > 0 && (
              <p className="text-xs text-nf-on-surface-variant/70 mt-1">
                {tx("dashboard.sentToday", { count: stats.sentToday })}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
