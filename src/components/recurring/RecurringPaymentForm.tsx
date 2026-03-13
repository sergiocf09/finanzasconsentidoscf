import { useState, useEffect, useMemo } from "react";
import { format, addDays, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRecurringPayments,
  getNextExecutionDate,
  FREQUENCY_LABELS,
  type RecurringPayment,
} from "@/hooks/useRecurringPayments";
import { formatCurrency } from "@/lib/formatters";

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

// Calculate all past execution dates between start and today
function getRetroactiveDates(startDate: Date, frequency: string): Date[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const dates: Date[] = [];
  let current = new Date(startDate);
  let safety = 0;

  while (current <= today && safety < 200) {
    dates.push(new Date(current));
    current = getNextExecutionDate(current, frequency);
    safety++;
  }

  return dates;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPayment?: RecurringPayment | null;
  prefill?: {
    type?: string;
    amount?: number;
    currency?: string;
    account_id?: string;
    category_id?: string;
    description?: string;
    date?: Date;
  };
}

export function RecurringPaymentForm({ open, onOpenChange, editPayment, prefill }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { accounts } = useAccounts();
  const { expenseCategories, incomeCategories } = useCategories();
  const { createPayment, updatePayment } = useRecurringPayments();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MXN");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [totalPayments, setTotalPayments] = useState("");
  const [originalTotal, setOriginalTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [requiresManualAction, setRequiresManualAction] = useState(false);
  const [retroConfirmOpen, setRetroConfirmOpen] = useState(false);
  const [isSavingRetro, setIsSavingRetro] = useState(false);

  const isEdit = !!editPayment;

  // Populate form fields when opening (works for both controlled and uncontrolled open)
  useEffect(() => {
    if (!open) return;
    if (editPayment) {
      setName(editPayment.name);
      setDescription(editPayment.description || "");
      setType(editPayment.type);
      setAmount(String(editPayment.amount));
      setCurrency(editPayment.currency);
      setAccountId(editPayment.account_id);
      setCategoryId(editPayment.category_id || "");
      setFrequency(editPayment.frequency);
      setStartDate(new Date(editPayment.start_date));
      setEndDate(editPayment.end_date ? new Date(editPayment.end_date) : undefined);
      setTotalPayments(editPayment.total_payments ? String(editPayment.total_payments) : "");
      setOriginalTotal(editPayment.original_total_amount ? String(editPayment.original_total_amount) : "");
      setNotes(editPayment.notes || "");
      setRequiresManualAction(editPayment.requires_manual_action ?? false);
    } else {
      setName(prefill?.description || "");
      setDescription(prefill?.description || "");
      setType(prefill?.type || "expense");
      setAmount(prefill?.amount ? String(prefill.amount) : "");
      setCurrency(prefill?.currency || "MXN");
      setAccountId(prefill?.account_id || "");
      setCategoryId(prefill?.category_id || "");
      setFrequency("monthly");
      setStartDate(prefill?.date || new Date());
      setEndDate(undefined);
      setTotalPayments("");
      setOriginalTotal("");
      setNotes("");
      setRequiresManualAction(false);
    }
  }, [open, editPayment]);

  const categories = type === "income" ? incomeCategories : expenseCategories;

  // Calculate retroactive dates (for new payments: all past dates; for edits: only new past dates beyond existing payments_made)
  const retroDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sDate = new Date(startDate);
    sDate.setHours(0, 0, 0, 0);
    if (sDate >= today) return [];
    const allDates = getRetroactiveDates(sDate, frequency);
    if (isEdit && editPayment) {
      // Only return dates beyond what's already been paid
      return allDates.slice(editPayment.payments_made);
    }
    return allDates;
  }, [startDate, frequency, isEdit, editPayment]);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!name || !parsedAmount || !accountId || !frequency) return;

    // If retroactive dates exist, show confirmation (both create and edit)
    if (retroDates.length > 0) {
      setRetroConfirmOpen(true);
      return;
    }

    await doSave(false);
  };

  const doSave = async (generateRetro: boolean) => {
    const parsedAmount = parseFloat(amount);
    if (!name || !parsedAmount || !accountId || !frequency || !user) return;

    const sDate = format(startDate, "yyyy-MM-dd");

    // Calculate next execution date (must be in the future)
    let nextDate: Date;
    if (retroDates.length > 0) {
      // Next date is after the last retroactive date
      nextDate = getNextExecutionDate(retroDates[retroDates.length - 1], frequency);
    } else {
      nextDate = getNextExecutionDate(startDate, frequency);
    }

    const payload: any = {
      name,
      description: description || null,
      type,
      account_id: accountId,
      category_id: categoryId || null,
      amount: parsedAmount,
      currency,
      frequency,
      start_date: sDate,
      next_execution_date: format(nextDate, "yyyy-MM-dd"),
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      total_payments: totalPayments ? parseInt(totalPayments) : null,
      original_total_amount: originalTotal ? parseFloat(originalTotal) : null,
      remaining_balance: originalTotal ? parseFloat(originalTotal) : null,
      notes: notes || null,
      payments_made: generateRetro ? retroDates.length : 0,
      requires_manual_action: requiresManualAction,
    };

    if (isEdit) {
      await updatePayment.mutateAsync({ id: editPayment.id, ...payload });

      // Generate retroactive transactions for edit mode too
      if (generateRetro && retroDates.length > 0) {
        setIsSavingRetro(true);
        try {
          const transactions = retroDates.map(date => ({
            user_id: user.id,
            account_id: accountId,
            category_id: categoryId || null,
            type,
            amount: parsedAmount,
            currency,
            exchange_rate: 1,
            amount_in_base: parsedAmount,
            description: description || name,
            transaction_date: format(date, "yyyy-MM-dd"),
            is_recurring: true,
            recurring_payment_id: editPayment.id,
          }));

          await supabase.from("transactions").insert(transactions);

          // Update payments_made and remaining balance
          const newPaymentsMade = (editPayment.payments_made || 0) + retroDates.length;
          const updateData: any = { payments_made: newPaymentsMade };
          if (originalTotal) {
            const totalPaid = parsedAmount * newPaymentsMade;
            updateData.remaining_balance = Math.max(0, parseFloat(originalTotal) - totalPaid);
          }
          await supabase
            .from("recurring_payments" as any)
            .update(updateData as any)
            .eq("id", editPayment.id);

          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          queryClient.invalidateQueries({ queryKey: ["budgets"] });
          queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
        } finally {
          setIsSavingRetro(false);
        }
      }
    } else {
      // Create the recurring payment
      const result = await createPayment.mutateAsync(payload);

      // Generate retroactive transactions if confirmed
      if (generateRetro && retroDates.length > 0) {
        setIsSavingRetro(true);
        try {
          const transactions = retroDates.map(date => ({
            user_id: user.id,
            account_id: accountId,
            category_id: categoryId || null,
            type,
            amount: parsedAmount,
            currency,
            exchange_rate: 1,
            amount_in_base: parsedAmount,
            description: description || name,
            transaction_date: format(date, "yyyy-MM-dd"),
            is_recurring: true,
            recurring_payment_id: (result as any)?.id || null,
          }));

          await supabase.from("transactions").insert(transactions);
          
          // Update remaining balance if applicable
          if (originalTotal) {
            const totalPaid = parsedAmount * retroDates.length;
            const remaining = Math.max(0, parseFloat(originalTotal) - totalPaid);
            await supabase
              .from("recurring_payments" as any)
              .update({ remaining_balance: remaining } as any)
              .eq("id", (result as any)?.id);
          }

          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          queryClient.invalidateQueries({ queryKey: ["budgets"] });
        } finally {
          setIsSavingRetro(false);
        }
      }
    }
    setRetroConfirmOpen(false);
    onOpenChange(false);
  };

  const isPending = createPayment.isPending || updatePayment.isPending || isSavingRetro;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl z-50">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-base font-heading">
              {isEdit ? "Editar pago recurrente" : "Nuevo pago recurrente"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {isEdit ? "Modifica los datos del pago programado." : "Programa un cargo o pago automático."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-1.5 py-2">
            <FieldRow label="Nombre">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Netflix" className="h-8 text-xs" />
            </FieldRow>

            <FieldRow label="Concepto">
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del cargo" className="h-8 text-xs" />
            </FieldRow>

            <FieldRow label="Tipo">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="income">Ingreso</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Importe">
              <div className="flex gap-2">
                <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-8 text-xs flex-1" />
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldRow>

            <FieldRow label="Cuenta">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger>
                <SelectContent side="bottom" className="z-[200] max-h-[35vh] overflow-y-auto">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span className="truncate">{a.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{formatCurrency(a.current_balance ?? 0, a.currency)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Categoría">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                <SelectContent side="bottom" className="max-h-[35vh] overflow-y-auto">
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Frecuencia">
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Fecha inicio">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-8 text-xs justify-start", !startDate && "text-muted-foreground")}>
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                    <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </FieldRow>

            {/* Retroactive warning */}
            {retroDates.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium">
                    {isEdit ? "La fecha de inicio genera pagos pendientes." : "La fecha de inicio es anterior a hoy."}
                  </p>
                  <p>Se generarán {retroDates.length} movimientos históricos al guardar.</p>
                </div>
              </div>
            )}

            <FieldRow label="Fecha fin" hint="Opcional">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-8 text-xs justify-start", !endDate && "text-muted-foreground")}>
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: es }) : "Sin fecha fin"}
                    <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                </PopoverContent>
              </Popover>
            </FieldRow>

            <FieldRow label="Núm. pagos" hint="Opcional">
              <Input type="number" value={totalPayments} onChange={e => setTotalPayments(e.target.value)} placeholder="Indefinido" className="h-8 text-xs" />
            </FieldRow>

            <FieldRow label="Importe total original" hint="Opcional, para compras a plazo">
              <Input type="number" step="0.01" value={originalTotal} onChange={e => setOriginalTotal(e.target.value)} placeholder="Ej: 10000" className="h-8 text-xs" />
            </FieldRow>

            <FieldRow label="Notas">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales" className="text-xs min-h-[3rem]" />
            </FieldRow>

            <FieldRow label="¿Acción manual?" hint="Actívalo si realizas tú el pago (transferencia, depósito)">
              <Switch checked={requiresManualAction} onCheckedChange={setRequiresManualAction} />
            </FieldRow>
          </div>

          <div className="flex gap-3 pt-3">
            <Button variant="outline" className="flex-1 h-10" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1 h-10" onClick={handleSave} disabled={isPending || !name || !amount || !accountId}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : (isEdit ? "Actualizar" : "Programar")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Retroactive confirmation dialog */}
      <AlertDialog open={retroConfirmOpen} onOpenChange={setRetroConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Movimientos históricos
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Este pago recurrente generará <strong>{retroDates.length} movimientos históricos</strong>:</p>
              <div className="max-h-32 overflow-y-auto space-y-0.5 bg-muted/50 rounded-lg p-2">
                {retroDates.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{format(d, "dd MMMM yyyy", { locale: es })}</span>
                    <span className="font-medium">{formatCurrency(parseFloat(amount) || 0, currency)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs">Los movimientos afectarán los saldos de cuentas, categorías y presupuestos.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSave(true)} disabled={isSavingRetro}>
              {isSavingRetro ? "Generando..." : "Confirmar y generar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
