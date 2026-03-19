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

  const onSubmit = async (data: FormValues) => {
    const from = activeAccounts.find((a) => a.id === data.from_account_id)!;
    const to = activeAccounts.find((a) => a.id === data.to_account_id)!;
    const isCross = from.currency !== to.currency;

    let amountTo = data.amount;
    let fxRateUsed: number | undefined;

    if (isCross && fxRate > 0) {
      if (from.currency === "USD" && to.currency === "MXN") {
        amountTo = data.amount * fxRate;
        fxRateUsed = fxRate;
      } else if (from.currency === "MXN" && to.currency === "USD") {
        amountTo = data.amount / fxRate;
        fxRateUsed = fxRate;
      }
    }

    await createTransfer.mutateAsync({
      from_account_id: data.from_account_id,
      to_account_id: data.to_account_id,
      amount_from: data.amount,
      currency_from: from.currency,
      amount_to: Math.round(amountTo * 100) / 100,
      currency_to: to.currency,
      fx_rate: fxRateUsed,
      transfer_date: data.transfer_date,
      description: data.description || undefined,
    });
    form.reset();
    onOpenChange(false);
  };

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

          <FieldRow label={`Monto ${fromAccount ? `(${fromAccount.currency})` : ""}`}>
            <Input className="h-8 text-sm text-right" type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
          </FieldRow>
          {form.formState.errors.amount && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.amount.message}</p>
          )}

          {needsFx && (
            <div className="space-y-1.5 rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground font-medium">
                Monedas diferentes: {fromAccount?.currency} → {toAccount?.currency}
              </p>
              <FieldRow label="Tipo de cambio">
                <Input
                  className="h-8 text-sm text-right"
                  type="number"
                  step="0.0001"
                  placeholder="Ej: 17.50"
                  {...form.register("fx_rate", { valueAsNumber: true })}
                  onChange={(e) => {
                    form.setValue("fx_rate", parseFloat(e.target.value));
                    const rate = parseFloat(e.target.value);
                    if (rate > 0 && watchedAmount > 0) {
                      form.setValue("amount_to", Math.round(watchedAmount * rate * 100) / 100);
                    }
                  }}
                />
              </FieldRow>
              <FieldRow label={`Monto destino (${toAccount?.currency})`}>
                <Input
                  className="h-8 text-sm text-right"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...form.register("amount_to", { valueAsNumber: true })}
                  onChange={(e) => {
                    form.setValue("amount_to", parseFloat(e.target.value));
                    const amtTo = parseFloat(e.target.value);
                    if (amtTo > 0 && watchedAmount > 0) {
                      form.setValue("fx_rate", Math.round((amtTo / watchedAmount) * 10000) / 10000);
                    }
                  }}
                />
              </FieldRow>
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
