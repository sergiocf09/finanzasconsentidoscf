import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts, isLiability } from "@/hooks/useAccounts";

const accountSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  type: z.enum(["cash", "bank", "savings", "investment", "credit_card", "payable", "mortgage", "auto_loan", "personal_loan", "caucion_bursatil"]),
  currency: z.string().default("MXN"),
  initial_balance: z.coerce.number().transform(v => (Number.isFinite(v) ? v : 0)).default(0),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

export function AccountForm({ open, onOpenChange }: AccountFormProps) {
  const { createAccount } = useAccounts();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "bank",
      currency: "MXN",
      initial_balance: 0,
    },
  });

  const selectedType = useWatch({ control: form.control, name: "type" });
  const isLiab = isLiability(selectedType);

  const onSubmit = async (data: AccountFormValues) => {
    const balance = isLiability(data.type) && data.initial_balance > 0
      ? -Math.abs(data.initial_balance)
      : data.initial_balance;

    await createAccount.mutateAsync({
      name: data.name,
      type: data.type,
      currency: data.currency,
      initial_balance: balance,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva cuenta</DialogTitle>
          <DialogDescription>
            Agrega una cuenta para registrar tus movimientos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-2">
          <FieldRow label="Nombre">
            <Input className="h-8 text-sm" placeholder="Ej: BBVA Nómina" {...form.register("name")} />
          </FieldRow>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.name.message}</p>
          )}

          <FieldRow label="Tipo de cuenta">
            <Select value={selectedType} onValueChange={(v) => form.setValue("type", v as any)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {accountTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Moneda">
            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
                <SelectItem value="USD">Dólar Estadounidense (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label={isLiab ? "Saldo adeudado" : "Saldo inicial"} hint={isLiab ? "Ingresa el monto que debes" : undefined}>
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("initial_balance")} />
          </FieldRow>

          <div className="flex gap-3 pt-3 border-t border-border mt-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createAccount.isPending}>
              {createAccount.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : "Crear cuenta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
