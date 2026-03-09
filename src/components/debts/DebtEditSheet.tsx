import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useDebts, Debt } from "@/hooks/useDebts";
import { useReconciliations } from "@/hooks/useReconciliations";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const debtTypes = [
  { value: "credit_card", label: "Tarjeta de Crédito" },
  { value: "personal_loan", label: "Préstamo Personal" },
  { value: "mortgage", label: "Hipoteca" },
  { value: "car_loan", label: "Crédito Automotriz" },
  { value: "student_loan", label: "Crédito Educativo" },
  { value: "other", label: "Otro" },
];

interface DebtEditSheetProps {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebtEditSheet({ debt, open, onOpenChange }: DebtEditSheetProps) {
  const { updateDebt } = useDebts();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [type, setType] = useState("credit_card");
  const [creditor, setCreditor] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [plannedPayment, setPlannedPayment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [cutDay, setCutDay] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [showBalanceConfirm, setShowBalanceConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (debt && open) {
      setName(debt.name);
      setType(debt.type);
      setCreditor(debt.creditor || "");
      setOriginalAmount(String(debt.original_amount));
      setCurrentBalance(String(Math.abs(debt.current_balance)));
      setInterestRate(String(debt.interest_rate ?? 0));
      setMinimumPayment(String(debt.minimum_payment ?? 0));
      setPlannedPayment(String((debt as any).planned_payment ?? 0));
      setDueDay(debt.due_day ? String(debt.due_day) : "");
      setCutDay(debt.cut_day ? String(debt.cut_day) : "");
      setReconciliationNote("");
    }
  }, [debt, open]);

  if (!debt) return null;

  const newBalanceNum = parseFloat(currentBalance) || 0;
  const oldBalanceAbs = Math.abs(debt.current_balance);
  const hasDiff = Math.abs(newBalanceNum - oldBalanceAbs) >= 0.01;

  const fmt = (v: number) => formatCurrency(v, debt.currency);

  const handleSave = () => {
    if (hasDiff) {
      setShowBalanceConfirm(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      // The new balance should be negative for liabilities
      const signedBalance = newBalanceNum > 0 ? -newBalanceNum : newBalanceNum;

      await updateDebt.mutateAsync({
        id: debt.id,
        name,
        type: type as Debt["type"],
        creditor: creditor || null,
        original_amount: parseFloat(originalAmount) || 0,
        current_balance: signedBalance,
        interest_rate: parseFloat(interestRate) || 0,
        minimum_payment: parseFloat(minimumPayment) || 0,
        planned_payment: parseFloat(plannedPayment) || 0,
        due_day: dueDay ? parseInt(dueDay) : null,
        cut_day: cutDay ? parseInt(cutDay) : null,
      });

      // If balance changed, record reconciliation on linked account
      if (hasDiff && debt.account_id) {
        const oldSigned = debt.current_balance;
        await supabase.from("account_reconciliations").insert({
          account_id: debt.account_id,
          user_id: debt.user_id,
          previous_balance: oldSigned,
          new_balance: signedBalance,
          delta: signedBalance - oldSigned,
          note: reconciliationNote || "Ajuste desde módulo de deudas",
        });
        queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      }

      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setShowBalanceConfirm(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar deuda</SheetTitle>
            <SheetDescription>Modifica los datos de esta deuda.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {debtTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Acreedor</Label>
                <Input value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="Ej: BBVA" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto original</Label>
                <Input type="number" step="0.01" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
              </div>
              <div>
                <Label>Saldo actual</Label>
                <Input type="number" step="0.01" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} />
              </div>
            </div>

            {hasDiff && (
              <div className="rounded-lg bg-status-warning/10 border border-status-warning/20 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Saldo anterior: <strong>{fmt(oldBalanceAbs)}</strong> → Nuevo: <strong>{fmt(newBalanceNum)}</strong>
                </p>
                <Textarea
                  placeholder="Nota de ajuste (opcional)"
                  value={reconciliationNote}
                  onChange={(e) => setReconciliationNote(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tasa de interés (%)</Label>
                <Input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
              </div>
              <div>
                <Label>Pago mínimo</Label>
                <Input type="number" step="0.01" value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Día de corte</Label>
                <Input type="number" min="1" max="31" value={cutDay} onChange={(e) => setCutDay(e.target.value)} placeholder="15" />
              </div>
              <div>
                <Label>Día de pago</Label>
                <Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="5" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !name}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showBalanceConfirm} onOpenChange={setShowBalanceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ajuste de saldo</AlertDialogTitle>
            <AlertDialogDescription>
              El saldo cambiará de {fmt(oldBalanceAbs)} a {fmt(newBalanceNum)}. Se registrará un ajuste en la cuenta asociada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeSave}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
