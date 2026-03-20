import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDebts } from "@/hooks/useDebts";
import { useAccounts } from "@/hooks/useAccounts";

const debtSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  type: z.enum(["credit_card", "personal_loan", "mortgage", "car_loan", "student_loan", "other"]),
  debt_category: z.enum(["current", "fixed"]).default("current"),
  creditor: z.string().optional(),
  original_amount: z.coerce.number().min(0.01, "Ingresa el monto original"),
  current_balance: z.coerce.number().min(0, "Ingresa el saldo actual"),
  interest_rate: z.coerce.number().optional().default(0),
  minimum_payment: z.coerce.number().optional().default(0),
  monthly_commitment: z.coerce.number().optional().default(0),
  planned_payment: z.coerce.number().optional().default(0),
  due_day: z.coerce.number().min(1).max(31).optional(),
  cut_day: z.coerce.number().min(1).max(31).optional(),
  start_date: z.date().optional(),
  currency: z.string().default("MXN"),
});

type DebtFormValues = z.infer<typeof debtSchema>;

interface DebtFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function DebtForm({ open, onOpenChange }: DebtFormProps) {
  const { createDebt } = useDebts();

  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: "",
      type: "credit_card",
      debt_category: "current",
      creditor: "",
      original_amount: 0,
      current_balance: 0,
      interest_rate: 0,
      minimum_payment: 0,
      monthly_commitment: 0,
      planned_payment: 0,
      due_day: undefined,
      currency: "MXN",
    },
  });

  const watchType = form.watch("type");
  const watchDebtCategory = form.watch("debt_category");

  // Non-credit-card types are always 'fixed'
  const effectiveDebtCategory = watchType === "credit_card" ? watchDebtCategory : "fixed";
  const showMonthlyCommitment = effectiveDebtCategory === "fixed";

  const onSubmit = async (data: DebtFormValues) => {
    const finalDebtCategory = data.type === "credit_card" ? data.debt_category : "fixed";
    await createDebt.mutateAsync({
      name: data.name,
      type: data.type,
      creditor: data.creditor,
      original_amount: data.original_amount,
      current_balance: data.current_balance,
      interest_rate: data.interest_rate,
      minimum_payment: data.minimum_payment,
      due_day: data.due_day,
      cut_day: data.cut_day,
      start_date: data.start_date ? format(data.start_date, "yyyy-MM-dd") : undefined,
      currency: data.currency,
      debt_category: finalDebtCategory,
      monthly_commitment: showMonthlyCommitment ? data.monthly_commitment : 0,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar deuda</DialogTitle>
          <DialogDescription>Agrega una deuda para dar seguimiento.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-2">
          <FieldRow label="Nombre">
            <Input className="h-8 text-sm" placeholder="Ej: Tarjeta BBVA" {...form.register("name")} />
          </FieldRow>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.name.message}</p>
          )}

          <FieldRow label="Tipo">
            <Select value={watchType} onValueChange={(v) => form.setValue("type", v as any)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {debtTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* debt_category — solo visible para tarjetas de crédito */}
          {watchType === "credit_card" && (
            <FieldRow label="Naturaleza del saldo" hint="¿Tiene deuda previa o solo consumos del mes?">
              <Select value={watchDebtCategory} onValueChange={(v) => form.setValue("debt_category", v as any)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">
                    <div>
                      <span>Solo consumos corrientes</span>
                      <span className="block text-[10px] text-muted-foreground">El saldo varía cada mes según lo que gastas</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="fixed">
                    <div>
                      <span>Tiene saldo preexistente a plazo</span>
                      <span className="block text-[10px] text-muted-foreground">Ya hay deuda acumulada que vas abonando</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          {/* monthly_commitment — visible cuando es deuda a plazo */}
          {showMonthlyCommitment && (
            <FieldRow label="Abono mensual comprometido" hint="Cuánto pagas cada mes para reducir esta deuda">
              <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("monthly_commitment")} />
            </FieldRow>
          )}

          <FieldRow label="Acreedor" hint="Opcional">
            <Input className="h-8 text-sm" placeholder="Ej: BBVA" {...form.register("creditor")} />
          </FieldRow>

          <FieldRow label="Monto original">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("original_amount")} />
          </FieldRow>

          <FieldRow label="Saldo actual">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("current_balance")} />
          </FieldRow>

          <FieldRow label="Tasa de interés" hint="% anual">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("interest_rate")} />
          </FieldRow>

          <FieldRow label="Pago mínimo" hint="Mensual">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("minimum_payment")} />
          </FieldRow>

          {watchType === "credit_card" && (
            <FieldRow label="Pago deseado" hint="Lo que planeas pagar">
              <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("planned_payment")} />
            </FieldRow>
          )}

          <FieldRow label="Día de corte">
            <Input className="h-8 text-sm text-right" type="number" min="1" max="31" placeholder="15" {...form.register("cut_day")} />
          </FieldRow>

          <FieldRow label="Día de pago">
            <Input className="h-8 text-sm text-right" type="number" min="1" max="31" placeholder="5" {...form.register("due_day")} />
          </FieldRow>

          <FieldRow label="Moneda">
            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Fecha de inicio" hint="Opcional">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full h-8 text-sm justify-start font-normal", !form.watch("start_date") && "text-muted-foreground")}
                >
                  {form.watch("start_date") ? format(form.watch("start_date")!, "PPP", { locale: es }) : "Seleccionar"}
                  <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch("start_date")}
                  onSelect={(d) => form.setValue("start_date", d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </FieldRow>

          <div className="flex gap-3 pt-3 border-t border-border mt-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createDebt.isPending}>
              {createDebt.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
