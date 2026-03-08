import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useAccounts, isAssetType } from "@/hooks/useAccounts";
import { useState } from "react";

const goalSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  goal_type: z.enum(["emergency", "retirement", "custom"]),
  target_amount: z.coerce.number().min(1, "Ingresa un monto objetivo"),
  description: z.string().optional(),
  target_date: z.date().optional(),
  currency: z.string().default("MXN"),
  initial_amount: z.coerce.number().optional().default(0),
  account_type: z.enum(["savings", "investment"]).default("savings"),
  account_id: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalSchema>;

interface SavingsGoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const goalTypes = [
  { value: "emergency", label: "Fondo de emergencia" },
  { value: "retirement", label: "Ahorro para el retiro" },
  { value: "custom", label: "Meta personalizada" },
];

const accountTypes = [
  { value: "savings", label: "Ahorro" },
  { value: "investment", label: "Inversión" },
];

export function SavingsGoalForm({ open, onOpenChange }: SavingsGoalFormProps) {
  const { createGoal } = useSavingsGoals();
  const { accounts } = useAccounts();
  const [linkExisting, setLinkExisting] = useState(false);

  // Filter only active asset accounts (savings/investment) not already linked
  const availableAccounts = accounts.filter(
    (a) => a.is_active && isAssetType(a.type) && ["savings", "investment"].includes(a.type)
  );

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      goal_type: "custom",
      target_amount: 0,
      description: "",
      currency: "MXN",
      initial_amount: 0,
      account_type: "savings",
      account_id: undefined,
    },
  });

  const onSubmit = async (data: GoalFormValues) => {
    await createGoal.mutateAsync({
      name: data.name,
      goal_type: data.goal_type,
      target_amount: data.target_amount,
      description: data.description,
      target_date: data.target_date ? format(data.target_date, "yyyy-MM-dd") : undefined,
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva meta de construcción</DialogTitle>
          <DialogDescription>
            Define una meta de ahorro o inversión para construir tu patrimonio.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la meta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Fondo de emergencia, Enganche casa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="goal_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {goalTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MXN">MXN</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto objetivo</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="100,000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="initial_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo inicial</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: Ahorro para el enganche de mi casa"
                      className="resize-none h-16"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha objetivo (opcional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Selecciona una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Account linking */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Vincular cuenta existente
                </span>
                <Switch
                  checked={linkExisting}
                  onCheckedChange={setLinkExisting}
                />
              </div>

              {linkExisting ? (
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuenta</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una cuenta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableAccounts.length === 0 ? (
                            <SelectItem value="_none" disabled>
                              Sin cuentas disponibles
                            </SelectItem>
                          ) : (
                            availableAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} ({acc.currency})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="account_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de cuenta a crear</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accountTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Se creará una cuenta activa vinculada a esta meta.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createGoal.isPending}
              >
                {createGoal.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Crear meta"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
