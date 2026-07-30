"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface NotificationChartProps {
  data: { date: string; wa: number; email: number }[];
}

export function NotificationChart({ data }: NotificationChartProps) {
  const { t, locale } = useI18n();

  const dateLang = locale === "id" ? "id-ID" : "en-US";

  const chartData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString(dateLang, {
      day: "numeric",
      month: "short",
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.dashboard.chartTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            {t.common.noData}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="wa" name="WhatsApp" fill="#25D366" radius={[4, 4, 0, 0]} />
              <Bar dataKey="email" name="Email" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
