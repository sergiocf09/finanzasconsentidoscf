import { useState, useCallback, useRef } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
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
import { format } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type AccountItem = ReturnType<typeof useAccounts>["accounts"][number];
type CategoryItem = ReturnType<typeof useCategories>["categories"][number];

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

// ─── Keyword-based category fallback dictionary ─────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Transporte": ["gasolina", "gasolinera", "uber", "taxi", "didi", "cabify", "estacionamiento", "peaje", "caseta"],
  "Restaurantes": ["restaurante", "comida", "cena", "desayuno", "almuerzo", "cafe", "cafeteria"],
  "Supermercado": ["supermercado", "super", "walmart", "costco", "soriana", "chedraui", "heb", "oxxo"],
  "Salud": ["farmacia", "medicinas", "doctor", "hospital", "dentista", "consultorio", "medicina"],
  "Servicios": ["cfe", "luz", "agua", "internet", "telefono", "celular", "gas", "telmex"],
  "Entretenimiento": ["cine", "netflix", "spotify", "golf", "gimnasio", "gym"],
  "Educación": ["colegiatura", "escuela", "universidad", "curso", "libro", "libros"],
  "Hogar": ["renta", "alquiler", "mantenimiento", "limpieza", "mueble", "muebles"],
  "Ropa": ["ropa", "zapatos", "tienda", "zara", "liverpool"],
};

// ─── Amount extraction ──────────────────────────────────────
function extractAmount(text: string): { amount: number | null; currency: string; rest: string; warning: string | null } {
  let rest = text;
  let currency = "MXN";
  let warning: string | null = null;

  const normText = normalize(rest);

  if (normText.includes("dolar") || normText.includes("usd") || normText.includes("dollar")) currency = "USD";
  else if (normText.includes("euro") || normText.includes("eur")) currency = "EUR";

  // Pattern 1: digits + "mil"
  const milMatch = rest.match(/(\d+(?:\.\d+)?)\s*mil/i);
  if (milMatch) {
    const amount = parseFloat(milMatch[1]) * 1000;
    rest = rest.replace(milMatch[0], " ");
    rest = stripCurrencyWords(rest);
    return { amount, currency, rest: cleanSpaces(rest), warning };
  }

  // Pattern 2: standard digits (but NOT if followed by "mil" — handled above)
  const digitMatch = rest.match(/\$?\s*(\d{1,3}(?:[.,\s]\d{3})*(?:\.\d{1,2}(?!\d))?)/);
  if (digitMatch) {
    let raw = digitMatch[1];
    // Treat dots as thousands separators if followed by exactly 3 digits
    raw = raw.replace(/\.(\d{3})(?!\d)/g, "$1");
    raw = raw.replace(/[,\s]/g, "");
    const amount = parseFloat(raw);
    if (amount > 0) {
      rest = rest.replace(digitMatch[0], " ");
      rest = stripCurrencyWords(rest);
      return { amount, currency, rest: cleanSpaces(rest), warning };
    }
  }

  // Pattern 3: Spanish word numbers
  const { value: wordAmount, matched } = spanishWordsToNumber(rest);
  if (wordAmount && wordAmount > 0) {
    // Validation: if text contains "mil" but amount < 500, flag as suspect
    if (normalize(rest).includes("mil") && wordAmount < 500) {
      warning = "El monto detectado parece incorrecto. Edita el monto o vuelve a dictarlo.";
    }
    for (const w of matched.split(/\s+/)) {
      if (w) rest = rest.replace(new RegExp(`\\b${w}\\b`, "i"), " ");
    }
    rest = stripCurrencyWords(rest);
    return { amount: wordAmount, currency, rest: cleanSpaces(rest), warning };
  }

  return { amount: null, currency, rest, warning: null };
}

function stripCurrencyWords(text: string): string {
  return text.replace(/\b(pesos?|mxn|dólares?|dolares?|usd|euros?|eur|mil)\b/gi, " ");
}

// ─── Category matching ──────────────────────────────────────
function matchCategory(text: string, cats: CategoryItem[], txType: "expense" | "income" | "transfer"): {
  category: CategoryItem | null;
  rest: string;
} {
  const typedCats = cats.filter(c => txType === "transfer" ? true : c.type === txType);
  const norm = normalize(text);
  const sorted = [...typedCats].sort((a, b) => b.name.length - a.name.length);

  // 1) Match by category keywords field
  for (const cat of sorted) {
    if (cat.keywords?.some(kw => kw && norm.includes(normalize(kw)))) {
      const rest = stripPhrase(text, cat.name);
      let cleaned = rest;
      for (const kw of cat.keywords ?? []) {
        if (kw && normalize(cleaned).includes(normalize(kw))) {
          cleaned = stripPhrase(cleaned, kw);
        }
      }
      return { category: cat, rest: cleaned };
    }
  }

  // 2) Match by category name
  for (const cat of sorted) {
    if (norm.includes(normalize(cat.name))) {
      return { category: cat, rest: stripPhrase(text, cat.name) };
    }
  }

  // 3) Fallback: keyword dictionary → try to find matching category by name
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (norm.includes(kw)) {
        // Find a user category whose name matches
        const match = sorted.find(c => normalize(c.name).includes(normalize(catName)));
        if (match) {
          const rest = text.replace(new RegExp(`\\b${kw}\\b`, "gi"), " ");
          return { category: match, rest: cleanSpaces(rest) };
        }
      }
    }
  }

  return { category: null, rest: text };
}

// ─── Account matching ───────────────────────────────────────
function matchAccountInText(text: string, accs: AccountItem[], excludeId?: string): {
  account: AccountItem | null;
  rest: string;
} {
  const norm = normalize(text);
  const active = accs.filter(a => a.is_active && a.id !== excludeId);
  const sorted = [...active].sort((a, b) => b.name.length - a.name.length);

  // Full name match
  for (const acc of sorted) {
    if (norm.includes(normalize(acc.name))) {
      return { account: acc, rest: stripPhrase(text, acc.name) };
    }
  }

  // Partial word match (all significant words)
  for (const acc of sorted) {
    const accWords = normalize(acc.name).split(/\s+/).filter(w => w.length > 2);
    if (accWords.length === 0) continue;
    if (accWords.every(w => norm.includes(w))) {
      let rest = text;
      for (const w of accWords) rest = stripWord(rest, w);
      return { account: acc, rest: cleanSpaces(rest) };
    }
  }

  // Fuzzy partial match (50%+ words)
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

  // Check for "efectivo" → cash account
  if (norm.includes("efectivo")) {
    const cashAcc = active.find(a => a.type === "cash");
    if (cashAcc) {
      return { account: cashAcc, rest: stripWord(text, "efectivo") };
    }
  }

  return { account: null, rest: text };
}

// ─── String cleanup helpers ─────────────────────────────────
function stripPhrase(text: string, phrase: string): string {
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

function buildConcept(remaining: string): string {
  let desc = remaining;
  // Remove functional words
  desc = desc.replace(/\b(por|de|en|con|la|el|los|las|del|al|para|y|a|un|una|que|se|su|mi|tu|lo|te|pago|pagué|pague|pagado|tarjeta|credito|crédito|débito|debito)\b/gi, " ");
  // Remove type words
  desc = desc.replace(/\b(gasto|gaste|gasté|gastó|pagué|pague|compré|compre|ingreso|recibí|recibi|transferencia|transfiere|transferí|transferi)\b/gi, " ");
  desc = desc.replace(/[.,;:\-–—]+/g, " ").replace(/\s+/g, " ").trim();
  if (desc.length > 0) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  return desc;
}

// ─── Parse voice command (type comes from UI, not from text) ─
interface ParsedVoiceCommand {
  type: "expense" | "income" | "transfer";
  category: CategoryItem | null;
  amount: number | null;
  currency: string;
  fromAccount: AccountItem | null;
  toAccount: AccountItem | null;
  concept: string;
  error: string | null;
  warning: string | null;
}

function parseVoiceCommand(
  rawText: string,
  preSelectedType: "expense" | "income" | "transfer",
  accounts: AccountItem[],
  categories: CategoryItem[],
  preSelectedFromAccountId?: string,
  preSelectedToAccountId?: string,
): ParsedVoiceCommand {
  const type = preSelectedType;

  const { category, rest: afterCat } = matchCategory(rawText, categories, type);
  const { amount, currency, rest: afterAmount, warning } = extractAmount(afterCat);

  let fromAccount: AccountItem | null = null;
  let toAccount: AccountItem | null = null;
  let afterAccounts = afterAmount;

  if (type === "transfer" && preSelectedFromAccountId && preSelectedToAccountId) {
    fromAccount = accounts.find(a => a.id === preSelectedFromAccountId) || null;
    toAccount = accounts.find(a => a.id === preSelectedToAccountId) || null;
    afterAccounts = afterAmount;
  } else if (type === "transfer") {
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

  const concept = buildConcept(afterAccounts);

  let error: string | null = null;
  if (!amount) {
    error = "No se detectó un monto. Edita o reintenta.";
  } else if (type === "transfer" && (!fromAccount || !toAccount)) {
    error = "Selecciona las cuentas origen y destino.";
  }

  return { type, category, amount, currency, fromAccount, toAccount, concept, error, warning };
}

// ─── Web Speech API hook ────────────────────────────────────
function useWebSpeechSTT() {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const isListeningRef = useRef(false);

  const isSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!isSupported) {
      toast.error("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    let accumulated = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      
      if (final.trim()) {
        accumulated = (accumulated + " " + final).trim();
        setFinalText(accumulated);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Permite el acceso al micrófono para usar voz.");
      } else if (event.error === "no-speech") {
        // Silent — just restart if still listening
      } else if (event.error !== "aborted") {
        toast.error("Error de reconocimiento. Intenta de nuevo.");
      }
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (isListeningRef.current) {
        try { recognition.start(); } catch (e) { /* ignore */ }
        return;
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    accumulated = "";
    setFinalText("");
    setInterimText("");
    
    try {
      recognition.start();
      setIsListening(true);
      isListeningRef.current = true;
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {
      console.error("Failed to start recognition:", e);
      toast.error("No se pudo iniciar el micrófono.");
    }
  }, [isSupported]);

  const stop = useCallback((): string => {
    isListeningRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    
    const result = (finalText + " " + interimText).trim();
    setInterimText("");
    return result;
  }, [finalText, interimText]);

  const reset = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    setFinalText("");
  }, []);

  return { isListening, interimText, finalText, isSupported, start, stop, reset };
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
  const [isSaving, setIsSaving] = useState(false);
  const [committedText, setCommittedText] = useState("");
  const [parseResult, setParseResult] = useState<ParsedVoiceCommand | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const stt = useWebSpeechSTT();

  // ─── Pre-selection state ───────────────
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

  const canStartRecording = selectedType !== null && (selectedType !== "transfer" || (preFromAccountId && preToAccountId && preFromAccountId !== preToAccountId));

  const handleStartRecording = useCallback(async () => {
    if (!canStartRecording) return;
    stt.start();
  }, [canStartRecording, stt]);

  const handleStopRecording = useCallback(async () => {
    const rawText = stt.stop();
    const finalText = rawText || (stt.finalText + " " + stt.interimText).trim();
    
    if (!finalText) {
      toast.error("No se detectó audio. Intenta de nuevo.");
      return;
    }

    setCommittedText(finalText);

    const activeAccs = accounts.filter(a => a.is_active);
    const result = parseVoiceCommand(
      finalText,
      selectedType!,
      activeAccs,
      categories,
      selectedType === "transfer" ? preFromAccountId : undefined,
      selectedType === "transfer" ? preToAccountId : undefined,
    );
    setParseResult(result);

    setEditType(result.type);
    setEditAmount(result.amount ? String(Math.round(result.amount)) : "");
    setEditDate(format(new Date(), "yyyy-MM-dd"));
    setEditCategoryId(result.category?.id || "");
    setEditAccountId(result.fromAccount?.id || "");
    setEditToAccountId(result.toAccount?.id || "");
    setEditDescription(result.concept);

    // Default to cash if no account detected (non-transfer)
    if (!result.fromAccount && result.type !== "transfer") {
      const cashAcc = accounts.find(a => a.type === "cash" && a.is_active);
      if (cashAcc) setEditAccountId(cashAcc.id);
    }

    // Log
    if (user) {
      supabase.from("voice_logs").insert([{
        user_id: user.id,
        transcript_raw: finalText,
        parsed_json: result as any,
        confidence: result.amount ? 80 : 30,
      }]).then(() => {});
    }

    if (result.warning) toast.warning(result.warning);
    if (result.error) toast.error(result.error);
  }, [stt, accounts, categories, selectedType, preFromAccountId, preToAccountId, user]);

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
    stt.reset();
    setCommittedText("");
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

  const fmt = (amount: number, currency: string = "MXN") =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

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

      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); else setIsOpen(true); }}>
        <DrawerContent className="max-h-[95vh]">
          <div className="mx-auto w-full max-w-md flex flex-col" style={{ maxHeight: "calc(95vh - 1rem)" }}>
            <DrawerHeader className="text-center pb-1 shrink-0">
              <DrawerTitle className="font-heading text-base">Registrar por voz</DrawerTitle>
              <DrawerDescription className="text-xs leading-tight">
                Selecciona el tipo, luego dicta el movimiento
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex flex-col items-center px-4 space-y-2 overflow-y-auto flex-1 min-h-0 pb-2">

              {/* ─── STEP 1: Type pre-selection ──── */}
              {!parseResult && (
                <div className="w-full space-y-2">
                  <div className="flex gap-2 w-full">
                    {typePills.map(({ value, label, icon }) => (
                      <button
                        key={value}
                        onClick={() => setSelectedType(value)}
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

                  {selectedType === "transfer" && (
                    <div className="w-full space-y-2 rounded-lg bg-secondary p-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cuenta origen</label>
                        <Select value={preFromAccountId} onValueChange={setPreFromAccountId}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
                          <SelectContent>
                            {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cuenta destino</label>
                        <Select value={preToAccountId} onValueChange={setPreToAccountId}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona destino" /></SelectTrigger>
                          <SelectContent>
                            {activeAccounts.filter(a => a.id !== preFromAccountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── STEP 2: Mic button ──── */}
              {!parseResult && (
                <>
                  {!stt.isSupported && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.</span>
                    </div>
                  )}
                  <button
                    onClick={stt.isListening ? handleStopRecording : handleStartRecording}
                    disabled={!canStartRecording || !stt.isSupported}
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full transition-all shrink-0",
                      stt.isListening
                        ? "bg-expense text-expense-foreground animate-pulse ring-4 ring-expense/30"
                        : canStartRecording && stt.isSupported
                          ? "bg-primary text-primary-foreground hover:scale-105"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {stt.isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </button>

                  <p className="text-xs text-center px-2">
                    {!selectedType ? (
                      <span className="text-muted-foreground font-medium">
                        👆 Selecciona tipo: Gasto, Ingreso o Transferencia
                      </span>
                    ) : selectedType === "transfer" && (!preFromAccountId || !preToAccountId) ? (
                      <span className="text-muted-foreground">
                        Selecciona cuentas origen y destino
                      </span>
                    ) : stt.isListening ? (
                      <span className="text-expense font-semibold animate-pulse">🎙️ ¡Habla ahora! — Toca para detener</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Toca el micrófono y dicta.
                        <br />
                        <span className="italic">
                          {selectedType === "expense" && 'Ej: "Gasolina mil pesos Scotiabank"'}
                          {selectedType === "income" && 'Ej: "Pensión 57 mil pesos BBVA"'}
                          {selectedType === "transfer" && 'Ej: "Mil pesos pago tarjeta"'}
                        </span>
                      </span>
                    )}
                  </p>
                </>
              )}

              {/* Live transcript */}
              {stt.isListening && liveText && (
                <div className="w-full rounded-lg bg-secondary p-2">
                  <p className="text-center text-sm text-foreground break-words">
                    {stt.finalText && <span className="font-medium">{stt.finalText} </span>}
                    {stt.interimText && <span className="text-muted-foreground italic">{stt.interimText}</span>}
                  </p>
                </div>
              )}

              {/* Parsed result - view mode */}
              {!stt.isListening && parseResult && !isEditing && (
                <div className="w-full space-y-2">
                  <div className="rounded-lg bg-secondary p-2 text-center">
                    <p className="text-xs text-muted-foreground">Transcripción:</p>
                    <p className="text-sm font-medium text-foreground break-words line-clamp-2">{committedText}</p>
                  </div>

                  {parseResult.error && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{parseResult.error}</span>
                    </div>
                  )}

                  {parseResult.warning && !parseResult.error && (
                    <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-2 text-sm text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{parseResult.warning}</span>
                    </div>
                  )}

                  <div className="text-sm space-y-0.5">
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

            {/* Sticky bottom buttons — ALWAYS visible */}
            {!stt.isListening && parseResult && (
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
                    <Button variant="secondary" size="default" className="flex-1" onClick={() => setIsEditing(false)}>
                      <Check className="h-4 w-4 mr-1" />Listo
                    </Button>
                  ) : (
                    <Button variant="outline" size="default" className="flex-1" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-1" />Editar
                    </Button>
                  )}
                  {!isEditing && (
                    <Button
                      size="default"
                      className="flex-1"
                      onClick={handleConfirm}
                      disabled={!canConfirm() || isSaving}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Confirmar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
