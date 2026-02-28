import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccounts, Account } from "@/hooks/useAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const accountTypes = [
  { value: "cash", label: "Efectivo" },
  { value: "bank", label: "Cuenta Bancaria" },
  { value: "savings", label: "Ahorro" },
  { value: "investment", label: "Inversión" },
  { value: "credit_card", label: "Tarjeta de Crédito" },
  { value: "payable", label: "Cuenta por Pagar" },
  { value: "mortgage", label: "Crédito Hipotecario" },
  { value: "auto_loan", label: "Crédito Automotriz" },
  { value: "personal_loan", label: "Crédito Personal" },
  { value: "caucion_bursatil", label: "Caución Bursátil" },
];

interface AccountEditSheetProps {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountEditSheet({ account, open, onOpenChange }: AccountEditSheetProps) {
  const { user } = useAuth();
  const { updateAccount } = useAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (account && open) {
      setName(account.name);
      setType(account.type);
      setNewBalance(String(account.current_balance));
      setReconciliationNote("");
      setShowConfirmDialog(false);
    }
  }, [account, open]);

  const fmt = (v: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);

  const parsedBalance = parseFloat(newBalance);
  const balanceDiff = !isNaN(parsedBalance) && account ? parsedBalance - account.current_balance : 0;
  const hasDiff = Math.abs(balanceDiff) > 0.01;

  const handleSaveClick = () => {
    if (!account) return;
    if (hasDiff) {
      setShowConfirmDialog(true);
      return;
    }
    executeSave();
  };

  const executeSave = async () => {
    if (!account || !user) return;
    setIsSaving(true);
    setShowConfirmDialog(false);
    try {
      const balanceChanged = hasDiff && !isNaN(parsedBalance);

      // Update name/type
      await updateAccount.mutateAsync({
        id: account.id,
        name,
        type: type as Account["type"],
        // Direct overwrite of current_balance if changed
        ...(balanceChanged ? { current_balance: parsedBalance } : {}),
      });

      // If balance changed, create reconciliation record (informational only)
      if (balanceChanged) {
        await supabase.from("account_reconciliations").insert({
          account_id: account.id,
          user_id: user.id,
          previous_balance: account.current_balance,
          new_balance: parsedBalance,
          delta: parsedBalance - account.current_balance,
          note: reconciliationNote.trim() || null,
        });
      }

      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["reconciliations"] }),
      ]);

      toast({ title: "Cuenta actualizada" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!account) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading">Editar cuenta</SheetTitle>
            <SheetDescription>Modifica los datos de tu cuenta.</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Tipo de cuenta</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Saldo actual ({account.currency})</Label>
              <Input
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Saldo registrado: {fmt(account.current_balance, account.currency)}
              </p>
            </div>

            {hasDiff && (
              <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
                <p className="text-sm text-foreground font-medium">Diferencia detectada</p>
                <p className="text-xs text-muted-foreground">
                  Saldo anterior: <span className="font-medium text-foreground">{fmt(account.current_balance, account.currency)}</span>
                  {" → "}
                  Nuevo saldo: <span className="font-medium text-foreground">{fmt(parsedBalance, account.currency)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Delta:{" "}
                  <span className={balanceDiff > 0 ? "text-income font-medium" : "text-expense font-medium"}>
                    {balanceDiff > 0 ? "+" : ""}{fmt(balanceDiff, account.currency)}
                  </span>
                </p>
              </div>
            )}

            {hasDiff && (
              <div className="space-y-2">
                <Label>Nota de conciliación (opcional)</Label>
                <Textarea
                  placeholder="Ej: Movimientos no registrados, corte bancario, efectivo..."
                  value={reconciliationNote}
                  onChange={(e) => setReconciliationNote(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSaveClick} disabled={isSaving || !name.trim()}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : "Guardar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog for balance reconciliation */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajuste de saldo (conciliación)</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Vas a reemplazar el saldo actual por el saldo real que indicas.
                </p>
                <p>
                  Las transacciones ya registradas <strong className="text-foreground">NO cambiarán</strong>.
                </p>
                <p>
                  Guardaremos una nota de conciliación con la diferencia para tu referencia.
                </p>
                <p className="font-medium text-foreground">
                  {fmt(account.current_balance, account.currency)} → {fmt(parsedBalance, account.currency)}{" "}
                  <span className={balanceDiff > 0 ? "text-income" : "text-expense"}>
                    ({balanceDiff > 0 ? "+" : ""}{fmt(balanceDiff, account.currency)})
                  </span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeSave}>
              Confirmar ajuste
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
