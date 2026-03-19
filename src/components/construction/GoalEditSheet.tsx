import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSavingsGoals, SavingsGoal, GoalType } from "@/hooks/useSavingsGoals";

const editSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  goal_type: z.string().min(1),
  target_amount: z.coerce.number().min(1, "Ingresa un monto objetivo"),
  description: z.string().optional(),
  target_date: z.date().optional().nullable(),
  contribution_day: z.coerce.number().min(1).max(31).optional(),
  monthly_contribution: z.coerce.number().optional().default(0),
});

type EditValues = z.infer<typeof editSchema>;

const goalTypes = [
  { value: "emergency", label: "Fondo de emergencia", emoji: "🛡️" },
  { value: "home", label: "Casa propia", emoji: "🏠" },
  { value: "car", label: "Auto propio", emoji: "🚗" },
  { value: "travel", label: "Viaje", emoji: "✈️" },
  { value: "education", label: "Educación", emoji: "🎓" },
  { value: "business", label: "Negocio propio", emoji: "🌱" },
  { value: "retirement", label: "Retiro", emoji: "🌅" },
  { value: "custom", label: "Meta personalizada", emoji: "⭐" },
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

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      goal_type: "custom",
      target_amount: 0,
      description: "",
      contribution_day: undefined,
      monthly_contribution: 0,
    },
  });

  useEffect(() => {
    if (goal && open) {
      form.reset({
        name: goal.name,
        goal_type: goal.goal_type,
        target_amount: goal.target_amount,
        description: goal.description || "",
        target_date: goal.target_date ? new Date(goal.target_date) : undefined,
        contribution_day: goal.contribution_day || undefined,
        monthly_contribution: goal.monthly_contribution || 0,
      });
    }
  }, [goal, open, form]);

  const onSubmit = async (data: EditValues) => {
    if (!goal) return;
    await updateGoal.mutateAsync({
      id: goal.id,
      name: data.name,
      goal_type: data.goal_type as GoalType,
      target_amount: data.target_amount,
      description: data.description || null,
      target_date: data.target_date ? format(data.target_date, "yyyy-MM-dd") : null,
      contribution_day: data.contribution_day || null,
      monthly_contribution: data.monthly_contribution || 0,
    } as any);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar meta</SheetTitle>
          <SheetDescription>Modifica los datos de tu meta.</SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-3">
          <FieldRow label="Nombre">
            <Input className="h-8 text-sm" {...form.register("name")} />
          </FieldRow>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.name.message}</p>
          )}

          <FieldRow label="Tipo">
            <Select value={form.watch("goal_type")} onValueChange={(v) => form.setValue("goal_type", v)}>
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

          <FieldRow label="Monto objetivo">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" {...form.register("target_amount")} />
          </FieldRow>
          {form.formState.errors.target_amount && (
            <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.target_amount.message}</p>
          )}

          <FieldRow label="Descripción" hint="Opcional">
            <Textarea className="resize-none text-sm h-14" {...form.register("description")} />
          </FieldRow>

          <FieldRow label="Fecha objetivo" hint="Opcional">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full h-8 text-sm justify-start font-normal", !form.watch("target_date") && "text-muted-foreground")}
                >
                  {form.watch("target_date") ? format(form.watch("target_date")!, "PPP", { locale: es }) : "Seleccionar"}
                  <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch("target_date") ?? undefined}
                  onSelect={(d) => form.setValue("target_date", d ?? null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </FieldRow>

          <FieldRow label="Día de aportación">
            <Input className="h-8 text-sm text-right" type="number" min={1} max={31} placeholder="15" {...form.register("contribution_day")} />
          </FieldRow>

          <FieldRow label="Aportación mensual">
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" {...form.register("monthly_contribution")} />
          </FieldRow>

          <div className="flex gap-3 pt-3 border-t border-border mt-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={updateGoal.isPending}>
              {updateGoal.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : "Guardar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
