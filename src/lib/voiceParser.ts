import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────
export interface AccountItem {
  id: string;
  name: string;
  type: string;
  currency: string;
  is_active: boolean | null;
  current_balance: number | null;
}

export interface CategoryItem {
  id: string;
  name: string;
  type: string;
  keywords: string[] | null;
}

export interface AccountMatchResult {
  account: AccountItem | null;
  rest: string;
  score: number;
  status: "matched" | "uncertain" | "missing";
  topCandidates: AccountItem[];
}

export interface ParsedVoiceCommand {
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

// ─── Helpers ────────────────────────────────────────────────
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function sanitizeTranscript(raw: string): string {
  let clean = raw.replace(/\s+/g, " ").trim();
  clean = clean.replace(/\b(\w+)(?:\s+\1){2,}\b/gi, "$1");
  clean = clean.replace(/\b((\w+)\s+(\w+))(?:\s+\1){1,}\b/gi, "$1");
  clean = clean.replace(/\b((\w+)\s+(\w+)\s+(\w+))(?:\s+\1){1,}\b/gi, "$1");
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

function cleanSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripPhrase(text: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), " ").replace(/\s+/g, " ").trim();
}

function stripWord(text: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ").replace(/\s+/g, " ").trim();
}

function stripCurrencyWords(text: string): string {
  return text.replace(/\b(pesos?|mxn|dólares?|dolares?|usd|euros?|eur|mil)\b/gi, " ");
}

// ─── Spanish word-to-number ─────────────────────────────────
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
export function extractAmount(text: string): { amount: number | null; currency: string; rest: string; warning: string | null } {
  let rest = text;
  let currency = "MXN";
  let warning: string | null = null;
  const normText = normalize(rest);

  if (normText.includes("dolar") || normText.includes("usd") || normText.includes("dollar")) currency = "USD";
  else if (normText.includes("euro") || normText.includes("eur")) currency = "EUR";

  const milMatch = rest.match(/(\d+)\s*mil\s*(\d+)?/i);
  if (milMatch) {
    let amount = parseInt(milMatch[1], 10) * 1000;
    if (milMatch[2]) amount += parseInt(milMatch[2], 10);
    rest = rest.replace(milMatch[0], " ");
    rest = stripCurrencyWords(rest);
    return { amount, currency, rest: cleanSpaces(rest), warning };
  }

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

  const plainDigitMatch = rest.match(/\$?\s*(\d{2,})/);
  if (plainDigitMatch) {
    const amount = parseInt(plainDigitMatch[1], 10);
    if (amount > 0) {
      rest = rest.replace(plainDigitMatch[0], " ");
      rest = stripCurrencyWords(rest);
      return { amount, currency, rest: cleanSpaces(rest), warning };
    }
  }

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

// ─── Category matching ──────────────────────────────────────
export function matchCategory(text: string, cats: CategoryItem[], txType: "expense" | "income" | "transfer"): {
  category: CategoryItem | null;
  rest: string;
} {
  const typedCats = cats.filter(c => txType === "transfer" ? true : c.type === txType);
  const norm = normalize(text);
  const sorted = [...typedCats].sort((a, b) => b.name.length - a.name.length);

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

  for (const cat of sorted) {
    if (norm.includes(normalize(cat.name))) {
      return { category: cat, rest: stripPhrase(text, cat.name) };
    }
  }

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

// ─── Account matching (fuzzy) ───────────────────────────────
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

export function matchAccountInText(text: string, accs: AccountItem[], excludeId?: string): AccountMatchResult {
  const norm = normalize(text);
  const spokenTokens = norm.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS_ACCOUNT.has(w));
  const active = accs.filter(a => a.is_active && a.id !== excludeId);

  const scored: { acc: AccountItem; score: number; matchedTokens: string[] }[] = [];

  for (const acc of active) {
    const aliases = generateAliases(acc.name);
    const accTokens = normalize(acc.name).split(/\s+/).filter(w => w.length > 2 && !STOPWORDS_ACCOUNT.has(w));

    let bestScore = 0;
    const matchedSpoken: string[] = [];

    for (const alias of aliases) {
      if (norm.includes(alias)) {
        bestScore = Math.max(bestScore, 0.95);
      }
    }

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

// ─── Concept builder ────────────────────────────────────────
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
  desc = desc.replace(/\b(por|de|en|con|la|el|los|las|del|al|para|y|a|un|una|que|se|su|mi|tu|lo|te|pago|pagué|pague|pagado|tarjeta|credito|crédito|débito|debito|efectivo)\b/gi, " ");
  desc = desc.replace(/\b(gasto|gaste|gasté|gastó|pagué|pague|compré|compre|ingreso|recibí|recibi|transferencia|transfiere|transferí|transferi)\b/gi, " ");
  desc = desc.replace(/\b\d+\b/g, " ");
  desc = desc.replace(/[.,;:\-–—]+/g, " ").replace(/\s+/g, " ").trim();
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

// ─── Date detection ─────────────────────────────────────────
export function detectVoiceDate(text: string): { date: string; rest: string; label: string } {
  const today = new Date();
  const norm = normalize(text);

  if (/\bayer\b/.test(norm)) {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/\bayer\b/gi, " ").replace(/\s+/g, " ").trim(), label: "Ayer" };
  }
  if (/\b(antier|anteayer)\b/.test(norm)) {
    const d = new Date(today); d.setDate(d.getDate() - 2);
    return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/\b(antier|anteayer)\b/gi, " ").replace(/\s+/g, " ").trim(), label: "Antier" };
  }
  const haceDias = norm.match(/hace\s+(\d+)\s+dias?/);
  if (haceDias) {
    const d = new Date(today); d.setDate(d.getDate() - parseInt(haceDias[1]));
    return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/hace\s+\d+\s+días?/gi, " ").replace(/\s+/g, " ").trim(), label: `Hace ${haceDias[1]} días` };
  }
  const elDia = norm.match(/\b(?:el\s+(?:dia\s+)?|dia\s+)(\d{1,2})\b/);
  if (elDia) {
    const day = parseInt(elDia[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d > today) d.setMonth(d.getMonth() - 1);
      return { date: format(d, "yyyy-MM-dd"), rest: text.replace(/\b(?:el\s+(?:día\s+)?|día\s+)\d{1,2}\b/gi, " ").replace(/\s+/g, " ").trim(), label: `El ${day}` };
    }
  }
  if (/\bhoy\b/.test(norm)) {
    return { date: format(today, "yyyy-MM-dd"), rest: text.replace(/\bhoy\b/gi, " ").replace(/\s+/g, " ").trim(), label: "Hoy" };
  }

  return { date: format(today, "yyyy-MM-dd"), rest: text, label: "Hoy" };
}

// ─── Main parser ────────────────────────────────────────────
export function parseVoiceCommand(
  rawText: string,
  preSelectedType: "expense" | "income" | "transfer",
  accounts: AccountItem[],
  categories: CategoryItem[],
  preSelectedFromAccountId?: string,
  preSelectedToAccountId?: string,
): ParsedVoiceCommand {
  const type = preSelectedType;
  const cleanText = sanitizeTranscript(rawText);

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
