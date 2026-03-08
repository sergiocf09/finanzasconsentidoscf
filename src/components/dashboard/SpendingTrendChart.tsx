import { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import type { PeriodComparison } from "@/hooks/useFinancialIntelligence";

interface SpendingTrendChartProps {
  data: PeriodComparison[];
}

type RangeKey = "3" | "6" | "12";

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const [range, setRange] = useState<RangeKey>("3");
  const rangeNum = parseInt(range);
  const sliced = data.slice(-rangeNum);

  if (sliced.length < 2) {
    return (
      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-2">Tendencia de gasto</h3>
        <p className="text-xs text-muted-foreground text-center py-6">Se necesitan al menos 2 meses de datos.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-foreground">Tendencia de gasto</h3>
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {(["3", "6", "12"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors",
                range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}m
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={sliced}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            name="Gasto"
            stroke="hsl(var(--expense))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--expense))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
