import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Wallet, Building2, PiggyBank, CreditCard, TrendingUp, Trash2, HandCoins,
  Home, Car, User, Landmark, ShieldCheck, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAccounts, Account, isAssetType, isLiabilityShort, isLiabilityLong, isLiability,
} from "@/hooks/useAccounts";
import { AccountForm } from "@/components/accounts/AccountForm";
import { AccountEditSheet } from "@/components/accounts/AccountEditSheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const typeIcons: Record<string, typeof Wallet> = {
  cash: Wallet, bank: Building2, savings: PiggyBank, investment: TrendingUp,
  credit_card: CreditCard, payable: HandCoins, mortgage: Home, auto_loan: Car,
  personal_loan: User, caucion_bursatil: Landmark,
};

const typeLabels: Record<string, string> = {
  cash: "Efectivo", bank: "Cuenta bancaria", savings: "Ahorro", investment: "Inversión",
  credit_card: "Tarjeta de crédito", payable: "Cuenta por pagar", mortgage: "Crédito hipotecario",
  auto_loan: "Crédito automotriz", personal_loan: "Crédito personal", caucion_bursatil: "Caución bursátil",
};

const fmt = (value: number, currency: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value));

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, isLoading, assetsByCurrency, liabilitiesByCurrency, deleteAccount } = useAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAccount.mutateAsync(deleteTarget.id);
    } catch {
      // Error handled by mutation
    }
    setDeleteTarget(null);
  };

  // Count transactions for delete warning
  const getTransactionCount = async (accountId: string) => {
    // We show warning in the dialog itself
    return 0;
  };

  const assets = accounts.filter(a => isAssetType(a.type)).sort((a, b) => a.name.localeCompare(b.name));
  const liabilitiesShort = accounts.filter(a => isLiabilityShort(a.type)).sort((a, b) => a.name.localeCompare(b.name));
  const liabilitiesLong = accounts.filter(a => isLiabilityLong(a.type)).sort((a, b) => b.current_balance - a.current_balance);

  const renderAccountRow = (account: Account) => {
    const Icon = typeIcons[account.type] || Wallet;
    const debt = isLiability(account.type);
    return (
      <div
        key={account.id}
        className="flex items-center gap-3 rounded-xl bg-card border border-border p-3 card-interactive cursor-pointer"
        onClick={() => navigate(`/accounts/${account.id}`)}
      >
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shrink-0", debt ? "bg-expense/10" : "bg-muted")}>
          <Icon className={cn("h-5 w-5", debt ? "text-expense" : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
          <p className="text-xs text-muted-foreground">{typeLabels[account.type] || account.type}</p>
        </div>
        <div className="text-right mr-1">
          <p className={cn("text-sm font-semibold tabular-nums", debt ? "text-expense" : "text-foreground")}>
            {debt && account.current_balance > 0 ? "-" : ""}{fmt(account.current_balance, account.currency)}
          </p>
          <p className="text-xs text-muted-foreground">{account.currency}</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={(e) => { e.stopPropagation(); setEditTarget(account); }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(account); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header — sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 -mx-1 px-1 pt-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Cuentas</h1>
            <p className="text-sm text-muted-foreground">Panorama de activos y pasivos</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva cuenta
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
          {/* Summary cards by currency — clickable to scroll */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(assetsByCurrency).map(([currency, total]) => (
              <div
                key={`asset-${currency}`}
                className="rounded-2xl bg-primary p-4 text-primary-foreground cursor-pointer card-interactive"
                onClick={() => document.getElementById("section-assets")?.scrollIntoView({ behavior: "smooth" })}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 opacity-80" />
                  <p className="text-xs opacity-80">Activos ({currency})</p>
                </div>
                <p className="text-2xl font-bold font-heading">{fmt(total, currency)}</p>
              </div>
            ))}
            {Object.entries(liabilitiesByCurrency).map(([currency, total]) => (
              <div
                key={`liab-${currency}`}
                className="rounded-2xl bg-expense/10 border border-expense/20 p-4 cursor-pointer card-interactive"
                onClick={() => document.getElementById("section-liabilities")?.scrollIntoView({ behavior: "smooth" })}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4 text-expense opacity-80" />
                  <p className="text-xs text-expense opacity-80">Pasivos ({currency})</p>
                </div>
                <p className="text-2xl font-bold font-heading text-expense">{fmt(total, currency)}</p>
              </div>
            ))}
          </div>

          {/* Two-column layout: assets left, liabilities right */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Assets */}
            <div className="space-y-3">
              <h2 id="section-assets" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2 scroll-mt-24">
                <TrendingUp className="h-4 w-4 text-income" /> Activos
              </h2>
              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin cuentas de activo</p>
              ) : assets.map(renderAccountRow)}
            </div>

            {/* Liabilities */}
            <div className="space-y-3">
              <h2 id="section-liabilities" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2 scroll-mt-24">
                <CreditCard className="h-4 w-4 text-expense" /> Pasivos
              </h2>
              {liabilitiesShort.length === 0 && liabilitiesLong.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin pasivos registrados</p>
              ) : (
                <>
                  {liabilitiesShort.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Corto plazo</p>
                      {liabilitiesShort.map(renderAccountRow)}
                    </div>
                  )}
                  {liabilitiesLong.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Mediano / Largo plazo</p>
                      {liabilitiesLong.map(renderAccountRow)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <AccountForm open={formOpen} onOpenChange={setFormOpen} />
      <AccountEditSheet account={editTarget} open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cuenta?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Estás a punto de eliminar <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>.
              </span>
              <span className="block">
                Si tiene movimientos asociados, la eliminación podría fallar. En ese caso, te recomendamos desactivarla desde la edición.
              </span>
              <span className="block font-medium text-foreground">Esta acción no se puede deshacer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
