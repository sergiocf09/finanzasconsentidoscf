import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useDebts, Debt } from "@/hooks/useDebts";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BalanceAdjustmentSheetProps {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[45%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

export function BalanceAdjustmentSheet({ debt, open, onOpenChange }: BalanceAdjustmentSheetProps) {
  const { updateDebt, addPayment } = useDebts();
  const { toast } = useToast();
  const [realBalance, setRealBalance] = useState("");
  const [saving, setSaving] = useState(false);

  if (!debt) return null;

  const currentBalance = Math.abs(debt.current_balance);
  const realBalanceNum = Number(realBalance);
  const hasDiff = realBalance !== "" && !isNaN(realBalanceNum) && realBalanceNum !== currentBalance;
  const diff = realBalanceNum - currentBalance;

  const handleBalanceAdjustment = async () => {
    if (!hasDiff || !debt) return;
    setSaving(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      if (diff > 0) {
        // Bank charges more (interests/insurance) — register as interest_insurance payment
        await addPayment.mutateAsync({
          debt_id: debt.id,
          amount: diff,
          payment_type: "interest_insurance",
          interest_amount: diff,
          payment_date: today,
          notes: `Ajuste por intereses y seguros del mes`,
        });
      }

      // Update the debt balance and statement info
      await updateDebt.mutateAsync({
        id: debt.id,
        current_balance: realBalanceNum,
        last_statement_balance: realBalanceNum,
        last_statement_date: today,
      } as any);

      toast({
        title: "Saldo actualizado",
        description: diff > 0
          ? `Intereses y seguros del mes: ${formatCurrencyAbs(diff, debt.currency)}`
          : `Saldo ajustado a la baja: -${formatCurrencyAbs(Math.abs(diff), debt.currency)}`,
      });

      setRealBalance("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Actualizar saldo real</SheetTitle>
          <SheetDescription className="text-xs">{debt.name}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          <p className="text-sm text-muted-foreground">
            Ingresa el saldo real según tu estado de cuenta del banco.
            La diferencia se registrará como intereses y seguros del mes.
          </p>

          <FieldRow label="Saldo registrado en app">
            <p className="text-sm font-medium text-right tabular-nums">
              {formatCurrencyAbs(currentBalance, debt.currency)}
            </p>
          </FieldRow>

          <FieldRow label="Saldo real según banco">
            <Input
              type="number"
              className="h-8 text-sm text-right"
              placeholder="0.00"
              step="0.01"
              value={realBalance}
              onChange={(e) => setRealBalance(e.target.value)}
            />
          </FieldRow>

          {hasDiff && (
            <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              Diferencia: {formatCurrencyAbs(Math.abs(diff), debt.currency)}
              {diff > 0
                ? " → Se registrará como intereses y seguros del mes"
                : " → El saldo se ajustará a la baja"}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleBalanceAdjustment}
            disabled={!hasDiff || saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Actualizar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
