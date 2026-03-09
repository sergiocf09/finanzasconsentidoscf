import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, ArrowRightLeft, Plus, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers } from "@/hooks/useTransfers";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { Eye, EyeOff } from "lucide-react";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransferForm } from "@/components/transfers/TransferForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

type PeriodKey = "current" | "previous" | "last3" | "custom";

const periodLabels: Record<PeriodKey, string> = {
  current: "Mes en curso",
  previous: "Mes anterior",
  last3: "Últimos 3 meses",
  custom: "Personalizado",
};

function getDateRange(period: PeriodKey, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (period) {
    case "previous":
      return { startDate: startOfMonth(subMonths(now, 1)), endDate: endOfMonth(subMonths(now, 1)) };
    case "last3":
      return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
    case "custom":
      return {
        startDate: customStart || startOfMonth(now),
        endDate: customEnd || endOfMonth(now),
      };
    default:
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  }
}

interface PeriodSummaryCardsProps {
  /** Pre-fetched totals from consolidated RPC (used for "current" period) */
  initialTotals?: { income: number; expense: number };
  /** Pre-fetched transfer total from consolidated RPC */
  initialTransferTotal?: number;
}

export function PeriodSummaryCards({ initialTotals, initialTransferTotal }: PeriodSummaryCardsProps) {
  const navigate = useNavigate();
  const { hidden, toggle, mask } = useHideAmounts("period");

  const [period, setPeriod] = useState<PeriodKey>("current");
  const [customStart, setCustomStart] = useState<Date>(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState<Date>(endOfMonth(new Date()));

  // When period = "current" and we have initial data from the RPC, skip individual queries
  const useRpcData = period === "current" && initialTotals !== undefined;

  const { startDate, endDate } = getDateRange(period, customStart, customEnd);
  const { totals: fetchedTotals } = useTransactions({
    startDate,
    endDate,
    enabled: !useRpcData,
  });
  const { totalTransferAmount: fetchedTransfer } = useTransfers(undefined, {
    startDate,
    endDate,
    enabled: !useRpcData,
  });

  // Use RPC data for current month, fetched data for other periods
  const totals = useRpcData ? initialTotals! : fetchedTotals;
  const transferTotal = useRpcData ? (initialTransferTotal ?? 0) : fetchedTransfer;

  // Form state
  const [txFormOpen, setTxFormOpen] = useState(false);
  const [txFormType, setTxFormType] = useState<"income" | "expense">("expense");
  const [transferOpen, setTransferOpen] = useState(false);

  const handlePeriodChange = (val: string) => {
    setPeriod(val as PeriodKey);
  };

  const openTxForm = (type: "income" | "expense", e: React.MouseEvent) => {
    e.stopPropagation();
    setTxFormType(type);
    setTxFormOpen(true);
  };

  const openTransferForm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferOpen(true);
  };

  const cards = [
    {
      label: "Ingresos",
      amount: totals.income,
      icon: TrendingUp,
      color: "income" as const,
      filterType: "income",
      onAdd: (e: React.MouseEvent) => openTxForm("income", e),
    },
    {
      label: "Gastos",
      amount: totals.expense,
      icon: TrendingDown,
      color: "expense" as const,
      filterType: "expense",
      onAdd: (e: React.MouseEvent) => openTxForm("expense", e),
    },
    {
      label: "Transferencias",
      amount: transferTotal,
      icon: ArrowRightLeft,
      color: "transfer" as const,
      filterType: "transfer",
      onAdd: (e: React.MouseEvent) => openTransferForm(e),
    },
  ];

  return (
    <>
      <div className="space-y-2">
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([key, label]) => (
                <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={toggle} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors" title={hidden ? "Mostrar montos" : "Ocultar montos"}>
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Custom date pickers */}
        {period === "custom" && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {format(customStart, "dd MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customStart}
                  onSelect={(d) => d && setCustomStart(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {format(customEnd, "dd MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={customEnd}
                  onSelect={(d) => d && setCustomEnd(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Cards grid */}
        <div className="grid grid-cols-3 gap-2">
          {cards.map((card) => (
            <div key={card.label} className="flex flex-col gap-1">
              <button
                onClick={() => navigate(`/transactions?type=${card.filterType}`)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl p-2.5 text-center transition-all card-interactive",
                  card.color === "income" && "bg-income/5 hover:bg-income/10",
                  card.color === "expense" && "bg-expense/5 hover:bg-expense/10",
                  card.color === "transfer" && "bg-transfer/5 hover:bg-transfer/10"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    card.color === "income" && "bg-income/10",
                    card.color === "expense" && "bg-expense/10",
                    card.color === "transfer" && "bg-transfer/10"
                  )}
                >
                  <card.icon
                    className={cn(
                      "h-4 w-4",
                      card.color === "income" && "text-income",
                      card.color === "expense" && "text-expense",
                      card.color === "transfer" && "text-transfer"
                    )}
                  />
                </div>
                <span className="text-xs font-bold text-foreground">{card.label}</span>
                <span
                  className={cn(
                    "text-base font-extrabold font-heading tabular-nums tracking-tight leading-tight",
                    card.color === "income" && "text-income",
                    card.color === "expense" && "text-expense",
                    card.color === "transfer" && "text-transfer"
                  )}
                >
                  {mask(formatCurrencyAbs(card.amount))}
                </span>
              </button>

              <button
                onClick={card.onAdd}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-lg py-1.5 transition-all border",
                  "hover:opacity-80 active:scale-95",
                  card.color === "income" && "bg-income/10 text-income border-income/30",
                  card.color === "expense" && "bg-expense/10 text-expense border-expense/30",
                  card.color === "transfer" && "bg-transfer/10 text-transfer border-transfer/30"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <TransactionForm open={txFormOpen} onOpenChange={setTxFormOpen} defaultType={txFormType} />
      <TransferForm open={transferOpen} onOpenChange={setTransferOpen} />
    </>
  );
}
