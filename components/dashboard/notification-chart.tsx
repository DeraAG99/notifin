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
    <Card className="nf-card rounded-2xl shadow-xl shadow-black/20">
      <CardHeader>
        <CardTitle className="text-nf-on-surface">{t.dashboard.chartTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-nf-on-surface-variant/70">
            {t.common.noData}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  color: "var(--popover-foreground)",
                  fontSize: "13px",
                }}
                labelStyle={{ color: "var(--popover-foreground)" }}
                itemStyle={{ color: "var(--popover-foreground)" }}
              />
              <Legend wrapperStyle={{ color: "var(--muted-foreground)" }} />
              <Bar dataKey="wa" name="WhatsApp" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="email" name="Email" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
