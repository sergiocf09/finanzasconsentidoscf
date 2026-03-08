import { useState, useMemo } from "react";
import { FinancialSummaryCards } from "@/components/dashboard/FinancialSummaryCards";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { NetPositionCard } from "@/components/dashboard/NetPositionCard";
import { MonthlyFlowChart } from "@/components/dashboard/MonthlyFlowChart";
import { BlockDistributionPie } from "@/components/dashboard/BlockDistributionPie";
import { BudgetBlockProgress } from "@/components/dashboard/BudgetBlockProgress";
import { TopCategoriesCard } from "@/components/dashboard/TopCategoriesCard";
import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import { FinancialAlertsBanner } from "@/components/dashboard/FinancialAlertsBanner";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const { profile } = useProfile();
  const displayName = profile?.display_name || "bienvenido";

  // Current month data
  const now = new Date();
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);
  const { totals } = useTransactions({ startDate: currentStart, endDate: currentEnd });
  const { budgets, totalBudgeted, totalSpent, budgetsNearLimit } = useBudgets();
  const { assetsByCurrency, liabilitiesByCurrency } = useAccounts();
  const {
    signals, recommendations, blockSummaries, currentBlocks,
    periodComparisons,
  } = useFinancialIntelligence();

  useBudgetAlerts();

  const currentMonth = format(now, "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  // Compute total assets / liabilities (MXN primary)
  const totalAssets = Object.values(assetsByCurrency).reduce((s, v) => s + v, 0);
  const totalLiabilities = Object.values(liabilitiesByCurrency).reduce((s, v) => s + v, 0);

  // Prepare top categories from currentBlocks
  const topCategories = useMemo(() => {
    const total = currentBlocks.total;
    return Object.values(currentBlocks.byCat)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map(c => ({
        name: c.name,
        amount: c.amount,
        block: c.block,
        percent: total > 0 ? (c.amount / total) * 100 : 0,
      }));
  }, [currentBlocks]);

  const netFlow = totals.income - totals.expense;

  return (
    <div className="space-y-4 stagger-children overflow-x-hidden">
      {/* Welcome */}
      <div className="pb-1">
        <h1 className="text-lg font-heading font-semibold text-foreground">
          Hola, {displayName} 👋
        </h1>
        <p className="text-xs text-muted-foreground">{capitalizedMonth}</p>
      </div>

      {/* 7. Financial Alerts Banner — top position for visibility */}
      <FinancialAlertsBanner
        signals={signals}
        recommendations={recommendations}
        budgetsNearLimit={budgetsNearLimit.map(b => ({ name: b.name, spent: b.spent ?? 0, amount: b.amount }))}
      />

      {/* 1. Resumen financiero (Assets/Liabilities expandable cards) */}
      <FinancialSummaryCards />

      {/* Net Position Card (Activos / Pasivos / Posición neta) */}
      <NetPositionCard totalAssets={totalAssets} totalLiabilities={totalLiabilities} />

      {/* Quick Actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-heading font-semibold text-foreground">Acciones rápidas</h2>
        <QuickActions />
      </div>

      {/* 2. Flujo mensual — bar chart */}
      <MonthlyFlowChart income={totals.income} expense={totals.expense} netFlow={netFlow} />

      {/* 3. Distribución del gasto — pie chart */}
      <BlockDistributionPie
        stability={currentBlocks.stability}
        lifestyle={currentBlocks.lifestyle}
        build={currentBlocks.build}
      />

      {/* 4. Avance del presupuesto — progress by block */}
      <BudgetBlockProgress
        blockSummaries={blockSummaries}
        totalBudgeted={totalBudgeted}
        totalSpent={totalSpent}
      />

      {/* 5. Top categorías del mes */}
      <TopCategoriesCard categories={topCategories} />

      {/* 6. Tendencia de gasto — line chart */}
      <SpendingTrendChart data={periodComparisons} />

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
