import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarClock, CreditCard, PiggyBank, AlertTriangle, ArrowRightLeft, X, Repeat, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpcomingDueDates, type UpcomingDueDatesProps } from "@/hooks/useUpcomingDueDates";
import { filterLabels, type TimeFilter } from "./upcomingDueDatesUtils";

export function UpcomingDueDates(props: UpcomingDueDatesProps) {
  const {
    visibleItems,
    recurringItems,
    accounts,
    sourceAccounts,
    hasAnyDueItems,
    fxRates,
    timeFilter,
    setTimeFilter,
    handleAmountChange,
    getDisplayAmount,
    focusedItemId,
    setFocusedItemId,
    transferringItemId,
    sourceAccountId,
    setSourceAccountId,
    transferCurrency,
    setTransferCurrency,
    isSaving,
    handleStartTransfer,
    handleCancelTransfer,
    handleConfirmTransfer,
    confirmingRecurring,
    setConfirmingRecurring,
    recurringSourceAccountId,
    setRecurringSourceAccountId,
    handleConfirmRecurring,
  } = useUpcomingDueDates(props);

  if (!hasAnyDueItems) return null;

  return (
    <div className="space-y-2">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-heading font-semibold text-foreground">Próximos vencimientos</h2>
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(filterLabels) as TimeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={cn(
                "text-xs font-bold px-3 py-1 rounded-full border transition-colors",
                timeFilter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-foreground border-border hover:border-muted-foreground/30"
              )}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Sin vencimientos en este periodo.
        </p>
      ) : (
        <div className="space-y-1.5">
          {visibleItems.map(item => {
            const isOverdue = item.daysLeft < 0;
            const isUrgent = item.daysLeft >= 0 && item.daysLeft <= 3;
            const isHighlight = isOverdue || isUrgent;
            const Icon = item.type === "debt" ? CreditCard : PiggyBank;
            const isTransferring = transferringItemId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  isOverdue
                    ? "border-destructive/40 bg-destructive/5"
                    : isUrgent
                      ? "border-expense/30 bg-expense/5"
                      : "border-border bg-card"
                )}
              >
              <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                    isOverdue ? "bg-destructive/10" : isUrgent ? "bg-expense/10" : "bg-primary/10"
                  )}>
                    <Icon className={cn("h-5 w-5", isHighlight ? "text-expense" : "text-primary")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                      {isOverdue && (
                        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          Vencido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(item.nextDate, "d 'de' MMMM", { locale: es })} · {
                        isOverdue
                          ? `Hace ${Math.abs(item.daysLeft)}D`
                          : item.daysLeft === 0 ? "Hoy"
                          : item.daysLeft === 1 ? "Mañana"
                          : `En ${item.daysLeft}D`
                      }
                    </p>
                  </div>

                  {isHighlight && <AlertTriangle className="h-3 w-3 text-expense shrink-0" />}

                  {focusedItemId === item.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={getDisplayAmount(item)}
                      onChange={(e) => handleAmountChange(item.id, e.target.value)}
                      onBlur={() => setFocusedItemId(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setFocusedItemId(null); }}
                      placeholder="0"
                      autoFocus
                      className={cn(
                        "h-7 w-24 text-xs text-right tabular-nums shrink-0 px-1.5",
                        isHighlight ? "border-expense/30" : "border-border"
                      )}
                    />
                  ) : (
                    <button
                      onClick={() => setFocusedItemId(item.id)}
                      className={cn(
                        "h-7 min-w-[5.5rem] rounded-md border px-1.5 text-xs text-right tabular-nums shrink-0 transition-colors",
                        "hover:border-primary/40 hover:bg-muted/50",
                        isHighlight ? "border-expense/30" : "border-border"
                      )}
                    >
                      {(() => {
                        const val = parseFloat(getDisplayAmount(item));
                        if (!val && val !== 0) return <span className="text-muted-foreground">$0</span>;
                        return <span className="text-foreground font-bold">{formatCurrencyAbs(val, item.currency)}</span>;
                      })()}
                    </button>
                  )}

                  {item.accountId && !isTransferring && (
                    <button
                      onClick={() => handleStartTransfer(item.id, item.currency)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md transition-colors shrink-0",
                        "bg-primary/10 hover:bg-primary/20 text-primary"
                      )}
                      title="Transferir"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isTransferring && (() => {
                  const sourceAcc = accounts.find(a => a.id === sourceAccountId);
                  const destAcc = accounts.find(a => a.id === item.accountId);
                  const isCross = sourceAcc && destAcc && sourceAcc.currency !== destAcc.currency;
                  const amt = parseFloat(getDisplayAmount(item)) || 0;
                  const isZero = amt === 0;
                  const usdRate = fxRates["USD"] || 1;

                  let previewFrom = amt;
                  let previewTo = amt;
                  if (isCross && amt > 0) {
                    if (transferCurrency === sourceAcc.currency) {
                      previewFrom = amt;
                      if (sourceAcc.currency === "USD" && destAcc.currency === "MXN") previewTo = amt * usdRate;
                      else if (sourceAcc.currency === "MXN" && destAcc.currency === "USD") previewTo = amt / usdRate;
                    } else if (transferCurrency === destAcc.currency) {
                      previewTo = amt;
                      if (sourceAcc.currency === "USD" && destAcc.currency === "MXN") previewFrom = amt / usdRate;
                      else if (sourceAcc.currency === "MXN" && destAcc.currency === "USD") previewFrom = amt * usdRate;
                    }
                  }

                  return (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border">
                      {isZero ? (
                        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                          Sin movimiento este mes. Se ocultará de los próximos vencimientos
                          hasta el siguiente ciclo.
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Moneda:</span>
                            <Select value={transferCurrency} onValueChange={setTransferCurrency}>
                              <SelectTrigger className="h-7 text-xs w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MXN" className="text-xs">MXN</SelectItem>
                                <SelectItem value="USD" className="text-xs">USD</SelectItem>
                                <SelectItem value="EUR" className="text-xs">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecciona cuenta de origen" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceAccounts
                                .filter(a => a.id !== item.accountId)
                                .map(a => {
                                  const bal = a.current_balance ?? 0;
                                  const isNeg = bal < 0;
                                  return (
                                    <SelectItem key={a.id} value={a.id} className="text-xs">
                                      <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="truncate">{a.name}</span>
                                        <span className={cn(
                                          "tabular-nums shrink-0",
                                          isNeg ? "text-expense" : "text-muted-foreground"
                                        )}>
                                          {isNeg ? "-" : ""}{formatCurrencyAbs(bal, a.currency)}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>

                          {isCross && amt > 0 && (
                            <div className="rounded-lg bg-muted px-3 py-2 text-xs space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Sale de {sourceAcc.name}</span>
                                <span className="font-medium text-foreground">{formatCurrencyAbs(Math.round(previewFrom * 100) / 100, sourceAcc.currency)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Llega a {destAcc.name}</span>
                                <span className="font-medium text-foreground">{formatCurrencyAbs(Math.round(previewTo * 100) / 100, destAcc.currency)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tipo de cambio</span>
                                <span>TC: ${usdRate.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={handleCancelTransfer}
                          disabled={isSaving}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-3 text-xs"
                          onClick={() => handleConfirmTransfer(item)}
                          disabled={isSaving || (!isZero && !sourceAccountId)}
                        >
                          {isZero ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Confirmar sin movimiento
                            </>
                          ) : (
                            <>
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              Transferir
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming recurring payments */}
      {recurringItems.length > 0 && (
        <div className="space-y-1.5 mt-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Repeat className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-heading font-semibold text-foreground">Cargos recurrentes próximos</h3>
          </div>
          {recurringItems.map(r => {
            const isManual = r.requires_manual_action;
            const isRecurringOverdue = r.daysLeft < 0;
            const isUrgent = r.daysLeft >= 0 && r.daysLeft <= 2;
            const isHighlightR = isRecurringOverdue || isUrgent;
            const isExpanded = confirmingRecurring === r.id;
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  isRecurringOverdue
                    ? "border-destructive/40 bg-destructive/5"
                    : isUrgent
                      ? "border-expense/30 bg-expense/5"
                      : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                    isRecurringOverdue ? "bg-destructive/10" : isUrgent ? "bg-expense/10" : "bg-primary/10"
                  )}>
                    <Repeat className={cn("h-5 w-5", isHighlightR ? "text-expense" : "text-primary")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
                      {isRecurringOverdue && (
                        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          Vencido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.next_execution_date + "T00:00:00"), "d 'de' MMMM", { locale: es })} · {
                        isRecurringOverdue
                          ? `Hace ${Math.abs(r.daysLeft)}D`
                          : r.daysLeft === 0 ? "Hoy"
                          : r.daysLeft === 1 ? "Mañana"
                          : `En ${r.daysLeft}D`
                      }
                    </p>
                  </div>

                  {isHighlightR && <AlertTriangle className="h-3 w-3 text-expense shrink-0" />}

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {formatCurrencyAbs(r.amount, r.currency)}
                    </span>
                    <span className={cn(
                      "text-[10px] font-medium",
                      isManual ? "text-muted-foreground" : "text-primary"
                    )}>
                      {isManual ? "Manual" : "Automático"}
                    </span>
                  </div>

                  {!isExpanded && (
                    <button
                      onClick={() => {
                        setConfirmingRecurring(r.id);
                        setRecurringSourceAccountId(r.account_id || "");
                      }}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md transition-colors shrink-0",
                        "bg-primary/10 hover:bg-primary/20 text-primary"
                      )}
                      title="Registrar cargo"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>


                {/* Account picker for confirmation (manual & automatic) */}
                {isExpanded && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {isManual
                        ? "Confirma la cuenta donde se aplicó este cargo:"
                        : "Este cargo es automático. Confirma que ya se realizó:"}
                    </p>
                    <Select value={recurringSourceAccountId} onValueChange={setRecurringSourceAccountId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Cuenta afectada" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter(a => a.is_active)
                          .map(a => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              <div className="flex items-center justify-between gap-3 w-full">
                                <span className="truncate">{a.name}</span>
                                <span className="tabular-nums text-muted-foreground shrink-0">
                                  {formatCurrencyAbs(Math.abs(a.current_balance ?? 0), a.currency)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setConfirmingRecurring(null);
                          setRecurringSourceAccountId("");
                        }}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1 px-3 text-xs"
                        onClick={() => handleConfirmRecurring(r, recurringSourceAccountId)}
                        disabled={!recurringSourceAccountId}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Confirmar cargo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
