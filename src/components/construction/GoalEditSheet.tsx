import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSavingsGoals, SavingsGoal } from "@/hooks/useSavingsGoals";
import { useAccounts, isAssetType } from "@/hooks/useAccounts";
import { formatCurrencyAbs } from "@/lib/formatters";

const editSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  goal_type: z.enum(["emergency", "home", "car", "travel", "education", "business", "retirement", "custom"]),
  target_amount: z.coerce.number().min(0).optional().default(0),
  description: z.string().optional(),
  target_date: z.date().optional().nullable(),
  contribution_day: z.coerce.number().min(1).max(31).optional().nullable(),
  monthly_contribution: z.coerce.number().optional().default(0),
  currency: z.string().default("MXN"),
  account_id: z.string().optional(),
}).refine(
  (data) => (data.target_amount && data.target_amount > 0) || !!data.target_date,
  {
    message: "Define un monto objetivo, una fecha de llegada, o ambos",
    path: ["target_amount"],
  }
);

type EditValues = z.infer<typeof editSchema>;

const goalTypes = [
  { value: "emergency", label: "🛡️  Fondo de emergencia" },
  { value: "home", label: "🏠  Casa propia" },
  { value: "car", label: "🚗  Auto propio" },
  { value: "travel", label: "✈️  Viaje" },
  { value: "education", label: "🎓  Educación" },
  { value: "business", label: "🌱  Negocio propio" },
  { value: "retirement", label: "🌅  Retiro" },
  { value: "custom", label: "⭐  Meta personalizada" },
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

interface GoalEditSheetProps {
  goal: SavingsGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalEditSheet({ goal, open, onOpenChange }: GoalEditSheetProps) {
  const { updateGoal } = useSavingsGoals();
  const { accounts } = useAccounts();
  const availableAccounts = accounts.filter(
    (a) => a.is_active && isAssetType(a.type) && ["savings", "investment"].includes(a.type)
  );
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const linkedAccount = goal?.account_id
    ? accounts.find((a) => a.id === goal.account_id)
    : null;

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      goal_type: "custom",
      target_amount: 0,
      description: "",
      target_date: null,
      contribution_day: undefined,
      monthly_contribution: 0,
      currency: "MXN",
      account_id: undefined,
    },
  });

  useEffect(() => {
    if (goal && open) {
      form.reset({
        name: goal.name,
        goal_type: goal.goal_type as EditValues["goal_type"],
        target_amount: goal.target_amount || 0,
        description: goal.description || "",
        target_date: goal.target_date ? new Date(goal.target_date + "T12:00:00") : null,
        contribution_day: goal.contribution_day ?? undefined,
        monthly_contribution: goal.monthly_contribution || 0,
        currency: (goal as any).currency ?? "MXN",
        account_id: goal.account_id ?? undefined,
      });
    }
  }, [goal, open, form]);

  const onSubmit = async (data: EditValues) => {
    if (!goal) return;
    await updateGoal.mutateAsync({
      id: goal.id,
      name: data.name,
      goal_type: data.goal_type,
      target_amount: data.target_amount || 0,
      description: data.description || null,
      target_date: data.target_date ? format(data.target_date, "yyyy-MM-dd") : null,
      contribution_day: data.contribution_day ?? null,
      monthly_contribution: data.monthly_contribution || 0,
      currency: data.currency,
      account_id: data.account_id ?? null,
    } as any);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar meta</SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-3">
          <FieldRow label="Nombre">
            <Input className="h-8 text-sm" {...form.register("name")} />
          </FieldRow>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.name.message}</p>
          )}

          <FieldRow label="Tipo">
            <Select value={form.watch("goal_type")} onValueChange={(v) => form.setValue("goal_type", v as any)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {goalTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Moneda">
            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Monto objetivo" hint="Opcional si defines fecha">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" {...form.register("target_amount")} />
          </FieldRow>
          {form.formState.errors.target_amount && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.target_amount.message}</p>
          )}

          <FieldRow label="Fecha objetivo" hint="Opcional si defines monto">
            <div className="flex items-center gap-1">
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("flex-1 h-8 text-sm justify-start font-normal", !form.watch("target_date") && "text-muted-foreground")}
                  >
                    {form.watch("target_date") ? format(form.watch("target_date")!, "PPP", { locale: es }) : "Seleccionar fecha"}
                    <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
                  <Calendar
                    mode="single"
                    selected={form.watch("target_date") ?? undefined}
                    onSelect={(d) => { form.setValue("target_date", d ?? null); setDatePopoverOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.watch("target_date") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => form.setValue("target_date", null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </FieldRow>

          <FieldRow label="Aportación mensual">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("monthly_contribution")} />
          </FieldRow>

          <FieldRow label="Día de aportación">
            <Input className="h-8 text-sm text-right" type="number" min={1} max={31} placeholder="15" {...form.register("contribution_day")} />
          </FieldRow>

          <FieldRow label="Descripción" hint="Opcional">
            <Textarea className="resize-none text-sm h-14" {...form.register("description")} />
          </FieldRow>

          {/* Cuenta vinculada — solo lectura */}
          {linkedAccount && (
            <FieldRow label="Cuenta vinculada">
              <div className="flex items-center gap-2 h-8 px-2 rounded-md border border-input bg-muted/30">
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {linkedAccount.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatCurrencyAbs(linkedAccount.current_balance, linkedAccount.currency)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                Para cambiarla, crea una nueva meta vinculada a otra cuenta.
              </p>
            </FieldRow>
          )}

          <div className="flex gap-2 pt-4 border-t border-border mt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={updateGoal.isPending}>
              {updateGoal.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
