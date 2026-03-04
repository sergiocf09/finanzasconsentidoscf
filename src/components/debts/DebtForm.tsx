import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDebts } from "@/hooks/useDebts";

const debtSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  type: z.enum(["credit_card", "personal_loan", "mortgage", "car_loan", "student_loan", "other"]),
  creditor: z.string().optional(),
  original_amount: z.coerce.number().min(0.01, "Ingresa el monto original"),
  current_balance: z.coerce.number().min(0, "Ingresa el saldo actual"),
  interest_rate: z.coerce.number().optional().default(0),
  minimum_payment: z.coerce.number().optional().default(0),
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

export function DebtForm({ open, onOpenChange }: DebtFormProps) {
  const { createDebt } = useDebts();

  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: "",
      type: "credit_card",
      creditor: "",
      original_amount: 0,
      current_balance: 0,
      interest_rate: 0,
      minimum_payment: 0,
      due_day: undefined,
      currency: "MXN",
    },
  });

  const onSubmit = async (data: DebtFormValues) => {
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
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar deuda</DialogTitle>
          <DialogDescription>
            Agrega una deuda para dar seguimiento a tus pagos.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la deuda</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Tarjeta BBVA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
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
                        {debtTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                name="creditor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acreedor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: BBVA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="original_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto original</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="current_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo actual</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="interest_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa de interés (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minimum_payment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pago mínimo</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="cut_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Día de corte</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="31" placeholder="15" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Día de pago</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="31" placeholder="5" {...field} />
                    </FormControl>
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
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de inicio (opcional)</FormLabel>
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
                disabled={createDebt.isPending}
              >
                {createDebt.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Registrar deuda"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
