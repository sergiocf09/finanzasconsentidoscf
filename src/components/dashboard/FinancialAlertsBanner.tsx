import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, AlertCircle } from "lucide-react";
import type { FinancialSignal, Recommendation } from "@/hooks/useFinancialIntelligence";

interface FinancialAlertsBannerProps {
  signals: FinancialSignal[];
  recommendations: Recommendation[];
  budgetsNearLimit: { name: string; spent: number; amount: number }[];
}

export function FinancialAlertsBanner({ signals, recommendations, budgetsNearLimit }: FinancialAlertsBannerProps) {
  const attentionSignals = signals.filter(s => s.type === "attention");
  const topRecommendations = recommendations.slice(0, 2);

  const alerts: { id: string; icon: "warning" | "attention" | "tip"; text: string }[] = [];

  budgetsNearLimit.forEach(b => {
    const pct = Math.round((b.spent / b.amount) * 100);
    alerts.push({
      id: `budget-${b.name}`,
      icon: pct >= 100 ? "warning" : "attention",
      text: pct >= 100
        ? `El presupuesto de ${b.name} está excedido (${pct}%).`
        : `El presupuesto de ${b.name} está cerca del límite (${pct}%).`,
    });
  });

  attentionSignals.forEach(s => {
    if (!alerts.some(a => a.text.includes(s.title))) {
      alerts.push({ id: s.id, icon: "attention", text: s.message });
    }
  });

  topRecommendations.forEach(r => {
    alerts.push({ id: r.id, icon: "tip", text: r.message });
  });

  if (alerts.length === 0) return null;

  const iconMap = {
    warning: <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-danger))] shrink-0" />,
    attention: <AlertCircle className="h-4 w-4 text-[hsl(var(--status-warning))] shrink-0" />,
    tip: <TrendingUp className="h-4 w-4 text-primary shrink-0" />,
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--status-warning)/0.2)] bg-[hsl(var(--status-warning)/0.04)] p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4.5 w-4.5 text-[hsl(var(--status-warning))]" />
        <h3 className="text-sm font-heading font-semibold text-foreground">Resumen</h3>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 5).map(alert => (
          <div key={alert.id} className="flex items-start gap-2">
            <div className="mt-0.5">{iconMap[alert.icon]}</div>
            <p className="text-xs leading-relaxed text-foreground/80">{alert.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
