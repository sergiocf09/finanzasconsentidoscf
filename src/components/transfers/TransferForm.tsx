import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransfers } from "@/hooks/useTransfers";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";

const schema = z.object({
  from_account_id: z.string().min(1, "Selecciona cuenta origen"),
  to_account_id: z.string().min(1, "Selecciona cuenta destino"),
  amount: z.coerce.number().positive("Monto debe ser mayor a 0"),
  transfer_date: z.string(),
  description: z.string().optional(),
}).refine((d) => d.from_account_id !== d.to_account_id, {
  message: "Origen y destino deben ser diferentes",
  path: ["to_account_id"],
});

type FormValues = z.infer<typeof schema>;

interface TransferFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

export function TransferForm({ open, onOpenChange }: TransferFormProps) {
  const { accounts } = useAccounts();
  const { createTransfer } = useTransfers();
  const { rate: fxRate } = useExchangeRate();
  const activeAccounts = accounts.filter((a) => a.is_active);
  const [selectedCurrency, setSelectedCurrency] = useState("MXN");

  const fmtBalance = (acc: typeof accounts[0]) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: acc.currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(acc.current_balance ?? 0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      from_account_id: "",
      to_account_id: "",
      amount: 0,
      transfer_date: format(new Date(), "yyyy-MM-dd"),
      description: "",
    },
  });

  const fromId = form.watch("from_account_id");
  const fromAccount = activeAccounts.find((a) => a.id === fromId);
  const toId = form.watch("to_account_id");
  const toAccount = activeAccounts.find((a) => a.id === toId);
  const needsFx = fromAccount && toAccount && fromAccount.currency !== toAccount.currency;
  const watchedAmount = form.watch("amount");

  // Bidirectional conversion calculation
  const calcTransfer = (amount: number, userCurrency: string, from: typeof fromAccount, to: typeof toAccount) => {
    if (!from || !to || !amount || !fxRate || fxRate <= 0) return null;
    if (from.currency === to.currency) return null;

    let amountFrom = amount;
    let amountTo = amount;
    let fxRateUsed: number | undefined = fxRate;

    if (userCurrency === from.currency) {
      // User expressed in origin currency → convert to destination
      amountFrom = amount;
      if (from.currency === "USD" && to.currency === "MXN") amountTo = amount * fxRate;
      else if (from.currency === "MXN" && to.currency === "USD") amountTo = amount / fxRate;
    } else if (userCurrency === to.currency) {
      // User expressed in destination currency → calculate what leaves origin
      amountTo = amount;
      if (from.currency === "USD" && to.currency === "MXN") amountFrom = amount / fxRate;
      else if (from.currency === "MXN" && to.currency === "USD") amountFrom = amount * fxRate;
    } else {
      // Fallback: treat as origin currency
      amountFrom = amount;
      amountTo = amount;
      fxRateUsed = undefined;
    }

    return {
      amountFrom: Math.round(amountFrom * 100) / 100,
      amountTo: Math.round(amountTo * 100) / 100,
      fxRateUsed,
    };
  };

  const onSubmit = async (data: FormValues) => {
    const from = activeAccounts.find((a) => a.id === data.from_account_id)!;
    const to = activeAccounts.find((a) => a.id === data.to_account_id)!;
    const isCross = from.currency !== to.currency;

    let amountFrom = data.amount;
    let amountTo = data.amount;
    let fxRateUsed: number | undefined;

    if (isCross && fxRate > 0) {
      const result = calcTransfer(data.amount, selectedCurrency, from, to);
      if (result) {
        amountFrom = result.amountFrom;
        amountTo = result.amountTo;
        fxRateUsed = result.fxRateUsed;
      }
    }

    await createTransfer.mutateAsync({
      from_account_id: data.from_account_id,
      to_account_id: data.to_account_id,
      amount_from: amountFrom,
      currency_from: from.currency,
      amount_to: amountTo,
      currency_to: to.currency,
      fx_rate: fxRateUsed,
      transfer_date: data.transfer_date,
      description: data.description || undefined,
    });
    form.reset();
    setSelectedCurrency("MXN");
    onOpenChange(false);
  };

  const conversion = needsFx ? calcTransfer(watchedAmount || 0, selectedCurrency, fromAccount, toAccount) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva transferencia</DialogTitle>
          <DialogDescription>Mueve dinero entre tus cuentas</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-2">
          <FieldRow label="Cuenta origen">
            <Select value={fromId} onValueChange={(v) => form.setValue("from_account_id", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center justify-between w-full gap-2">
                      <span>{a.name} ({a.currency})</span>
                      <span className="text-muted-foreground text-[11px] font-semibold">{fmtBalance(a)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Cuenta destino">
            <Select value={toId} onValueChange={(v) => form.setValue("to_account_id", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.filter((a) => a.id !== fromId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center justify-between w-full gap-2">
                      <span>{a.name} ({a.currency})</span>
                      <span className="text-muted-foreground text-[11px] font-semibold">{fmtBalance(a)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          {form.formState.errors.to_account_id && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.to_account_id.message}</p>
          )}

          <FieldRow label="Monto">
            <div className="flex gap-2">
              <Input className="h-8 text-sm text-right flex-1" type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="h-8 text-sm w-20"><SelectValue /></SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldRow>
          {form.formState.errors.amount && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.amount.message}</p>
          )}

          {needsFx && fxRate > 0 && conversion && (
            <div className="rounded-lg bg-muted px-3 py-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sale de {fromAccount!.name}</span>
                <span className="font-medium">{new Intl.NumberFormat("es-MX", { style: "currency", currency: fromAccount!.currency }).format(conversion.amountFrom)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Llega a {toAccount!.name}</span>
                <span className="font-medium text-foreground">{new Intl.NumberFormat("es-MX", { style: "currency", currency: toAccount!.currency }).format(conversion.amountTo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo de cambio automático</span>
                <span>TC: ${fxRate.toFixed(2)}</span>
              </div>
            </div>
          )}

          <FieldRow label="Fecha">
            <Input className="h-8 text-sm" type="date" {...form.register("transfer_date")} />
          </FieldRow>

          <FieldRow label="Concepto" hint="Opcional">
            <Input className="h-8 text-sm" placeholder="Ej: Pago de tarjeta" {...form.register("description")} />
          </FieldRow>

          <div className="flex gap-3 pt-3 border-t border-border mt-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createTransfer.isPending}>
              {createTransfer.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Transferir
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}