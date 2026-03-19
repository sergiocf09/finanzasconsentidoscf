import { useState } from "react";
import { Plus, CreditCard, Calendar, TrendingDown, Trash2, Home, Car, User, Landmark, ArrowUpDown, Pencil, RefreshCw, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useDebts, Debt } from "@/hooks/useDebts";
import { useDebtIntelligence } from "@/hooks/useDebtIntelligence";
import { DebtForm } from "@/components/debts/DebtForm";
import { DebtEditSheet } from "@/components/debts/DebtEditSheet";
import { DTISummaryCards } from "@/components/debts/DTISummaryCards";
import { BalanceAdjustmentSheet } from "@/components/debts/BalanceAdjustmentSheet";
import { ReconciliationSheet } from "@/components/debts/ReconciliationSheet";
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
  const { debts, isLoading, totalDebt, totalMinimumPayment, snowballOrder, avalancheOrder, createDebt, deleteDebt } = useDebts();
  const dti = useDebtIntelligence();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [editTarget, setEditTarget] = useState<Debt | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Debt | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();

  const formatAmount = (value: number, currency: string) => formatCurrencyAbs(value, currency);

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
    const isFixed = debt.debt_category === "fixed" || debt.type !== "credit_card";
    return (
      <div
        key={debt.id}
        className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-card border border-border card-interactive cursor-pointer group"
        onClick={() => navigate(`/accounts/${debt.account_id || debt.id}`)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-expense/10 shrink-0">
          <Icon className="h-4 w-4 text-expense" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{debt.name}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{typeLabels[debt.type] ?? debt.type}</span>
            {debt.interest_rate > 0 && <span>{debt.interest_rate}%</span>}
            {isFixed && <span className="text-primary font-medium">A plazo</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-expense tabular-nums">
            {debt.current_balance !== 0 ? "-" : ""}{formatAmount(debt.current_balance, debt.currency)}
          </p>
          {debt.due_day && (
            <p className="text-[10px] font-bold text-expense tabular-nums flex items-center justify-end gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              Día {debt.due_day}
            </p>
          )}
          {debt.minimum_payment > 0 && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              Mín: {formatAmount(debt.minimum_payment, debt.currency)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {/* Balance adjustment button for fixed debts */}
          {isFixed && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); setAdjustTarget(debt); }}
              title="Actualizar saldo real"
            >
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
            </Button>
          )}
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setEditTarget(debt); }}
            title="Editar deuda"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(debt); }}
            title="Eliminar deuda"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="pb-2">
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

          {/* DTI Summary */}
          <DTISummaryCards dti={dti} />

          {/* Strategy suggestions */}
          {snowballOrder.length >= 2 && (() => {
            const snowFirst = snowballOrder[0];
            const avaFirst = avalancheOrder[0];
            return (
              <div className="space-y-2">
                <div className="rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-3">
                  <div className="flex items-start gap-2.5">
                    <TrendingDown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-foreground">Bola de nieve</p>
                      <p className="text-[10px] text-muted-foreground">
                        Paga primero <span className="font-medium text-foreground">{snowFirst.name}</span> (-{formatAmount(snowFirst.current_balance, snowFirst.currency)}) — saldo más bajo
                      </p>
                    </div>
                  </div>
                </div>
                {avaFirst && avaFirst.interest_rate > 0 && avaFirst.id !== snowFirst.id && (
                  <div className="rounded-xl bg-gradient-to-r from-accent/5 to-primary/5 border border-accent/10 p-3">
                    <div className="flex items-start gap-2.5">
                      <TrendingDown className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">Avalancha</p>
                        <p className="text-[10px] text-muted-foreground">
                          Paga primero <span className="font-medium text-foreground">{avaFirst.name}</span> ({avaFirst.interest_rate}%) — tasa más alta, ahorras más en intereses
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <DebtForm open={formOpen} onOpenChange={setFormOpen} />
      <DebtEditSheet debt={editTarget} open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)} />
      <BalanceAdjustmentSheet debt={adjustTarget} open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              La deuda y su cuenta pasiva asociada se desactivarán. Todo el historial de transacciones y transferencias se mantiene intacto para reportes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
