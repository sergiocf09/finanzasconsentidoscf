import { useState } from "react";
import { ArrowLeft, Brain, Lightbulb, BarChart3, Zap, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { StageCard } from "@/components/intelligence/StageCard";
import { FinancialSummaryHeader } from "@/components/intelligence/FinancialSummaryHeader";
import { BlockDistribution } from "@/components/intelligence/BlockDistribution";
import { SignalsList } from "@/components/intelligence/SignalsList";
import { RecommendationsList } from "@/components/intelligence/RecommendationsList";
import { CategoryComparisonList } from "@/components/intelligence/CategoryComparisonList";
import { HistoricalChart } from "@/components/intelligence/HistoricalChart";
import { formatCurrency } from "@/lib/formatters";

const formatAmount = (value: number) => formatCurrency(value);

export default function FinancialIntelligence() {
  const {
    isLoading,
    stage,
    stageName,
    stageMessage,
    income,
    expense,
    balance,
    blockSummaries,
    currentBlocks,
    signals,
    recommendations,
    categoryComparisons,
    periodComparisons,
    opportunities,
    prevTotals,
  } = useFinancialIntelligence();

  const [activeTab, setActiveTab] = useState("overview");

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="pb-1">
          <h1 className="text-lg font-heading font-semibold text-foreground">Inteligencia financiera</h1>
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
    <div className="space-y-5 overflow-x-hidden">
      {/* Header */}
      <div className="pb-1">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-heading font-semibold text-foreground">
            Inteligencia financiera
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Un resumen inteligente de cómo se comporta tu dinero.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="signals" className="text-xs gap-1">
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Señales</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Comparativo</span>
          </TabsTrigger>
          <TabsTrigger value="tips" className="text-xs gap-1">
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Consejos</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          <StageCard stage={stage} stageName={stageName} stageMessage={stageMessage} />

          <FinancialSummaryHeader
            income={income}
            expense={expense}
            balance={balance}
            prevIncome={prevTotals.income}
            prevExpense={prevTotals.expense}
            formatAmount={formatAmount}
          />

          <BlockDistribution
            blocks={blockSummaries}
            totalExpense={currentBlocks.total}
            formatAmount={formatAmount}
          />

          {/* Top signals preview */}
          {signals.length > 0 && (
            <SignalsList signals={signals} maxItems={3} title="Señales principales" />
          )}

          {/* Top recommendations preview */}
          {recommendations.length > 0 && (
            <RecommendationsList recommendations={recommendations} maxItems={2} />
          )}
        </TabsContent>

        {/* Signals */}
        <TabsContent value="signals" className="space-y-4 mt-0">
          <SignalsList signals={signals.filter((s) => s.type === "positive")} title="Lo que va bien ✓" />
          <SignalsList signals={signals.filter((s) => s.type === "attention")} title="Puntos de atención" />
          <SignalsList signals={opportunities} title="Oportunidades" />
        </TabsContent>

        {/* Compare */}
        <TabsContent value="compare" className="space-y-4 mt-0">
          <HistoricalChart data={periodComparisons} formatAmount={formatAmount} />
          <CategoryComparisonList comparisons={categoryComparisons} formatAmount={formatAmount} />
        </TabsContent>

        {/* Tips / Recommendations */}
        <TabsContent value="tips" className="space-y-4 mt-0">
          <RecommendationsList recommendations={recommendations} />
          <SignalsList signals={opportunities} title="Oportunidades detectadas" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
