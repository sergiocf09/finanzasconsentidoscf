import { useState, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { parseTransaction, type ParsedTransaction } from "@/hooks/useTransactionParser";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { format } from "date-fns";

export function VoiceButton() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { accounts } = useAccounts();
  const { categories, findCategoryByKeyword } = useCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [committedText, setCommittedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<string>("expense");
  const [editAccountId, setEditAccountId] = useState("");
  const [editToAccountId, setEditToAccountId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => setPartialText(data.text),
    onCommittedTranscript: (data) => {
      setCommittedText((prev) => (prev ? `${prev} ${data.text}` : data.text).trim());
      setPartialText("");
    },
  });

  useEffect(() => {
    if (isOpen && !scribe.isConnected && !isConnecting && !parsedData) {
      handleStartRecording();
    }
  }, [isOpen]);

  const handleStartRecording = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error("No token");
      await scribe.connect({ token: data.token, microphone: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      toast.error("No se pudo iniciar la grabación.");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const handleStopRecording = useCallback(async () => {
    await scribe.disconnect();
    const finalText = committedText || partialText;
    if (finalText) {
      if (!committedText && partialText) {
        setCommittedText(partialText);
        setPartialText("");
      }
      const parsed = parseTransactionEnhanced(finalText);
      setParsedData(parsed);
      // Pre-fill edit fields
      setEditAmount(String(parsed.amount || ""));
      setEditType(parsed.type);
      setEditDate(parsed.date ? format(parsed.date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));

      // Auto-categorize using DB keywords
      const matchedCategory = findCategoryByKeyword(finalText);
      if (matchedCategory) {
        setEditCategoryId(matchedCategory.id);
      } else if (parsed.category) {
        const cat = categories.find((c) => c.name.toLowerCase().includes(parsed.category!.toLowerCase()));
        if (cat) setEditCategoryId(cat.id);
      }

      // Fuzzy match accounts and strip account name from description
      const matchedFrom = fuzzyMatchAccount(finalText, accounts);
      if (matchedFrom) {
        setEditAccountId(matchedFrom.id);
        // Strip account name words from the description
        const descCleaned = stripAccountNameFromText(parsed.description || finalText, matchedFrom.name);
        setEditDescription(descCleaned);
      } else {
        // Default to cash account if exists, otherwise first account
        const cashAccount = accounts.find(a => a.type === 'cash' && a.is_active);
        setEditAccountId(cashAccount?.id || (accounts.length > 0 ? accounts[0].id : ""));
        setEditDescription(parsed.description || "");
      }

      if (parsed.type === "transfer") {
        const matchedTo = fuzzyMatchToAccount(finalText, accounts, matchedFrom?.id);
        if (matchedTo) {
          setEditToAccountId(matchedTo.id);
          // Also strip to-account name from description
          setEditDescription(prev => stripAccountNameFromText(prev, matchedTo.name));
        }
      }
    }
  }, [scribe, committedText, partialText, accounts, categories, findCategoryByKeyword]);

  const parseTransactionEnhanced = (text: string): ParsedTransaction => {
    const lower = text.toLowerCase().trim();

    let type: "expense" | "income" | "transfer" = "expense";
    if (lower.startsWith("transferencia") || lower.startsWith("transfiere") || lower.startsWith("transferí") || lower.includes("transferencia")) {
      type = "transfer";
    } else if (lower.startsWith("ingreso") || lower.startsWith("recibí") || lower.includes("ingreso") || lower.includes("me pagaron") || lower.includes("nómina") || lower.includes("pensión")) {
      type = "income";
    } else if (lower.startsWith("gasto") || lower.startsWith("gasté") || lower.startsWith("pagué") || lower.startsWith("compré")) {
      type = "expense";
    }

    const base = parseTransaction(text);
    return { ...base, type };
  };

  const stripAccountNameFromText = (text: string, accountName: string): string => {
    const words = accountName.toLowerCase().split(/\s+/);
    let result = text;
    // Strip each word of the account name from the text
    for (const w of words) {
      if (w.length > 2) {
        result = result.replace(new RegExp(`\\b${w}\\b`, 'gi'), '');
      }
    }
    // Also strip full account name
    result = result.replace(new RegExp(accountName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    return result.replace(/\s+/g, ' ').trim();
  };

  const fuzzyMatchAccount = (text: string, accs: typeof accounts) => {
    const lower = text.toLowerCase();
    // Try matching by multi-word account name first (longer names first for specificity)
    const sorted = [...accs].sort((a, b) => b.name.length - a.name.length);
    for (const acc of sorted) {
      if (lower.includes(acc.name.toLowerCase())) return acc;
    }
    // Fallback: match individual words (>2 chars)
    for (const acc of sorted) {
      const words = acc.name.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (w.length > 2 && lower.includes(w)) return acc;
      }
    }
    return null;
  };

  const fuzzyMatchToAccount = (text: string, accs: typeof accounts, excludeId?: string) => {
    const lower = text.toLowerCase();
    const match = lower.match(/(?:a|hacia)\s+(\w+)/);
    if (match) {
      const target = match[1];
      for (const acc of accs) {
        if (acc.id === excludeId) continue;
        if (acc.name.toLowerCase().includes(target)) return acc;
      }
    }
    return null;
  };

  const handleConfirm = async () => {
    if (!user || !editAmount) return;
    setIsSaving(true);
    try {
      const amount = parseFloat(editAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Monto inválido");

      await supabase.from('voice_logs').insert([{
        user_id: user.id,
        transcript_raw: committedText,
        parsed_json: parsedData as any,
        confidence: parsedData?.confidence ?? 0,
      }]);

      if (editType === "transfer") {
        if (!editAccountId || !editToAccountId) throw new Error("Selecciona cuentas origen y destino");
        const from = accounts.find((a) => a.id === editAccountId)!;
        const to = accounts.find((a) => a.id === editToAccountId)!;
        await supabase.from('transfers').insert({
          user_id: user.id,
          from_account_id: editAccountId,
          to_account_id: editToAccountId,
          amount_from: amount,
          currency_from: from.currency,
          amount_to: amount,
          currency_to: to.currency,
          transfer_date: editDate,
          description: editDescription || committedText,
          created_from: 'voice',
        });
        queryClient.invalidateQueries({ queryKey: ['transfers'] });
      } else {
        if (!editAccountId) throw new Error("Selecciona una cuenta");
        const acc = accounts.find((a) => a.id === editAccountId)!;
        await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: editAccountId,
          category_id: editCategoryId || null,
          type: editType,
          amount,
          currency: acc.currency,
          description: editDescription || committedText,
          transaction_date: editDate,
          voice_transcript: committedText,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
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
    setCommittedText("");
    setPartialText("");
    setParsedData(null);
    setIsEditing(false);
    setEditAmount("");
    setEditType("expense");
    setEditAccountId("");
    setEditToAccountId("");
    setEditCategoryId("");
    setEditDescription("");
    setEditDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleCancel = async () => {
    if (scribe.isConnected) await scribe.disconnect();
    handleReset();
    setIsOpen(false);
  };

  const activeAccounts = accounts.filter((a) => a.is_active);
  const typeLabels: Record<string, string> = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" };
  const typeColors: Record<string, string> = { expense: "text-expense", income: "text-income", transfer: "text-muted-foreground" };

  const fmt = (amount: number, currency: string = "MXN") =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

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

      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); else setIsOpen(true); }}>
        <DrawerContent className="max-h-[95vh] min-h-[60vh]">
          <div className="mx-auto w-full max-w-md flex flex-col h-full overflow-hidden">
            <DrawerHeader className="text-center pb-1 shrink-0">
              <DrawerTitle className="font-heading text-base">Registrar por voz</DrawerTitle>
              <DrawerDescription className="text-xs leading-tight">
                <span className="font-semibold">Acción</span> → <span className="font-semibold">Monto</span> → <span className="font-semibold">Cuenta</span> → <span className="font-semibold">Concepto</span>
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex flex-col items-center px-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              {/* Mic button */}
              <button
                onClick={scribe.isConnected ? handleStopRecording : handleStartRecording}
                disabled={isConnecting}
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full transition-all shrink-0",
                  scribe.isConnected ? "bg-expense text-expense-foreground animate-pulse" : "bg-primary text-primary-foreground hover:scale-105",
                  isConnecting && "opacity-50"
                )}
              >
                {isConnecting ? <Loader2 className="h-7 w-7 animate-spin" /> : scribe.isConnected ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </button>

              <p className="text-xs text-muted-foreground text-center px-2">
                {isConnecting ? "Conectando..." : scribe.isConnected ? "Escuchando... Toca para detener" : parsedData ? "Revisa tu movimiento" : (
                  <>
                    Ejemplo: <span className="italic">"Gasto 500 pesos tarjeta gasolina"</span>
                  </>
                )}
              </p>

              {/* Live transcript */}
              {scribe.isConnected && (committedText || partialText) && (
                <div className="w-full rounded-lg bg-secondary p-2">
                  <p className="text-center text-sm text-foreground break-words">
                    {committedText && <span className="font-medium">{committedText} </span>}
                    {partialText && <span className="text-muted-foreground italic">{partialText}</span>}
                  </p>
                </div>
              )}

              {/* Parsed result - view mode */}
              {!scribe.isConnected && parsedData && !isEditing && (
                <div className="w-full space-y-2">
                  <div className="rounded-lg bg-secondary p-2 text-center">
                    <p className="text-xs text-muted-foreground">Detecté:</p>
                    <p className="text-sm font-medium text-foreground break-words">{committedText}</p>
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Acción:</span>
                      <span className={cn("font-medium", typeColors[editType])}>{typeLabels[editType]}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-medium">{editAmount ? fmt(parseFloat(editAmount)) : "—"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Fecha:</span>
                      <span className="font-medium">{editDate}</span>
                    </div>
                    {editAccountId && (
                      <div className="flex justify-between py-1 border-b border-border">
                        <span className="text-muted-foreground">{editType === "transfer" ? "Origen:" : "Cuenta:"}</span>
                        <span className="font-medium truncate ml-2 max-w-[180px]">{activeAccounts.find((a) => a.id === editAccountId)?.name ?? "—"}</span>
                      </div>
                    )}
                    {editType === "transfer" && editToAccountId && (
                      <div className="flex justify-between py-1 border-b border-border">
                        <span className="text-muted-foreground">Destino:</span>
                        <span className="font-medium truncate ml-2 max-w-[180px]">{activeAccounts.find((a) => a.id === editToAccountId)?.name ?? "—"}</span>
                      </div>
                    )}
                    {editCategoryId && (
                      <div className="flex justify-between py-1 border-b border-border">
                        <span className="text-muted-foreground">Categoría:</span>
                        <span className="font-medium text-primary">{getCategoryName(editCategoryId)}</span>
                      </div>
                    )}
                    {editDescription && (
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Descripción:</span>
                        <span className="font-medium truncate ml-2 max-w-[180px]">{editDescription}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit mode */}
              {!scribe.isConnected && parsedData && isEditing && (
                <div className="w-full space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Acción</label>
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Gasto</SelectItem>
                        <SelectItem value="income">Ingreso</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Monto</label>
                    <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{editType === "transfer" ? "Cuenta origen" : "Cuenta"}</label>
                    <Select value={editAccountId} onValueChange={setEditAccountId}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {editType === "transfer" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Cuenta destino</label>
                      <Select value={editToAccountId} onValueChange={setEditToAccountId}>
                        <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                        <SelectContent>
                          {activeAccounts.filter((a) => a.id !== editAccountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {editType !== "transfer" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                      <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                        <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                        <SelectContent>
                          {categories.filter((c) => editType === "expense" ? c.type === "expense" : c.type === "income").map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                    <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Ej: Gasolina Pemex Constitución" />
                  </div>
                </div>
              )}
            </div>

            {/* Sticky bottom buttons */}
            {!scribe.isConnected && parsedData && (
              <div className="flex gap-2 px-4 py-3 border-t border-border shrink-0 bg-background">
                <Button variant="outline" size="default" className="flex-1" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-1" />Cancelar
                </Button>
                {isEditing ? (
                  <Button variant="outline" size="default" className="flex-1" onClick={() => setIsEditing(false)}>
                    Listo
                  </Button>
                ) : (
                  <Button variant="outline" size="default" className="flex-1" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-1" />Editar
                  </Button>
                )}
                <Button size="default" className="flex-1" onClick={handleConfirm} disabled={isSaving || !editAmount}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  {isSaving ? "..." : "Confirmar"}
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
