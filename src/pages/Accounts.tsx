import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Wallet, CreditCard, TrendingUp, ShieldCheck, Eye, EyeOff,
  Calendar, RefreshCw, Pencil, Trash2, ArrowUpDown, Home, Car, User, Landmark, TrendingDown,
} from "lucide-react";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import {
  useAccounts, Account, isAssetType,
} from "@/hooks/useAccounts";
import { useDebts } from "@/hooks/useDebts";
import { useDebtIntelligence } from "@/hooks/useDebtIntelligence";
import { DTISummaryCards } from "@/components/debts/DTISummaryCards";
import { DebtForm } from "@/components/debts/DebtForm";
import { DebtEditSheet } from "@/components/debts/DebtEditSheet";
import { BalanceAdjustmentSheet } from "@/components/debts/BalanceAdjustmentSheet";
import { AccountForm } from "@/components/accounts/AccountForm";
import { AccountEditSheet } from "@/components/accounts/AccountEditSheet";
import { SortableAccountSection } from "@/components/accounts/SortableAccountSection";
import { ReconciliationSheet } from "@/components/debts/ReconciliationSheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Default sort priority within each section
const ASSET_TYPE_ORDER: Record<string, number> = { cash: 0, bank: 1, savings: 2, investment: 3 };

const sortByTypeOrder = (order: Record<string, number>) => (a: Account, b: Account) => {
  const oa = order[a.type] ?? 99;
  const ob = order[b.type] ?? 99;
  if (oa !== ob) return oa - ob;
  return a.name.localeCompare(b.name);
};

const fmt = (value: number, currency: string) => formatCurrency(value, currency);

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, isLoading, assetsByCurrency, liabilitiesByCurrency, deactivateAccount } = useAccounts();
  const { hidden, toggle, mask } = useHideAmounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [reconcilingAccount, setReconcilingAccount] = useState<Account | null>(null);

  // Debt state
  const { debts, isLoading: debtsLoading, totalDebt, totalMinimumPayment,
          snowballOrder, avalancheOrder, deleteDebt } = useDebts();
  const dti = useDebtIntelligence();
  const [debtFormOpen, setDebtFormOpen] = useState(false);
  const [editDebtTarget, setEditDebtTarget] = useState<any>(null);
  const [deleteDebtTarget, setDeleteDebtTarget] = useState<any>(null);
  const [adjustDebtTarget, setAdjustDebtTarget] = useState<any>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);

  const typeIcons: Record<string, any> = {
    credit_card: CreditCard, personal_loan: User,
    mortgage: Home, car_loan: Car,
    student_loan: Landmark, other: CreditCard,
  };
  const typeLabels: Record<string, string> = {
    credit_card: "Tarjeta de crédito", personal_loan: "Crédito personal",
    mortgage: "Crédito hipotecario", car_loan: "Crédito automotriz",
    student_loan: "Crédito estudiantil", other: "Otro",
  };

  const sortDebts = (list: any[]) =>
    [...list].sort((a, b) => sortAsc
      ? Math.abs(a.current_balance) - Math.abs(b.current_balance)
      : Math.abs(b.current_balance) - Math.abs(a.current_balance));

  const shortTermDebts = sortDebts(debts.filter(d => d.type === "credit_card"));
  const longTermDebts  = sortDebts(debts.filter(d => d.type !== "credit_card"));

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    try { await deactivateAccount.mutateAsync(deleteTarget.id); } catch { /* handled */ }
    setDeleteTarget(null);
  };

  const handleDeleteDebt = async () => {
    if (!deleteDebtTarget) return;
    await deleteDebt.mutateAsync(deleteDebtTarget.id);
    setDeleteDebtTarget(null);
  };

  const activeAccounts = accounts.filter(a => a.is_active);

  // Group by currency then type for full-width list
  const allCurrencies = Array.from(new Set(activeAccounts.map(a => a.currency)));
  allCurrencies.sort((a, b) => (a === "MXN" ? -1 : b === "MXN" ? 1 : a.localeCompare(b)));

  const assetsByCurr = (currency: string) =>
    activeAccounts.filter(a => isAssetType(a.type) && a.currency === currency).sort(sortByTypeOrder(ASSET_TYPE_ORDER));

  const handleAccountClick = (account: Account) => navigate(`/accounts/${account.id}`);
  const handleEdit = (account: Account) => setEditTarget(account);
  const handleDelete = (account: Account) => setDeleteTarget(account);

  const renderDebtRow = (debt: any) => {
    const Icon = typeIcons[debt.type] || CreditCard;
    return (
      <div
        key={debt.id}
        className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-card border border-border card-interactive cursor-pointer"
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
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-expense tabular-nums">
            {debt.current_balance !== 0 ? "-" : ""}{fmt(Math.abs(debt.current_balance), debt.currency)}
          </p>
          {debt.due_day && (
            <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-0.5">
              <Calendar className="h-2.5 w-2.5" /> Día {debt.due_day}
            </p>
          )}
          {debt.minimum_payment > 0 && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              Mín: {fmt(debt.minimum_payment, debt.currency)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setAdjustDebtTarget(debt); }}
            title="Actualizar saldo real">
            <RefreshCw className="h-3.5 w-3.5 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setEditDebtTarget(debt); }}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setDeleteDebtTarget(debt); }}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-2">
        <div className="flex items-center justify-between">
            <h1 className="text-lg font-heading font-semibold text-foreground">Cuentas</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva cuenta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin cuentas todavía</p>
          <p className="text-sm mt-1">Crea tu primera cuenta para empezar.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="flex justify-end -mb-1">
            <button onClick={toggle} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors" title={hidden ? "Mostrar montos" : "Ocultar montos"}>
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              {Object.entries(assetsByCurrency).map(([currency, total]) => (
                <div
                  key={`asset-${currency}`}
                  className="rounded-xl bg-income/10 border border-income/20 p-3 cursor-pointer card-interactive"
                  onClick={() => document.getElementById("section-assets")?.scrollIntoView({ behavior: "smooth" })}
                >
                   <div className="flex items-center gap-1.5 mb-0.5">
                    <ShieldCheck className="h-4 w-4 text-income" />
                    <p className="text-xs font-bold text-foreground">Activos {currency}</p>
                  </div>
                  <p className="text-lg font-bold font-heading text-income">{mask(fmt(total, currency))}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {Object.entries(liabilitiesByCurrency).map(([currency, total]) => (
                <div
                  key={`liab-${currency}`}
                  className="rounded-xl bg-expense/10 border border-expense/20 p-3 cursor-pointer card-interactive"
                  onClick={() => document.getElementById("section-liabilities")?.scrollIntoView({ behavior: "smooth" })}
                >
                   <div className="flex items-center gap-1.5 mb-0.5">
                    <CreditCard className="h-4 w-4 text-expense" />
                    <p className="text-xs font-bold text-foreground">Pasivos {currency}</p>
                  </div>
                  <p className="text-lg font-bold font-heading text-expense">{hidden ? "••••••" : `-${fmt(total, currency)}`}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Assets by currency */}
          <div className="space-y-4">
            {allCurrencies.map(currency => {
              const items = assetsByCurr(currency);
              if (items.length === 0) return null;
              return (
                <div key={`assets-${currency}`} className="space-y-1.5">
                  <h2 id={currency === allCurrencies[0] ? "section-assets" : undefined}
                    className="text-xs font-heading font-semibold text-foreground flex items-center gap-1.5 scroll-mt-24">
                    <TrendingUp className="h-3.5 w-3.5 text-income" /> Activos {currency}
                  </h2>
                  <SortableAccountSection
                    sectionKey={`assets-${currency}`}
                    accounts={items}
                    mask={mask}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClick={handleAccountClick}
                  />
                </div>
              );
            })}

            {/* ── DEUDAS Y CRÉDITOS ─────────────────────────────── */}
            {debts.length > 0 && (
              <div className="space-y-3" id="section-liabilities">
                <div className="flex items-center justify-between scroll-mt-24">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-expense" />
                    <h2 className="text-xs font-heading font-semibold text-foreground">
                      Deudas y créditos
                    </h2>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setSortAsc(!sortAsc)}
                      title={sortAsc ? "Mayor a menor" : "Menor a mayor"}>
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1"
                      onClick={() => setDebtFormOpen(true)}>
                      <Plus className="h-3 w-3" /> Nueva deuda
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-expense/5 border border-expense/20 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deuda total</p>
                    <p className="text-base font-bold font-heading text-expense">
                      -{mask(fmt(totalDebt, "MXN"))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago mín. mensual</p>
                    <p className="text-base font-bold font-heading">
                      {mask(fmt(totalMinimumPayment, "MXN"))}
                    </p>
                  </div>
                </div>

                {shortTermDebts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Corto plazo
                    </p>
                    {shortTermDebts.map(renderDebtRow)}
                  </div>
                )}

                {longTermDebts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Largo plazo
                    </p>
                    {longTermDebts.map(renderDebtRow)}
                  </div>
                )}

                <DTISummaryCards dti={dti} />

                {snowballOrder.length >= 2 && (
                  <div className="space-y-1.5">
                    <button
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      onClick={() => setShowStrategy(!showStrategy)}
                    >
                      <TrendingDown className="h-3.5 w-3.5" />
                      {showStrategy ? "Ocultar" : "Ver"} estrategia de pago
                    </button>
                    {showStrategy && (
                      <div className="space-y-2">
                        <div className="rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-3">
                          <div className="flex items-start gap-2.5">
                            <TrendingDown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-foreground">Bola de nieve</p>
                              <p className="text-[10px] text-muted-foreground">
                                Paga primero <span className="font-medium text-foreground">{snowballOrder[0].name}</span> — saldo más bajo
                              </p>
                            </div>
                          </div>
                        </div>
                        {avalancheOrder[0] && avalancheOrder[0].interest_rate > 0 &&
                         avalancheOrder[0].id !== snowballOrder[0].id && (
                          <div className="rounded-xl bg-gradient-to-r from-accent/5 to-primary/5 border border-accent/10 p-3">
                            <div className="flex items-start gap-2.5">
                              <TrendingDown className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-foreground">Avalancha</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Paga primero <span className="font-medium text-foreground">{avalancheOrder[0].name}</span> ({avalancheOrder[0].interest_rate}%) — tasa más alta
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {debts.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
                <CreditCard className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">Sin deudas registradas</p>
                <Button variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => setDebtFormOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar deuda
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <AccountForm open={formOpen} onOpenChange={setFormOpen} />
      <AccountEditSheet
        account={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onOpenReconciliation={(account) => {
          setEditTarget(null);
          setReconcilingAccount(account);
        }}
      />

      {reconcilingAccount && (
        <ReconciliationSheet
          open={!!reconcilingAccount}
          onOpenChange={(o) => { if (!o) setReconcilingAccount(null); }}
          accountId={reconcilingAccount.id}
          debtName={reconcilingAccount.name}
          currentBalance={Math.abs(reconcilingAccount.current_balance ?? 0)}
          currency={reconcilingAccount.currency}
          reconciliationType={
            reconcilingAccount.type === "credit_card" || reconcilingAccount.type === "payable"
              ? "current"
              : "fixed"
          }
        />
      )}

      <DebtForm open={debtFormOpen} onOpenChange={setDebtFormOpen} />

      <DebtEditSheet
        debt={editDebtTarget}
        open={!!editDebtTarget}
        onOpenChange={(o) => { if (!o) setEditDebtTarget(null); }}
      />

      {adjustDebtTarget && (
        <ReconciliationSheet
          open={!!adjustDebtTarget}
          onOpenChange={(o) => { if (!o) setAdjustDebtTarget(null); }}
          debtId={adjustDebtTarget.id}
          debtName={adjustDebtTarget.name}
          currentBalance={Math.abs(adjustDebtTarget.current_balance ?? 0)}
          currency={adjustDebtTarget.currency}
          reconciliationType={
            adjustDebtTarget.type === "credit_card" ? "current" : "fixed"
          }
        />
      )}

      <AlertDialog open={!!deleteDebtTarget} onOpenChange={(o) => !o && setDeleteDebtTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteDebtTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la deuda. El historial de transacciones se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDebt}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar esta cuenta?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Cuenta: <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>
              </span>
              <span className="block">
                La cuenta se desactivará y dejará de aparecer en las listas. Todo el historial de transacciones, transferencias e ingresos/gastos se mantiene intacto para reportes.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>
              Desactivar cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
