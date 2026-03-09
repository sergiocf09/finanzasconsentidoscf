import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X, AlertTriangle, ArrowRight } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { format } from "date-fns";

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export function VoiceButton() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { checkAlerts } = useBudgetAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const handleConfirm = async () => {
    if (!user || !canConfirm()) return;
    setIsSaving(true);
    try {
      const amount = parseFloat(editAmount);

      if (editType === "transfer") {
        const from = accounts.find(a => a.id === editAccountId)!;
        const to = accounts.find(a => a.id === editToAccountId)!;
        const fromCurrency = from.currency;
        const toCurrency = to.currency;
        const isCrossCurrency = fromCurrency !== toCurrency;
        await supabase.from("transfers").insert({
          user_id: user.id,
          from_account_id: editAccountId,
          to_account_id: editToAccountId,
          amount_from: amount,
          currency_from: fromCurrency,
          amount_to: amount,
          currency_to: toCurrency,
          fx_rate: isCrossCurrency ? 1 : null,
          transfer_date: editDate,
          description: editDescription || cleanTranscript || committedText,
          created_from: "voice",
        });
        queryClient.invalidateQueries({ queryKey: ["transfers"] });
      } else {
        const acc = accounts.find(a => a.id === editAccountId)!;
        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: editAccountId,
          category_id: editCategoryId || null,
          type: editType,
          amount,
          currency: acc.currency,
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
  };

  const handleCancel = async () => {
    stt.reset();
    handleReset();
    setIsOpen(false);
  };

  const activeAccounts = accounts.filter(a => a.is_active);
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
                      <span className="font-medium text-right">{editAmount ? fmt(parseFloat(editAmount)) : <span className="text-destructive">Sin monto</span>}</span>
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

                  {/* ─── 3-COLUMN ACCOUNT SELECTOR ──── */}
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
