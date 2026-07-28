"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const cards = [
    {
      title: "Total Sent",
      value: stats.totalSent,
      icon: Send,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Delivered",
      value: stats.totalDelivered,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Failed",
      value: stats.totalFailed,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Pending",
      value: stats.totalPending,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
            {card.title === "Total Sent" && stats.sentToday > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {stats.sentToday} sent today
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
