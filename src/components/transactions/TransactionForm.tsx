import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { useExchangeRate } from "@/hooks/useExchangeRate";

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().min(0.01, "Ingresa un monto válido"),
  currency: z.string().default("MXN"),
  account_id: z.string().min(1, "Selecciona una cuenta"),
  category_id: z.string().optional(),
  description: z.string().optional(),
  transaction_date: z.date(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "income" | "expense";
  voiceData?: {
    amount?: number;
    currency?: string;
    category?: string;
    description?: string;
    date?: Date;
  };
}

export function TransactionForm({ open, onOpenChange, defaultType = "expense", voiceData }: TransactionFormProps) {
  const [activeTab, setActiveTab] = useState<"income" | "expense">(defaultType);
  
  const { createTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { expenseCategories, incomeCategories } = useCategories();
  const { checkAlerts } = useBudgetAlerts();
  const { rate: fxRate } = useExchangeRate();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      amount: voiceData?.amount ?? 0,
      currency: voiceData?.currency ?? "MXN",
      account_id: "",
      category_id: "",
      description: voiceData?.description ?? "",
      transaction_date: voiceData?.date ?? new Date(),
    },
  });

  // Sync activeTab and form type when defaultType changes (e.g. opening from QuickActions)
  useEffect(() => {
    if (open) {
      setActiveTab(defaultType);
      form.setValue("type", defaultType);
    }
  }, [open, defaultType]);

  const categories = activeTab === "income" ? incomeCategories : expenseCategories;

  // Cross-currency detection
  const watchedAccountId = form.watch("account_id");
  const watchedCurrency = form.watch("currency");
  const watchedAmount = Number(form.watch("amount")) || 0;
  const selectedAccount = accounts.find(a => a.id === watchedAccountId);
  const isCrossCurrency = selectedAccount && watchedCurrency !== selectedAccount.currency;
  const convertedAmount = isCrossCurrency && fxRate > 0 && watchedAmount > 0
    ? (watchedCurrency === "USD" && selectedAccount.currency === "MXN"
      ? watchedAmount * fxRate
      : watchedCurrency === "MXN" && selectedAccount.currency === "USD"
        ? watchedAmount / fxRate
        : watchedAmount)
    : null;

  const onSubmit = async (data: TransactionFormValues) => {
    const account = accounts.find(a => a.id === data.account_id);
    const crossCurrency = account && data.currency !== account.currency;
    
    let finalAmount = data.amount;
    let finalCurrency = data.currency;
    let exchangeRate = 1;
    let amountInBase: number | undefined;
    let description = data.description || "";
    let notes = "";

    if (crossCurrency && fxRate > 0) {
      // Store original amount in amount_in_base
      amountInBase = data.amount;
      // Convert to account's currency
      if (data.currency === "USD" && account.currency === "MXN") {
        finalAmount = data.amount * fxRate;
        exchangeRate = fxRate;
      } else if (data.currency === "MXN" && account.currency === "USD") {
        finalAmount = data.amount / fxRate;
        exchangeRate = 1 / fxRate;
      }
      finalCurrency = account.currency;
      // Add conversion note to notes field
      notes = `Originalmente ${data.amount.toFixed(2)} ${data.currency} · TC: ${fxRate.toFixed(2)}`;
    }

    await createTransaction.mutateAsync({
      account_id: data.account_id,
      amount: Math.round(finalAmount * 100) / 100,
      currency: finalCurrency,
      exchange_rate: exchangeRate,
      amount_in_base: amountInBase,
      notes: notes || undefined,
      category_id: data.category_id && data.category_id.length > 0 ? data.category_id : undefined,
      description,
      type: activeTab,
      transaction_date: format(data.transaction_date, "yyyy-MM-dd"),
    });
    // Check budget alerts after expense (with small delay for DB triggers to settle)
    if (activeTab === "expense") {
      setTimeout(() => checkAlerts(), 1000);
    }
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-heading">Registrar movimiento</DialogTitle>
          <DialogDescription className="text-xs">
            Agrega un ingreso o gasto.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="income" className="text-xs text-income">Ingreso</TabsTrigger>
              <TabsTrigger value="expense" className="text-xs text-expense">Gasto</TabsTrigger>
            </TabsList>
          </Tabs>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 mt-3">
              {/* Amount + Currency */}
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs">Monto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          className="h-9"
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
                    <FormItem className="w-20">
                      <FormLabel className="text-xs">Moneda</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MXN">MXN</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <FormLabel className="text-xs">Cuenta</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Selecciona una cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => {
                          const bal = formatCurrency(account.current_balance ?? 0, account.currency);
                          return (
                            <SelectItem key={account.id} value={account.id}>
                              <span className="flex items-center gap-3 w-full">
                                <span className="truncate">{account.name}</span>
                                <span className="text-muted-foreground text-xs font-bold ml-auto">{bal}</span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cross-currency info */}
              {isCrossCurrency && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p className="font-medium text-foreground">Conversión automática</p>
                    <p>
                      La cuenta es en {selectedAccount?.currency}. Se convertirá usando TC: ${fxRate.toFixed(2)}.
                    </p>
                    {convertedAmount !== null && (
                      <p className="font-semibold text-foreground">
                        {watchedAmount.toFixed(2)} {watchedCurrency} → {convertedAmount.toFixed(2)} {selectedAccount?.currency}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Category */}
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Categoría</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-xs">
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
                  </FormItem>
                )}
              />

              {/* Date + Description side by side */}
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="transaction_date"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs">Fecha</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-2 text-left font-normal h-9 text-xs",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yy", { locale: es })
                              ) : (
                                <span>Fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
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
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="flex-[2]">
                      <FormLabel className="text-xs">Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Uber oficina" {...field} className="h-9 text-xs" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}