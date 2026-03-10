import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useToast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface DiagnosticResult {
  stabilityPct: number;
  lifestylePct: number;
  buildPct: number;
  stage: "stabilize" | "balance" | "build";
  stageName: string;
  stageMessage: string;
  suggestedRanges: { stability: [number, number]; lifestyle: [number, number]; build: [number, number] };
  totalExpenses: number;
  categoryBreakdown: Record<string, { amount: number; block: string; name: string }>;
}

function determineStage(_stability: number, _lifestyle: number, build: number): DiagnosticResult["stage"] {
  if (build < 10) return "stabilize";
  if (build < 25) return "balance";
  return "build";
}

const stageConfig = {
  stabilize: {
    name: "Estabilizar",
    message: "Hoy estás en etapa de Estabilizar. Estás priorizando sostener tus obligaciones. Vamos paso a paso.",
    ranges: { stability: [70, 85] as [number, number], lifestyle: [10, 25] as [number, number], build: [0, 5] as [number, number] },
  },
  balance: {
    name: "Equilibrar",
    message: "Estás en etapa de Equilibrar. Ya sostienes tus básicos y empiezas a construir con calma.",
    ranges: { stability: [50, 65] as [number, number], lifestyle: [20, 30] as [number, number], build: [10, 20] as [number, number] },
  },
  build: {
    name: "Construir",
    message: "Estás en etapa de Construir. Tu dinero ya tiene espacio para crecer contigo.",
    ranges: { stability: [40, 55] as [number, number], lifestyle: [15, 25] as [number, number], build: [25, 40] as [number, number] },
  },
};

export function useDiagnostic() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = async (months: number = 3) => {
    if (!user) return;
    setIsRunning(true);

    try {
      const end = endOfMonth(new Date());
      const start = startOfMonth(subMonths(new Date(), months));

      const { data: txs, error } = await supabase
        .from("transactions")
        .select("category_id, amount")
        .eq("type", "expense")
        .gte("transaction_date", format(start, "yyyy-MM-dd"))
        .lte("transaction_date", format(end, "yyyy-MM-dd"));

      if (error) throw error;

      // Build category map
      const catMap = new Map(categories.map((c) => [c.id, c]));

      // Sum by category
      const categoryBreakdown: DiagnosticResult["categoryBreakdown"] = {};
      let totalExpenses = 0;

      (txs ?? []).forEach((tx) => {
        const cat = tx.category_id ? catMap.get(tx.category_id) : null;
        const amount = Number(tx.amount);
        totalExpenses += amount;

        if (tx.category_id) {
          if (!categoryBreakdown[tx.category_id]) {
            categoryBreakdown[tx.category_id] = {
              amount: 0,
              block: (cat as any)?.bucket || "lifestyle",
              name: cat?.name || "Sin categoría",
            };
          }
          categoryBreakdown[tx.category_id].amount += amount;
        }
      });

      // Calculate block totals
      let stabilityTotal = 0, lifestyleTotal = 0, buildTotal = 0;
      Object.values(categoryBreakdown).forEach((item) => {
        if (item.block === "stability") stabilityTotal += item.amount;
        else if (item.block === "build") buildTotal += item.amount;
        else lifestyleTotal += item.amount;
      });

      const stabilityPct = totalExpenses > 0 ? (stabilityTotal / totalExpenses) * 100 : 0;
      const lifestylePct = totalExpenses > 0 ? (lifestyleTotal / totalExpenses) * 100 : 0;
      const buildPct = totalExpenses > 0 ? (buildTotal / totalExpenses) * 100 : 0;

      const stage = determineStage(stabilityPct, lifestylePct, buildPct);
      const config = stageConfig[stage];

      const diagnostic: DiagnosticResult = {
        stabilityPct,
        lifestylePct,
        buildPct,
        stage,
        stageName: config.name,
        stageMessage: config.message,
        suggestedRanges: config.ranges,
        totalExpenses,
        categoryBreakdown,
      };

      setResult(diagnostic);

      // Persist
      await supabase.from("diagnostics").insert({
        user_id: user.id,
        analysis_months: months,
        stability_pct: stabilityPct,
        lifestyle_pct: lifestylePct,
        build_pct: buildPct,
        stage,
        total_expenses: totalExpenses,
      });

      return diagnostic;
    } catch (err: any) {
      toast({ title: "Error en diagnóstico", description: err.message, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  return { runDiagnostic, result, isRunning };
}
