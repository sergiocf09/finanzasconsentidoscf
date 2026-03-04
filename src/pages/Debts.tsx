import { useState } from "react";
import { Plus, CreditCard, Calendar, TrendingDown, Pencil, Trash2, Home, Car, User, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useDebts, Debt } from "@/hooks/useDebts";
import { DebtForm } from "@/components/debts/DebtForm";

const typeIcons: Record<string, typeof CreditCard> = {
  credit_card: CreditCard, personal_loan: User, mortgage: Home, car_loan: Car,
  student_loan: Landmark, other: CreditCard,
};

const typeLabels: Record<string, string> = {
  credit_card: "Tarjeta de crédito", personal_loan: "Crédito personal",
  mortgage: "Crédito hipotecario", car_loan: "Crédito automotriz",
  student_loan: "Crédito estudiantil", other: "Otro",
};

export default function Debts() {
  const { debts, isLoading, totalDebt, totalMinimumPayment, snowballOrder, createDebt, updateDebt, deleteDebt } = useDebts();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);

  const formatAmount = (value: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDebt.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Deudas</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Agregar deuda
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : debts.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No tienes deudas registradas</p>
          <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar primera deuda
          </Button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-expense/5 border border-expense/20 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-expense/10">
                  <CreditCard className="h-5 w-5 text-expense" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deuda total</p>
                  <p className="text-2xl font-bold font-heading text-expense">
                    {formatAmount(totalDebt, "MXN")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pago mínimo mensual</p>
                  <p className="text-2xl font-bold font-heading">
                    {formatAmount(totalMinimumPayment, "MXN")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Debt List */}
          <div className="space-y-4">
            {debts.map((debt) => {
              const usedPercentage = debt.original_amount > 0
                ? (debt.current_balance / debt.original_amount) * 100
                : 0;
              const Icon = typeIcons[debt.type] || CreditCard;

              return (
                <div key={debt.id} className="rounded-2xl bg-card border border-border p-5 card-interactive">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-expense/10">
                        <Icon className="h-5 w-5 text-expense" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{debt.name}</p>
                        <p className="text-xs text-muted-foreground">{typeLabels[debt.type] ?? debt.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(debt)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-right mb-2">
                    <p className="text-xl font-bold text-expense">
                      {formatAmount(debt.current_balance, debt.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      de {formatAmount(debt.original_amount, debt.currency)} ({usedPercentage.toFixed(0)}% restante)
                    </p>
                  </div>

                  <Progress
                    value={usedPercentage}
                    className="h-2 mb-3 [&>div]:bg-expense"
                  />

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {debt.minimum_payment > 0 && (
                      <span>Mínimo: <span className="font-medium text-foreground">{formatAmount(debt.minimum_payment, debt.currency)}</span></span>
                    )}
                    {debt.interest_rate > 0 && (
                      <span>Tasa: <span className="font-medium text-foreground">{debt.interest_rate}%</span></span>
                    )}
                    {debt.cut_day && (
                      <span>Corte: <span className="font-medium text-foreground">día {debt.cut_day}</span></span>
                    )}
                    {debt.due_day && (
                      <span className="flex items-center gap-1 text-status-warning">
                        <Calendar className="h-3.5 w-3.5" />
                        Pago: día {debt.due_day}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Strategy suggestion */}
          {snowballOrder.length >= 2 && (
            <div className="rounded-2xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                  <TrendingDown className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Estrategia: Bola de nieve</p>
                  <p className="text-sm text-muted-foreground">
                    Paga primero <span className="font-medium text-foreground">{snowballOrder[0].name}</span> ({formatAmount(snowballOrder[0].current_balance, snowballOrder[0].currency)}) mientras haces pagos mínimos en las demás.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <DebtForm open={formOpen} onOpenChange={setFormOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la deuda y todos sus pagos registrados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
