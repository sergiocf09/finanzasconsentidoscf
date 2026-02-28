import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";

const transactionSchema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.coerce.number().min(0.01, "Ingresa un monto válido"),
  currency: z.string().default("MXN"),
  account_id: z.string().min(1, "Selecciona una cuenta"),
  category_id: z.string().optional(),
  related_account_id: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  transaction_date: z.date(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "income" | "expense" | "transfer";
  voiceData?: {
    amount?: number;
    currency?: string;
    category?: string;
    description?: string;
    date?: Date;
  };
}

export function TransactionForm({ open, onOpenChange, defaultType = "expense", voiceData }: TransactionFormProps) {
  const [activeTab, setActiveTab] = useState<"income" | "expense" | "transfer">(defaultType);
  
  const { createTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { expenseCategories, incomeCategories, transferCategories } = useCategories();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      amount: voiceData?.amount ?? 0,
      currency: voiceData?.currency ?? "MXN",
      account_id: "",
      category_id: "",
      related_account_id: "",
      description: voiceData?.description ?? "",
      notes: "",
      transaction_date: voiceData?.date ?? new Date(),
    },
  });

  const categories = activeTab === "income" 
    ? incomeCategories 
    : activeTab === "expense" 
    ? expenseCategories 
    : transferCategories;

  const onSubmit = async (data: TransactionFormValues) => {
    await createTransaction.mutateAsync({
      account_id: data.account_id,
      amount: data.amount,
      currency: data.currency,
      category_id: data.category_id,
      related_account_id: data.related_account_id,
      description: data.description,
      notes: data.notes,
      type: activeTab,
      transaction_date: format(data.transaction_date, "yyyy-MM-dd"),
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            Agrega un ingreso, gasto o transferencia.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col min-h-0 flex-1">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="income" className="text-income">Ingreso</TabsTrigger>
            <TabsTrigger value="expense" className="text-expense">Gasto</TabsTrigger>
            <TabsTrigger value="transfer" className="text-transfer">Transferencia</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1 mt-4">
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Amount & Currency */}
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          className="text-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem className="w-24">
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

              {/* Account */}
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{activeTab === "transfer" ? "Cuenta origen" : "Cuenta"}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Destination Account for transfers */}
              {activeTab === "transfer" && (
                <FormField
                  control={form.control}
                  name="related_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuenta destino</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona cuenta destino" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts
                            .filter((a) => a.id !== form.watch("account_id"))
                            .map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} ({account.currency})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Category */}
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date */}
              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha</FormLabel>
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
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Uber a la oficina" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detalles adicionales..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              </div>

              <div className="flex gap-3 pt-4 shrink-0 border-t border-border mt-2 bg-background sticky bottom-0">
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
                  disabled={createTransaction.isPending}
                >
                  {createTransaction.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
