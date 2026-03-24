import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Wallet, CreditCard, TrendingUp, ShieldCheck, Eye, EyeOff,
  Calendar, Pencil, Trash2, Home, Car, User, Landmark, TrendingDown,
  Sofa, Gem, Package,
} from "lucide-react";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import {
  useAccounts, Account, isAssetType,
} from "@/hooks/useAccounts";
import { useDebts } from "@/hooks/useDebts";
import { useDebtIntelligence } from "@/hooks/useDebtIntelligence";
import { useNonFinancialAssets, NFA_TYPE_LABELS } from "@/hooks/useNonFinancialAssets";
import { NonFinancialAssetSheet } from "@/components/assets/NonFinancialAssetSheet";
import { DTISummaryCards } from "@/components/debts/DTISummaryCards";
import { DebtEditSheet } from "@/components/debts/DebtEditSheet";
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
  const [editDebtTarget, setEditDebtTarget] = useState<any>(null);
  const [deleteDebtTarget, setDeleteDebtTarget] = useState<any>(null);
  const [showStrategy, setShowStrategy] = useState(false);

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

  // Adapter: convert debts to Account shape for SortableAccountSection
  const debtsAsAccounts = (list: any[]): Account[] =>
    list.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type === "car_loan" ? "auto_loan" :
            d.type === "mortgage" ? "mortgage" :
            d.type === "personal_loan" ? "personal_loan" : "credit_card",
      currency: d.currency,
      current_balance: -Math.abs(d.current_balance),
      is_active: true,
      user_id: "",
      initial_balance: 0,
      color: null,
      icon: null,
      include_in_summary: true,
      created_at: d.created_at,
      updated_at: d.updated_at,
    } as Account));

  const shortTermDebts = debts.filter(d => d.type === "credit_card");
  const longTermDebts = debts.filter(d => d.type !== "credit_card");

  // Build metadata map for debt rows (due_day, interest_rate)
  const debtMetadata = Object.fromEntries(
    debts.map(d => [d.id, { dueDay: d.due_day, interestRate: d.interest_rate }])
  );

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

            {/* ── ACTIVOS NO FINANCIEROS ──────────────────────── */}
            {nfAssets.length > 0 && (
              <div className="space-y-1.5">
                <h2 className="text-xs font-heading font-semibold text-foreground flex items-center gap-1.5">
                  <Home className="h-3.5 w-3.5 text-income" />
                  Activos no financieros
                </h2>
                {nfAssets.map(asset => {
                  const IconMap: Record<string, React.ElementType> = {
                    real_estate: Home, vehicle: Car, furniture: Sofa, valuables: Gem, other: Package,
                  };
                  const Icon = IconMap[asset.asset_type] || Package;
                  return (
                    <div key={asset.id}
                      className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-card border border-border card-interactive cursor-pointer"
                      onClick={() => { setEditingNfa(asset); setNfaSheetOpen(true); }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-income/10 shrink-0">
                        <Icon className="h-4 w-4 text-income" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
                        <p className="text-[10px] text-muted-foreground">{NFA_TYPE_LABELS[asset.asset_type]}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-income tabular-nums">
                          {mask(fmt(asset.current_value, asset.currency))}
                        </p>
                        {asset.acquisition_value && (
                          <p className="text-[10px] text-muted-foreground">
                            Compra: {mask(fmt(asset.acquisition_value, asset.currency))}
                          </p>
                        )}
                      </div>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── DEUDAS Y CRÉDITOS ─────────────────────────────── */}
            {debts.length > 0 && (
              <div className="space-y-3" id="section-liabilities">
                <div className="flex items-center gap-1.5 scroll-mt-24">
                  <CreditCard className="h-3.5 w-3.5 text-expense" />
                  <h2 className="text-xs font-heading font-semibold text-foreground">
                    Deudas y créditos
                  </h2>
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
                    <SortableAccountSection
                      sectionKey="debts-short"
                      accounts={debtsAsAccounts(shortTermDebts)}
                      mask={mask}
                      metadata={debtMetadata}
                      onEdit={(acc) => setEditDebtTarget(debts.find(d => d.id === acc.id) ?? null)}
                      onDelete={(acc) => setDeleteDebtTarget(debts.find(d => d.id === acc.id) ?? null)}
                      onClick={(acc) => navigate(`/accounts/${debts.find(d => d.id === acc.id)?.account_id || acc.id}`)}
                    />
                  </div>
                )}

                {longTermDebts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Largo plazo
                    </p>
                    <SortableAccountSection
                      sectionKey="debts-long"
                      accounts={debtsAsAccounts(longTermDebts)}
                      mask={mask}
                      metadata={debtMetadata}
                      onEdit={(acc) => setEditDebtTarget(debts.find(d => d.id === acc.id) ?? null)}
                      onDelete={(acc) => setDeleteDebtTarget(debts.find(d => d.id === acc.id) ?? null)}
                      onClick={(acc) => navigate(`/accounts/${debts.find(d => d.id === acc.id)?.account_id || acc.id}`)}
                    />
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
                <p className="text-[10px] text-muted-foreground">Crea una cuenta pasiva para dar seguimiento a tus deudas.</p>
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

      <DebtEditSheet
        debt={editDebtTarget}
        open={!!editDebtTarget}
        onOpenChange={(o) => { if (!o) setEditDebtTarget(null); }}
      />

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
