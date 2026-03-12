import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Transaction {
  id: string;
  description: string | null;
  amount: number;
  amount_in_base: number | null;
  exchange_rate: number | null;
  transaction_date: string;
  currency: string;
}

interface BudgetCategoryDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: {
    id: string;
    name: string;
    amount: number;
    spent: number;
    category_id: string | null;
  } | null;
  year: number;
  month: number;
  onUpdateAmount?: (id: string, amount: number) => void;
}

export function BudgetCategoryDetail({
  open,
  onOpenChange,
  budget,
  year,
  month,
  onUpdateAmount,
}: BudgetCategoryDetailProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState("");

  useEffect(() => {
    if (!open || !budget?.category_id) return;

    const fetchTransactions = async () => {
      setLoading(true);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      const { data } = await supabase
        .from("transactions")
        .select("id, description, amount, amount_in_base, exchange_rate, transaction_date, currency")
        .eq("category_id", budget.category_id!)
        .eq("type", "expense")
        .gte("transaction_date", startDate)
        .lt("transaction_date", endDate)
        .order("transaction_date", { ascending: false });

      setTransactions(data ?? []);
      setLoading(false);
    };

    fetchTransactions();
  }, [open, budget?.category_id, year, month]);

  if (!budget) return null;

  const spent = Math.max(0, budget.spent);
  const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const remaining = budget.amount - spent;

  const getStatus = (pct: number) => {
    if (pct > 100) return "over";
    if (pct >= 95) return "caution";
    if (pct >= 80) return "warning";
    return "safe";
  };

  const status = getStatus(percentage);

  const barColorClass = {
    safe: "[&>div]:bg-[hsl(var(--block-build))]",
    warning: "[&>div]:bg-[hsl(var(--block-lifestyle))]",
    caution: "[&>div]:bg-[hsl(var(--accent))]",
    over: "[&>div]:bg-[hsl(var(--status-danger))]",
  }[status];

  const textColorClass = {
    safe: "text-[hsl(var(--block-build))]",
    warning: "text-[hsl(var(--block-lifestyle))]",
    caution: "text-[hsl(var(--accent))]",
    over: "text-[hsl(var(--status-danger))]",
  }[status];

  const fmt = (v: number) => formatCurrency(v);

  const handleSaveAmount = () => {
    const val = parseFloat(editAmount);
    if (!isNaN(val) && val > 0 && onUpdateAmount) {
      onUpdateAmount(budget.id, val);
    }
    setEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-left truncate">{budget.name}</SheetTitle>
          </div>
        </SheetHeader>

        {/* Summary */}
        <div className="space-y-4 pb-6">
          <div className="rounded-xl bg-secondary/50 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Presupuestado</span>
              {editing ? (
                <div className="flex gap-1">
                  <Input
                    type="number"
                    className="h-7 w-24 text-right text-sm"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveAmount}>
                    OK
                  </Button>
                </div>
              ) : (
                <button
                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  onClick={() => {
                    setEditAmount(String(budget.amount));
                    setEditing(true);
                  }}
                >
                  {fmt(budget.amount)} ✎
                </button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Gastado</span>
              <span className={cn("text-sm font-semibold", textColorClass)}>
                {fmt(spent)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Disponible</span>
              <span className="text-sm font-semibold text-foreground">
                {remaining >= 0 ? fmt(remaining) : `-${fmt(Math.abs(remaining))}`}
              </span>
            </div>

            <Progress
              value={Math.min(percentage, 100)}
              className={cn("h-2.5", barColorClass)}
            />
            <p className={cn("text-xs font-medium text-center", textColorClass)}>
              {percentage.toFixed(0)}% utilizado
            </p>
          </div>

          {/* Transactions */}
          <div>
            <h4 className="text-sm font-heading font-semibold text-foreground mb-3">
              Movimientos del mes
            </h4>
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sin movimientos en esta categoría
              </p>
            ) : (
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">
                        {tx.description || "Sin descripción"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(tx.transaction_date), "d MMM", { locale: es })}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-foreground shrink-0 ml-2">
                      {fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
