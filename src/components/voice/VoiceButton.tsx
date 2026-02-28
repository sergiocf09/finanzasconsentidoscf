import { useState, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X, AlertTriangle } from "lucide-react";
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
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { format } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type AccountItem = ReturnType<typeof useAccounts>["accounts"][number];
type CategoryItem = ReturnType<typeof useCategories>["categories"][number];

// ─── STEP 1: Detect type from first word ────────────────────
const TYPE_KEYWORDS: Record<string, "expense" | "income" | "transfer"> = {
  gasto: "expense", gaste: "expense", "gasté": "expense", "gastó": "expense",
  "pagué": "expense", pague: "expense", "compré": "expense", compre: "expense",
  ingreso: "income", "recibí": "income", recibi: "income",
  transferencia: "transfer", transfiere: "transfer", "transferí": "transfer", transferi: "transfer",
};

function detectTypeStrict(text: string): { type: "expense" | "income" | "transfer" | null; rest: string } {
  const trimmed = text.trim();
  const normFirst = normalize(trimmed).split(/\s+/)[0];
  const matched = TYPE_KEYWORDS[normFirst];
  if (matched) {
    // Remove only the first word
    const rest = trimmed.replace(/^\S+\s*/, "");
    return { type: matched, rest };
  }
  return { type: null, rest: trimmed };
}

// ─── STEP 2: Match category from remaining text ─────────────
function matchCategory(text: string, cats: CategoryItem[], txType: "expense" | "income" | "transfer"): {
  category: CategoryItem | null;
  rest: string;
} {
  const typedCats = cats.filter(c =>
    txType === "transfer" ? true : c.type === txType
  );
  const norm = normalize(text);

  // Sort longest name first for greedy matching
  const sorted = [...typedCats].sort((a, b) => b.name.length - a.name.length);

  // 1) Match by DB keywords
  for (const cat of sorted) {
    if (cat.keywords?.some(kw => kw && norm.includes(normalize(kw)))) {
      const rest = stripPhrase(text, cat.name);
      // Also strip any matching keyword that appears in text
      let cleaned = rest;
      for (const kw of cat.keywords ?? []) {
        if (kw && normalize(cleaned).includes(normalize(kw))) {
          cleaned = stripPhrase(cleaned, kw);
        }
      }
      return { category: cat, rest: cleaned };
    }
  }

  // 2) Match by category name in transcript
  for (const cat of sorted) {
    if (norm.includes(normalize(cat.name))) {
      return { category: cat, rest: stripPhrase(text, cat.name) };
    }
  }

  return { category: null, rest: text };
}

// ─── Spanish word-to-number map ─────────────────────────────
const SPANISH_NUMS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

function spanishWordsToNumber(text: string): { value: number | null; matched: string } {
  const norm = normalize(text);
  const words = norm.split(/\s+/);
  let total = 0;
  let current = 0;
  let found = false;
  const matchedWords: string[] = [];

  for (const w of words) {
    if (w === "y") { matchedWords.push(w); continue; }
    if (w === "mil") {
      if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
      found = true;
      matchedWords.push(w);
      continue;
    }
    if (w === "millon" || w === "millones") {
      if (current === 0) current = 1;
      total += current * 1000000;
      current = 0;
      found = true;
      matchedWords.push(w);
      continue;
    }
    if (SPANISH_NUMS[w] !== undefined) {
      current += SPANISH_NUMS[w];
      found = true;
      matchedWords.push(w);
    }
  }
  total += current;
  return { value: found ? total : null, matched: matchedWords.join(" ") };
}

// ─── STEP 3: Extract amount ─────────────────────────────────
function extractAmount(text: string): { amount: number | null; currency: string; rest: string } {
  let rest = text;
  let currency = "MXN";

  const normText = normalize(rest);

  // Detect currency
  if (normText.includes("dolar") || normText.includes("usd") || normText.includes("dollar")) currency = "USD";
  else if (normText.includes("euro") || normText.includes("eur")) currency = "EUR";

  // Pattern 1: digits + "mil" (e.g. "57 mil", "2 mil")
  const milMatch = rest.match(/(\d+(?:\.\d+)?)\s*mil/i);
  if (milMatch) {
    const amount = parseFloat(milMatch[1]) * 1000;
    rest = rest.replace(milMatch[0], " ");
    rest = stripCurrencyWords(rest);
    return { amount, currency, rest: cleanSpaces(rest) };
  }

  // Pattern 2: standard digits - handle Spanish thousands separator (dot) e.g. "20.000" = 20000
  // A dot followed by exactly 3 digits is a thousands separator, not decimal
  const digitMatch = rest.match(/\$?\s*(\d{1,3}(?:[.,\s]\d{3})*(?:\.\d{1,2}(?!\d))?)/);
  if (digitMatch) {
    let raw = digitMatch[1];
    // If pattern like "20.000" (dot + exactly 3 digits at end), treat dot as thousands sep
    raw = raw.replace(/\.(\d{3})(?!\d)/g, "$1");
    raw = raw.replace(/[,\s]/g, "");
    const amount = parseFloat(raw);
    if (amount > 0) {
      rest = rest.replace(digitMatch[0], " ");
      rest = stripCurrencyWords(rest);
      return { amount, currency, rest: cleanSpaces(rest) };
    }
  }

  // Pattern 3: Spanish word numbers ("veinte mil", "quinientos", "cincuenta y siete mil")
  const { value: wordAmount, matched } = spanishWordsToNumber(rest);
  if (wordAmount && wordAmount > 0) {
    // Remove matched words from text
    for (const w of matched.split(/\s+/)) {
      if (w) rest = rest.replace(new RegExp(`\\b${w}\\b`, "i"), " ");
    }
    rest = stripCurrencyWords(rest);
    return { amount: wordAmount, currency, rest: cleanSpaces(rest) };
  }

  return { amount: null, currency, rest };
}

function stripCurrencyWords(text: string): string {
  return text.replace(/\b(pesos?|mxn|dólares?|dolares?|usd|euros?|eur|mil)\b/gi, " ");
}

// ─── STEP 4: Match account(s) ───────────────────────────────
function matchAccountInText(text: string, accs: AccountItem[], excludeId?: string): {
  account: AccountItem | null;
  rest: string;
} {
  const norm = normalize(text);
  const active = accs.filter(a => a.is_active && a.id !== excludeId);
  // Sort longest name first
  const sorted = [...active].sort((a, b) => b.name.length - a.name.length);

  // 1) Full name match
  for (const acc of sorted) {
    if (norm.includes(normalize(acc.name))) {
      return { account: acc, rest: stripPhrase(text, acc.name) };
    }
  }

  // 2) Significant word match (all words > 2 chars must match)
  for (const acc of sorted) {
    const accWords = normalize(acc.name).split(/\s+/).filter(w => w.length > 2);
    if (accWords.length === 0) continue;
    const allMatch = accWords.every(w => norm.includes(w));
    if (allMatch) {
      let rest = text;
      for (const w of accWords) rest = stripWord(rest, w);
      return { account: acc, rest: cleanSpaces(rest) };
    }
  }

  // 3) Phonetic prefix match for single-word or two-word accounts
  for (const acc of sorted) {
    const accWords = normalize(acc.name).split(/\s+/).filter(w => w.length > 2);
    if (accWords.length === 0) continue;
    const spokenWords = norm.split(/\s+/);
    let matchCount = 0;
    const matchedSpoken: string[] = [];
    for (const aw of accWords) {
      for (const sw of spokenWords) {
        if (sw.length >= 3 && aw.length >= 3 &&
          (aw.startsWith(sw.substring(0, 3)) || sw.startsWith(aw.substring(0, 3)))) {
          matchCount++;
          matchedSpoken.push(sw);
          break;
        }
      }
    }
    if (matchCount >= Math.max(1, Math.ceil(accWords.length * 0.5))) {
      let rest = text;
      for (const sw of matchedSpoken) rest = stripWord(rest, sw);
      return { account: acc, rest: cleanSpaces(rest) };
    }
  }

  return { account: null, rest: text };
}

// ─── String cleanup helpers ─────────────────────────────────
function stripPhrase(text: string, phrase: string): string {
  // Case-insensitive phrase removal
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), " ").replace(/\s+/g, " ").trim();
}

function stripWord(text: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ").replace(/\s+/g, " ").trim();
}

function cleanSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ─── STEP 5: Build clean concept ────────────────────────────
function buildConcept(remaining: string): string {
  let desc = remaining;
  // Strip filler/preposition words
  desc = desc.replace(/\b(por|de|en|con|la|el|los|las|del|al|para|y|a|un|una|que|se|su|mi|tu|lo)\b/gi, " ");
  // Clean up
  desc = desc.replace(/[.,;:\-–—]+/g, " ").replace(/\s+/g, " ").trim();
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }
  return desc;
}

// ─── Full deterministic pipeline ────────────────────────────
interface ParsedVoiceCommand {
  type: "expense" | "income" | "transfer" | null;
  category: CategoryItem | null;
  amount: number | null;
  currency: string;
  fromAccount: AccountItem | null;
  toAccount: AccountItem | null;
  concept: string;
  error: string | null;
}

function parseVoiceCommand(
  rawText: string,
  accounts: AccountItem[],
  categories: CategoryItem[],
): ParsedVoiceCommand {
  // Step 1: Type
  const { type, rest: afterType } = detectTypeStrict(rawText);
  if (!type) {
    return {
      type: null, category: null, amount: null, currency: "MXN",
      fromAccount: null, toAccount: null, concept: rawText,
      error: "Inicia con: INGRESO, GASTO o TRANSFERENCIA.",
    };
  }

  // Step 2: Category
  const { category, rest: afterCat } = matchCategory(afterType, categories, type);

  // Step 3: Amount
  const { amount, currency, rest: afterAmount } = extractAmount(afterCat);

  // Step 4: Accounts
  let fromAccount: AccountItem | null = null;
  let toAccount: AccountItem | null = null;
  let afterAccounts = afterAmount;

  if (type === "transfer") {
    const { account: acc1, rest: r1 } = matchAccountInText(afterAmount, accounts);
    fromAccount = acc1;
    const { account: acc2, rest: r2 } = matchAccountInText(r1, accounts, acc1?.id);
    toAccount = acc2;
    afterAccounts = r2;
  } else {
    const { account, rest: r } = matchAccountInText(afterAmount, accounts);
    fromAccount = account;
    afterAccounts = r;
  }

  // Step 5: Concept
  const concept = buildConcept(afterAccounts);

  // Validation
  let error: string | null = null;
  if (!amount) {
    error = "No se detectó un monto. Intenta de nuevo.";
  } else if (type === "transfer") {
    if (!fromAccount || !toAccount) error = "Se necesitan dos cuentas distintas para transferencia.";
    else if (fromAccount.id === toAccount.id) error = "Las cuentas origen y destino no pueden ser iguales.";
  }

  return { type, category, amount, currency, fromAccount, toAccount, concept, error };
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export function VoiceButton() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [committedText, setCommittedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [parseResult, setParseResult] = useState<ParsedVoiceCommand | null>(null);
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
    languageCode: "es",
    onPartialTranscript: (data) => setPartialText(data.text),
    onCommittedTranscript: (data) => {
      setCommittedText((prev) => (prev ? `${prev} ${data.text}` : data.text).trim());
      setPartialText("");
    },
  });

  // Pre-fetch token when drawer opens
  const [prefetchedToken, setPrefetchedToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !parseResult) {
      supabase.functions.invoke("elevenlabs-scribe-token").then(({ data }) => {
        if (data?.token) setPrefetchedToken(data.token);
      });
    }
  }, [isOpen, parseResult]);

  const handleStartRecording = useCallback(async () => {
    setIsConnecting(true);
    setIsReady(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      let token = prefetchedToken;
      if (!token) {
        const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
        if (error || !data?.token) throw new Error("No token");
        token = data.token;
      }
      setPrefetchedToken(null);
      await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true } });
      setIsReady(true);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch {
      toast.error("No se pudo iniciar la grabación.");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, prefetchedToken]);

  const handleStopRecording = useCallback(async () => {
    await scribe.disconnect();
    const finalText = committedText || partialText;
    if (!finalText) return;

    if (!committedText && partialText) {
      setCommittedText(partialText);
      setPartialText("");
    }

    const result = parseVoiceCommand(finalText, accounts.filter(a => a.is_active), categories);
    setParseResult(result);

    // Pre-fill edit fields from deterministic parse
    setEditType(result.type || "expense");
    setEditAmount(result.amount ? String(result.amount) : "");
    setEditDate(format(new Date(), "yyyy-MM-dd"));
    setEditCategoryId(result.category?.id || "");
    setEditAccountId(result.fromAccount?.id || "");
    setEditToAccountId(result.toAccount?.id || "");
    setEditDescription(result.concept);

    // If no account found, try to default to cash
    if (!result.fromAccount && result.type !== "transfer") {
      const cashAcc = accounts.find(a => a.type === "cash" && a.is_active);
      if (cashAcc) setEditAccountId(cashAcc.id);
    }

    // Show error if any
    if (result.error) {
      toast.error(result.error);
    }
  }, [scribe, committedText, partialText, accounts, categories]);

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

      await supabase.from("voice_logs").insert([{
        user_id: user.id,
        transcript_raw: committedText,
        parsed_json: parseResult as any,
        confidence: parseResult?.amount ? 80 : 30,
      }]);

      if (editType === "transfer") {
        const from = accounts.find(a => a.id === editAccountId)!;
        const to = accounts.find(a => a.id === editToAccountId)!;
        await supabase.from("transfers").insert({
          user_id: user.id,
          from_account_id: editAccountId,
          to_account_id: editToAccountId,
          amount_from: amount,
          currency_from: from.currency,
          amount_to: amount,
          currency_to: to.currency,
          transfer_date: editDate,
          description: editDescription || committedText,
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
          description: editDescription || committedText,
          transaction_date: editDate,
          voice_transcript: committedText,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
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
    setParseResult(null);
    setIsEditing(false);
    setIsReady(false);
    setPrefetchedToken(null);
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

  const activeAccounts = accounts.filter(a => a.is_active);
  const typeLabels: Record<string, string> = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" };
  const typeColors: Record<string, string> = { expense: "text-expense", income: "text-income", transfer: "text-muted-foreground" };

  const fmt = (amount: number, currency: string = "MXN") =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name ?? "";

  const validationMsg = getValidationMessage();

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
                <span className="font-semibold">Tipo</span> → <span className="font-semibold">Categoría</span> → <span className="font-semibold">Importe</span> → <span className="font-semibold">Cuenta</span> → <span className="font-semibold">Concepto</span>
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex flex-col items-center px-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              {/* Mic button */}
              {!parseResult && (
                <>
                  <button
                    onClick={scribe.isConnected ? handleStopRecording : handleStartRecording}
                    disabled={isConnecting}
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full transition-all shrink-0",
                      scribe.isConnected
                        ? "bg-expense text-expense-foreground animate-pulse ring-4 ring-expense/30"
                        : "bg-primary text-primary-foreground hover:scale-105",
                      isConnecting && "opacity-50"
                    )}
                  >
                    {isConnecting ? <Loader2 className="h-7 w-7 animate-spin" /> : scribe.isConnected ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                  </button>

                  <p className="text-xs text-center px-2">
                    {isConnecting ? (
                      <span className="text-muted-foreground">Preparando micrófono...</span>
                    ) : scribe.isConnected ? (
                      <span className="text-expense font-semibold animate-pulse">🎙️ ¡Habla ahora! — Toca para detener</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Toca el micrófono para empezar.
                        <br />
                        <span className="italic">Ej: "Gasto restaurante 1500 pesos BBVA Sonora Grill"</span>
                      </span>
                    )}
                  </p>
                </>
              )}

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
              {!scribe.isConnected && parseResult && !isEditing && (
                <div className="w-full space-y-2">
                  <div className="rounded-lg bg-secondary p-2 text-center">
                    <p className="text-xs text-muted-foreground">Transcripción:</p>
                    <p className="text-sm font-medium text-foreground break-words">{committedText}</p>
                  </div>

                  {parseResult.error && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{parseResult.error}</span>
                    </div>
                  )}

                  <div className="text-sm space-y-1">
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className={cn("font-medium", typeColors[editType])}>{typeLabels[editType] ?? "—"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Categoría:</span>
                      <span className="font-medium text-primary">{editCategoryId ? getCategoryName(editCategoryId) : <span className="text-muted-foreground">Sin categoría</span>}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-medium">{editAmount ? fmt(parseFloat(editAmount)) : <span className="text-destructive">Sin monto</span>}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">{editType === "transfer" ? "Origen:" : "Cuenta:"}</span>
                      <span className="font-medium truncate ml-2 max-w-[180px]">
                        {editAccountId ? activeAccounts.find(a => a.id === editAccountId)?.name ?? "—" : <span className="text-destructive">Sin cuenta</span>}
                      </span>
                    </div>
                    {editType === "transfer" && (
                      <div className="flex justify-between py-1 border-b border-border">
                        <span className="text-muted-foreground">Destino:</span>
                        <span className="font-medium truncate ml-2 max-w-[180px]">
                          {editToAccountId ? activeAccounts.find(a => a.id === editToAccountId)?.name ?? "—" : <span className="text-destructive">Sin cuenta destino</span>}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Fecha:</span>
                      <span className="font-medium">{editDate}</span>
                    </div>
                    {editDescription && (
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Concepto:</span>
                        <span className="font-medium truncate ml-2 max-w-[180px]">{editDescription}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit mode */}
              {!scribe.isConnected && parseResult && isEditing && (
                <div className="w-full space-y-3">
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
                    <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
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
            {!scribe.isConnected && parseResult && (
              <div className="px-4 py-3 border-t border-border shrink-0 bg-background space-y-2">
                {validationMsg && !isEditing && (
                  <p className="text-xs text-destructive text-center flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {validationMsg}
                  </p>
                )}
                <div className="flex gap-2">
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
                  <Button
                    size="default"
                    className="flex-1"
                    onClick={handleConfirm}
                    disabled={isSaving || !canConfirm()}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                    {isSaving ? "..." : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
