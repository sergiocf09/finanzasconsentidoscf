import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Trash2, X, TrendingUp, TrendingDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Budget } from "@/hooks/useBudgets";

interface BudgetMonthEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  expenseBudgets: Budget[];
  incomeBudgets: Budget[];
  onUpdateAmount: (id: string, amount: number) => void;
  onDelete: (id: string) => void;
  monthLabel: string;
}

interface RowProps {
  b: Budget;
  onUpdateAmount: (id: string, amount: number) => void;
  onDelete: (id: string) => void;
  accent: "expense" | "income";
}

function BudgetRow({ b, onUpdateAmount, onDelete, accent }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(b.amount));

  useEffect(() => {
    if (!editing) setValue(String(b.amount));
  }, [b.amount, editing]);

  const save = () => {
    const val = parseFloat(value);
    if (!isNaN(val) && val > 0 && val !== b.amount) {
      onUpdateAmount(b.id, val);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
      <div
        className={cn(
          "w-1.5 h-8 rounded-full shrink-0",
          accent === "income" ? "bg-income" : "bg-primary"
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {accent === "income" ? "Recibido" : "Gastado"}: {formatCurrency(b.spent ?? 0)}
        </p>
      </div>
      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number"
            step="0.01"
            className="h-8 w-24 text-right text-sm"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={save}>
            <Check className="h-4 w-4 text-income" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setEditing(false)}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="text-sm font-semibold tabular-nums text-foreground hover:text-primary transition-colors"
            onClick={() => setEditing(true)}
          >
            {formatCurrency(b.amount)}
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setEditing(true)}
            aria-label="Editar monto"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(b.id)}
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function BudgetMonthEditor({
  open,
  onOpenChange,
  expenseBudgets,
  incomeBudgets,
  onUpdateAmount,
  onDelete,
  monthLabel,
}: BudgetMonthEditorProps) {
  const sortedExpense = useMemo(
    () => [...expenseBudgets].sort((a, b) => b.amount - a.amount),
    [expenseBudgets]
  );
  const sortedIncome = useMemo(
    () => [...incomeBudgets].sort((a, b) => b.amount - a.amount),
    [incomeBudgets]
  );

  const totalExpense = sortedExpense.reduce((s, b) => s + b.amount, 0);
  const totalIncome = sortedIncome.reduce((s, b) => s + b.amount, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto max-h-[100dvh]"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-left">Editar presupuesto</SheetTitle>
          <SheetDescription className="text-left">
            Revisa y ajusta lo capturado para {monthLabel}. Toca un monto para modificarlo.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {sortedIncome.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-income" />
                  <h3 className="text-sm font-heading font-semibold text-foreground">
                    Ingresos ({sortedIncome.length})
                  </h3>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(totalIncome)}
                </span>
              </div>
              <div className="space-y-2">
                {sortedIncome.map((b) => (
                  <BudgetRow
                    key={b.id}
                    b={b}
                    accent="income"
                    onUpdateAmount={onUpdateAmount}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {sortedExpense.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-expense" />
                  <h3 className="text-sm font-heading font-semibold text-foreground">
                    Gastos ({sortedExpense.length})
                  </h3>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(totalExpense)}
                </span>
              </div>
              <div className="space-y-2">
                {sortedExpense.map((b) => (
                  <BudgetRow
                    key={b.id}
                    b={b}
                    accent="expense"
                    onUpdateAmount={onUpdateAmount}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          ) : sortedIncome.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aún no hay presupuestos para este mes.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
