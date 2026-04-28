import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X, AlertTriangle, ArrowRight, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  sanitizeTranscript,
  parseVoiceCommand,
  type ParsedVoiceCommand,
} from "@/lib/voiceParser";
import { useWebSpeechSTT } from "@/hooks/useWebSpeechSTT";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { FREQUENCY_LABELS } from "@/hooks/useRecurringPayments";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useVoiceSubmit } from "@/hooks/useVoiceSubmit";
import { format } from "date-fns";

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export function VoiceButton() {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { rates: fxRates } = useExchangeRate();
  const { submitVoiceTransaction, logVoiceTranscript, isPending: isSaving } = useVoiceSubmit();
  const [isOpen, setIsOpen] = useState(false);
  const [committedText, setCommittedText] = useState("");
  const [committedText, setCommittedText] = useState("");
  const [cleanTranscript, setCleanTranscript] = useState("");
  const [parseResult, setParseResult] = useState<ParsedVoiceCommand | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const stt = useWebSpeechSTT();

  // Pre-selection state
  const [selectedType, setSelectedType] = useState<"expense" | "income" | "transfer" | null>(null);
  const [preFromAccountId, setPreFromAccountId] = useState("");
  const [preToAccountId, setPreToAccountId] = useState("");

  // Edit fields
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<string>("expense");
  const [editAccountId, setEditAccountId] = useState("");
  const [editToAccountId, setEditToAccountId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [requiresManualAction, setRequiresManualAction] = useState(false);
  const [editCurrency, setEditCurrency] = useState("MXN");

  // ─── ONE-TAP: selecting type immediately starts recording ────
  const handleTypeSelect = useCallback((type: "expense" | "income" | "transfer") => {
    setSelectedType(type);
    // All types now start recording immediately
    setTimeout(() => {
      stt.start();
    }, 150);
  }, [stt]);

  // Auto-process when STT stops listening and we have text
  const hasProcessed = useRef(false);
  useEffect(() => {
    if (!stt.isListening && (stt.finalText || stt.interimText) && selectedType && !parseResult && !hasProcessed.current) {
      hasProcessed.current = true;
      const rawText = (stt.finalText + " " + stt.interimText).trim();
      if (!rawText) return;

      const cleaned = sanitizeTranscript(rawText);
      setCommittedText(rawText);
      setCleanTranscript(cleaned);

      const activeAccs = accounts.filter(a => a.is_active);
      const result = parseVoiceCommand(
        rawText,
        selectedType,
        activeAccs,
        categories,
        selectedType === "transfer" ? preFromAccountId : undefined,
        selectedType === "transfer" ? preToAccountId : undefined,
      );
      setParseResult(result);

      setEditType(result.type);
      setEditAmount(result.amount ? String(result.amount) : "");
      setEditDate(result.date);
      setEditCategoryId(result.category?.id || "");
      setEditAccountId(result.fromAccount?.id || "");
      setEditToAccountId(result.toAccount?.id || "");
      setEditDescription(result.concept);
      setEditCurrency(result.currency ?? "MXN");

      // Log
      if (user) {
        supabase.from("voice_logs").insert([{
          user_id: user.id,
          transcript_raw: rawText,
          parsed_json: { ...result, transcript_clean: cleaned } as any,
          confidence: result.amount ? (result.accountScore > 0.7 ? 85 : 60) : 30,
        }]).then(() => {});
      }

      if (result.warning) toast.warning(result.warning);
      if (result.error) toast.error(result.error);
    }
  }, [stt.isListening, stt.finalText, stt.interimText, selectedType, parseResult, accounts, categories, preFromAccountId, preToAccountId, user]);

  const handleStopRecording = useCallback(() => {
    stt.stop();
  }, [stt]);

  const handleStartRecording = useCallback(() => {
    stt.start();
  }, [stt]);

  const canConfirm = (): boolean => {
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) return false;
    if (!editAccountId) return false;
    if (editType === "transfer" && (!editToAccountId || editAccountId === editToAccountId)) return false;
    return true;
  };

  const getValidationMessage = (): string | null => {
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) return "Falta el monto.";
    if (!editAccountId) return "Selecciona una cuenta.";
    if (editType === "transfer" && !editToAccountId) return "Selecciona cuenta destino.";
    if (editType === "transfer" && editAccountId === editToAccountId) return "Las cuentas no pueden ser iguales.";
    return null;
  };

  const activeAccounts = accounts.filter(a => a.is_active);

  // Reactive transfer conversion preview
  const transferConversion = useMemo(() => {
    if (editType !== "transfer") return null;
    const from = activeAccounts.find(a => a.id === editAccountId);
    const to = activeAccounts.find(a => a.id === editToAccountId);
    if (!from || !to || from.currency === to.currency) return null;
    const amt = parseFloat(editAmount) || 0;
    if (!amt) return null;
    const usdRate = fxRates["USD"] || 1;

    let amountFrom = amt;
    let amountTo = amt;

    if (editCurrency === from.currency) {
      amountFrom = amt;
      if (from.currency === "USD" && to.currency === "MXN") amountTo = amt * usdRate;
      else if (from.currency === "MXN" && to.currency === "USD") amountTo = amt / usdRate;
    } else if (editCurrency === to.currency) {
      amountTo = amt;
      if (from.currency === "USD" && to.currency === "MXN") amountFrom = amt / usdRate;
      else if (from.currency === "MXN" && to.currency === "USD") amountFrom = amt * usdRate;
    }

    return {
      amountFrom: Math.round(amountFrom * 100) / 100,
      currencyFrom: from.currency,
      amountTo: Math.round(amountTo * 100) / 100,
      currencyTo: to.currency,
      rate: usdRate,
      fromName: from.name,
      toName: to.name,
    };
  }, [editType, editAmount, editCurrency, editAccountId, editToAccountId, activeAccounts, fxRates]);

  const handleConfirm = async () => {
    if (!user || !canConfirm()) return;
    setIsSaving(true);
    try {
      const amount = parseFloat(editAmount);

      if (editType === "transfer") {
        const from = accounts.find(a => a.id === editAccountId)!;
        const to = accounts.find(a => a.id === editToAccountId)!;
        const usdRate = fxRates["USD"] || 1;
        const userCurrency = editCurrency;

        let amountFrom = amount;
        let amountTo = amount;
        let fxRateUsed: number | null = null;

        if (userCurrency === from.currency && from.currency !== to.currency) {
          fxRateUsed = usdRate;
          if (from.currency === "USD" && to.currency === "MXN") amountTo = amount * usdRate;
          else if (from.currency === "MXN" && to.currency === "USD") amountTo = amount / usdRate;
          amountFrom = amount;
        } else if (userCurrency !== from.currency && userCurrency === to.currency) {
          fxRateUsed = usdRate;
          amountTo = amount;
          if (from.currency === "USD" && to.currency === "MXN") amountFrom = amount / usdRate;
          else if (from.currency === "MXN" && to.currency === "USD") amountFrom = amount * usdRate;
        }

        // B.5: Auto-cierre de vencimiento si la cuenta destino tiene una deuda activa con due_day próximo (≤30 días)
        const linkedDebt = debts.find(d => d.account_id === editToAccountId && d.is_active);
        let createdFrom = "voice";
        let finalDescription = editDescription || cleanTranscript || committedText;
        if (linkedDebt && linkedDebt.due_day) {
          const today = new Date();
          const y = today.getFullYear();
          const m = today.getMonth();
          const dim = new Date(y, m + 1, 0).getDate();
          const dueDate = new Date(y, m, Math.min(linkedDebt.due_day, dim));
          dueDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
          if (daysDiff <= 30) {
            createdFrom = "due_dates";
            finalDescription = `Pago: ${linkedDebt.name}`;
          }
        }

        await supabase.from("transfers").insert({
          user_id: user.id,
          from_account_id: editAccountId,
          to_account_id: editToAccountId,
          amount_from: Math.round(amountFrom * 100) / 100,
          currency_from: from.currency,
          amount_to: Math.round(amountTo * 100) / 100,
          currency_to: to.currency,
          fx_rate: fxRateUsed,
          transfer_date: editDate,
          description: finalDescription,
          created_from: createdFrom,
        });
        queryClient.invalidateQueries({ queryKey: ["transfers"] });
      } else {
        const acc = accounts.find(a => a.id === editAccountId)!;
        let finalAmount = amount;
        let amountInBase = amount;
        let exchangeRate = 1;
        let notes: string | null = null;

        const usdRate = fxRates["USD"] || 0;
        if (editCurrency !== acc.currency && usdRate > 0) {
          if (editCurrency === "MXN" && acc.currency === "USD") {
            finalAmount = amount / usdRate;
            amountInBase = amount;
            exchangeRate = 1 / usdRate;
            notes = `Registrado: $${amount.toFixed(2)} MXN · TC: $${usdRate.toFixed(2)} · En cuenta: $${finalAmount.toFixed(2)} USD`;
          } else if (editCurrency === "USD" && acc.currency === "MXN") {
            finalAmount = amount * usdRate;
            amountInBase = finalAmount;
            exchangeRate = usdRate;
            notes = `Registrado: $${amount.toFixed(2)} USD · TC: $${usdRate.toFixed(2)} · Equivalente: $${finalAmount.toFixed(2)} MXN`;
          }
        } else if (editCurrency === acc.currency && acc.currency !== "MXN") {
          // Same currency but not MXN → calculate MXN equivalent
          const rateForCurrency = fxRates[acc.currency] || 0;
          if (rateForCurrency > 0) {
            amountInBase = amount * rateForCurrency;
            exchangeRate = rateForCurrency;
            notes = `$${amount.toFixed(2)} ${acc.currency} · TC: $${rateForCurrency.toFixed(2)} · Equivalente: $${amountInBase.toFixed(2)} MXN`;
          }
        }

        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: editAccountId,
          category_id: editCategoryId || null,
          type: editType,
          amount: finalAmount,
          currency: acc.currency,
          exchange_rate: exchangeRate,
          amount_in_base: amountInBase,
          notes,
          description: editDescription || cleanTranscript || committedText,
          transaction_date: editDate,
          voice_transcript: committedText,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      // Check budget alerts after expense
      if (editType === "expense") {
        setTimeout(() => checkAlerts(), 1000);
      }

      // Create recurring payment if switch is on
      if (makeRecurring && editType !== "transfer" && editAccountId) {
        const acc = accounts.find(a => a.id === editAccountId)!;
        const txDate = new Date(editDate + "T12:00:00");
        const nextDate = getNextExecutionDate(txDate, recurringFrequency);
        await createRecurring.mutateAsync({
          name: editDescription || cleanTranscript || committedText || "Pago recurrente",
          description: editDescription || cleanTranscript || committedText || null,
          type: editType,
          account_id: editAccountId,
          category_id: editCategoryId || undefined,
          amount: parseFloat(editAmount),
          currency: acc.currency,
          frequency: recurringFrequency,
          start_date: editDate,
          next_execution_date: format(nextDate, "yyyy-MM-dd"),
          payments_made: 1,
          requires_manual_action: requiresManualAction,
        });
        queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
        queryClient.invalidateQueries({ queryKey: ["upcoming_recurring"] });
      }

      toast.success("Registrado correctamente");
      handleReset();
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    stt.reset();
    hasProcessed.current = false;
    setCommittedText("");
    setCleanTranscript("");
    setParseResult(null);
    setIsEditing(false);
    setSelectedType(null);
    setPreFromAccountId("");
    setPreToAccountId("");
    setEditAmount("");
    setEditType("expense");
    setEditAccountId("");
    setEditToAccountId("");
    setEditCategoryId("");
    setEditDescription("");
    setEditDate(format(new Date(), "yyyy-MM-dd"));
    setMakeRecurring(false);
    setRecurringFrequency("monthly");
    setRequiresManualAction(false);
    setEditCurrency("MXN");
  };

  const handleCancel = async () => {
    stt.reset();
    handleReset();
    setIsOpen(false);
  };

  // activeAccounts already defined above
  const typeLabels: Record<string, string> = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" };
  const typeColors: Record<string, string> = { expense: "text-expense", income: "text-income", transfer: "text-muted-foreground" };

  const fmt = (amount: number, currency: string = "MXN") => formatCurrency(amount, currency);

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name ?? "";

  const validationMsg = getValidationMessage();

  const typePills: { value: "expense" | "income" | "transfer"; label: string; icon: string }[] = [
    { value: "expense", label: "Gasto", icon: "↓" },
    { value: "income", label: "Ingreso", icon: "↑" },
    { value: "transfer", label: "Transferencia", icon: "↔" },
  ];

  const liveText = stt.finalText + (stt.interimText ? " " + stt.interimText : "");

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-all hover:scale-105 active:scale-95",
          "bottom-20 right-4 lg:bottom-6 lg:right-6"
        )}
        aria-label="Registrar por voz"
      >
        <Mic className="h-6 w-6" />
      </button>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); else setIsOpen(true); }}>
        <DialogContent className="sm:max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden w-[calc(100vw-2rem)]">
          <div className="mx-auto w-full flex flex-col overflow-hidden">
            <DialogHeader className="text-center pb-1 shrink-0">
              <DialogTitle className="font-heading text-base">Registra con tu voz</DialogTitle>
              <DialogDescription className="text-xs leading-tight">
                Toca el tipo para empezar a grabar.
                <br />
                <span className="italic text-muted-foreground">Ej: "900 pesos gasolina HSBC"</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center px-4 space-y-2 overflow-y-auto flex-1 min-h-0 pb-2">

              {/* ─── STEP 1: Type selection (one-tap starts recording) ──── */}
              {!parseResult && (
                <div className="w-full space-y-2">
                  <div className="flex gap-2 w-full">
                    {typePills.map(({ value, label, icon }) => (
                      <button
                        key={value}
                        onClick={() => handleTypeSelect(value)}
                        disabled={stt.isListening}
                        className={cn(
                          "flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-all border-2",
                          selectedType === value
                            ? value === "expense"
                              ? "border-expense bg-expense/10 text-expense"
                              : value === "income"
                                ? "border-income bg-income/10 text-income"
                                : "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground/30"
                        )}
                      >
                        <span className="block text-lg leading-none mb-0.5">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Listening indicator ──── */}
              {!parseResult && stt.isListening && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <button
                    onClick={handleStopRecording}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-expense text-expense-foreground animate-pulse ring-4 ring-expense/30 transition-all"
                  >
                    <MicOff className="h-7 w-7" />
                  </button>
                  <p className="text-sm text-expense font-semibold animate-pulse">🎙️ ¡Habla ahora! — Toca para detener</p>
                </div>
              )}

              {/* ─── Status when not listening and no result yet ──── */}
              {!parseResult && !stt.isListening && selectedType && (
                <p className="text-xs text-muted-foreground text-center italic">
                  {selectedType === "expense" && 'Ej: "Gasolina mil pesos Scotiabank"'}
                  {selectedType === "income" && 'Ej: "Renta 35 mil pesos BBVA"'}
                  {selectedType === "transfer" && 'Ej: "5 mil pesos de BBVA a Scotiabank"'}
                </p>
              )}

              {/* Live transcript */}
              {stt.isListening && liveText && (
                <div className="w-full rounded-lg bg-secondary p-2">
                  <p className="text-center text-sm text-foreground break-words line-clamp-2">
                    {stt.finalText && <span className="font-medium">{stt.finalText} </span>}
                    {stt.interimText && <span className="text-muted-foreground italic">{stt.interimText}</span>}
                  </p>
                </div>
              )}

              {/* ─── Parsed result - view mode ──── */}
              {!stt.isListening && parseResult && !isEditing && (
                <div className="w-full space-y-2">
                  <div className="rounded-lg bg-secondary p-2 text-center">
                    <p className="text-xs text-muted-foreground">Transcripción:</p>
                    <p className="text-sm font-medium text-foreground break-words line-clamp-2">{cleanTranscript || committedText}</p>
                  </div>

                  {parseResult.error && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{parseResult.error}</span>
                    </div>
                  )}

                  {parseResult.warning && !parseResult.error && (
                    <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--status-warning)/0.1)] p-2 text-sm text-[hsl(var(--status-warning))]">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{parseResult.warning}</span>
                    </div>
                  )}

                  <div className="text-xs space-y-0 w-full overflow-hidden">
                    <div className="flex justify-between py-0.5 border-b border-border gap-2">
                      <span className="text-muted-foreground shrink-0">Tipo:</span>
                      <span className={cn("font-medium text-right truncate", typeColors[editType])}>{typeLabels[editType] ?? "—"}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border gap-2">
                      <span className="text-muted-foreground shrink-0">Categoría:</span>
                      <span className="font-medium text-primary truncate text-right min-w-0">{editCategoryId ? getCategoryName(editCategoryId) : <span className="text-muted-foreground">Sin categoría</span>}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border gap-2">
                      <span className="text-muted-foreground shrink-0">Monto:</span>
                      <span className="font-medium text-right">{editAmount ? `${fmt(parseFloat(editAmount), editCurrency)} ${editCurrency}` : <span className="text-destructive">Sin monto</span>}</span>
                    </div>
                    {/* Currency chips in confirmation view */}
                    <div className="flex justify-between py-0.5 border-b border-border gap-2 items-center">
                      <span className="text-muted-foreground shrink-0">Moneda:</span>
                      <div className="flex gap-1">
                        {["MXN", "USD", "EUR"].map(cur => (
                          <button
                            key={cur}
                            type="button"
                            onClick={() => setEditCurrency(cur)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors",
                              editCurrency === cur
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-accent"
                            )}
                          >
                            {cur}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border gap-2">
                      <span className="text-muted-foreground shrink-0">{editType === "transfer" ? "Origen:" : "Cuenta:"}</span>
                      <span className="font-medium truncate text-right min-w-0">
                        {editAccountId ? activeAccounts.find(a => a.id === editAccountId)?.name ?? "—" : <span className="text-destructive">Sin cuenta</span>}
                      </span>
                    </div>
                    {editType === "transfer" && (
                      <div className="flex justify-between py-0.5 border-b border-border gap-2">
                        <span className="text-muted-foreground shrink-0">Destino:</span>
                        <span className="font-medium truncate text-right min-w-0">
                          {editToAccountId ? activeAccounts.find(a => a.id === editToAccountId)?.name ?? "—" : <span className="text-destructive">Sin cuenta destino</span>}
                        </span>
                      </div>
                    )}
                    {editDescription && (
                      <div className="flex justify-between py-0.5 border-b border-border gap-2">
                        <span className="text-muted-foreground shrink-0">Concepto:</span>
                        <span className="font-medium truncate text-right min-w-0">{editDescription}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-0.5 gap-2">
                      <span className="text-muted-foreground shrink-0">Fecha:</span>
                      <span className="font-medium text-right">{editDate === format(new Date(), "yyyy-MM-dd") ? "Hoy" : editDate}</span>
                    </div>
                  </div>

                  {/* ─── CURRENCY CONVERSION INDICATOR ──── */}
                  {(() => {
                    const acc = editAccountId ? activeAccounts.find(a => a.id === editAccountId) : null;
                    if (!acc || !editAmount) return null;
                    const amount = parseFloat(editAmount);
                    if (isNaN(amount) || amount <= 0) return null;

                    // Cross-currency case
                    if (editCurrency !== acc.currency) {
                      const usdRate = fxRates["USD"] || 0;
                      if (usdRate <= 0) return null;
                      let convertedAmount = 0;
                      let label = "";
                      if (editCurrency === "USD" && acc.currency === "MXN") {
                        convertedAmount = amount * usdRate;
                        label = `$${amount.toFixed(2)} USD → $${convertedAmount.toFixed(2)} MXN · TC: $${usdRate.toFixed(2)}`;
                      } else if (editCurrency === "MXN" && acc.currency === "USD") {
                        convertedAmount = amount / usdRate;
                        label = `$${amount.toFixed(2)} MXN → $${convertedAmount.toFixed(4)} USD · TC: $${usdRate.toFixed(2)}`;
                      } else {
                        return null;
                      }
                      return (
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                          <p className="text-[11px] text-foreground text-center">
                            <span className="font-semibold">{label}</span>
                          </p>
                        </div>
                      );
                    }

                    // Same currency but not MXN → show MXN equivalent
                    if (acc.currency !== "MXN") {
                      const rateForCurrency = fxRates[acc.currency] || 0;
                      if (rateForCurrency <= 0) return null;
                      const mxnEquiv = amount * rateForCurrency;
                      return (
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                          <p className="text-[11px] text-foreground text-center">
                            <span className="font-semibold">
                              ${amount.toFixed(2)} {acc.currency} ≈ ${mxnEquiv.toFixed(2)} MXN · TC: ${rateForCurrency.toFixed(2)}
                            </span>
                          </p>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* ─── TRANSFER CONVERSION PREVIEW ──── */}
                  {transferConversion && (
                    <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex justify-between">
                        <span>Sale de {transferConversion.fromName}</span>
                        <span className="font-medium">{formatCurrency(transferConversion.amountFrom, transferConversion.currencyFrom)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Llega a {transferConversion.toName}</span>
                        <span className="font-medium text-foreground">{formatCurrency(transferConversion.amountTo, transferConversion.currencyTo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tipo de cambio</span>
                        <span>TC: ${transferConversion.rate.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* ─── RECURRING PAYMENT SWITCH ──── */}
                  {editType !== "transfer" && (
                    <div className="w-full rounded-lg border border-border p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Repeat className="h-3 w-3 text-primary" />
                          <Label className="text-[11px] font-medium">Pago recurrente</Label>
                        </div>
                        <Switch checked={makeRecurring} onCheckedChange={setMakeRecurring} />
                      </div>
                      {makeRecurring && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground shrink-0">Frecuencia:</Label>
                            <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                              <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">¿Acción manual?</Label>
                            <Switch checked={requiresManualAction} onCheckedChange={setRequiresManualAction} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {((!editAccountId || parseResult.accountStatus === "uncertain") && editType !== "transfer") && (() => {
                    const cardAccs = activeAccounts.filter(a => a.type === "credit_card");
                    const bankAccs = activeAccounts.filter(a => ["bank", "checking", "savings", "investment"].includes(a.type));
                    const cashAccs = activeAccounts.filter(a => ["cash"].includes(a.type));
                    const showSelector = cardAccs.length > 0 || bankAccs.length > 0 || cashAccs.length > 0;
                    if (!showSelector) return null;

                    const chipBtn = (acc: typeof activeAccounts[0]) => (
                      <button
                        key={acc.id}
                        onClick={() => setEditAccountId(acc.id)}
                        className={cn(
                          "w-full px-2 py-1.5 rounded-lg text-xs font-medium border transition-all text-left truncate",
                          editAccountId === acc.id
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border bg-card text-foreground hover:border-primary/50"
                        )}
                      >
                        {acc.name}
                      </button>
                    );

                    return (
                      <div className="space-y-1.5 w-full">
                        <p className="text-xs font-medium text-muted-foreground">
                          {editAccountId && parseResult.accountStatus === "uncertain"
                            ? "⚠️ ¿Es correcta? Toca para cambiar:"
                            : "Selecciona cuenta:"}
                        </p>
                        <div className="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide text-center">Tarjetas</p>
                            {cardAccs.length > 0 ? cardAccs.map(chipBtn) : (
                              <p className="text-[10px] text-muted-foreground/50 text-center">—</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide text-center">Bancos</p>
                            {bankAccs.length > 0 ? bankAccs.map(chipBtn) : (
                              <p className="text-[10px] text-muted-foreground/50 text-center">—</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide text-center">Efectivo</p>
                            {cashAccs.length > 0 ? cashAccs.map(chipBtn) : (
                              <p className="text-[10px] text-muted-foreground/50 text-center">—</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─── TRANSFER ACCOUNT SELECTOR ──── */}
                  {editType === "transfer" && (!editAccountId || !editToAccountId || parseResult.accountStatus === "uncertain") && (() => {
                    const chipBtn = (acc: typeof activeAccounts[0], isDestination: boolean) => {
                      const isSelected = isDestination ? editToAccountId === acc.id : editAccountId === acc.id;
                      const isUsedInOther = isDestination ? editAccountId === acc.id : editToAccountId === acc.id;
                      return (
                        <button
                          key={acc.id}
                          onClick={() => isDestination ? setEditToAccountId(acc.id) : setEditAccountId(acc.id)}
                          disabled={isUsedInOther}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all truncate",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                              : isUsedInOther
                                ? "border-border/50 bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                                : "border-border bg-card text-foreground hover:border-primary/50"
                          )}
                        >
                          {acc.name}
                        </button>
                      );
                    };

                    return (
                      <div className="space-y-3 w-full">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <span className="text-expense">↑</span> Cuenta origen:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeAccounts.map(a => chipBtn(a, false))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <span className="text-income">↓</span> Cuenta destino:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeAccounts.map(a => chipBtn(a, true))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Edit mode */}
              {!stt.isListening && parseResult && isEditing && (
                <div className="w-full space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Gasto</SelectItem>
                        <SelectItem value="income">Ingreso</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editType !== "transfer" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                      <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                        <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter(c => c.type === editType)
                            .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Monto</label>
                    <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="text-lg font-bold" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Moneda</label>
                    <Select value={editCurrency} onValueChange={setEditCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MXN">MXN — Peso Mexicano</SelectItem>
                        <SelectItem value="USD">USD — Dólar</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Same-currency non-MXN conversion preview in edit mode */}
                  {(() => {
                    const acc = editAccountId ? activeAccounts.find(a => a.id === editAccountId) : null;
                    if (!acc || !editAmount) return null;
                    const amount = parseFloat(editAmount);
                    if (isNaN(amount) || amount <= 0) return null;
                    if (editCurrency === acc.currency && acc.currency !== "MXN") {
                      const r = fxRates[acc.currency] || 0;
                      if (r <= 0) return null;
                      return (
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-[11px] text-center font-semibold text-foreground">
                          ${amount.toFixed(2)} {acc.currency} ≈ ${(amount * r).toFixed(2)} MXN · TC: ${r.toFixed(2)}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Transfer conversion in edit mode */}
                  {transferConversion && (
                    <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex justify-between">
                        <span>Sale de {transferConversion.fromName}</span>
                        <span className="font-medium">{formatCurrency(transferConversion.amountFrom, transferConversion.currencyFrom)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Llega a {transferConversion.toName}</span>
                        <span className="font-medium text-foreground">{formatCurrency(transferConversion.amountTo, transferConversion.currencyTo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tipo de cambio</span>
                        <span>TC: ${transferConversion.rate.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{editType === "transfer" ? "Cuenta origen" : "Cuenta"}</label>
                    <Select value={editAccountId} onValueChange={setEditAccountId}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {editType === "transfer" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Cuenta destino</label>
                      <Select value={editToAccountId} onValueChange={setEditToAccountId}>
                        <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                        <SelectContent>
                          {activeAccounts.filter(a => a.id !== editAccountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                    <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Concepto</label>
                    <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Concepto adicional" />
                  </div>
                </div>
              )}
            </div>

            {/* Sticky bottom buttons */}
            {!stt.isListening && parseResult && (
              <div className="px-4 py-3 border-t border-border shrink-0 bg-background space-y-2">
                {validationMsg && !isEditing && (
                  <p className="text-xs text-destructive text-center flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {validationMsg}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs px-1" onClick={handleCancel}>
                    <X className="h-3.5 w-3.5 mr-0.5 shrink-0" />Cancelar
                  </Button>
                  {isEditing ? (
                    <Button variant="secondary" size="sm" className="w-full text-xs px-1" onClick={() => setIsEditing(false)}>
                      <Check className="h-3.5 w-3.5 mr-0.5 shrink-0" />Listo
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full text-xs px-1" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-3.5 w-3.5 mr-0.5 shrink-0" />Editar
                    </Button>
                  )}
                  {!isEditing && (
                    <Button
                      size="sm"
                      className="w-full text-xs px-1"
                      onClick={handleConfirm}
                      disabled={!canConfirm() || isSaving}
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-0.5 shrink-0 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-0.5 shrink-0" />}
                      Confirmar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
