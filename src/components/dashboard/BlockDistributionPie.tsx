import { formatCurrency } from "@/lib/formatters";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

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
        <h3 className="text-base font-heading font-semibold text-foreground mb-2">Distribución del gasto</h3>
        <p className="text-xs text-muted-foreground text-center py-6">Sin gastos registrados este mes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground">Distribución del gasto</h3>

      <div className="flex items-center gap-4">
        <div className="pointer-events-none shrink-0">
          <ResponsiveContainer width={80} height={80}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={36}
                strokeWidth={2}
                stroke="hsl(var(--card))"
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={BLOCKS.find(b => b.label === data[i].name)?.color || "#ccc"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2">
          {BLOCKS.map(block => {
            const value = block.key === "stability" ? stability : block.key === "lifestyle" ? lifestyle : build;
            const pct = total > 0 ? ((value / total) * 100).toFixed(0) : "0";
            return (
              <div key={block.key} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: block.color }}
                />
                <span className="text-xs text-foreground truncate">{block.label}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums ml-1 w-8 text-right shrink-0">{pct}%</span>
                <span className="text-xs text-muted-foreground tabular-nums ml-auto shrink-0">{formatCurrency(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
