import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  transaction_date: string;
  category_id: string | null;
  account_id: string;
  related_account_id: string | null;
  voice_transcript: string | null;
  created_at: string | null;
}

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailSheet({ transaction, open, onOpenChange }: TransactionDetailSheetProps) {
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  if (!transaction) return null;

  const fmt = (v: number, c: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);

  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? "Sin categoría";
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name ?? "—";
  const typeLabels: Record<string, string> = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" };
  const typeColors: Record<string, string> = { expense: "text-expense", income: "text-income", transfer: "text-muted-foreground" };

  const dateFormatted = format(new Date(transaction.transaction_date + "T12:00:00"), "EEEE d 'de' MMMM, yyyy", { locale: es });

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "Tipo", value: typeLabels[transaction.type] ?? transaction.type, className: typeColors[transaction.type] },
    { label: "Monto", value: `${transaction.type === "expense" ? "- " : transaction.type === "income" ? "+ " : ""}${fmt(transaction.amount, transaction.currency)}`, className: transaction.type === "expense" ? "text-expense" : transaction.type === "income" ? "text-income" : undefined },
    { label: "Moneda", value: transaction.currency },
    { label: "Fecha", value: dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1) },
    { label: "Cuenta", value: getAccountName(transaction.account_id) },
  ];

  if (transaction.related_account_id) {
    rows.push({ label: "Cuenta destino", value: getAccountName(transaction.related_account_id) });
  }

  rows.push({ label: "Categoría", value: getCategoryName(transaction.category_id) });

  if (transaction.description) {
    rows.push({ label: "Descripción", value: transaction.description });
  }
  if (transaction.notes) {
    rows.push({ label: "Notas", value: transaction.notes });
  }
  if (transaction.voice_transcript) {
    rows.push({ label: "Transcripción de voz", value: transaction.voice_transcript });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-lg">Detalle del movimiento</SheetTitle>
        </SheetHeader>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className={cn("text-sm font-medium text-right max-w-[60%] break-words", row.className)}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
