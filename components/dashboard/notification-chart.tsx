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
              <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tick={{ fill: "#8d90a0" }}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tick={{ fill: "#8d90a0" }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#0e1b2b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#d6e4f9",
                  fontSize: "13px",
                }}
                labelStyle={{ color: "#d6e4f9" }}
                itemStyle={{ color: "#d6e4f9" }}
              />
              <Legend wrapperStyle={{ color: "#8d90a0" }} />
              <Bar dataKey="wa" name="WhatsApp" fill="#25D366" radius={[4, 4, 0, 0]} />
              <Bar dataKey="email" name="Email" fill="#41ddc2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
