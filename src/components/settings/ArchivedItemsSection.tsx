import { useState } from "react";
import { Archive, RotateCcw, Wallet, CreditCard, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccounts, Account, isLiability } from "@/hooks/useAccounts";
import { useDebts, Debt } from "@/hooks/useDebts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
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

export function ArchivedItemsSection() {
  const { accounts, isLoading: loadingAccounts } = useAccounts();
  const { debts, isLoading: loadingDebts } = useDebts();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState(false);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ type: "account" | "debt"; item: Account | Debt } | null>(null);

  const archivedAccounts = accounts.filter((a) => !a.is_active);
  const archivedDebts = debts.filter((d) => !d.is_active);
  const totalArchived = archivedAccounts.length + archivedDebts.length;

  const handleReactivateAccount = async (account: Account) => {
    setReactivating(account.id);
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: true })
        .eq("id", account.id);

      if (error) throw error;

      // If it's a liability, also reactivate linked debt
      if (isLiability(account.type)) {
        await supabase
          .from("debts")
          .update({ is_active: true })
          .eq("account_id", account.id);
        queryClient.invalidateQueries({ queryKey: ["debts"] });
      }

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Cuenta reactivada", description: `"${account.name}" está activa nuevamente.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReactivating(null);
      setConfirmTarget(null);
    }
  };

  const handleReactivateDebt = async (debt: Debt) => {
    setReactivating(debt.id);
    try {
      const { error } = await supabase
        .from("debts")
        .update({ is_active: true })
        .eq("id", debt.id);

      if (error) throw error;

      // Also reactivate linked account if exists
      if (debt.account_id) {
        await supabase
          .from("accounts")
          .update({ is_active: true })
          .eq("id", debt.account_id);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }

      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast({ title: "Deuda reactivada", description: `"${debt.name}" está activa nuevamente.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReactivating(null);
      setConfirmTarget(null);
    }
  };

  const handleConfirmReactivate = () => {
    if (!confirmTarget) return;
    if (confirmTarget.type === "account") {
      handleReactivateAccount(confirmTarget.item as Account);
    } else {
      handleReactivateDebt(confirmTarget.item as Debt);
    }
  };

  if (loadingAccounts || loadingDebts) {
    return (
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-medium text-foreground">Elementos archivados</h2>
        </div>
        <div className="p-4 text-center text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full p-4 border-b border-border hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">Elementos archivados</h2>
            {totalArchived > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {totalArchived}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="divide-y divide-border">
            {totalArchived === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No hay cuentas ni deudas archivadas
              </div>
            ) : (
              <>
                {/* Archived Accounts */}
                {archivedAccounts.length > 0 && (
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Wallet className="h-3.5 w-3.5" />
                      Cuentas ({archivedAccounts.length})
                    </h3>
                    <div className="space-y-2">
                      {archivedAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{account.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(account.current_balance, account.currency)} · {account.type}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmTarget({ type: "account", item: account })}
                            disabled={reactivating === account.id}
                          >
                            {reactivating === account.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reactivar
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archived Debts */}
                {archivedDebts.length > 0 && (
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5" />
                      Deudas ({archivedDebts.length})
                    </h3>
                    <div className="space-y-2">
                      {archivedDebts.map((debt) => (
                        <div
                          key={debt.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{debt.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(debt.current_balance, debt.currency)} · {debt.type}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmTarget({ type: "debt", item: debt })}
                            disabled={reactivating === debt.id}
                          >
                            {reactivating === debt.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reactivar
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar {confirmTarget?.type === "account" ? "cuenta" : "deuda"}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmTarget?.item.name}" volverá a aparecer en las listas activas
              {confirmTarget?.type === "account" && isLiability((confirmTarget.item as Account).type)
                ? " junto con su deuda asociada."
                : confirmTarget?.type === "debt" && (confirmTarget.item as Debt).account_id
                ? " junto con su cuenta asociada."
                : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReactivate}>Reactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
