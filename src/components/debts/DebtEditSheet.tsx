import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useDebts, Debt } from "@/hooks/useDebts";
import { useAccounts } from "@/hooks/useAccounts";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ReconciliationSheet } from "@/components/debts/ReconciliationSheet";

const debtTypes = [
  { value: "credit_card", label: "Tarjeta de Crédito" },
  { value: "personal_loan", label: "Préstamo Personal" },
  { value: "mortgage", label: "Hipoteca" },
  { value: "car_loan", label: "Crédito Automotriz" },
  { value: "student_loan", label: "Crédito Educativo" },
  { value: "other", label: "Otro" },
];

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

interface DebtEditSheetProps {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenReconciliation?: (debt: Debt) => void;
}

export function DebtEditSheet({ debt, open, onOpenChange, onOpenReconciliation }: DebtEditSheetProps) {
  const { updateDebt } = useDebts();
  const { accounts } = useAccounts();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const liabilityAccounts = accounts.filter(a =>
    a.is_active &&
    ['credit_card', 'mortgage', 'auto_loan', 'personal_loan', 'caucion_bursatil', 'payable'].includes(a.type)
  );

  const [name, setName] = useState("");
  const [type, setType] = useState("credit_card");
  const [creditor, setCreditor] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [plannedPayment, setPlannedPayment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [cutDay, setCutDay] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  useEffect(() => {
    if (debt && open) {
      setName(debt.name);
      setType(debt.type);
      setCreditor(debt.creditor || "");
      setOriginalAmount(String(debt.original_amount));
      setInterestRate(String(debt.interest_rate ?? 0));
      setMinimumPayment(String(debt.minimum_payment ?? 0));
      setPlannedPayment(String((debt as any).planned_payment ?? 0));
      setDueDay(debt.due_day ? String(debt.due_day) : "");
      setCutDay(debt.cut_day ? String(debt.cut_day) : "");
      setAccountId(debt.account_id || "");
    }
  }, [debt, open]);

  if (!debt) return null;

  const fmt = (v: number) => formatCurrency(v, debt.currency);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDebt.mutateAsync({
        id: debt.id,
        name,
        type: type as Debt["type"],
        creditor: creditor || null,
        original_amount: parseFloat(originalAmount) || 0,
        interest_rate: parseFloat(interestRate) || 0,
        minimum_payment: parseFloat(minimumPayment) || 0,
        planned_payment: parseFloat(plannedPayment) || 0,
        due_day: dueDay ? parseInt(dueDay) : null,
        cut_day: cutDay ? parseInt(cutDay) : null,
        account_id: accountId || null,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
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

          <div className="space-y-1.5 mt-3">
            <FieldRow label="Nombre">
              <Input className="h-8 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </FieldRow>

            <FieldRow label="Tipo">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {debtTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Acreedor" hint="Opcional">
              <Input className="h-8 text-sm" value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="Ej: BBVA" />
            </FieldRow>

            <FieldRow label="Monto original">
              <Input className="h-8 text-sm text-right" type="number" step="0.01" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
            </FieldRow>

            <FieldRow label="Saldo actual">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-right tabular-nums">
                  {fmt(Math.abs(debt.current_balance))}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  El saldo se actualiza mediante conciliación con tu estado de cuenta.
                </p>
              </div>
            </FieldRow>

            <FieldRow label="Cuenta vinculada" hint="Para pago automático al transferir">
              <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin cuenta vinculada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cuenta vinculada</SelectItem>
                  {liabilityAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            {accountId && accountId !== "none" && (
              <p className="text-[10px] text-muted-foreground pl-[42%] -mt-1">
                Cuando transfieras dinero a esta cuenta, la deuda se reducirá automáticamente.
              </p>
            )}

            <FieldRow label="Tasa de interés" hint="% anual">
              <Input className="h-8 text-sm text-right" type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </FieldRow>

            <FieldRow label="Pago mínimo" hint="Mensual">
              <Input className="h-8 text-sm text-right" type="number" step="0.01" value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} />
            </FieldRow>

            {type === "credit_card" && (
              <FieldRow label="Pago deseado" hint="Lo que planeas pagar">
                <Input className="h-8 text-sm text-right" type="number" step="0.01" value={plannedPayment} onChange={(e) => setPlannedPayment(e.target.value)} placeholder="0.00" />
              </FieldRow>
            )}

            <FieldRow label="Día de corte">
              <Input className="h-8 text-sm text-right" type="number" min="1" max="31" value={cutDay} onChange={(e) => setCutDay(e.target.value)} placeholder="15" />
            </FieldRow>

            <FieldRow label="Día de pago">
              <Input className="h-8 text-sm text-right" type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="5" />
            </FieldRow>

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 text-primary border-primary/30 hover:bg-primary/5 h-8 text-xs"
                onClick={() => setReconcileOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Actualizar saldo real
              </Button>
            </div>

            <div className="flex gap-3 pt-3 border-t border-border mt-3">
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

      {debt && (
        <ReconciliationSheet
          open={reconcileOpen}
          onOpenChange={setReconcileOpen}
          debtId={debt.id}
          debtName={debt.name}
          currentBalance={Math.abs(debt.current_balance ?? 0)}
          currency={debt.currency}
          reconciliationType={debt.type === "credit_card" ? "current" : "fixed"}
        />
      )}
    </>
  );
}
