import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import type { PeriodComparison } from "@/hooks/useFinancialIntelligence";

interface HistoricalChartProps {
  data: PeriodComparison[];
  formatAmount: (v: number) => string;
}

export function HistoricalChart({ data, formatAmount }: HistoricalChartProps) {
  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Se necesitan al menos 2 meses de historial para mostrar la tendencia.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.label,
    Estabilidad: d.blocks.stability || 0,
    "Calidad de Vida": d.blocks.lifestyle || 0,
    Construcción: d.blocks.build || 0,
  }));

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-heading font-semibold text-sm">Tendencia por bloques</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatAmount(value), name]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                fontSize: 12,
              }}
            />
            <Bar dataKey="Estabilidad" stackId="a" fill="hsl(var(--block-stability))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Calidad de Vida" stackId="a" fill="hsl(var(--block-lifestyle))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Construcción" stackId="a" fill="hsl(var(--block-build))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
