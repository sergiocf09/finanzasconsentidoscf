import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { format } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type AccountItem = ReturnType<typeof useAccounts>["accounts"][number];
type CategoryItem = ReturnType<typeof useCategories>["categories"][number];

// ─── Transcript Sanitizer ───────────────────────────────────
function sanitizeTranscript(raw: string): string {
  let clean = raw.replace(/\s+/g, " ").trim();
  // Deduplicate consecutive repeated words (3+ → 1)
  clean = clean.replace(/\b(\w+)(?:\s+\1){2,}\b/gi, "$1");
  // Deduplicate consecutive repeated bigrams
  clean = clean.replace(/\b((\w+)\s+(\w+))(?:\s+\1){1,}\b/gi, "$1");
  // Deduplicate consecutive repeated trigrams
  clean = clean.replace(/\b((\w+)\s+(\w+)\s+(\w+))(?:\s+\1){1,}\b/gi, "$1");
  // Collapse spaces
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
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

function spanishWordsToNumber(text: string): { value: number | null; matchedTokens: string[] } {
  const norm = normalize(text);
  const words = norm.split(/\s+/);
  let total = 0;
  let current = 0;
  let found = false;
  const matchedTokens: string[] = [];

  for (const w of words) {
    if (w === "y") { matchedTokens.push(w); continue; }
    if (w === "mil") {
      if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
      found = true;
      matchedTokens.push(w);
      continue;
    }
    if (w === "millon" || w === "millones") {
      if (current === 0) current = 1;
      total += current * 1000000;
      current = 0;
      found = true;
      matchedTokens.push(w);
      continue;
    }
    if (SPANISH_NUMS[w] !== undefined) {
      current += SPANISH_NUMS[w];
      found = true;
      matchedTokens.push(w);
    }
  }
  total += current;
  return { value: found ? total : null, matchedTokens };
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

  // Pattern 1: digit(s) + "mil" (e.g. "35 mil", "2 mil 800")
  const milMatch = rest.match(/(\d+)\s*mil\s*(\d+)?/i);
  if (milMatch) {
    let amount = parseInt(milMatch[1], 10) * 1000;
    if (milMatch[2]) amount += parseInt(milMatch[2], 10);
    rest = rest.replace(milMatch[0], " ");
    rest = stripCurrencyWords(rest);
    return { amount, currency, rest: cleanSpaces(rest), warning };
  }

  // Pattern 2: digits with commas/dots as thousands separators (e.g. "35,100", "35.100")
  // Important: treat dots/commas followed by exactly 3 digits as thousands separators (no cents)
  const formattedMatch = rest.match(/(\d{1,3}(?:[.,]\d{3})+)/);
  if (formattedMatch) {
    const raw = formattedMatch[1].replace(/[.,]/g, "");
    const amount = parseInt(raw, 10);
    if (amount > 0) {
      rest = rest.replace(formattedMatch[0], " ");
      rest = stripCurrencyWords(rest);
      return { amount, currency, rest: cleanSpaces(rest), warning };
    }
  }

  // Pattern 3: plain digit sequences (e.g. "2800", "1500", "300")
  const plainDigitMatch = rest.match(/\$?\s*(\d{2,})/);
  if (plainDigitMatch) {
    const amount = parseInt(plainDigitMatch[1], 10);
    if (amount > 0) {
      rest = rest.replace(plainDigitMatch[0], " ");
      rest = stripCurrencyWords(rest);
      return { amount, currency, rest: cleanSpaces(rest), warning };
    }
  }

  // Pattern 4: Spanish word numbers ("treinta y cinco mil cien")
  const { value: wordAmount, matchedTokens } = spanishWordsToNumber(rest);
  if (wordAmount && wordAmount > 0) {
    if (normalize(rest).includes("mil") && wordAmount < 500) {
      warning = "El monto detectado parece incorrecto. Edita el monto.";
    }
    for (const w of matchedTokens) {
      if (w && w !== "y") rest = rest.replace(new RegExp(`\\b${w}\\b`, "i"), " ");
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
      let rest = text;
      for (const kw of cat.keywords ?? []) {
        if (kw && normalize(rest).includes(normalize(kw))) {
          rest = stripPhrase(rest, kw);
        }
      }
      return { category: cat, rest };
    }
  }

  // 2) Match by category name
  for (const cat of sorted) {
    if (norm.includes(normalize(cat.name))) {
      return { category: cat, rest: stripPhrase(text, cat.name) };
    }
  }

  // 3) Fallback: keyword dictionary
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (norm.includes(kw)) {
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

// ─── Fuzzy Account matching (token-based + Levenshtein) ─────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function tokenSimilarity(token: string, target: string): number {
  if (target.includes(token) || token.includes(target)) return 1;
  const dist = levenshtein(token, target);
  const maxLen = Math.max(token.length, target.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

function generateAliases(name: string): string[] {
  const norm = normalize(name);
  const words = norm.split(/\s+/).filter(w => w.length > 1);
  const aliases: string[] = [norm];
  for (const w of words) {
    if (w.length > 2) aliases.push(w);
  }
  if (words.length >= 2) {
    aliases.push(words[0] + " " + words[words.length - 1]);
  }
  return aliases;
}

const STOPWORDS_ACCOUNT = new Set(["de", "del", "la", "el", "los", "las", "con", "por", "en", "a", "tarjeta", "credito", "crédito", "debito", "débito", "cuenta"]);

interface AccountMatchResult {
  account: AccountItem | null;
  rest: string;
  score: number;
  status: "matched" | "uncertain" | "missing";
  topCandidates: AccountItem[];
}

function matchAccountInText(text: string, accs: AccountItem[], excludeId?: string): AccountMatchResult {
  const norm = normalize(text);
  const spokenTokens = norm.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS_ACCOUNT.has(w));
  const active = accs.filter(a => a.is_active && a.id !== excludeId);

  const scored: { acc: AccountItem; score: number; matchedTokens: string[] }[] = [];

  for (const acc of active) {
    const aliases = generateAliases(acc.name);
    const accTokens = normalize(acc.name).split(/\s+/).filter(w => w.length > 2 && !STOPWORDS_ACCOUNT.has(w));
    
    let bestScore = 0;
    const matchedSpoken: string[] = [];

    // Full alias match
    for (const alias of aliases) {
      if (norm.includes(alias)) {
        bestScore = Math.max(bestScore, 0.95);
      }
    }

    // Token-by-token matching
    if (accTokens.length > 0) {
      let tokenMatches = 0;
      for (const at of accTokens) {
        let bestTokenScore = 0;
        let bestSpoken = "";
        for (const st of spokenTokens) {
          const sim = tokenSimilarity(st, at);
          if (sim > bestTokenScore) {
            bestTokenScore = sim;
            bestSpoken = st;
          }
        }
        if (bestTokenScore >= 0.7) {
          tokenMatches++;
          if (bestSpoken && !matchedSpoken.includes(bestSpoken)) matchedSpoken.push(bestSpoken);
        }
      }
      const ratio = tokenMatches / accTokens.length;
      bestScore = Math.max(bestScore, ratio * 0.9);
    }

    if (bestScore >= 0.3) {
      scored.push({ acc, score: bestScore, matchedTokens: matchedSpoken });
    }
  }

  // Check for explicit "efectivo" keyword → cash account (ONLY if word is present)
  if (norm.includes("efectivo")) {
    const cashAcc = active.find(a => a.type === "cash");
    if (cashAcc) {
      scored.push({ acc: cashAcc, score: 0.95, matchedTokens: ["efectivo"] });
    }
  }

  if (scored.length === 0) {
    return { account: null, rest: text, score: 0, status: "missing", topCandidates: active.slice(0, 8) };
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const topCandidates = scored.slice(0, 5).map(s => s.acc);

  // Thresholds: >= 0.80 auto-select, 0.50-0.79 uncertain, < 0.50 missing
  if (best.score >= 0.80) {
    let rest = text;
    for (const t of best.matchedTokens) rest = stripWord(rest, t);
    return { account: best.acc, rest: cleanSpaces(rest), score: best.score, status: "matched", topCandidates };
  } else if (best.score >= 0.50) {
    let rest = text;
    for (const t of best.matchedTokens) rest = stripWord(rest, t);
    return { account: best.acc, rest: cleanSpaces(rest), score: best.score, status: "uncertain", topCandidates };
  } else {
    return { account: null, rest: text, score: best.score, status: "missing", topCandidates };
  }
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

function buildConcept(remaining: string, accountName?: string, categoryName?: string): string {
  let desc = remaining;
  if (accountName) {
    for (const token of accountName.split(/\s+/)) {
      if (token.length > 2) desc = desc.replace(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    }
  }
  if (categoryName) {
    for (const token of categoryName.split(/\s+/)) {
      if (token.length > 2) desc = desc.replace(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    }
  }
  // Strip stopwords, action verbs, leftover digits
  desc = desc.replace(/\b(por|de|en|con|la|el|los|las|del|al|para|y|a|un|una|que|se|su|mi|tu|lo|te|pago|pagué|pague|pagado|tarjeta|credito|crédito|débito|debito|efectivo)\b/gi, " ");
  desc = desc.replace(/\b(gasto|gaste|gasté|gastó|pagué|pague|compré|compre|ingreso|recibí|recibi|transferencia|transfiere|transferí|transferi)\b/gi, " ");
  desc = desc.replace(/\b\d+\b/g, " ");
  desc = desc.replace(/[.,;:\-–—]+/g, " ").replace(/\s+/g, " ").trim();
  // Deduplicate words
  const words = desc.split(" ");
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (lw.length < 2) continue;
    if (!seen.has(lw)) { seen.add(lw); deduped.push(w); }
  }
  desc = deduped.join(" ");
  if (desc.length > 0) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  return desc;
}

// ─── Date detection from voice ───────────────────────────────
function detectVoiceDate(text: string): { date: string; rest: string; label: string } {
  const today = new Date();
  const norm = normalize(text);
  
  // "ayer"
  if (/\bayer\b/.test(norm)) {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/\bayer\b/gi, " ").replace(/\s+/g, " ").trim(), label: "Ayer" };
  }
  // "antier" / "anteayer"
  if (/\b(antier|anteayer)\b/.test(norm)) {
    const d = new Date(today); d.setDate(d.getDate() - 2);
    return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/\b(antier|anteayer)\b/gi, " ").replace(/\s+/g, " ").trim(), label: "Antier" };
  }
  // "hace X días"
  const haceDias = norm.match(/hace\s+(\d+)\s+dias?/);
  if (haceDias) {
    const d = new Date(today); d.setDate(d.getDate() - parseInt(haceDias[1]));
    return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/hace\s+\d+\s+días?/gi, " ").replace(/\s+/g, " ").trim(), label: `Hace ${haceDias[1]} días` };
  }
  // "el día X" or "el X" (day of current month)
  const elDia = norm.match(/\b(?:el\s+(?:dia\s+)?|dia\s+)(\d{1,2})\b/);
  if (elDia) {
    const day = parseInt(elDia[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d > today) d.setMonth(d.getMonth() - 1); // if future, assume last month
      return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/\b(?:el\s+(?:día\s+)?|día\s+)\d{1,2}\b/gi, " ").replace(/\s+/g, " ").trim(), label: `El ${day}` };
    }
  }
  // "hoy" or default
  if (/\bhoy\b/.test(norm)) {
    return { date: format(today, "yyyy-MM-dd"), rest: text.replace(/\bhoy\b/gi, " ").replace(/\s+/g, " ").trim(), label: "Hoy" };
  }
  
  // Default: today
  return { date: format(today, "yyyy-MM-dd"), rest: text, label: "Hoy" };
}

// ─── Parse voice command ─────────────────────────────────────
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
  accountScore: number;
  accountStatus: "matched" | "uncertain" | "missing";
  topCandidates: AccountItem[];
  date: string;
  dateLabel: string;
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
  const cleanText = sanitizeTranscript(rawText);

  // Detect date first and strip from text
  const { date, rest: afterDate, label: dateLabel } = detectVoiceDate(cleanText);

  const { category, rest: afterCat } = matchCategory(afterDate, categories, type);
  const { amount, currency, rest: afterAmount, warning } = extractAmount(afterCat);

  let fromAccount: AccountItem | null = null;
  let toAccount: AccountItem | null = null;
  let afterAccounts = afterAmount;
  let accountScore = 0;
  let accountStatus: "matched" | "uncertain" | "missing" = "missing";
  let topCandidates: AccountItem[] = [];

  if (type === "transfer" && preSelectedFromAccountId && preSelectedToAccountId) {
    fromAccount = accounts.find(a => a.id === preSelectedFromAccountId) || null;
    toAccount = accounts.find(a => a.id === preSelectedToAccountId) || null;
    afterAccounts = afterAmount;
    accountScore = 1;
    accountStatus = "matched";
    topCandidates = [];
  } else if (type === "transfer") {
    const r1 = matchAccountInText(afterAmount, accounts);
    fromAccount = r1.account;
    const r2 = matchAccountInText(r1.rest, accounts, r1.account?.id);
    toAccount = r2.account;
    afterAccounts = r2.rest;
    accountScore = Math.min(r1.score, r2.score);
    accountStatus = r1.status === "missing" || r2.status === "missing" ? "missing" : r1.status === "uncertain" || r2.status === "uncertain" ? "uncertain" : "matched";
    topCandidates = r1.topCandidates;
  } else {
    const r = matchAccountInText(afterAmount, accounts);
    fromAccount = r.account;
    afterAccounts = r.rest;
    accountScore = r.score;
    accountStatus = r.status;
    topCandidates = r.topCandidates;
  }

  const concept = buildConcept(afterAccounts, fromAccount?.name || toAccount?.name, category?.name);

  let error: string | null = null;
  if (!amount) {
    error = "No se detectó un monto. Edita o reintenta.";
  } else if (type === "transfer" && (!fromAccount || !toAccount)) {
    error = "Selecciona las cuentas origen y destino.";
  }

  return { type, category, amount, currency, fromAccount, toAccount, concept, error, warning, accountScore, accountStatus, topCandidates, date, dateLabel };
}

// ─── Web Speech API hook (FIXED: no continuous, proper final handling) ────
function useWebSpeechSTT() {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const finalSegmentsRef = useRef<string[]>([]);

  const isSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!isSupported) {
      toast.error("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // CRITICAL SETTINGS:
    // continuous=false → single utterance, avoids re-emission of previous segments
    // interimResults=true → show live text while speaking
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let currentInterim = "";
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Pick best alternative (first one is usually best)
          const transcript = result[0].transcript.trim();
          if (transcript) {
            // Only add if not already in our segments (prevents duplication)
            const existing = finalSegmentsRef.current.join(" ").toLowerCase();
            if (!existing.includes(transcript.toLowerCase())) {
              finalSegmentsRef.current.push(transcript);
              const joined = finalSegmentsRef.current.join(" ");
              setFinalText(sanitizeTranscript(joined));
            }
          }
          currentInterim = ""; // Clear interim once final arrives
        } else {
          currentInterim = result[0].transcript;
        }
      }
      setInterimText(currentInterim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Permite el acceso al micrófono para usar voz.");
      } else if (event.error === "no-speech") {
        // Silent - user didn't speak
      } else if (event.error !== "aborted") {
        toast.error("Error de reconocimiento. Intenta de nuevo.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // With continuous=false, recognition ends after one utterance.
      // We DON'T restart - this is intentional to prevent repetition.
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    finalSegmentsRef.current = [];
    setFinalText("");
    setInterimText("");
    
    try {
      recognition.start();
      setIsListening(true);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {
      console.error("Failed to start recognition:", e);
      toast.error("No se pudo iniciar el micrófono.");
    }
  }, [isSupported]);

  const stop = useCallback((): string => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    
    // Build final result from segments + any remaining interim
    const segments = finalSegmentsRef.current.join(" ");
    const result = sanitizeTranscript((segments + " " + interimText).trim());
    setInterimText("");
    return result;
  }, [interimText]);

  const reset = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    setFinalText("");
    finalSegmentsRef.current = [];
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
    // For non-transfer, start recording immediately
    if (type !== "transfer") {
      // Small delay to let state update
      setTimeout(() => {
        stt.start();
      }, 150);
    }
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

      // NO default to Efectivo - leave blank if not detected
      // User must select from chips

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
    // Processing will happen in the useEffect above
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
        // For cross-currency via voice, use same amount (user can edit in transfers later)
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

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); else setIsOpen(true); }}>
        <DialogContent className="sm:max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden w-[calc(100vw-2rem)]">
          <div className="mx-auto w-full flex flex-col overflow-hidden">
            <DialogHeader className="text-center pb-1 shrink-0">
              <DialogTitle className="font-heading text-base">Registrar por voz</DialogTitle>
              <DialogDescription className="text-xs leading-tight">
                Toca el tipo para empezar a grabar
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
                      {preFromAccountId && preToAccountId && preFromAccountId !== preToAccountId && (
                        <Button
                          className="w-full mt-2"
                          onClick={handleStartRecording}
                          disabled={stt.isListening}
                        >
                          <Mic className="h-4 w-4 mr-2" /> Grabar monto
                        </Button>
                      )}
                    </div>
                  )}
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
              {!parseResult && !stt.isListening && selectedType && selectedType !== "transfer" && (
                <p className="text-xs text-muted-foreground text-center italic">
                  {selectedType === "expense" && 'Ej: "Gasolina mil pesos Scotiabank"'}
                  {selectedType === "income" && 'Ej: "Renta 35 mil pesos BBVA"'}
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
                    <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-2 text-sm text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{parseResult.warning}</span>
                    </div>
                  )}

                  <div className="text-xs space-y-0">
                    <div className="flex justify-between py-0.5 border-b border-border">
                      <span className="text-muted-foreground shrink-0">Tipo:</span>
                      <span className={cn("font-medium", typeColors[editType])}>{typeLabels[editType] ?? "—"}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border">
                      <span className="text-muted-foreground shrink-0">Categoría:</span>
                      <span className="font-medium text-primary truncate ml-2">{editCategoryId ? getCategoryName(editCategoryId) : <span className="text-muted-foreground">Sin categoría</span>}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border">
                      <span className="text-muted-foreground shrink-0">Monto:</span>
                      <span className="font-medium">{editAmount ? fmt(parseFloat(editAmount)) : <span className="text-destructive">Sin monto</span>}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-border">
                      <span className="text-muted-foreground shrink-0">{editType === "transfer" ? "Origen:" : "Cuenta:"}</span>
                      <span className="font-medium truncate ml-2">
                        {editAccountId ? activeAccounts.find(a => a.id === editAccountId)?.name ?? "—" : <span className="text-destructive">Sin cuenta</span>}
                      </span>
                    </div>
                    {editType === "transfer" && (
                      <div className="flex justify-between py-0.5 border-b border-border">
                        <span className="text-muted-foreground shrink-0">Destino:</span>
                        <span className="font-medium truncate ml-2">
                          {editToAccountId ? activeAccounts.find(a => a.id === editToAccountId)?.name ?? "—" : <span className="text-destructive">Sin cuenta destino</span>}
                        </span>
                      </div>
                    )}
                    {editDescription && (
                      <div className="flex justify-between py-0.5 border-b border-border">
                        <span className="text-muted-foreground shrink-0">Concepto:</span>
                        <span className="font-medium truncate ml-2">{editDescription}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground shrink-0">Fecha:</span>
                      <span className="font-medium">{editDate === format(new Date(), "yyyy-MM-dd") ? "Hoy" : editDate}</span>
                    </div>
                  </div>

                  {/* ─── 3-COLUMN ACCOUNT SELECTOR (Tarjetas | Bancos | Efectivo) ──── */}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
