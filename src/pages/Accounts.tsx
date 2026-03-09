import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Wallet, CreditCard, TrendingUp, ShieldCheck, Eye, EyeOff,
} from "lucide-react";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import {
  useAccounts, Account, isAssetType, isLiabilityShort, isLiabilityLong,
} from "@/hooks/useAccounts";
import { AccountForm } from "@/components/accounts/AccountForm";
import { AccountEditSheet } from "@/components/accounts/AccountEditSheet";
import { SortableAccountSection } from "@/components/accounts/SortableAccountSection";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Default sort priority within each section
const ASSET_TYPE_ORDER: Record<string, number> = { cash: 0, bank: 1, savings: 2, investment: 3 };
const LIAB_SHORT_ORDER: Record<string, number> = { credit_card: 0, payable: 1 };
const LIAB_LONG_ORDER: Record<string, number> = { mortgage: 0, auto_loan: 1, personal_loan: 1, caucion_bursatil: 1 };

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

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    try { await deactivateAccount.mutateAsync(deleteTarget.id); } catch { /* handled */ }
    setDeleteTarget(null);
  };

  const activeAccounts = accounts.filter(a => a.is_active);

  // Group by currency then type for full-width list
  const allCurrencies = Array.from(new Set(activeAccounts.map(a => a.currency)));
  // Sort: base currency (MXN) first
  allCurrencies.sort((a, b) => (a === "MXN" ? -1 : b === "MXN" ? 1 : a.localeCompare(b)));

  const assetsByCurr = (currency: string) =>
    activeAccounts.filter(a => isAssetType(a.type) && a.currency === currency).sort((a, b) => a.name.localeCompare(b.name));

  const liabsShortByCurr = (currency: string) =>
    activeAccounts.filter(a => isLiabilityShort(a.type) && a.currency === currency).sort((a, b) => a.name.localeCompare(b.name));

  const liabsLongByCurr = (currency: string) =>
    activeAccounts.filter(a => isLiabilityLong(a.type) && a.currency === currency).sort((a, b) => b.current_balance - a.current_balance);

  const renderAccountRow = (account: Account) => {
    const Icon = typeIcons[account.type] || Wallet;
    const debt = isLiability(account.type);
    return (
      <div
        key={account.id}
        className="flex items-center gap-2 rounded-lg bg-card border border-border p-2.5 card-interactive cursor-pointer"
        onClick={() => navigate(`/accounts/${account.id}`)}
      >
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", debt ? "bg-expense/10" : "bg-income/10")}>
          <Icon className={cn("h-4 w-4", debt ? "text-expense" : "text-income")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{account.name}</p>
          <p className="text-[10px] text-muted-foreground">{typeLabels[account.type] || account.type}</p>
        </div>
        <div className="text-right mr-0.5">
          <p className={cn("text-xs font-semibold tabular-nums",
            debt
              ? (account.current_balance > 0 ? "text-income" : "text-expense")
              : (account.current_balance < 0 ? "text-expense" : "text-income")
          )}>
            {mask(fmt(account.current_balance, account.currency))}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={(e) => { e.stopPropagation(); setEditTarget(account); }}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(account); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
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
          {/* Summary cards: mirror of Dashboard — 2 columns */}
          <div className="flex justify-end -mb-1">
            <button onClick={toggle} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors" title={hidden ? "Mostrar montos" : "Ocultar montos"}>
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Left: Assets */}
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
            {/* Right: Liabilities */}
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

          {/* Full-width account list: Activos MXN → Activos USD → Pasivos MXN → Pasivos USD */}
          <div className="space-y-4">
            {/* Assets by currency */}
            {allCurrencies.map(currency => {
              const items = assetsByCurr(currency);
              if (items.length === 0) return null;
              return (
                <div key={`assets-${currency}`} className="space-y-1.5">
                  <h2 id={currency === allCurrencies[0] ? "section-assets" : undefined}
                    className="text-xs font-heading font-semibold text-foreground flex items-center gap-1.5 scroll-mt-24">
                    <TrendingUp className="h-3.5 w-3.5 text-income" /> Activos {currency}
                  </h2>
                  {items.map(renderAccountRow)}
                </div>
              );
            })}

            {/* Liabilities by currency */}
            {allCurrencies.map(currency => {
              const short = liabsShortByCurr(currency);
              const long = liabsLongByCurr(currency);
              if (short.length === 0 && long.length === 0) return null;
              return (
                <div key={`liabs-${currency}`} className="space-y-1.5">
                  <h2 id={currency === allCurrencies[0] ? "section-liabilities" : undefined}
                    className="text-xs font-heading font-semibold text-foreground flex items-center gap-1.5 scroll-mt-24">
                    <CreditCard className="h-3.5 w-3.5 text-expense" /> Pasivos {currency}
                  </h2>
                  {short.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Corto plazo</p>
                      {short.map(renderAccountRow)}
                    </div>
                  )}
                  {long.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Largo plazo</p>
                      {long.map(renderAccountRow)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <AccountForm open={formOpen} onOpenChange={setFormOpen} />
      <AccountEditSheet account={editTarget} open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }} />

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
