import { useState } from "react";
import { Plus, CreditCard, Calendar, TrendingDown, Trash2, Home, Car, User, Landmark, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useDebts, Debt } from "@/hooks/useDebts";
import { DebtForm } from "@/components/debts/DebtForm";
import { useNavigate } from "react-router-dom";

const typeIcons: Record<string, typeof CreditCard> = {
  credit_card: CreditCard, personal_loan: User, mortgage: Home, car_loan: Car,
  student_loan: Landmark, other: CreditCard,
};

const typeLabels: Record<string, string> = {
  credit_card: "Tarjeta de crédito", personal_loan: "Crédito personal",
  mortgage: "Crédito hipotecario", car_loan: "Crédito automotriz",
  student_loan: "Crédito estudiantil", other: "Otro",
};

const SHORT_TERM_TYPES = ["credit_card"];
const LONG_TERM_TYPES = ["personal_loan", "mortgage", "car_loan", "student_loan", "other"];

export default function Debts() {
  const { debts, isLoading, totalDebt, totalMinimumPayment, snowballOrder, createDebt, deleteDebt } = useDebts();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();

  const formatAmount = (value: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDebt.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const sortDebts = (list: Debt[]) =>
    [...list].sort((a, b) => sortAsc ? Math.abs(a.current_balance) - Math.abs(b.current_balance) : Math.abs(b.current_balance) - Math.abs(a.current_balance));

  const shortTerm = sortDebts(debts.filter(d => SHORT_TERM_TYPES.includes(d.type)));
  const longTerm = sortDebts(debts.filter(d => LONG_TERM_TYPES.includes(d.type)));

  const renderDebtRow = (debt: Debt) => {
    const Icon = typeIcons[debt.type] || CreditCard;
    return (
      <div
        key={debt.id}
        className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-card border border-border card-interactive cursor-pointer group"
        onClick={() => navigate(`/accounts/${debt.account_id || debt.id}`)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-expense/10 shrink-0">
          <Icon className="h-4 w-4 text-expense" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{debt.name}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{typeLabels[debt.type] ?? debt.type}</span>
            {debt.due_day && (
              <span className="flex items-center gap-0.5 text-status-warning">
                <Calendar className="h-2.5 w-2.5" />
                Día {debt.due_day}
              </span>
            )}
            {debt.interest_rate > 0 && <span>{debt.interest_rate}%</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-expense tabular-nums">
            {debt.current_balance !== 0 ? "-" : ""}{formatAmount(debt.current_balance, debt.currency)}
          </p>
          {debt.minimum_payment > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Mín: {formatAmount(debt.minimum_payment, debt.currency)}
            </p>
          )}
        </div>
        <Button
          variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(debt); }}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    );
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Deudas</h1>
          <div className="flex items-center gap-1.5">
            {debts.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? "Mayor a menor" : "Menor a mayor"}>
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 mt-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : debts.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No tienes deudas registradas</p>
          <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar primera deuda
          </Button>
        </div>
      ) : (
        <div className="space-y-4 mt-3">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-expense/5 border border-expense/20 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deuda total</p>
              <p className="text-lg font-bold font-heading text-expense">-{formatAmount(totalDebt, "MXN")}</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago mín. mensual</p>
              <p className="text-lg font-bold font-heading">{formatAmount(totalMinimumPayment, "MXN")}</p>
            </div>
          </div>

          {/* Short term */}
          {shortTerm.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Corto plazo</p>
              {shortTerm.map(renderDebtRow)}
            </div>
          )}

          {/* Long term */}
          {longTerm.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Largo plazo</p>
              {longTerm.map(renderDebtRow)}
            </div>
          )}

          {/* Strategy suggestion */}
          {snowballOrder.length >= 2 && (() => {
            const first = snowballOrder.find(d => Math.abs(d.current_balance) > 0) || snowballOrder[0];
            return (
              <div className="rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <TrendingDown className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Estrategia: Bola de nieve</p>
                    <p className="text-xs text-muted-foreground">
                      Paga primero <span className="font-medium text-foreground">{first.name}</span> (-{formatAmount(first.current_balance, first.currency)})
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <DebtForm open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la deuda y la cuenta pasiva asociada. Esta acción no se puede deshacer.
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
