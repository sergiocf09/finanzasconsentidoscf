import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";

interface MonthlyFlowChartProps {
  income: number;
  expense: number;
  netFlow: number;
}

export function MonthlyFlowChart({ income, expense, netFlow }: MonthlyFlowChartProps) {
  const data = [
    { name: "Ingresos", value: income, color: "hsl(var(--income))" },
    { name: "Gastos", value: expense, color: "hsl(var(--expense))" },
    { name: "Flujo neto", value: Math.abs(netFlow), color: netFlow >= 0 ? "hsl(var(--income))" : "hsl(var(--expense))" },
  ];

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-foreground">Flujo mensual</h3>
        <span className={cn(
          "text-xs font-semibold tabular-nums",
          netFlow >= 0 ? "text-income" : "text-expense"
        )}>
          {netFlow >= 0 ? "+" : "-"}{formatCurrency(Math.abs(netFlow))}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Ingresos</p>
          <p className="text-xs font-semibold text-income tabular-nums">{formatCurrency(income)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Gastos</p>
          <p className="text-xs font-semibold text-expense tabular-nums">{formatCurrency(expense)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Flujo neto</p>
          <p className={cn("text-xs font-semibold tabular-nums", netFlow >= 0 ? "text-income" : "text-expense")}>
            {formatCurrency(Math.abs(netFlow))}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} barCategoryGap="20%">
          <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
