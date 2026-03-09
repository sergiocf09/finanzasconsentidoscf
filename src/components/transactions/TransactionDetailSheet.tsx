import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Edit2, Check, X, Trash2, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  transaction_date: string;
  category_id: string | null;
  account_id: string;
  related_account_id: string | null;
  voice_transcript: string | null;
  created_at: string | null;
  is_recurring?: boolean | null;
  recurring_payment_id?: string | null;
}

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailSheet({ transaction, open, onOpenChange }: TransactionDetailSheetProps) {
  const { categories, expenseCategories, incomeCategories } = useCategories();
  const { accounts } = useAccounts();
  const { updateTransaction, deleteTransaction } = useTransactions();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit state
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (transaction && open) {
      setEditAmount(String(transaction.amount));
      setEditType(transaction.type);
      setEditAccountId(transaction.account_id);
      setEditCategoryId(transaction.category_id || "");
      setEditDescription(transaction.description || "");
      setEditDate(transaction.transaction_date);
      setEditNotes(transaction.notes || "");
      setIsEditing(false);
    }
  }, [transaction, open]);

  if (!transaction) return null;

  const fmt = (v: number, c: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);

  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? "Sin categoría";
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name ?? "—";
  const typeLabels: Record<string, string> = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia", adjustment_income: "Ajuste (+)", adjustment_expense: "Ajuste (-)" };
  const typeColors: Record<string, string> = { expense: "text-expense", income: "text-income", transfer: "text-muted-foreground", adjustment_income: "text-muted-foreground", adjustment_expense: "text-muted-foreground" };

  const dateFormatted = format(new Date(transaction.transaction_date + "T12:00:00"), "EEEE d 'de' MMMM, yyyy", { locale: es });

  const filteredCategories = editType === "income" ? incomeCategories : expenseCategories;
  const activeAccounts = accounts.filter(a => a.is_active);

  const handleSave = async () => {
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0 || !editAccountId) return;

    await updateTransaction.mutateAsync({
      id: transaction.id,
      type: editType as any,
      amount,
      account_id: editAccountId,
      category_id: editCategoryId || null,
      description: editDescription || null,
      notes: editNotes || null,
      transaction_date: editDate,
    });
    setIsEditing(false);
    onOpenChange(false);
  };

  if (isEditing) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="font-heading text-lg">Editar movimiento</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Gasto</SelectItem>
                    <SelectItem value="income">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Monto</label>
                <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Cuenta</label>
                <Select value={editAccountId} onValueChange={setEditAccountId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map(a => {
                      const bal = new Intl.NumberFormat("es-MX", { style: "currency", currency: a.currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(a.current_balance ?? 0);
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center justify-between w-full gap-2">
                            <span>{a.name}</span>
                            <span className="text-muted-foreground text-[10px]">{bal}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-9" />
              </div>
              <div className="flex-[2]">
                <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="h-9" placeholder="Descripción" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notas</label>
              <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-9" placeholder="Notas adicionales" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={updateTransaction.isPending}>
                <Check className="h-4 w-4 mr-1" /> Guardar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "Tipo", value: typeLabels[transaction.type] ?? transaction.type, className: typeColors[transaction.type] },
    { label: "Monto", value: `${transaction.type === "expense" ? "- " : transaction.type === "income" ? "+ " : ""}${fmt(transaction.amount, transaction.currency)}`, className: transaction.type === "expense" ? "text-expense" : transaction.type === "income" ? "text-income" : undefined },
    { label: "Moneda", value: transaction.currency },
    { label: "Fecha", value: dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1) },
    { label: "Cuenta", value: getAccountName(transaction.account_id) },
  ];

  if (transaction.related_account_id) {
    rows.push({ label: "Cuenta destino", value: getAccountName(transaction.related_account_id) });
  }
  rows.push({ label: "Categoría", value: getCategoryName(transaction.category_id) });
  if (transaction.description) rows.push({ label: "Descripción", value: transaction.description });
  if (transaction.notes) rows.push({ label: "Notas", value: transaction.notes });
  if (transaction.voice_transcript) rows.push({ label: "Transcripción de voz", value: transaction.voice_transcript });

  const canEdit = !["adjustment_income", "adjustment_expense", "transfer"].includes(transaction.type);

  const handleDelete = async () => {
    await deleteTransaction.mutateAsync(transaction.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="font-heading text-lg">Detalle del movimiento</SheetTitle>
                {transaction.is_recurring && (
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                    <Repeat className="h-2.5 w-2.5 mr-0.5" /> Recurrente
                  </Badge>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El saldo de la cuenta se actualizará automáticamente.
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
