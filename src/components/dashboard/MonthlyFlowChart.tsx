import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
} from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Transaction } from "@/hooks/useTransactions";

interface MonthlyFlowChartProps {
  income: number;
  expense: number;
  netFlow: number;
  transactions?: Transaction[];
}

export function MonthlyFlowChart({ income, expense, netFlow, transactions = [] }: MonthlyFlowChartProps) {
  const [expanded, setExpanded] = useState<"income" | "expense" | null>(null);

  const data = [
    { name: "Ingresos", value: income, color: "hsl(var(--income))" },
    { name: "Gastos", value: expense, color: "hsl(var(--expense))" },
    { name: "Flujo neto", value: Math.abs(netFlow), color: netFlow >= 0 ? "hsl(var(--income))" : "hsl(var(--expense))" },
  ];

  const topIncome = transactions
    .filter(t => t.type === "income")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const topExpense = transactions
    .filter(t => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const toggleExpanded = (type: "income" | "expense") => {
    setExpanded(prev => (prev === type ? null : type));
  };

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground">Flujo mensual</h3>

      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          onClick={() => toggleExpanded("income")}
          className="rounded-lg bg-income/8 p-2 transition-colors hover:bg-income/15"
        >
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="text-sm font-bold text-income tabular-nums">{formatCurrency(income)}</p>
          {topIncome.length > 0 && (
            <div className="flex justify-center mt-0.5">
              {expanded === "income" ? (
                <ChevronUp className="h-3 w-3 text-income/60" />
              ) : (
                <ChevronDown className="h-3 w-3 text-income/60" />
              )}
            </div>
          )}
        </button>
        <button
          onClick={() => toggleExpanded("expense")}
          className="rounded-lg bg-expense/8 p-2 transition-colors hover:bg-expense/15"
        >
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="text-sm font-bold text-expense tabular-nums">{formatCurrency(expense)}</p>
          {topExpense.length > 0 && (
            <div className="flex justify-center mt-0.5">
              {expanded === "expense" ? (
                <ChevronUp className="h-3 w-3 text-expense/60" />
              ) : (
                <ChevronDown className="h-3 w-3 text-expense/60" />
              )}
            </div>
          )}
        </button>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-xs text-muted-foreground">Flujo neto</p>
          <p className={cn("text-sm font-bold tabular-nums", netFlow >= 0 ? "text-income" : "text-expense")}>
            {formatCurrency(Math.abs(netFlow))}
          </p>
        </div>
      </div>

      {/* Top 5 drill-down */}
      {expanded && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <h4 className="text-xs font-heading font-semibold text-foreground">
            Top 5 {expanded === "income" ? "Ingresos" : "Gastos"}
          </h4>
          {(expanded === "income" ? topIncome : topExpense).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin movimientos este mes.</p>
          ) : (
            <div className="space-y-1.5">
              {(expanded === "income" ? topIncome : topExpense).map((tx, i) => (
                <div key={tx.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                  <span className="text-xs text-foreground flex-1 truncate">
                    {tx.description || "Sin descripción"}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold tabular-nums shrink-0",
                    expanded === "income" ? "text-income" : "text-expense"
                  )}>
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} barCategoryGap="20%">
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
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
