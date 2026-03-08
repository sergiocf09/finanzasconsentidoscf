import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { FinancialSummaryCards } from "@/components/dashboard/FinancialSummaryCards";
import { PeriodSummaryCards } from "@/components/dashboard/PeriodSummaryCards";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const { profile } = useProfile();
  const displayName = profile?.display_name || "bienvenido";

  useBudgetAlerts();

  const now = new Date();
  const currentMonth = format(now, "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  return (
    <div className="space-y-4 stagger-children overflow-x-hidden">
      {/* Welcome */}
      <div className="pb-1">
        <h1 className="text-lg font-heading font-semibold text-foreground">
          Hola, {displayName} 👋
        </h1>
        <p className="text-xs text-muted-foreground">{capitalizedMonth}</p>
      </div>

      {/* Financial Summary */}
      <FinancialSummaryCards />

      {/* Period Summary */}
      <div className="space-y-2">
        <h2 className="text-sm font-heading font-semibold text-foreground">Estado del mes</h2>
        <PeriodSummaryCards />
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-heading font-semibold text-foreground">Acciones rápidas</h2>
        <QuickActions />
      </div>

      {/* Recent Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-semibold text-foreground">Movimientos recientes</h2>
          <Link to="/transactions" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <RecentTransactions />
      </div>

      {/* Voice Tip */}
      <div className="rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Registra con tu voz</p>
            <p className="text-xs text-muted-foreground break-words">
              Toca el micrófono y di: "900 pesos gasolina HSBC".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
