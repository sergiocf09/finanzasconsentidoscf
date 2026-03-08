import { formatCurrency } from "@/lib/formatters";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface BlockDistributionPieProps {
  stability: number;
  lifestyle: number;
  build: number;
}

const BLOCKS = [
  { key: "stability", label: "Estabilidad", color: "hsl(var(--block-stability))" },
  { key: "lifestyle", label: "Calidad de Vida", color: "hsl(var(--block-lifestyle))" },
  { key: "build", label: "Construcción", color: "hsl(var(--block-build))" },
];

export function BlockDistributionPie({ stability, lifestyle, build }: BlockDistributionPieProps) {
  const total = stability + lifestyle + build;
  const data = [
    { name: "Estabilidad", value: stability },
    { name: "Calidad de Vida", value: lifestyle },
    { name: "Construcción", value: build },
  ].filter(d => d.value > 0);

  if (total === 0) {
    return (
      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-2">Distribución del gasto</h3>
        <p className="text-xs text-muted-foreground text-center py-6">Sin gastos registrados este mes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <h3 className="text-sm font-heading font-semibold text-foreground">Distribución del gasto</h3>

      <div className="flex items-center gap-3">
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={50}
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={BLOCKS.find(b => b.label === data[i].name)?.color || "#ccc"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2">
          {BLOCKS.map(block => {
            const value = block.key === "stability" ? stability : block.key === "lifestyle" ? lifestyle : build;
            const pct = total > 0 ? ((value / total) * 100).toFixed(0) : "0";
            return (
              <div key={block.key} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: block.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{block.label}</p>
                </div>
                <span className="text-[10px] font-semibold text-foreground tabular-nums">{pct}%</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
