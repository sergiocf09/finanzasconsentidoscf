import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

interface BudgetRow {
  id: string;
  name: string;
  amount: number;
  spent: number;
  alert_threshold: number;
  alert_sent: boolean;
  currency?: string;
}

/**
 * Checks active budgets against their alert thresholds.
 * Shows in-app toasts for budgets that crossed their threshold
 * and marks them as alert_sent in the DB to avoid duplicates.
 */
export function useBudgetAlerts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const checkedRef = useRef(false);

  const checkAlerts = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Fetch active budgets for the current period that haven't sent an alert yet
    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("id, name, amount, spent, alert_threshold, alert_sent")
      .eq("is_active", true)
      .eq("year", currentYear)
      .or(`month.eq.${currentMonth},period.eq.yearly`);

    if (error || !budgets) return;

    const triggered: BudgetRow[] = [];

    for (const b of budgets as BudgetRow[]) {
      if (b.amount <= 0) continue;
      const ratio = (b.spent ?? 0) / b.amount;
      const threshold = b.alert_threshold ?? 0.8;

      if (ratio >= threshold && !b.alert_sent) {
        triggered.push(b);
      }
    }

    if (triggered.length === 0) return;

    // Mark all triggered budgets as alert_sent
    const ids = triggered.map((b) => b.id);
    await supabase
      .from("budgets")
      .update({ alert_sent: true })
      .in("id", ids);

    // Show toasts
    for (const b of triggered) {
      const pct = Math.round(((b.spent ?? 0) / b.amount) * 100);
      const isOver = pct >= 100;

      toast({
        title: isOver ? `⚠️ ${b.name} excedido` : `⚡ ${b.name} al ${pct}%`,
        description: isOver
          ? `Has gastado ${formatCurrency(b.spent)} de ${formatCurrency(b.amount)} presupuestados.`
          : `Llevas ${formatCurrency(b.spent)} de ${formatCurrency(b.amount)}. Cuidado con el ritmo de gasto.`,
        variant: isOver ? "destructive" : undefined,
        duration: 6000,
      });
    }

    // Refresh budgets query so UI reflects alert_sent change
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  }, [user, toast, queryClient]);

  // Check on mount (Dashboard load / app open) — only once per session
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    checkAlerts();
  }, [checkAlerts]);

  return { checkAlerts };
}
