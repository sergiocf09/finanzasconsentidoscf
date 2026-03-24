import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useSavingsGoals, GoalType } from "@/hooks/useSavingsGoals";

const goalSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre para tu meta"),
  goal_type: z.enum(["emergency", "home", "car", "travel", "education", "business", "retirement", "custom"]),
  target_amount: z.coerce.number().min(0).optional().default(0),
  description: z.string().optional(),
  target_date: z.date().optional().nullable(),
  contribution_day: z.coerce.number().min(1).max(31).optional(),
  monthly_contribution: z.coerce.number().optional().default(0),
  currency: z.string().default("MXN"),
  initial_amount: z.coerce.number().optional().default(0),
  account_type: z.enum(["savings", "investment"]).default("savings"),
}).refine(
  (data) => (data.target_amount && data.target_amount > 0) || !!data.target_date,
  {
    message: "Define un monto objetivo, una fecha de llegada, o ambos",
    path: ["target_amount"],
  }
);

type GoalFormValues = z.infer<typeof goalSchema>;

interface SavingsGoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const goalTypes = [
  { value: "emergency", label: "Fondo de emergencia", emoji: "🛡️", hint: "Tu red de seguridad ante lo inesperado" },
  { value: "home", label: "Casa propia", emoji: "🏠", hint: "Tu propio espacio, tu mayor inversión" },
  { value: "car", label: "Auto propio", emoji: "🚗", hint: "Tu movilidad e independencia" },
  { value: "travel", label: "Viaje", emoji: "✈️", hint: "Ese viaje que llevas tiempo planeando" },
  { value: "education", label: "Educación", emoji: "🎓", hint: "Invertir en conocimiento siempre rinde" },
  { value: "business", label: "Negocio propio", emoji: "🌱", hint: "El primer paso hacia tu independencia" },
  { value: "retirement", label: "Retiro", emoji: "🌅", hint: "Tu libertad financiera a largo plazo" },
  { value: "custom", label: "Meta personalizada", emoji: "⭐", hint: "Lo que tú decides que vale la pena" },
];

const accountTypes = [
  { value: "savings", label: "Ahorro" },
  { value: "investment", label: "Inversión" },
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

export function SavingsGoalForm({ open, onOpenChange }: SavingsGoalFormProps) {
  const { createGoal } = useSavingsGoals();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      goal_type: "custom",
      target_amount: 0,
      description: "",
      target_date: null,
      currency: "MXN",
      initial_amount: 0,
      contribution_day: undefined,
      monthly_contribution: 0,
      account_type: "savings",
      account_id: undefined,
    },
  });

  const watchType = form.watch("goal_type");
  const selectedGoalType = goalTypes.find(t => t.value === watchType);

  const onSubmit = async (data: GoalFormValues) => {
    await createGoal.mutateAsync({
      name: data.name,
      goal_type: data.goal_type as GoalType,
      target_amount: data.target_amount || 0,
      description: data.description,
      target_date: data.target_date ? format(data.target_date, "yyyy-MM-dd") : undefined,
      contribution_day: data.contribution_day,
      monthly_contribution: data.monthly_contribution,
      currency: data.currency,
      initial_amount: data.initial_amount,
      account_id: linkExisting ? data.account_id : undefined,
      create_account: !linkExisting,
      account_type: data.account_type,
    });
    form.reset();
    setLinkExisting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva meta de construcción</DialogTitle>
          <DialogDescription>Define una meta de ahorro o inversión.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-2">
          <FieldRow label="Nombre">
            <Input className="h-8 text-sm" placeholder="Ej: Fondo de emergencia" {...form.register("name")} />
          </FieldRow>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.name.message}</p>
          )}

          <FieldRow label="Tipo">
            <Select value={watchType} onValueChange={(v) => form.setValue("goal_type", v as any)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {goalTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="mr-1.5">{t.emoji}</span>{t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          {selectedGoalType && (
            <p className="text-[10px] text-muted-foreground pl-[40%] -mt-0.5">{selectedGoalType.hint}</p>
          )}

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
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="100,000" {...form.register("target_amount")} />
          </FieldRow>
          {form.formState.errors.target_amount && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.target_amount.message}</p>
          )}

          <FieldRow label="Saldo inicial">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("initial_amount")} />
          </FieldRow>

          <FieldRow label="Descripción" hint="Opcional">
            <Textarea
              className="resize-none text-sm h-14"
              placeholder="Ej: Enganche de mi casa"
              {...form.register("description")}
            />
          </FieldRow>

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

          <FieldRow label="Día de aportación">
            <Input className="h-8 text-sm text-right" type="number" min={1} max={31} placeholder="15" {...form.register("contribution_day")} />
          </FieldRow>

          <FieldRow label="Aportación mensual">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="5,000" {...form.register("monthly_contribution")} />
          </FieldRow>

          {/* Account linking */}
          <div className="rounded-lg border border-border p-2.5 space-y-1.5 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Vincular cuenta existente</span>
              <Switch checked={linkExisting} onCheckedChange={setLinkExisting} />
            </div>

            {linkExisting ? (
              <FieldRow label="Cuenta">
                <Select value={form.watch("account_id")} onValueChange={(v) => form.setValue("account_id", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {availableAccounts.length === 0 ? (
                      <SelectItem value="_none" disabled>Sin cuentas disponibles</SelectItem>
                    ) : (
                      availableAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FieldRow>
            ) : (
              <FieldRow label="Tipo de cuenta" hint="Se creará automáticamente">
                <Select value={form.watch("account_type")} onValueChange={(v) => form.setValue("account_type", v as any)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            )}
          </div>

          <div className="flex gap-3 pt-3 border-t border-border mt-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createGoal.isPending}>
              {createGoal.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : "Crear meta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
