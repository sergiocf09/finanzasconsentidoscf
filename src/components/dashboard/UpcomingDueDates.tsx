import { useMemo, useState, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock, CreditCard, PiggyBank, AlertTriangle, DollarSign, Check, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useDebts } from "@/hooks/useDebts";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useAccounts } from "@/hooks/useAccounts";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DueItem {
  id: string;
  name: string;
  day: number;
  nextDate: Date;
  daysLeft: number;
  amount: number;
  currency: string;
  type: "debt" | "goal";
  accountId: string | null;
  route: string;
}

type TimeFilter = "15" | "30" | "next_month";

const filterLabels: Record<TimeFilter, string> = {
  "15": "15 días",
  "30": "30 días",
  "next_month": "Próx. mes",
};

function getNextOccurrence(day: number, today: Date): Date {
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonth = new Date(y, m, day);
  if (thisMonth >= today) return thisMonth;
  return new Date(y, m + 1, day);
}

function getMaxDays(filter: TimeFilter, today: Date): number {
  if (filter === "15") return 15;
  if (filter === "30") return 30;
  // next_month: days until end of next month
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return Math.ceil((nextMonth.getTime() - today.getTime()) / 86400000);
}

export function UpcomingDueDates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { debts } = useDebts();
  const { goals } = useSavingsGoals();
  const { accounts } = useAccounts();
  const { mask } = useHideAmounts("balances");

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("15");
  const [payingItemId, setPayingItemId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const items = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDays = getMaxDays(timeFilter, today);
    const result: DueItem[] = [];

    // Debts with due_day
    (debts ?? [])
      .filter(d => d.is_active && d.due_day)
      .forEach(d => {
        const next = getNextOccurrence(d.due_day!, today);
        const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
        if (diff <= maxDays) {
          result.push({
            id: `debt-${d.id}`,
            name: d.name,
            day: d.due_day!,
            nextDate: next,
            daysLeft: diff,
            amount: d.minimum_payment ?? 0,
            currency: d.currency,
            type: "debt",
            accountId: d.account_id,
            route: d.account_id ? `/accounts/${d.account_id}` : "/debts",
          });
        }
      });

    // Savings goals with contribution_day
    (goals ?? [])
      .filter(g => g.is_active && (g as any).contribution_day)
      .forEach(g => {
        const cDay = (g as any).contribution_day as number;
        const next = getNextOccurrence(cDay, today);
        const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
        if (diff <= maxDays) {
          result.push({
            id: `goal-${g.id}`,
            name: g.name,
            day: cDay,
            nextDate: next,
            daysLeft: diff,
            amount: (g as any).monthly_contribution ?? 0,
            currency: "MXN",
            type: "goal",
            accountId: g.account_id,
            route: "/construction",
          });
        }
      });

    return result.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [debts, goals, timeFilter]);

  // Check if there are ANY items with due dates (regardless of filter)
  const hasAnyDueItems = useMemo(() => {
    const hasDebts = (debts ?? []).some(d => d.is_active && d.due_day);
    const hasGoals = (goals ?? []).some(g => g.is_active && (g as any).contribution_day);
    return hasDebts || hasGoals;
  }, [debts, goals]);

  const handleStartPay = useCallback((item: DueItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setPayingItemId(item.id);
    setPayAmount(item.amount ? String(item.amount) : "");
  }, []);

  const handleCancelPay = useCallback(() => {
    setPayingItemId(null);
    setPayAmount("");
  }, []);

  const handleConfirmPay = useCallback(async (item: DueItem) => {
    if (!user) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    setIsSaving(true);
    try {
      if (item.type === "debt" && item.accountId) {
        // Find a source account (first active asset account in same currency)
        const sourceAccount = accounts.find(
          a => a.is_active && a.currency === item.currency && !["credit_card", "payable", "mortgage", "auto_loan", "personal_loan", "caucion_bursatil"].includes(a.type)
        );

        if (sourceAccount) {
          // Create transfer from source to debt account
          await supabase.from("transfers").insert({
            user_id: user.id,
            from_account_id: sourceAccount.id,
            to_account_id: item.accountId,
            amount_from: amount,
            amount_to: amount,
            currency_from: sourceAccount.currency,
            currency_to: item.currency,
            transfer_date: format(new Date(), "yyyy-MM-dd"),
            description: `Pago: ${item.name}`,
            created_from: "due_dates",
          });
        } else {
          // No source account, create expense transaction on the debt account
          await supabase.from("transactions").insert({
            user_id: user.id,
            account_id: item.accountId,
            type: "income",
            amount,
            currency: item.currency,
            description: `Pago: ${item.name}`,
            transaction_date: format(new Date(), "yyyy-MM-dd"),
          });
        }
      } else if (item.type === "goal" && item.accountId) {
        // Find source account
        const sourceAccount = accounts.find(
          a => a.is_active && a.id !== item.accountId && !["credit_card", "payable", "mortgage", "auto_loan", "personal_loan", "caucion_bursatil"].includes(a.type)
        );

        if (sourceAccount) {
          await supabase.from("transfers").insert({
            user_id: user.id,
            from_account_id: sourceAccount.id,
            to_account_id: item.accountId,
            amount_from: amount,
            amount_to: amount,
            currency_from: sourceAccount.currency,
            currency_to: item.currency,
            transfer_date: format(new Date(), "yyyy-MM-dd"),
            description: `Aportación: ${item.name}`,
            created_from: "due_dates",
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      toast.success("Pago registrado correctamente");
      handleCancelPay();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar pago");
    } finally {
      setIsSaving(false);
    }
  }, [user, payAmount, accounts, queryClient, handleCancelPay]);

  if (!hasAnyDueItems) return null;

  return (
    <div className="space-y-2">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-heading font-semibold text-foreground">Próximos vencimientos</h2>
        </div>
        <div className="flex gap-1">
          {(Object.keys(filterLabels) as TimeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                timeFilter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:border-muted-foreground/30"
              )}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Sin vencimientos en este periodo.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const isUrgent = item.daysLeft <= 3;
            const Icon = item.type === "debt" ? CreditCard : PiggyBank;
            const isPaying = payingItemId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-2.5 transition-colors",
                  isUrgent
                    ? "border-expense/30 bg-expense/5"
                    : "border-border bg-card"
                )}
              >
                <div
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => !isPaying && navigate(item.route)}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                    isUrgent ? "bg-expense/10" : "bg-primary/10"
                  )}>
                    <Icon className={cn("h-4 w-4", isUrgent ? "text-expense" : "text-primary")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(item.nextDate, "d 'de' MMMM", { locale: es })} · {item.daysLeft === 0 ? "Hoy" : item.daysLeft === 1 ? "Mañana" : `En ${item.daysLeft} días`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isUrgent && <AlertTriangle className="h-3 w-3 text-expense" />}
                    <span className={cn("text-xs font-semibold tabular-nums", isUrgent ? "text-expense" : "text-foreground")}>
                      {mask(formatCurrencyAbs(item.amount, item.currency))}
                    </span>
                    {item.accountId && !isPaying && (
                      <button
                        onClick={(e) => handleStartPay(item, e)}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                          "bg-primary/10 hover:bg-primary/20 text-primary"
                        )}
                        title="Registrar pago"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline pay form */}
                {isPaying && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                    <Input
                      type="number"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="Monto"
                      className="h-8 text-sm flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelPay}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleConfirmPay(item)}
                      disabled={isSaving || !payAmount}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
