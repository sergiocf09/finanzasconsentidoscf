import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Edit2, Check, X, Trash2 } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransfers, Transfer } from "@/hooks/useTransfers";

interface TransferDetailSheetProps {
  transfer: Transfer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferDetailSheet({ transfer, open, onOpenChange }: TransferDetailSheetProps) {
  const { accounts } = useAccounts();
  const { updateTransfer, deleteTransfer } = useTransfers();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editFromId, setEditFromId] = useState("");
  const [editToId, setEditToId] = useState("");
  const [editAmountFrom, setEditAmountFrom] = useState("");
  const [editAmountTo, setEditAmountTo] = useState("");
  const [editFxRate, setEditFxRate] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const activeAccounts = accounts.filter(a => a.is_active);

  useEffect(() => {
    if (transfer && open) {
      setEditFromId(transfer.from_account_id);
      setEditToId(transfer.to_account_id);
      setEditAmountFrom(String(transfer.amount_from));
      setEditAmountTo(String(transfer.amount_to));
      setEditFxRate(transfer.fx_rate ? String(transfer.fx_rate) : "");
      setEditDate(transfer.transfer_date);
      setEditDescription(transfer.description || "");
      setIsEditing(false);
    }
  }, [transfer, open]);

  if (!transfer) return null;

  const fmt = (v: number, c: string) => formatCurrency(v, c, { decimals: 2 });

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name ?? "—";
  const getAccountCurrency = (id: string) => accounts.find(a => a.id === id)?.currency ?? "MXN";

  const fromAccount = activeAccounts.find(a => a.id === editFromId);
  const toAccount = activeAccounts.find(a => a.id === editToId);
  const needsFx = fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  const dateFormatted = format(new Date(transfer.transfer_date + "T12:00:00"), "EEEE d 'de' MMMM, yyyy", { locale: es });

  const handleSave = async () => {
    const amountFrom = parseFloat(editAmountFrom);
    const amountTo = parseFloat(editAmountTo) || amountFrom;
    if (!amountFrom || amountFrom <= 0 || !editFromId || !editToId || editFromId === editToId) return;

    const from = activeAccounts.find(a => a.id === editFromId)!;
    const to = activeAccounts.find(a => a.id === editToId)!;

    await updateTransfer.mutateAsync({
      id: transfer.id,
      from_account_id: editFromId,
      to_account_id: editToId,
      amount_from: amountFrom,
      amount_to: from.currency !== to.currency ? amountTo : amountFrom,
      currency_from: from.currency,
      currency_to: to.currency,
      fx_rate: editFxRate ? parseFloat(editFxRate) : null,
      transfer_date: editDate,
      description: editDescription || null,
    });
    setIsEditing(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await deleteTransfer.mutateAsync(transfer.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const fmtBalance = (acc: typeof accounts[0]) => formatCurrency(acc.current_balance ?? 0, acc.currency);

  if (isEditing) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="font-heading text-lg">Editar transferencia</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cuenta origen</label>
              <Select value={editFromId} onValueChange={setEditFromId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center justify-between w-full gap-2">
                        <span>{a.name}</span>
                        <span className="text-muted-foreground text-[10px]">{fmtBalance(a)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cuenta destino</label>
              <Select value={editToId} onValueChange={setEditToId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.filter(a => a.id !== editFromId).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center justify-between w-full gap-2">
                        <span>{a.name}</span>
                        <span className="text-muted-foreground text-[10px]">{fmtBalance(a)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Monto origen {fromAccount ? `(${fromAccount.currency})` : ""}</label>
                <Input type="number" step="0.01" value={editAmountFrom} onChange={e => setEditAmountFrom(e.target.value)} className="h-9" />
              </div>
              {needsFx && (
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Monto destino ({toAccount?.currency})</label>
                  <Input type="number" step="0.01" value={editAmountTo} onChange={e => {
                    setEditAmountTo(e.target.value);
                    const at = parseFloat(e.target.value);
                    const af = parseFloat(editAmountFrom);
                    if (at > 0 && af > 0) setEditFxRate(String(Math.round((at / af) * 10000) / 10000));
                  }} className="h-9" />
                </div>
              )}
            </div>
            {needsFx && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo de cambio</label>
                <Input type="number" step="0.0001" value={editFxRate} onChange={e => {
                  setEditFxRate(e.target.value);
                  const rate = parseFloat(e.target.value);
                  const af = parseFloat(editAmountFrom);
                  if (rate > 0 && af > 0) setEditAmountTo(String(Math.round(af * rate * 100) / 100));
                }} className="h-9" />
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-9" />
              </div>
              <div className="flex-[2]">
                <label className="text-xs font-medium text-muted-foreground">Concepto</label>
                <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="h-9" placeholder="Concepto" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={updateTransfer.isPending}>
                <Check className="h-4 w-4 mr-1" /> Guardar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const isCrossCurrency = transfer.currency_from !== transfer.currency_to;
  const rows: { label: string; value: string; className?: string }[] = [
    { label: "Tipo", value: "Transferencia", className: "text-muted-foreground" },
    { label: "Cuenta origen", value: getAccountName(transfer.from_account_id) },
    { label: "Cuenta destino", value: getAccountName(transfer.to_account_id) },
    { label: "Monto", value: fmt(transfer.amount_from, transfer.currency_from) },
  ];
  if (isCrossCurrency) {
    rows.push({ label: "Monto destino", value: fmt(transfer.amount_to, transfer.currency_to) });
    if (transfer.fx_rate) rows.push({ label: "Tipo de cambio", value: String(transfer.fx_rate) });
  }
  rows.push({ label: "Fecha", value: dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1) });
  if (transfer.description) rows.push({ label: "Concepto", value: transfer.description });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-heading text-lg">Detalle de transferencia</SheetTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={cn("text-sm font-medium text-right max-w-[60%] break-words", row.className)}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar transferencia?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los saldos de ambas cuentas se actualizarán automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
