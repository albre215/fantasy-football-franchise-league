"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsChartDatum } from "@/types/analytics";

interface AnalyticsBarChartProps {
  title: string;
  description?: string;
  data: AnalyticsChartDatum[];
  emptyMessage: string;
  valueLabel: string;
  color?: string;
}

const BAR_COLORS = ["#2BBE5A", "#30C662", "#37CF6A", "#47D677", "#58DD85", "#E0B24A", "#CC9B2E", "#B88613"];

export function AnalyticsBarChart({
  title,
  description,
  data,
  emptyMessage,
  valueLabel,
  color = "#2BBE5A"
}: AnalyticsBarChartProps) {
  return (
    <Card className="brand-surface">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="rgba(120, 150, 130, 0.18)" />
                <XAxis
                  axisLine={false}
                  dataKey="value"
                  tickLine={false}
                  type="number"
                  width={48}
                />
                <YAxis
                  axisLine={false}
                  dataKey="label"
                  tickLine={false}
                  type="category"
                  width={72}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(9, 27, 18, 0.96)",
                    border: "1px solid rgba(86, 126, 97, 0.45)",
                    borderRadius: "14px",
                    color: "#F7FAF8"
                  }}
                  formatter={(value) => [`${value ?? 0} ${valueLabel}`, valueLabel]}
                  labelStyle={{ color: "#F7FAF8" }}
                />
                <Bar dataKey="value" fill={color} radius={[0, 8, 8, 0]}>
                  {data.map((entry, index) => (
                    <Cell fill={BAR_COLORS[index % BAR_COLORS.length]} key={entry.key} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
