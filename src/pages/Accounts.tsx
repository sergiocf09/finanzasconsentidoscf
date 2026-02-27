import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Wallet, Building2, PiggyBank, CreditCard, TrendingUp, Pencil, Trash2, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAccounts, Account } from "@/hooks/useAccounts";
import { AccountForm } from "@/components/accounts/AccountForm";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const typeIcons: Record<string, typeof Wallet> = {
  cash: Wallet,
  bank: Building2,
  savings: PiggyBank,
  investment: TrendingUp,
  credit_card: CreditCard,
  payable: HandCoins,
};

const typeLabels: Record<string, string> = {
  cash: "Efectivo",
  bank: "Cuenta bancaria",
  savings: "Ahorro",
  investment: "Inversión",
  credit_card: "Tarjeta de crédito",
  payable: "Cuenta por pagar",
};

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, isLoading, totalBalance, deleteAccount } = useAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const formatAmount = (value: number, currency: string) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAccount.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Cuentas</h1>
          <p className="text-muted-foreground">Administra tu dinero en diferentes lugares</p>
        </div>
        <Button className="gap-2" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      {/* Total Balance */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground card-elevated">
        <p className="text-sm text-primary-foreground/80">Saldo total (MXN)</p>
        {isLoading ? (
          <Skeleton className="h-10 w-48 bg-primary-foreground/20 mt-1" />
        ) : (
          <p className="text-4xl font-bold font-heading mt-1">
            {formatAmount(totalBalance, "MXN")}
          </p>
        )}
        <p className="text-sm text-primary-foreground/80 mt-2">
          En {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Accounts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin cuentas todavía</p>
          <p className="text-sm mt-1">Crea tu primera cuenta para empezar a registrar movimientos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const Icon = typeIcons[account.type] || Wallet;
            const isNegative = account.current_balance < 0;
            const isDebt = account.type === "credit_card" || account.type === "payable";

            return (
              <div
                key={account.id}
                className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 card-interactive cursor-pointer"
                onClick={() => navigate(`/accounts/${account.id}`)}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl",
                    isDebt ? "bg-expense/10" : account.type === "savings" ? "bg-income/10" : "bg-muted"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-6 w-6",
                      isDebt ? "text-expense" : account.type === "savings" ? "text-income" : "text-muted-foreground"
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{account.name}</p>
                  <p className="text-sm text-muted-foreground">{typeLabels[account.type] || account.type}</p>
                </div>

                <div className="text-right mr-2">
                  <p
                    className={cn(
                      "font-semibold tabular-nums",
                      isNegative ? "text-expense" : "text-foreground"
                    )}
                  >
                    {isNegative && "-"}
                    {formatAmount(account.current_balance, account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">{account.currency}</p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(account); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AccountForm open={formOpen} onOpenChange={setFormOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la cuenta "{deleteTarget?.name}". Si tiene movimientos asociados, esta acción podría fallar.
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
