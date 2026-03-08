import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface TopCategory {
  name: string;
  amount: number;
  block: string;
  percent: number;
}

interface TopCategoriesCardProps {
  categories: TopCategory[];
}

const blockColors: Record<string, string> = {
  stability: "bg-[hsl(var(--block-stability))]",
  lifestyle: "bg-[hsl(var(--block-lifestyle))]",
  build: "bg-[hsl(var(--block-build))]",
};

export function TopCategoriesCard({ categories }: TopCategoriesCardProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-base font-heading font-semibold text-foreground mb-2">Top categorías</h3>
        <p className="text-xs text-muted-foreground text-center py-4">Sin datos este mes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground">Top categorías del mes</h3>
      <div className="space-y-2">
        {categories.map((cat, i) => (
          <div key={cat.name} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", blockColors[cat.block] || "bg-muted")} />
            <span className="text-sm font-medium text-foreground flex-1 truncate">{cat.name}</span>
            <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
              {formatCurrency(cat.amount)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums w-8 text-right shrink-0">
              {cat.percent.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
