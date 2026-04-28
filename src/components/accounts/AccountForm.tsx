import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isLiability } from "@/hooks/useAccounts";
import { useAccountForm } from "@/hooks/useAccountForm";

const accountSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  type: z.enum(["cash", "bank", "savings", "investment", "credit_card", "payable", "mortgage", "auto_loan", "personal_loan", "caucion_bursatil"]),
  currency: z.string().default("MXN"),
  initial_balance: z.coerce.number().default(0),
  creditor: z.string().optional(),
  interest_rate: z.coerce.number().optional().default(0),
  minimum_payment: z.coerce.number().optional().default(0),
  monthly_commitment: z.coerce.number().optional().default(0),
  due_day: z.coerce.number().min(1).max(31).optional(),
  debt_category: z.enum(["current", "fixed"]).default("current"),
});

type AccountFormValues = z.infer<typeof accountSchema>;

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[42%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountForm({ open, onOpenChange }: AccountFormProps) {
  const { createAccount } = useAccounts();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "", type: "bank", currency: "MXN",
      initial_balance: 0, creditor: "",
      interest_rate: 0, minimum_payment: 0,
      monthly_commitment: 0, due_day: undefined,
      debt_category: "current",
    },
  });

  const selectedType = useWatch({ control: form.control, name: "type" });
  const isLiab = isLiability(selectedType);

  const onSubmit = async (data: AccountFormValues) => {
    if (!user) return;

    const balance = isLiability(data.type) && data.initial_balance > 0
      ? -Math.abs(data.initial_balance)
      : data.initial_balance;

    const { data: newAccount, error } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name: data.name,
        type: data.type,
        currency: data.currency,
        initial_balance: balance,
        current_balance: balance,
      })
      .select()
      .single();

    if (error || !newAccount) return;

    if (isLiability(data.type)) {
      const debtTypeMap: Record<string, string> = {
        credit_card: "credit_card", mortgage: "mortgage",
        auto_loan: "car_loan", personal_loan: "personal_loan",
        caucion_bursatil: "other", payable: "other",
      };
      await supabase.from("debts").insert({
        user_id: user.id,
        account_id: newAccount.id,
        name: data.name,
        type: debtTypeMap[data.type] || "other",
        creditor: data.creditor || null,
        original_amount: Math.abs(data.initial_balance) || 0,
        current_balance: Math.abs(data.initial_balance) || 0,
        interest_rate: data.interest_rate || 0,
        minimum_payment: data.minimum_payment || 0,
        monthly_commitment: data.monthly_commitment || 0,
        due_day: data.due_day || null,
        debt_category: data.debt_category || "current",
        currency: data.currency,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["debts"] });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva cuenta</DialogTitle>
          <DialogDescription>
            Activa para tus recursos, o pasiva para lo que debes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-2">

          <FieldRow label="Nombre">
            <Input
              className="h-8 text-sm"
              placeholder={isLiab ? "Ej: Hipoteca BBVA, Le debo a Ana" : "Ej: BBVA Nómina"}
              {...form.register("name")}
            />
          </FieldRow>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive pl-[44%]">{form.formState.errors.name.message}</p>
          )}

          <FieldRow label="Tipo">
            <Select value={selectedType} onValueChange={(v) => form.setValue("type", v as any)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" className="max-h-[min(var(--radix-select-content-available-height),280px)] overflow-y-auto">
                <div className="px-2 py-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Lo que tengo
                  </p>
                </div>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="bank">Cuenta de banco</SelectItem>
                <SelectItem value="savings">Cuenta de ahorro</SelectItem>
                <SelectItem value="investment">Inversión</SelectItem>
                <div className="px-2 py-1 mt-1 border-t border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Lo que debo
                  </p>
                </div>
                <SelectItem value="credit_card">Tarjeta de crédito</SelectItem>
                <SelectItem value="mortgage">Crédito hipotecario</SelectItem>
                <SelectItem value="auto_loan">Crédito automotriz</SelectItem>
                <SelectItem value="personal_loan">Crédito personal</SelectItem>
                <SelectItem value="caucion_bursatil">Caución bursátil</SelectItem>
                <SelectItem value="payable">Le debo a alguien</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Moneda">
            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" className="max-h-[min(var(--radix-select-content-available-height),280px)] overflow-y-auto">
                <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow
            label={isLiab ? "¿Cuánto debes hoy?" : "Saldo inicial"}
            hint={isLiab ? "El monto total que debes ahora" : undefined}
          >
            <Input
              className="h-8 text-sm text-right"
              type="number" step="0.01" placeholder="0.00"
              {...form.register("initial_balance")}
            />
          </FieldRow>

          {/* Campos adicionales solo para pasivos */}
          {isLiab && (
            <div className="space-y-1.5 rounded-xl bg-muted/30 border border-border p-3 mt-1">
              <p className="text-[10px] text-muted-foreground">
                Opcional — agrega solo lo que tengas a la mano
              </p>

              <FieldRow label="¿A quién le debo?" hint="Banco, persona, institución">
                <Input
                  className="h-8 text-sm"
                  placeholder="Ej: BBVA, mi hermana, el carpintero"
                  {...form.register("creditor")}
                />
              </FieldRow>

              {selectedType === "credit_card" && (
                <FieldRow label="¿Tiene deuda acumulada?">
                  <Select
                    value={form.watch("debt_category")}
                    onValueChange={(v) => form.setValue("debt_category", v as any)}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" className="max-h-[min(var(--radix-select-content-available-height),280px)] overflow-y-auto">
                      <SelectItem value="current">No — solo consumos del mes</SelectItem>
                      <SelectItem value="fixed">Sí — hay saldo acumulado</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              )}

              <FieldRow label="Pago mensual" hint="Cuánto pagas cada mes">
                <Input
                  className="h-8 text-sm text-right"
                  type="number" step="0.01" placeholder="0.00"
                  {...form.register("minimum_payment")}
                />
              </FieldRow>

              <FieldRow label="Tasa anual %" hint="Para calcular intereses">
                <Input
                  className="h-8 text-sm text-right"
                  type="number" step="0.01" placeholder="0.00"
                  {...form.register("interest_rate")}
                />
              </FieldRow>

              <FieldRow label="Día de pago" hint="Del mes">
                <Input
                  className="h-8 text-sm text-right"
                  type="number" min={1} max={31} placeholder="—"
                  {...form.register("due_day")}
                />
              </FieldRow>
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t border-border mt-3">
            <Button type="button" variant="outline" className="flex-1"
              onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createAccount.isPending}>
              {createAccount.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                : "Crear cuenta"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
