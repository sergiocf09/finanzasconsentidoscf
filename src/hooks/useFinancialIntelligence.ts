import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useBudgets } from "@/hooks/useBudgets";
import { useAccounts } from "@/hooks/useAccounts";
import { useDebts } from "@/hooks/useDebts";
import { useEmergencyFund } from "@/hooks/useEmergencyFund";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

export type FinancialStage = "stabilize" | "balance" | "build";
export type SignalType = "positive" | "neutral" | "attention";

export interface FinancialSignal {
  id: string;
  type: SignalType;
  title: string;
  message: string;
  block?: string;
  category?: string;
}

export interface Recommendation {
  id: string;
  message: string;
  priority: number;
}

export interface BlockSummary {
  label: string;
  amount: number;
  percent: number;
  budgeted: number;
  budgetPercent: number;
}

export interface CategoryComparison {
  name: string;
  block: string;
  current: number;
  previous: number;
  change: number; // percentage change
}

export interface PeriodComparison {
  label: string;
  income: number;
  expense: number;
  balance: number;
  blocks: Record<string, number>;
}

function determineStage(_stability: number, _lifestyle: number, build: number): FinancialStage {
  if (build < 10) return "stabilize";
  if (build < 25) return "balance";
  return "build";
}

const stageLabels: Record<FinancialStage, { name: string; message: string }> = {
  stabilize: {
    name: "Estabilizar",
    message: "Estás priorizando sostener tus obligaciones. Vamos paso a paso hacia un balance más equilibrado.",
  },
  balance: {
    name: "Equilibrar",
    message: "Ya sostienes lo básico y empiezas a construir con calma. Buen camino.",
  },
  build: {
    name: "Construir",
    message: "Tu dinero ya tiene espacio para crecer contigo. Sigue así.",
  },
};

export function useFinancialIntelligence() {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Current month transactions
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);
  const { transactions: currentTxs, totals: currentTotals, isLoading: txLoading } = useTransactions({
    startDate: currentStart,
    endDate: currentEnd,
  });

  // Previous month
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));
  const { transactions: prevTxs, totals: prevTotals } = useTransactions({
    startDate: prevStart,
    endDate: prevEnd,
  });

  // Last 3 months (includes current)
  const threeStart = startOfMonth(subMonths(now, 2));
  const { transactions: threeTxs } = useTransactions({
    startDate: threeStart,
    endDate: currentEnd,
  });

  const { categories, isLoading: catLoading } = useCategories();
  const { budgets, totalBudgeted, totalSpent } = useBudgets(currentYear, currentMonth);
  const { accounts, totalBalance } = useAccounts();
  const { debts } = useDebts();
  const { fund, progress: emergencyProgress } = useEmergencyFund();

  // Historical data for comparisons (6 months)
  const sixStart = startOfMonth(subMonths(now, 5));
  const historicalQuery = useQuery({
    queryKey: ["intelligence-history", user?.id, format(sixStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("category_id, amount, type, transaction_date")
        .eq("type", "expense")
        .gte("transaction_date", format(sixStart, "yyyy-MM-dd"))
        .lte("transaction_date", format(currentEnd, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Compute block distribution for a set of expense transactions
  const computeBlocks = (txs: typeof currentTxs) => {
    let stability = 0, lifestyle = 0, build = 0, total = 0;
    const byCat: Record<string, { amount: number; block: string; name: string }> = {};

    txs.filter((t) => t.type === "expense").forEach((tx) => {
      const cat = tx.category_id ? catMap.get(tx.category_id) : null;
      const bucket = (cat as any)?.bucket || "lifestyle";
      const amount = Number(tx.amount);
      total += amount;

      if (bucket === "stability") stability += amount;
      else if (bucket === "build") build += amount;
      else lifestyle += amount;

      if (tx.category_id) {
        if (!byCat[tx.category_id]) {
          byCat[tx.category_id] = { amount: 0, block: bucket, name: cat?.name || "Otro" };
        }
        byCat[tx.category_id].amount += amount;
      }
    });

    return {
      stability, lifestyle, build, total, byCat,
      stabilityPct: total > 0 ? (stability / total) * 100 : 0,
      lifestylePct: total > 0 ? (lifestyle / total) * 100 : 0,
      buildPct: total > 0 ? (build / total) * 100 : 0,
    };
  };

  const currentBlocks = useMemo(() => computeBlocks(currentTxs), [currentTxs, catMap]);
  const prevBlocks = useMemo(() => computeBlocks(prevTxs), [prevTxs, catMap]);

  // Stage
  const stage = useMemo(
    () => determineStage(currentBlocks.stabilityPct, currentBlocks.lifestylePct, currentBlocks.buildPct),
    [currentBlocks]
  );
  const stageInfo = stageLabels[stage];

  // Block summaries
  const blockSummaries = useMemo((): Record<string, BlockSummary> => {
    const budgetByBlock: Record<string, number> = { stability: 0, lifestyle: 0, build: 0 };
    budgets.forEach((b) => {
      const cat = b.category_id ? catMap.get(b.category_id) : null;
      const bucket = (cat as any)?.bucket || "lifestyle";
      if (budgetByBlock[bucket] !== undefined) budgetByBlock[bucket] += b.amount;
    });

    return {
      stability: {
        label: "Estabilidad",
        amount: currentBlocks.stability,
        percent: currentBlocks.stabilityPct,
        budgeted: budgetByBlock.stability,
        budgetPercent: budgetByBlock.stability > 0 ? (currentBlocks.stability / budgetByBlock.stability) * 100 : 0,
      },
      lifestyle: {
        label: "Calidad de Vida",
        amount: currentBlocks.lifestyle,
        percent: currentBlocks.lifestylePct,
        budgeted: budgetByBlock.lifestyle,
        budgetPercent: budgetByBlock.lifestyle > 0 ? (currentBlocks.lifestyle / budgetByBlock.lifestyle) * 100 : 0,
      },
      build: {
        label: "Construcción",
        amount: currentBlocks.build,
        percent: currentBlocks.buildPct,
        budgeted: budgetByBlock.build,
        budgetPercent: budgetByBlock.build > 0 ? (currentBlocks.build / budgetByBlock.build) * 100 : 0,
      },
    };
  }, [currentBlocks, budgets, catMap]);

  // Signals
  const signals = useMemo((): FinancialSignal[] => {
    const s: FinancialSignal[] = [];
    const income = currentTotals.income;
    const expense = currentTotals.expense;

    // Positive signals
    if (currentBlocks.buildPct > 20) {
      s.push({ id: "build-strong", type: "positive", title: "Construcción sólida", message: `Estás destinando ${currentBlocks.buildPct.toFixed(0)}% a Construcción. Excelente ritmo.`, block: "build" });
    }
    if (income > 0 && expense < income * 0.85) {
      s.push({ id: "savings-good", type: "positive", title: "Margen de ahorro", message: "Tus gastos están por debajo del 85% de tus ingresos. Buen equilibrio." });
    }
    if (prevBlocks.total > 0 && currentBlocks.total < prevBlocks.total * 0.95) {
      s.push({ id: "expense-down", type: "positive", title: "Gasto a la baja", message: "Tu gasto total es menor que el mes anterior. Buen progreso." });
    }
    if (fund && emergencyProgress >= 50) {
      s.push({ id: "emergency-good", type: "positive", title: "Fondo de emergencia avanzando", message: `Tu fondo de emergencia va al ${emergencyProgress.toFixed(0)}% de la meta.` });
    }

    // Attention signals
    if (currentBlocks.buildPct < 5 && income > 0) {
      s.push({ id: "build-low", type: "attention", title: "Construcción baja", message: "Tu bloque de Construcción está por debajo del 5%. Considera destinar un poco más.", block: "build" });
    }
    if (currentBlocks.stabilityPct > 75) {
      s.push({ id: "stability-high", type: "attention", title: "Estabilidad presionada", message: `El ${currentBlocks.stabilityPct.toFixed(0)}% de tu gasto va a obligaciones fijas. Es alto, pero puedes ajustar poco a poco.`, block: "stability" });
    }
    if (prevBlocks.lifestylePct > 0 && currentBlocks.lifestylePct > prevBlocks.lifestylePct + 10) {
      s.push({ id: "lifestyle-rising", type: "attention", title: "Calidad de Vida en aumento", message: "Tu bloque de Calidad de Vida creció más de 10 puntos respecto al mes pasado.", block: "lifestyle" });
    }
    if (totalBudgeted > 0 && totalSpent > totalBudgeted * 0.9) {
      s.push({ id: "budget-near", type: "attention", title: "Presupuesto cerca del límite", message: `Ya usaste el ${((totalSpent / totalBudgeted) * 100).toFixed(0)}% de tu presupuesto mensual.` });
    }
    if (income > 0 && expense > income) {
      s.push({ id: "deficit", type: "attention", title: "Gastos superan ingresos", message: "Este mes tus gastos han superado tus ingresos. Revisa si hay algo que puedas ajustar." });
    }

    // Category-level signals
    Object.entries(currentBlocks.byCat).forEach(([catId, curr]) => {
      const prev = prevBlocks.byCat[catId];
      if (prev && curr.amount > prev.amount * 1.5 && curr.amount > 500) {
        s.push({
          id: `cat-spike-${catId}`,
          type: "attention",
          title: `Aumento en ${curr.name}`,
          message: `Tu gasto en ${curr.name} subió considerablemente respecto al mes anterior.`,
          category: curr.name,
          block: curr.block,
        });
      }
    });

    return s;
  }, [currentTxs, prevTxs, currentBlocks, prevBlocks, currentTotals, totalBudgeted, totalSpent, fund, emergencyProgress]);

  // Recommendations
  const recommendations = useMemo((): Recommendation[] => {
    const r: Recommendation[] = [];
    const income = currentTotals.income;

    if (currentBlocks.lifestylePct > 35 && currentBlocks.buildPct < 15) {
      r.push({ id: "shift-to-build", priority: 1, message: "Podrías mover una pequeña parte de tu gasto de Calidad de Vida hacia Construcción para fortalecer tu futuro financiero." });
    }

    // Budget alerts
    budgets.forEach((b) => {
      const pct = b.amount > 0 ? ((b.spent ?? 0) / b.amount) * 100 : 0;
      if (pct >= 80 && pct < 100) {
        r.push({ id: `budget-alert-${b.id}`, priority: 2, message: `Tu presupuesto de "${b.name}" está al ${pct.toFixed(0)}%. Un pequeño ajuste puede ayudarte a cerrar el mes bajo control.` });
      }
    });

    // Debt DTI signals
    const activeDebts = debts.filter((d) => d.is_active);
    const totalMinPayments = activeDebts.reduce((s, d) => s + (d.minimum_payment ?? 0), 0);
    const totalPlannedPayments = activeDebts.reduce((s, d) => {
      const planned = (d as any).planned_payment ?? 0;
      return s + (planned > 0 ? planned : (d.minimum_payment ?? 0));
    }, 0);
    const plannedDTI = income > 0 ? (totalPlannedPayments / income) * 100 : 0;
    const minDTI = income > 0 ? (totalMinPayments / income) * 100 : 0;

    if (plannedDTI > 35) {
      r.push({ id: "dti-critical", priority: 1, message: `Tu endeudamiento planeado (DTI ${plannedDTI.toFixed(0)}%) es crítico. Tus pagos de deuda consumen más del 35% de tu ingreso.` });
    } else if (plannedDTI > 25) {
      r.push({ id: "dti-elevated", priority: 2, message: `Tu DTI planeado está al ${plannedDTI.toFixed(0)}%. Busca reducir deudas para bajar del 25%.` });
    } else if (income > 0 && totalMinPayments > income * 0.2) {
      r.push({ id: "debt-pressure", priority: 2, message: "Tus pagos mínimos de deuda absorben una parte importante de tu flujo. Considera si puedes renegociar condiciones." });
    }

    // Minimum-only trap warning
    if (minDTI > 0 && plannedDTI - minDTI > 5) {
      r.push({ id: "min-trap", priority: 3, message: `Si solo pagaras mínimos (DTI ${minDTI.toFixed(0)}%), parecerías libre pero pagarías mucho más en intereses a largo plazo.` });
    }

    // Emergency fund
    if (fund && emergencyProgress < 30) {
      r.push({ id: "emergency-low", priority: 3, message: "Tu fondo de emergencia aún es pequeño. Sería buena idea aportar un poco más este mes." });
    }

    if (currentBlocks.stabilityPct > 70) {
      r.push({ id: "stability-review", priority: 3, message: "Revisa tus gastos fijos de Estabilidad. A veces hay servicios o suscripciones que se pueden optimizar." });
    }

    if (income > 0 && currentTotals.expense < income * 0.7) {
      r.push({ id: "good-margin", priority: 4, message: "Tienes un buen margen este mes. Aprovéchalo para fortalecer tu fondo de emergencia o aumentar Construcción." });
    }

    return r.sort((a, b) => a.priority - b.priority);
  }, [currentBlocks, currentTotals, budgets, debts, fund, emergencyProgress]);

  // Category comparisons (current vs previous)
  const categoryComparisons = useMemo((): CategoryComparison[] => {
    const comps: CategoryComparison[] = [];
    const allCatIds = new Set([
      ...Object.keys(currentBlocks.byCat),
      ...Object.keys(prevBlocks.byCat),
    ]);

    allCatIds.forEach((catId) => {
      const curr = currentBlocks.byCat[catId];
      const prev = prevBlocks.byCat[catId];
      const currentAmt = curr?.amount ?? 0;
      const prevAmt = prev?.amount ?? 0;
      if (currentAmt === 0 && prevAmt === 0) return;

      const change = prevAmt > 0 ? ((currentAmt - prevAmt) / prevAmt) * 100 : currentAmt > 0 ? 100 : 0;
      comps.push({
        name: curr?.name ?? prev?.name ?? "Categoría",
        block: curr?.block ?? prev?.block ?? "lifestyle",
        current: currentAmt,
        previous: prevAmt,
        change,
      });
    });

    return comps.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [currentBlocks, prevBlocks]);

  // Opportunities
  const opportunities = useMemo((): FinancialSignal[] => {
    const opp: FinancialSignal[] = [];

    // Positive recognition
    if (currentBlocks.stabilityPct > 0 && currentBlocks.stabilityPct <= 60) {
      opp.push({ id: "stability-ordered", type: "positive", title: "Estabilidad ordenada", message: "Tu bloque de Estabilidad se mantiene en un rango saludable." });
    }

    // Categories with reduction
    Object.entries(currentBlocks.byCat).forEach(([catId, curr]) => {
      const prev = prevBlocks.byCat[catId];
      if (prev && curr.amount < prev.amount * 0.8 && prev.amount > 300) {
        opp.push({ id: `cat-improve-${catId}`, type: "positive", title: `Mejora en ${curr.name}`, message: `Redujiste tu gasto en ${curr.name} respecto al mes anterior.` });
      }
    });

    // Cuttable categories (lifestyle over 20% of block)
    if (currentBlocks.lifestyle > 0) {
      Object.entries(currentBlocks.byCat)
        .filter(([, v]) => v.block === "lifestyle")
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 2)
        .forEach(([catId, v]) => {
          const catPct = (v.amount / currentBlocks.lifestyle) * 100;
          if (catPct > 30) {
            opp.push({ id: `cut-${catId}`, type: "neutral", title: `${v.name} concentra gasto`, message: `${v.name} representa el ${catPct.toFixed(0)}% de tu Calidad de Vida. Podrías revisarlo.` });
          }
        });
    }

    // Build potential
    if (currentBlocks.buildPct < 15 && currentTotals.income > currentTotals.expense) {
      const surplus = currentTotals.income - currentTotals.expense;
      opp.push({ id: "surplus-to-build", type: "neutral", title: "Oportunidad en Construcción", message: `Tienes un excedente que podrías canalizar a ahorro o inversión.` });
    }

    return opp;
  }, [currentBlocks, prevBlocks, currentTotals]);

  // Period comparison data
  const periodComparisons = useMemo((): PeriodComparison[] => {
    if (!historicalQuery.data) return [];

    // Group historical expenses by month
    const monthlyData: Record<string, { expense: number; blocks: Record<string, number> }> = {};
    historicalQuery.data.forEach((tx) => {
      const monthKey = tx.transaction_date.substring(0, 7); // "YYYY-MM"
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { expense: 0, blocks: { stability: 0, lifestyle: 0, build: 0 } };
      const cat = tx.category_id ? catMap.get(tx.category_id) : null;
      const bucket = (cat as any)?.bucket || "lifestyle";
      monthlyData[monthKey].expense += Number(tx.amount);
      monthlyData[monthKey].blocks[bucket] = (monthlyData[monthKey].blocks[bucket] || 0) + Number(tx.amount);
    });

    const monthNames = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => {
        const [y, m] = key.split("-").map(Number);
        return {
          label: `${monthNames[m]} ${y}`,
          income: 0, // we only queried expenses
          expense: data.expense,
          balance: 0,
          blocks: data.blocks,
        };
      });
  }, [historicalQuery.data, catMap]);

  const isLoading = txLoading || catLoading;

  return {
    isLoading,
    // Stage
    stage,
    stageName: stageInfo.name,
    stageMessage: stageInfo.message,
    // Totals
    income: currentTotals.income,
    expense: currentTotals.expense,
    balance: currentTotals.income - currentTotals.expense,
    // Blocks
    blockSummaries,
    currentBlocks,
    // Signals
    signals,
    // Recommendations
    recommendations,
    // Comparisons
    categoryComparisons,
    periodComparisons,
    prevTotals,
    // Opportunities
    opportunities,
    // Budget
    totalBudgeted,
    totalSpent,
    // Accounts
    totalBalance,
  };
}
