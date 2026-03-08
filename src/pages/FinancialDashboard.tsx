import { useMemo } from "react";
import { FinancialSummaryCards } from "@/components/dashboard/FinancialSummaryCards";
import { NetPositionCard } from "@/components/dashboard/NetPositionCard";
import { MonthlyFlowChart } from "@/components/dashboard/MonthlyFlowChart";
import { BlockDistributionPie } from "@/components/dashboard/BlockDistributionPie";
import { BudgetBlockProgress } from "@/components/dashboard/BudgetBlockProgress";
import { TopCategoriesCard } from "@/components/dashboard/TopCategoriesCard";
import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import { FinancialAlertsBanner } from "@/components/dashboard/FinancialAlertsBanner";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

export default function FinancialDashboard() {
  const now = new Date();
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);
  const { totals } = useTransactions({ startDate: currentStart, endDate: currentEnd });
  const { totalBudgeted, totalSpent, budgetsNearLimit } = useBudgets();
  const { assetsByCurrency, liabilitiesByCurrency } = useAccounts();
  const {
    signals, recommendations, blockSummaries, currentBlocks,
    periodComparisons,
  } = useFinancialIntelligence();

  useBudgetAlerts();

  const currentMonth = format(now, "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const totalAssets = Object.values(assetsByCurrency).reduce((s, v) => s + v, 0);
  const totalLiabilities = Object.values(liabilitiesByCurrency).reduce((s, v) => s + v, 0);

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
      {/* Header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <h1 className="text-lg font-heading font-semibold text-foreground">
          Dashboard Financiero
        </h1>
        <p className="text-xs text-muted-foreground">{capitalizedMonth}</p>
      </div>

      {/* Alertas financieras */}
      <FinancialAlertsBanner
        signals={signals}
        recommendations={recommendations}
        budgetsNearLimit={budgetsNearLimit.map(b => ({ name: b.name, spent: b.spent ?? 0, amount: b.amount }))}
      />

      {/* Resumen financiero */}
      <FinancialSummaryCards />

      {/* Posición neta */}
      <NetPositionCard totalAssets={totalAssets} totalLiabilities={totalLiabilities} />

      {/* Flujo mensual */}
      <MonthlyFlowChart income={totals.income} expense={totals.expense} netFlow={netFlow} />

      {/* Distribución del gasto */}
      <BlockDistributionPie
        stability={currentBlocks.stability}
        lifestyle={currentBlocks.lifestyle}
        build={currentBlocks.build}
      />

      {/* Avance del presupuesto */}
      <BudgetBlockProgress
        blockSummaries={blockSummaries}
        totalBudgeted={totalBudgeted}
        totalSpent={totalSpent}
      />

      {/* Top categorías */}
      <TopCategoriesCard categories={topCategories} />

      {/* Tendencia de gasto */}
      <SpendingTrendChart data={periodComparisons} />
    </div>
  );
}
