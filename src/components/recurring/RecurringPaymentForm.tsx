import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
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

  const isEdit = !!editPayment;

  // Reset form when opened
  const handleOpenChange = (v: boolean) => {
    if (v) {
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
      }
    }
    onOpenChange(v);
  };

  const categories = type === "income" ? incomeCategories : expenseCategories;

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!name || !parsedAmount || !accountId || !frequency) return;

    const sDate = format(startDate, "yyyy-MM-dd");
    const nextDate = isEdit
      ? editPayment.next_execution_date
      : format(getNextExecutionDate(startDate, frequency), "yyyy-MM-dd");

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
      next_execution_date: nextDate,
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      total_payments: totalPayments ? parseInt(totalPayments) : null,
      original_total_amount: originalTotal ? parseFloat(originalTotal) : null,
      remaining_balance: originalTotal ? parseFloat(originalTotal) : null,
      notes: notes || null,
    };

    if (isEdit) {
      await updatePayment.mutateAsync({ id: editPayment.id, ...payload });
    } else {
      await createPayment.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const isPending = createPayment.isPending || updatePayment.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
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
              <SelectContent>
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
                <SelectContent>
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
              <SelectContent>
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
              <SelectContent>
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
        </div>

        <div className="flex gap-3 pt-3">
          <Button variant="outline" className="flex-1 h-10" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="flex-1 h-10" onClick={handleSave} disabled={isPending || !name || !amount || !accountId}>
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : (isEdit ? "Actualizar" : "Programar")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
