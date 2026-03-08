import { cn } from "@/lib/utils";
import { TrendingUp, AlertCircle, Sparkles } from "lucide-react";
import type { FinancialSignal } from "@/hooks/useFinancialIntelligence";

const typeConfig: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
  positive: { icon: TrendingUp, color: "text-[hsl(var(--income))]", bg: "bg-[hsl(var(--income)/0.1)]" },
  neutral: { icon: Sparkles, color: "text-[hsl(var(--transfer))]", bg: "bg-[hsl(var(--transfer)/0.1)]" },
  attention: { icon: AlertCircle, color: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning)/0.1)]" },
};

interface SignalsListProps {
  signals: FinancialSignal[];
  title?: string;
  maxItems?: number;
}

export function SignalsList({ signals, title = "Señales financieras", maxItems }: SignalsListProps) {
  const visible = maxItems ? signals.slice(0, maxItems) : signals;

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Sin señales relevantes por ahora.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-heading font-semibold text-sm">{title}</h3>
      <div className="space-y-2.5">
        {visible.map((s) => {
          const cfg = typeConfig[s.type];
          const Icon = cfg.icon;
          return (
            <div key={s.id} className={cn("flex gap-3 rounded-xl p-3", cfg.bg)}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", cfg.bg)}>
                <Icon className={cn("h-4 w-4", cfg.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
