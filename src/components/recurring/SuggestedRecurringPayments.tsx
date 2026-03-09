import { useState } from "react";
import { Lightbulb, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { FREQUENCY_LABELS } from "@/hooks/useRecurringPayments";
import { useRecurringSuggestions, type RecurringSuggestion } from "@/hooks/useRecurringSuggestions";
import { RecurringPaymentForm } from "./RecurringPaymentForm";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function SuggestedRecurringPayments() {
  const { suggestions, isLoading, dismiss } = useRecurringSuggestions();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RecurringSuggestion | null>(null);

  if (isLoading || suggestions.length === 0) return null;

  const handleConvert = (s: RecurringSuggestion) => {
    setSelectedSuggestion(s);
    setFormOpen(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-medium">Pagos sugeridos</h3>
        <Badge variant="secondary" className="text-[10px]">{suggestions.length}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Detectamos estos gastos recurrentes en tu historial.
      </p>

      <div className="space-y-2">
        {suggestions.slice(0, 5).map((s, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.description}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span>{s.accountName}</span>
                  {s.categoryName && <><span>·</span><span>{s.categoryName}</span></>}
                  <span>·</span>
                  <span>{FREQUENCY_LABELS[s.frequency] || s.frequency}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {s.occurrences} ocurrencias · Últimas: {s.dates.slice(-3).map(d => 
                    format(new Date(d + "T12:00:00"), "dd MMM", { locale: es })
                  ).join(", ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{formatCurrency(s.averageAmount, s.currency)}</p>
                <p className="text-[10px] text-muted-foreground">promedio</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => dismiss(s)}>
                <X className="h-3 w-3 mr-1" /> Descartar
              </Button>
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleConvert(s)}>
                <Plus className="h-3 w-3 mr-1" /> Crear recurrente
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {selectedSuggestion && (
        <RecurringPaymentForm
          open={formOpen}
          onOpenChange={(v) => {
            setFormOpen(v);
            if (!v) {
              dismiss(selectedSuggestion);
              setSelectedSuggestion(null);
            }
          }}
          prefill={{
            type: "expense",
            amount: selectedSuggestion.averageAmount,
            currency: selectedSuggestion.currency,
            account_id: selectedSuggestion.accountId,
            category_id: selectedSuggestion.categoryId || undefined,
            description: selectedSuggestion.description,
          }}
        />
      )}
    </div>
  );
}
