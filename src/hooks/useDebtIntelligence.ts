import { useMemo } from "react";
import { useDebts, Debt } from "@/hooks/useDebts";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";

export type DTIStatus = "healthy" | "moderate" | "elevated" | "critical";

export interface DTIResult {
  /** DTI using minimum payments only */
  minimumDTI: number;
  minimumDTIStatus: DTIStatus;
  /** DTI using planned payments (or minimum if no planned set) */
  plannedDTI: number;
  plannedDTIStatus: DTIStatus;
  /** Monthly income used for calculation */
  monthlyIncome: number;
  /** Sum of all minimum payments */
  totalMinimumPayments: number;
  /** Sum of all planned payments (falls back to minimum) */
  totalPlannedPayments: number;
  /** Interest saved by paying planned vs minimum (credit cards only) */
  interestSavings: DebtProjection[];
  /** Whether data is sufficient for DTI */
  hasIncome: boolean;
  /** Debts missing interest rate */
  missingRateCount: number;
}

export interface DebtProjection {
  debtId: string;
  debtName: string;
  balance: number;
  rate: number;
  /** Months to liquidate paying minimum */
  monthsMinimum: number;
  /** Total interest paid at minimum */
  totalInterestMinimum: number;
  /** Months to liquidate paying planned */
  monthsPlanned: number;
  /** Total interest paid at planned */
  totalInterestPlanned: number;
  /** Money saved by paying planned vs minimum */
  interestSaved: number;
  /** Time saved in months */
  timeSaved: number;
}

function getDTIStatus(ratio: number): DTIStatus {
  if (ratio <= 15) return "healthy";
  if (ratio <= 25) return "moderate";
  if (ratio <= 35) return "elevated";
  return "critical";
}

/** Calculate months to liquidate and total interest for a revolving balance */
function projectDebt(balance: number, annualRate: number, monthlyPayment: number): { months: number; totalInterest: number } {
  if (balance <= 0 || monthlyPayment <= 0) return { months: 0, totalInterest: 0 };
  if (annualRate <= 0) {
    const months = Math.ceil(balance / monthlyPayment);
    return { months, totalInterest: 0 };
  }

  const monthlyRate = annualRate / 100 / 12;
  // Check if payment covers interest
  const interestOnly = balance * monthlyRate;
  if (monthlyPayment <= interestOnly) {
    return { months: Infinity, totalInterest: Infinity };
  }

  // N = -log(1 - (i*A)/P) / log(1 + i)
  const months = Math.ceil(
    -Math.log(1 - (monthlyRate * balance) / monthlyPayment) / Math.log(1 + monthlyRate)
  );
  const totalPaid = months * monthlyPayment;
  const totalInterest = totalPaid - balance;

  return { months: isFinite(months) ? months : 999, totalInterest: isFinite(totalInterest) ? totalInterest : 0 };
}

export function useDebtIntelligence(): DTIResult {
  const { debts } = useDebts();
  const { data: summary } = useDashboardSummary();

  return useMemo(() => {
    const monthlyIncome = summary?.period_totals?.income ?? 0;
    const activeDebts = debts.filter((d) => d.is_active && Math.abs(d.current_balance) > 0);

    const totalMinimumPayments = activeDebts.reduce((s, d) => s + (d.minimum_payment ?? 0), 0);
    const totalPlannedPayments = activeDebts.reduce((s, d) => {
      const planned = (d as any).planned_payment ?? 0;
      return s + (planned > 0 ? planned : (d.minimum_payment ?? 0));
    }, 0);

    const hasIncome = monthlyIncome > 0;
    const minimumDTI = hasIncome ? (totalMinimumPayments / monthlyIncome) * 100 : 0;
    const plannedDTI = hasIncome ? (totalPlannedPayments / monthlyIncome) * 100 : 0;

    const missingRateCount = activeDebts.filter((d) => !d.interest_rate || d.interest_rate === 0).length;

    // Cost projections for debts with interest
    const interestSavings: DebtProjection[] = activeDebts
      .filter((d) => (d.interest_rate ?? 0) > 0 && (d.minimum_payment ?? 0) > 0)
      .map((d) => {
        const balance = Math.abs(d.current_balance);
        const rate = d.interest_rate ?? 0;
        const minPay = d.minimum_payment ?? 0;
        const plannedPay = (d as any).planned_payment > 0 ? (d as any).planned_payment : minPay;

        const minProj = projectDebt(balance, rate, minPay);
        const plannedProj = projectDebt(balance, rate, plannedPay);

        return {
          debtId: d.id,
          debtName: d.name,
          balance,
          rate,
          monthsMinimum: minProj.months,
          totalInterestMinimum: minProj.totalInterest,
          monthsPlanned: plannedProj.months,
          totalInterestPlanned: plannedProj.totalInterest,
          interestSaved: minProj.totalInterest - plannedProj.totalInterest,
          timeSaved: minProj.months - plannedProj.months,
        };
      })
      .filter((p) => p.interestSaved > 0)
      .sort((a, b) => b.interestSaved - a.interestSaved);

    return {
      minimumDTI,
      minimumDTIStatus: getDTIStatus(minimumDTI),
      plannedDTI,
      plannedDTIStatus: getDTIStatus(plannedDTI),
      monthlyIncome,
      totalMinimumPayments,
      totalPlannedPayments,
      interestSavings,
      hasIncome,
      missingRateCount,
    };
  }, [debts, summary]);
}
