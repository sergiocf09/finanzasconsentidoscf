import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Loader2 } from "lucide-react";
import { useReconciliation, UnregisteredExpense } from "@/hooks/useReconciliation";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrencyAbs } from "@/lib/formatters";

interface ReconciliationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtId?: string;
  accountId?: string;
  debtName: string;
  currentBalance: number;
  currency: string;
  reconciliationType: "fixed" | "current";
}

export function ReconciliationSheet({
  open, onOpenChange, debtId, accountId,
  debtName, currentBalance, currency, reconciliationType,
}: ReconciliationSheetProps) {
  const [realBalance, setRealBalance] = useState("");
  const [expenses, setExpenses] = useState<UnregisteredExpense[]>([]);
  const { reconcileFixedDebt, reconcileCreditCard, isLoading } = useReconciliation();
  const { expenseCategories } = useCategories();

  const realBalanceNum = Number(realBalance) || 0;
  const difference = realBalanceNum - currentBalance;
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const financialCost = Math.max(0, difference - totalExpenses);

  const addExpense = () => {
    setExpenses(prev => [...prev, {
      id: crypto.randomUUID(),
      concept: "",
      amount: 0,
      category_id: null,
    }]);
  };

  const removeExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const updateExpense = (id: string, field: keyof UnregisteredExpense, value: any) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleConfirm = async () => {
    if (!realBalance) return;
    const today = new Date().toISOString().split("T")[0];

    if (reconciliationType === "fixed") {
      await reconcileFixedDebt({
        debtId: debtId!,
        previousBalance: currentBalance,
        realBalance: realBalanceNum,
        currency,
        debtName,
      });
    } else {
      await reconcileCreditCard({
        debtId,
        accountId,
        previousBalance: currentBalance,
        realBalance: realBalanceNum,
        currency,
        unregisteredExpenses: expenses.filter(e => e.amount > 0 && e.concept),
        date: today,
      });
    }
    onOpenChange(false);
    setRealBalance("");
    setExpenses([]);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setRealBalance("");
      setExpenses([]);
    }
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Actualizar saldo — {debtName}</SheetTitle>
          <SheetDescription className="text-xs">
            Concilia el saldo con tu estado de cuenta bancario
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Step 1 — Real balance */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Saldo según estado de cuenta</Label>

            <div className="flex items-center gap-3 min-h-[2rem]">
              <div className="w-[45%] shrink-0">
                <Label className="text-xs text-muted-foreground">Registrado en app</Label>
              </div>
              <p className="flex-1 text-sm font-medium text-right tabular-nums">
                {formatCurrencyAbs(currentBalance, currency)}
              </p>
            </div>

            <div className="flex items-center gap-3 min-h-[2rem]">
              <div className="w-[45%] shrink-0">
                <Label className="text-xs text-muted-foreground">Saldo real del banco</Label>
              </div>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm text-right flex-1"
                placeholder="0.00"
                value={realBalance}
                onChange={(e) => setRealBalance(e.target.value)}
              />
            </div>

            {realBalance && difference !== 0 && (
              <div className="flex items-center gap-3 min-h-[2rem]">
                <div className="w-[45%] shrink-0">
                  <Label className="text-xs text-muted-foreground">Diferencia</Label>
                </div>
                <p className={`flex-1 text-sm font-bold text-right tabular-nums ${difference > 0 ? "text-destructive" : "text-green-600"}`}>
                  {difference > 0 ? "+" : ""}{formatCurrencyAbs(Math.abs(difference), currency)}
                  {difference < 0 && <span className="text-green-600"> ↓</span>}
                </p>
              </div>
            )}
          </div>

          {/* Step 2 — Credit card: unregistered expenses */}
          {reconciliationType === "current" && realBalance && difference > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/30 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                ¿Hay gastos que no registraste? (opcional)
              </p>
              <p className="text-[10px] text-muted-foreground">
                Si hiciste compras que no capturaste en la app, agrégalas aquí. Lo que quede sin explicar se registrará como costo financiero.
              </p>

              {expenses.map(expense => (
                <div key={expense.id} className="space-y-1.5 rounded-lg bg-background p-2 border border-border">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-7 text-xs flex-1"
                      placeholder="Concepto (ej. Cena restaurante)"
                      value={expense.concept}
                      onChange={(e) => updateExpense(expense.id, "concept", e.target.value)}
                    />
                    <button onClick={() => removeExpense(expense.id)} className="text-muted-foreground hover:text-foreground p-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2"
                      value={expense.category_id || ""}
                      onChange={(e) => updateExpense(expense.id, "category_id", e.target.value || null)}
                    >
                      <option value="">Sin categoría</option>
                      {expenseCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-7 text-xs text-right w-24"
                      placeholder="$0.00"
                      value={expense.amount || ""}
                      onChange={(e) => updateExpense(expense.id, "amount", Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addExpense}>
                <Plus className="h-3 w-3" /> Agregar gasto no registrado
              </Button>

              {/* Distribution summary */}
              {(totalExpenses > 0 || financialCost > 0) && (
                <div className="rounded-lg bg-muted p-2 space-y-1 text-xs">
                  {totalExpenses > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos no registrados</span>
                      <span className="font-medium">{formatCurrencyAbs(totalExpenses, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo financiero (intereses, comisiones)</span>
                    <span className={`font-medium ${financialCost > 0 ? "text-destructive" : ""}`}>
                      {formatCurrencyAbs(financialCost, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span className="font-medium">Total diferencia</span>
                    <span className="font-bold">{formatCurrencyAbs(Math.abs(difference), currency)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fixed debt summary */}
          {reconciliationType === "fixed" && realBalance && difference > 0 && (
            <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              La diferencia de {formatCurrencyAbs(difference, currency)} se registrará como intereses y seguros del mes.
            </div>
          )}

          {reconciliationType === "fixed" && realBalance && difference < 0 && (
            <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              El saldo se ajustará a la baja en {formatCurrencyAbs(Math.abs(difference), currency)}.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={!realBalance || difference === 0 || isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
