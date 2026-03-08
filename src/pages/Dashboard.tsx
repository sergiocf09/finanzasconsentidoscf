import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { FinancialSummaryCards } from "@/components/dashboard/FinancialSummaryCards";
import { PeriodSummaryCards } from "@/components/dashboard/PeriodSummaryCards";
import { FxRateWidget } from "@/components/dashboard/FxRateWidget";
import { UpcomingDueDates } from "@/components/dashboard/UpcomingDueDates";
import { ArrowRight } from "lucide-react";
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
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">
            Hola, {displayName} 👋
          </h1>
          <FxRateWidget />
        </div>
        <p className="text-xs text-muted-foreground">{capitalizedMonth}</p>
      </div>

      {/* Financial Summary */}
      <FinancialSummaryCards />

      {/* Period Summary */}
      <div className="space-y-2">
        <h2 className="text-sm font-heading font-semibold text-foreground">Estado del periodo</h2>
        <PeriodSummaryCards />
      </div>

      {/* Upcoming Due Dates */}
      <UpcomingDueDates />

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
    </div>
  );
}
