import { useMemo, useState } from "react";
import { Brain, Gauge, BarChart3, ChevronDown } from "lucide-react";
import { SectionHelp } from "@/components/help/SectionHelp";
import { helpData } from "@/components/help/sectionHelpData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { NetPositionCard } from "@/components/dashboard/NetPositionCard";
import { MonthlyFlowChart } from "@/components/dashboard/MonthlyFlowChart";
import { BlockDistributionPie } from "@/components/dashboard/BlockDistributionPie";
import { BudgetBlockProgress } from "@/components/dashboard/BudgetBlockProgress";
import { TopCategoriesCard } from "@/components/dashboard/TopCategoriesCard";
import { FinancialAlertsBanner } from "@/components/dashboard/FinancialAlertsBanner";
import { StageCard } from "@/components/intelligence/StageCard";
import { SignalsList } from "@/components/intelligence/SignalsList";
import { RecommendationsList } from "@/components/intelligence/RecommendationsList";
import { CategoryComparisonList } from "@/components/intelligence/CategoryComparisonList";
import { HistoricalChart } from "@/components/intelligence/HistoricalChart";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatCurrency } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

const formatAmount = (value: number) => formatCurrency(value);

export default function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState("panorama");

  const now = new Date();
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);
  const { totals, transactions } = useTransactions({ startDate: currentStart, endDate: currentEnd });
  const { totalBudgeted, totalSpent, budgetsNearLimit } = useBudgets();
  const { assetsByCurrency, liabilitiesByCurrency } = useAccounts();
  const {
    isLoading,
    stage, stageName, stageMessage,
    signals, recommendations, blockSummaries, currentBlocks,
    periodComparisons, categoryComparisons, opportunities,
  } = useFinancialIntelligence();

  useBudgetAlerts();

  const currentMonth = format(now, "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const { convertToMXN } = useExchangeRate();

  const totalAssets = Object.entries(assetsByCurrency).reduce((s, [currency, v]) => s + convertToMXN(v, currency), 0);
  const totalLiabilities = Object.entries(liabilitiesByCurrency).reduce((s, [currency, v]) => s + convertToMXN(v, currency), 0);

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

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="pb-1">
          <h1 className="text-lg font-heading font-semibold text-foreground">Dashboard Financiero</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger-children overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-heading font-semibold text-foreground leading-tight">
            Dashboard Financiero
          </h1>
          <p className="text-[11px] text-muted-foreground">{capitalizedMonth}</p>
        </div>
        <SectionHelp content={helpData.financialDashboard} />
      </div>

      {/* Resumen conceptual — colapsable */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
          Resumen conceptual
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <FinancialAlertsBanner
            signals={signals}
            recommendations={recommendations}
            budgetsNearLimit={budgetsNearLimit.map(b => ({ name: b.name, spent: b.spent ?? 0, amount: b.amount }))}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="panorama" className="text-xs gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            Mi Panorama
          </TabsTrigger>
          <TabsTrigger value="analisis" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Análisis
          </TabsTrigger>
        </TabsList>

        {/* ── Zone 1: Mi Panorama ── */}
        <TabsContent value="panorama" className="space-y-4 mt-0">
          <StageCard stage={stage} stageName={stageName} stageMessage={stageMessage} />
          <NetPositionCard totalAssets={totalAssets} totalLiabilities={totalLiabilities} />
          <MonthlyFlowChart
            income={totals.income}
            expense={totals.expense}
            netFlow={netFlow}
            transactions={transactions}
          />
          <BlockDistributionPie
            stability={currentBlocks.stability}
            lifestyle={currentBlocks.lifestyle}
            build={currentBlocks.build}
          />
          <BudgetBlockProgress
            blockSummaries={blockSummaries}
            totalBudgeted={totalBudgeted}
            totalSpent={totalSpent}
          />
          <TopCategoriesCard categories={topCategories} />
        </TabsContent>

        {/* ── Zone 2: Análisis ── */}
        <TabsContent value="analisis" className="space-y-4 mt-0">
          <SignalsList signals={signals.filter(s => s.type === "positive")} title="Lo que va bien ✓" />
          <SignalsList signals={signals.filter(s => s.type === "attention")} title="Puntos de atención" />
          <SignalsList signals={opportunities} title="Oportunidades detectadas" />
          <HistoricalChart data={periodComparisons} formatAmount={formatAmount} />
          <CategoryComparisonList comparisons={categoryComparisons} formatAmount={formatAmount} />
          <RecommendationsList recommendations={recommendations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
