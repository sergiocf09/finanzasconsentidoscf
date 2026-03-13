import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, Info, Repeat, Check, ChevronsUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { matchCategory } from "@/lib/voiceParser";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, Category } from "@/hooks/useCategories";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useRecurringPayments, getNextExecutionDate, FREQUENCY_LABELS } from "@/hooks/useRecurringPayments";

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

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

export function TransactionForm({ open, onOpenChange, defaultType = "expense", voiceData }: TransactionFormProps) {
  const [activeTab, setActiveTab] = useState<"income" | "expense">(defaultType);
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [suggestedCategory, setSuggestedCategory] = useState<Category | null>(null);
  const [userSelectedCategory, setUserSelectedCategory] = useState(false);
  const [openCategoryCombo, setOpenCategoryCombo] = useState(false);
  const [openAccountCombo, setOpenAccountCombo] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { createTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { expenseCategories, incomeCategories, categories: allCategories } = useCategories();
  const { checkAlerts } = useBudgetAlerts();
  const { rate: fxRate } = useExchangeRate();
  const { createPayment: createRecurring } = useRecurringPayments();

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

  useEffect(() => {
    if (open) {
      setActiveTab(defaultType);
      form.setValue("type", defaultType);
      setMakeRecurring(false);
      setSuggestedCategory(null);
      setUserSelectedCategory(false);
    }
  }, [open, defaultType]);

  const categories = activeTab === "income" ? incomeCategories : expenseCategories;

  // Debounced category suggestion
  const watchedDescription = form.watch("description");
  
  const runSuggestion = useCallback((desc: string) => {
    if (!desc || desc.trim().length < 2 || userSelectedCategory) {
      setSuggestedCategory(null);
      return;
    }
    const voiceCategories = allCategories.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      keywords: c.keywords,
    }));
    const result = matchCategory(desc, voiceCategories, activeTab);
    setSuggestedCategory(result.category ? allCategories.find(c => c.id === result.category!.id) ?? null : null);
  }, [allCategories, activeTab, userSelectedCategory]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSuggestion(watchedDescription || ""), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [watchedDescription, runSuggestion]);

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
      if (data.currency === "USD" && account.currency === "MXN") {
        finalAmount = data.amount * fxRate;
        amountInBase = finalAmount;
        exchangeRate = fxRate;
      } else if (data.currency === "MXN" && account.currency === "USD") {
        finalAmount = data.amount / fxRate;
        amountInBase = data.amount;
        exchangeRate = 1 / fxRate;
      }
      finalCurrency = account.currency;
      const eqMxn = amountInBase ?? finalAmount;
      notes = `Originalmente $${data.amount.toFixed(2)} ${data.currency} · TC: $${fxRate.toFixed(2)} · Equivalente: $${eqMxn.toFixed(2)} MXN`;
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

    if (activeTab === "expense") {
      setTimeout(() => checkAlerts(), 1000);
    }

    if (makeRecurring && data.account_id) {
      const nextDate = getNextExecutionDate(data.transaction_date, recurringFrequency);
      await createRecurring.mutateAsync({
        name: data.description || "Pago recurrente",
        description: data.description || null,
        type: activeTab,
        account_id: data.account_id,
        category_id: data.category_id || undefined,
        amount: data.amount,
        currency: data.currency,
        frequency: recurringFrequency,
        start_date: format(data.transaction_date, "yyyy-MM-dd"),
        next_execution_date: format(nextDate, "yyyy-MM-dd"),
        payments_made: 1,
      });
    }

    form.reset();
    setMakeRecurring(false);
    setSuggestedCategory(null);
    setUserSelectedCategory(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-heading">Registrar movimiento</DialogTitle>
          <DialogDescription className="text-xs">Agrega un ingreso o gasto.</DialogDescription>
        </DialogHeader>

        <div>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setSuggestedCategory(null); setUserSelectedCategory(false); }}>
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="income" className="text-xs text-income">Ingreso</TabsTrigger>
              <TabsTrigger value="expense" className="text-xs text-expense">Gasto</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5 mt-3">
            {/* 1. Monto */}
            <FieldRow label="Monto">
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...form.register("amount", { valueAsNumber: true })}
                  className="h-8 text-sm text-right flex-1"
                />
                <Select value={watchedCurrency} onValueChange={(v) => form.setValue("currency", v)}>
                  <SelectTrigger className="h-8 text-sm w-20"><SelectValue /></SelectTrigger>
                  <SelectContent side="bottom">
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldRow>
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.amount.message}</p>
            )}

            {/* 2. Descripción (moved up) */}
            <FieldRow label="Descripción" hint="Opcional">
              <Input className="h-8 text-sm" placeholder="Ej: Uber oficina" {...form.register("description")} />
            </FieldRow>

            {/* 3. Categoría */}
            <FieldRow label="Categoría" hint="Opcional">
              <Popover open={openCategoryCombo} onOpenChange={setOpenCategoryCombo} modal={true}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <span className={cn(!form.watch("category_id") && "text-muted-foreground")}>
                      {form.watch("category_id")
                        ? categories.find(c => c.id === form.watch("category_id"))?.name || "Selecciona"
                        : "Selecciona"}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                  <Command filter={() => 1}>
                    <CommandInput className="hidden" />
                    <CommandList className="max-h-[35vh]">
                      <CommandGroup>
                        {categories.map((cat) => (
                          <CommandItem
                            key={cat.id}
                            value={cat.name}
                            onSelect={() => {
                              form.setValue("category_id", cat.id);
                              setUserSelectedCategory(true);
                              setSuggestedCategory(null);
                              setOpenCategoryCombo(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-3.5 w-3.5", form.watch("category_id") === cat.id ? "opacity-100" : "opacity-0")} />
                            {cat.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FieldRow>

            {/* Category suggestion badge */}
            {suggestedCategory && !userSelectedCategory && (
              <div className="flex items-center gap-2 pl-[40%]">
                <span className="text-xs text-muted-foreground">¿Sugerida?</span>
                <button
                  type="button"
                  onClick={() => {
                    form.setValue("category_id", suggestedCategory.id);
                    setUserSelectedCategory(true);
                    setSuggestedCategory(null);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  {suggestedCategory.name}
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestedCategory(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 4. Cuenta */}
            <FieldRow label="Cuenta">
              <Popover open={openAccountCombo} onOpenChange={setOpenAccountCombo} modal={true}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <span className={cn(!watchedAccountId && "text-muted-foreground")}>
                      {selectedAccount
                        ? `${selectedAccount.name} · ${formatCurrency(selectedAccount.current_balance ?? 0, selectedAccount.currency)}`
                        : "Selecciona"}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                  <Command filter={() => 1}>
                    <CommandInput className="hidden" />
                    <CommandList className="max-h-[35vh]">
                      <CommandGroup>
                        {accounts.map((acc) => (
                          <CommandItem
                            key={acc.id}
                            value={acc.name}
                            onSelect={() => {
                              form.setValue("account_id", acc.id);
                              setOpenAccountCombo(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-3.5 w-3.5", watchedAccountId === acc.id ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1 truncate">{acc.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{formatCurrency(acc.current_balance ?? 0, acc.currency)}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FieldRow>
            {form.formState.errors.account_id && (
              <p className="text-xs text-destructive pl-[40%]">{form.formState.errors.account_id.message}</p>
            )}

            {/* Cross-currency info */}
            {isCrossCurrency && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">Conversión automática</p>
                  <p>La cuenta es en {selectedAccount?.currency}. TC: ${fxRate.toFixed(2)}.</p>
                  {convertedAmount !== null && (
                    <p className="font-semibold text-foreground">
                      {watchedAmount.toFixed(2)} {watchedCurrency} → {convertedAmount.toFixed(2)} {selectedAccount?.currency}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 5. Fecha */}
            <FieldRow label="Fecha">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full h-8 text-sm justify-start font-normal",
                      !form.watch("transaction_date") && "text-muted-foreground"
                    )}
                  >
                    {form.watch("transaction_date")
                      ? format(form.watch("transaction_date"), "PPP", { locale: es })
                      : "Seleccionar"}
                    <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("transaction_date")}
                    onSelect={(d) => d && form.setValue("transaction_date", d)}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </FieldRow>

            {/* Recurring switch */}
            <div className="rounded-lg border border-border p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-xs font-medium">Convertir en pago recurrente</Label>
                </div>
                <Switch checked={makeRecurring} onCheckedChange={setMakeRecurring} />
              </div>
              {makeRecurring && (
                <FieldRow label="Frecuencia">
                  <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
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
              <Button type="submit" className="flex-1" disabled={createTransaction.isPending}>
                {createTransaction.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                ) : "Guardar"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
