import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Repeat, Calendar, Wallet, Tag, AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/formatters";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import {
  useRecurringPayments,
  useRecurringPaymentTransactions,
  FREQUENCY_LABELS,
  STATUS_LABELS,
  type RecurringPayment,
} from "@/hooks/useRecurringPayments";
import { RecurringPaymentForm } from "./RecurringPaymentForm";

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xs font-medium text-right">{value}</span>
  </div>
);

interface Props {
  payment: RecurringPayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecurringPaymentDetailSheet({ payment, open, onOpenChange }: Props) {
  const { accounts } = useAccounts();
  const { categories: allCategories } = useCategories();
  const { cancelPayment, updatePayment } = useRecurringPayments();
  const { data: linkedTxs } = useRecurringPaymentTransactions(payment?.id ?? null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (!payment) return null;

  const account = accounts.find(a => a.id === payment.account_id);
  const category = allCategories.find(c => c.id === payment.category_id);

  const statusColor = payment.status === "active" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    : payment.status === "paused" ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
    : "bg-muted text-muted-foreground";

  const handleTogglePause = async () => {
    const newStatus = payment.status === "active" ? "paused" : "active";
    await updatePayment.mutateAsync({ id: payment.id, status: newStatus } as any);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <SheetTitle className="text-base font-heading">{payment.name}</SheetTitle>
              <Badge className={`text-[10px] ${statusColor}`}>{STATUS_LABELS[payment.status] || payment.status}</Badge>
            </div>
            <SheetDescription className="text-xs">{payment.description || "Pago programado"}</SheetDescription>
          </SheetHeader>

          <div className="space-y-0.5 py-2">
            <InfoRow label="Importe recurrente" value={formatCurrency(payment.amount, payment.currency)} />
            {payment.original_total_amount && (
              <InfoRow label="Importe original" value={formatCurrency(payment.original_total_amount, payment.currency)} />
            )}
            <InfoRow label="Frecuencia" value={FREQUENCY_LABELS[payment.frequency] || payment.frequency} />
            <InfoRow label="Fecha inicio" value={format(new Date(payment.start_date), "dd MMM yyyy", { locale: es })} />
            {payment.end_date && (
              <InfoRow label="Fecha fin" value={format(new Date(payment.end_date), "dd MMM yyyy", { locale: es })} />
            )}
            <InfoRow label="Próximo cargo" value={
              payment.status === "active"
                ? format(new Date(payment.next_execution_date), "dd MMM yyyy", { locale: es })
                : "—"
            } />
            <InfoRow label="Pagos realizados" value={
              payment.total_payments
                ? `${payment.payments_made} / ${payment.total_payments}`
                : String(payment.payments_made)
            } />
            {payment.remaining_balance != null && (
              <InfoRow label="Saldo pendiente" value={formatCurrency(payment.remaining_balance, payment.currency)} />
            )}
            <InfoRow label="Cuenta" value={account?.name || "—"} />
            <InfoRow label="Categoría" value={category?.name || "—"} />
            {payment.notes && <InfoRow label="Notas" value={payment.notes} />}
          </div>

          {/* Linked transactions */}
          {linkedTxs && linkedTxs.length > 0 && (
            <div className="pt-3">
              <Label className="text-xs font-medium text-muted-foreground">Movimientos generados</Label>
              <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                {linkedTxs.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                    <span>{format(new Date(tx.transaction_date), "dd/MM/yy", { locale: es })}</span>
                    <span className="font-medium">{formatCurrency(tx.amount, tx.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {payment.status !== "cancelled" && payment.status !== "completed" && (
            <div className="flex gap-2 pt-4">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleTogglePause}>
                {payment.status === "active" ? "Pausar" : "Reanudar"}
              </Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => setCancelOpen(true)}>
                Cancelar
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Cancelar pago recurrente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {payment.original_total_amount && payment.remaining_balance != null && payment.remaining_balance > 0 ? (
                <>
                  <p>Esta operación correspondía a un total de {formatCurrency(payment.original_total_amount, payment.currency)}.</p>
                  <p>Se han realizado {payment.payments_made} pagos de {formatCurrency(payment.amount, payment.currency)}.</p>
                  <p className="font-medium">Queda un saldo pendiente estimado de {formatCurrency(payment.remaining_balance, payment.currency)}.</p>
                </>
              ) : (
                <p>Se detendrán todos los cargos futuros. Los movimientos ya generados no se eliminarán.</p>
              )}
              <p>¿Deseas cancelar este pago recurrente?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction onClick={() => { cancelPayment.mutate(payment.id); setCancelOpen(false); onOpenChange(false); }}>
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit form */}
      <RecurringPaymentForm open={editOpen} onOpenChange={setEditOpen} editPayment={payment} />
    </>
  );
}
