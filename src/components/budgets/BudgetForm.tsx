import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useState } from "react";

const budgetSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  category_id: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Ingresa un monto válido"),
  period: z.enum(["monthly", "yearly"]),
  month: z.coerce.number().optional(),
  year: z.coerce.number(),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const months = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
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

export function BudgetForm({ open, onOpenChange }: BudgetFormProps) {
  const { createBudget } = useBudgets();
  const { expenseCategories, incomeCategories } = useCategories();
  const [budgetType, setBudgetType] = useState<"expense" | "income">("expense");

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: "",
      category_id: "",
      amount: 0,
      period: "monthly",
      month: currentMonth,
      year: currentYear,
    },
  });

  const period = form.watch("period");
  const availableCategories = budgetType === "income" ? incomeCategories : expenseCategories;

  const onSubmit = async (data: BudgetFormValues) => {
    await createBudget.mutateAsync({
      name: data.name,
      category_id: data.category_id || undefined,
      amount: data.amount,
      period: data.period,
      month: data.period === "monthly" ? data.month : undefined,
      year: data.year,
      budget_type: budgetType,
    });
    form.reset();
    setBudgetType("expense");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo presupuesto</DialogTitle>
          <DialogDescription>Define cuánto planeas gastar o recibir en una categoría.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-2">
          {/* Budget type selector */}
          <FieldRow label="Tipo de presupuesto">
            <Select value={budgetType} onValueChange={(v) => { setBudgetType(v as any); form.setValue("category_id", ""); }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Gasto — cuánto puedo gastar</SelectItem>
                <SelectItem value="income">Ingreso — cuánto espero recibir</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Nombre">
            <Input className="h-8 text-sm" placeholder={budgetType === "income" ? "Ej: Sueldo mensual" : "Ej: Alimentación mensual"} {...form.register("name")} />
          </FieldRow>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.name.message}</p>
          )}

          <FieldRow label="Categoría" hint="Opcional">
            <Select value={form.watch("category_id") || ""} onValueChange={(v) => form.setValue("category_id", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {availableCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label={budgetType === "income" ? "Monto esperado" : "Monto presupuestado"}>
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("amount", { valueAsNumber: true })} />
          </FieldRow>
          {form.formState.errors.amount && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.amount.message}</p>
          )}

          <FieldRow label="Periodo">
            <Select value={period} onValueChange={(v) => form.setValue("period", v as any)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {period === "monthly" && (
            <FieldRow label="Mes">
              <Select value={String(form.watch("month"))} onValueChange={(v) => form.setValue("month", parseInt(v))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          <FieldRow label="Año">
            <Select value={String(form.watch("year"))} onValueChange={(v) => form.setValue("year", parseInt(v))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                <SelectItem value={(currentYear + 1).toString()}>{currentYear + 1}</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <div className="flex gap-3 pt-3 border-t border-border mt-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createBudget.isPending}>
              {createBudget.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : "Crear presupuesto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
