import { useState, useMemo } from "react";
import { Plus, Repeat, Filter, Search, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import {
  useRecurringPayments,
  FREQUENCY_LABELS,
  STATUS_LABELS,
} from "@/hooks/useRecurringPayments";
import { RecurringPaymentForm } from "@/components/recurring/RecurringPaymentForm";
import { RecurringPaymentDetailSheet } from "@/components/recurring/RecurringPaymentDetailSheet";
import type { RecurringPayment } from "@/hooks/useRecurringPayments";

export default function RecurringPayments() {
  const { payments, isLoading } = useRecurringPayments();
  const { accounts } = useAccounts();
  const { categories: allCategories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<RecurringPayment | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");

  const filtered = useMemo(() => {
    let items = payments;
    if (statusFilter !== "all") items = items.filter(p => p.status === statusFilter);
    if (frequencyFilter !== "all") items = items.filter(p => p.frequency === frequencyFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [payments, statusFilter, frequencyFilter, search]);

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "—";
  const getCategoryName = (id: string | null) => {
    if (!id) return null;
    return allCategories.find(c => c.id === id)?.name || null;
  };

  const statusColor = (s: string) => {
    if (s === "active") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    if (s === "paused") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    if (s === "cancelled") return "bg-destructive/15 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-heading font-semibold">Pagos Recurrentes</h1>
          <p className="text-xs text-muted-foreground">Cargos y pagos programados automáticos</p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="h-8 text-xs pl-7" />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Frecuencia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Repeat className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin pagos recurrentes</p>
          <p className="text-xs mt-1">Programa tu primer pago automático.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(payment => {
            const catName = getCategoryName(payment.category_id);
            return (
              <Card
                key={payment.id}
                className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSelected(payment)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{payment.name}</span>
                      <Badge className={`text-[9px] px-1.5 py-0 ${statusColor(payment.status)}`}>
                        {STATUS_LABELS[payment.status] || payment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>{getAccountName(payment.account_id)}</span>
                      {catName && <><span>·</span><span>{catName}</span></>}
                      <span>·</span>
                      <span>{FREQUENCY_LABELS[payment.frequency]}</span>
                    </div>
                    {payment.status === "active" && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Próximo: {format(new Date(payment.next_execution_date), "dd MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold">
                      {formatCurrency(payment.amount, payment.currency)}
                    </span>
                    {payment.total_payments && (
                      <p className="text-[10px] text-muted-foreground">
                        {payment.payments_made}/{payment.total_payments}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RecurringPaymentForm open={formOpen} onOpenChange={setFormOpen} />
      <RecurringPaymentDetailSheet payment={selected} open={!!selected} onOpenChange={v => { if (!v) setSelected(null); }} />
    </div>
  );
}
