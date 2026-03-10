import { useState } from "react";
import { FinancialSummaryCards } from "@/components/dashboard/FinancialSummaryCards";
import { PeriodSummaryCards } from "@/components/dashboard/PeriodSummaryCards";
import { FxRateWidget } from "@/components/dashboard/FxRateWidget";
import { UpcomingDueDates } from "@/components/dashboard/UpcomingDueDates";
import { useProfile } from "@/hooks/useProfile";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SectionHelp } from "@/components/help/SectionHelp";
import { helpData } from "@/components/help/sectionHelpData";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { profile } = useProfile();
  const displayName = profile?.display_name || "bienvenido";
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const [wizardDismissed, setWizardDismissed] = useState(false);

  useBudgetAlerts();

  const now = new Date();
  const currentMonth = format(now, "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const showWizard = profile && !profile.onboarding_dismissed && !wizardDismissed;

  if (summaryLoading) {
    return (
      <div className="space-y-4 overflow-x-hidden">
        <div className="pb-1">
          <h1 className="text-lg font-heading font-semibold text-foreground">
            Hola, {displayName} 👋
          </h1>
          <p className="text-xs text-muted-foreground">{capitalizedMonth}</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger-children overflow-x-hidden">
      {/* Onboarding Wizard */}
      {showWizard && (
        <OnboardingWizard
          open={true}
          onDismiss={() => setWizardDismissed(true)}
          displayName={displayName}
          baseCurrency={profile?.base_currency || "MXN"}
        />
      )}

      {/* Welcome */}
      <div className="pb-1">
        <div className="flex items-center gap-1.5">
          <h1 className="text-lg font-heading font-semibold text-foreground">
            Hola, {displayName} 👋
          </h1>
          <SectionHelp content={helpData.dashboard} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{capitalizedMonth}</p>
          <FxRateWidget />
        </div>
      </div>

      {/* Financial Summary — from RPC */}
      <FinancialSummaryCards accountsSummary={summary?.accounts_summary ?? undefined} />

      {/* Period Summary — from RPC for current month */}
      <div className="space-y-2">
        <h2 className="text-sm font-heading font-semibold text-foreground">Estado del periodo</h2>
        <PeriodSummaryCards
          initialTotals={summary?.period_totals}
          initialTransferTotal={summary?.transfer_total}
        />
      </div>

      {/* Upcoming Due Dates — from RPC */}
      <UpcomingDueDates
        summaryDebts={summary?.upcoming_debts ?? undefined}
        summaryGoals={summary?.upcoming_goals ?? undefined}
        summaryPaidDueDates={summary?.paid_due_dates ?? undefined}
        summaryAccounts={summary?.accounts_summary ?? undefined}
      />
    </div>
  );
}
