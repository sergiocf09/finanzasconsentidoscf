import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, getDay, isSameDay, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, List, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  useRecurringPayments,
  getNextExecutionDate,
  FREQUENCY_LABELS,
  type RecurringPayment,
} from "@/hooks/useRecurringPayments";
import { RecurringPaymentDetailSheet } from "./RecurringPaymentDetailSheet";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

interface CalendarEvent {
  payment: RecurringPayment;
  date: Date;
}

function projectPayments(payments: RecurringPayment[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const p of payments) {
    if (p.status !== "active") continue;

    let current = new Date(p.next_execution_date + "T12:00:00");
    let safety = 0;

    while (current <= rangeEnd && safety < 100) {
      if (current >= rangeStart) {
        events.push({ payment: p, date: new Date(current) });
      }
      current = getNextExecutionDate(current, p.frequency);
      safety++;

      // Stop if past end_date or total_payments reached
      if (p.end_date && current > new Date(p.end_date + "T12:00:00")) break;
      if (p.total_payments && (p.payments_made + safety) >= p.total_payments) break;
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecurringCalendar({ open, onOpenChange }: Props) {
  const { payments } = useRecurringPayments();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [selectedPayment, setSelectedPayment] = useState<RecurringPayment | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Project 3 months ahead for list view
  const listEnd = endOfMonth(addMonths(currentMonth, 2));

  const calendarEvents = useMemo(
    () => projectPayments(payments, monthStart, monthEnd),
    [payments, monthStart, monthEnd]
  );

  const listEvents = useMemo(
    () => projectPayments(payments, new Date(), listEnd),
    [payments, listEnd]
  );

  const totalMonth = calendarEvents.reduce((s, e) => s + e.payment.amount, 0);

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0=Sun

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base font-heading flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Calendario de pagos
            </SheetTitle>
            <SheetDescription className="text-xs">Visualiza tus compromisos financieros futuros.</SheetDescription>
          </SheetHeader>

          {/* Controls */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => addMonths(m, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                variant={viewMode === "calendar" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="h-3 w-3" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setViewMode("list")}
              >
                <List className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Monthly total */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 mb-3">
            <p className="text-xs text-muted-foreground">Total proyectado del mes</p>
            <p className="text-lg font-bold font-heading text-primary">
              {formatCurrency(totalMonth, "MXN")}
            </p>
            <p className="text-[10px] text-muted-foreground">{calendarEvents.length} pagos programados</p>
          </div>

          {viewMode === "calendar" ? (
            /* Calendar grid */
            <div className="space-y-1">
              <div className="grid grid-cols-7 gap-0.5">
                {dayNames.map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {/* Empty cells before first day */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10" />
                ))}
                {days.map(day => {
                  const dayEvents = calendarEvents.filter(e => isSameDay(e.date, day));
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "h-10 rounded-md text-center relative flex flex-col items-center justify-start pt-0.5",
                        isToday && "bg-primary/10 ring-1 ring-primary/30",
                        dayEvents.length > 0 && "cursor-pointer hover:bg-muted/50"
                      )}
                    >
                      <span className={cn("text-[11px]", isToday && "font-bold text-primary")}>
                        {format(day, "d")}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((e, i) => (
                            <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary" />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Events below calendar */}
              {calendarEvents.length > 0 && (
                <div className="space-y-1 pt-2">
                  {calendarEvents.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-card border border-border cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedPayment(e.payment)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Repeat className="h-3 w-3 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{e.payment.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(e.date, "dd MMM", { locale: es })} · {FREQUENCY_LABELS[e.payment.frequency]}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold shrink-0">
                        {formatCurrency(e.payment.amount, e.payment.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* List view - next 3 months */
            <div className="space-y-1">
              {listEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sin pagos programados.</p>
              ) : (
                listEvents.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedPayment(e.payment)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex flex-col items-center bg-primary/10 rounded-lg px-2 py-1 shrink-0 min-w-[40px]">
                        <span className="text-[10px] text-primary font-medium capitalize">
                          {format(e.date, "MMM", { locale: es })}
                        </span>
                        <span className="text-sm font-bold text-primary leading-none">
                          {format(e.date, "dd")}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.payment.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {FREQUENCY_LABELS[e.payment.frequency]}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0">
                      {formatCurrency(e.payment.amount, e.payment.currency)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RecurringPaymentDetailSheet
        payment={selectedPayment}
        open={!!selectedPayment}
        onOpenChange={v => { if (!v) setSelectedPayment(null); }}
      />
    </>
  );
}
