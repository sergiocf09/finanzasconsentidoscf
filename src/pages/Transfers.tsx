import { useState } from "react";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransfers } from "@/hooks/useTransfers";
import { useAccounts } from "@/hooks/useAccounts";
import { TransferForm } from "@/components/transfers/TransferForm";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

export default function Transfers() {
  const { transfers, isLoading, deleteTransfer } = useTransfers();
  const { accounts } = useAccounts();
  const [formOpen, setFormOpen] = useState(false);

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "—";

  const formatAmount = (amount: number, currency: string) => formatCurrency(amount, currency);

  return (
    <div className="space-y-6">
      {/* Header — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Transferencias</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nueva transferencia
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin transferencias</p>
          <p className="text-sm mt-1">Mueve dinero entre cuentas para verlo aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => (
            <div key={t.id} className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">
                  {getAccountName(t.from_account_id)} → {getAccountName(t.to_account_id)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(t.transfer_date), "d MMM yyyy", { locale: es })}
                  {t.description && ` · ${t.description}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums text-foreground">
                  {formatAmount(t.amount_from, t.currency_from)}
                </p>
                {t.currency_from !== t.currency_to && (
                  <p className="text-xs text-muted-foreground">
                    → {formatAmount(t.amount_to, t.currency_to)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteTransfer.mutate(t.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <TransferForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
