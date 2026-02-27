import { useMemo } from "react";

export interface ParsedTransaction {
  type: "expense" | "income" | "transfer";
  amount: number | null;
  currency: "MXN" | "USD" | "EUR" | null;
  category: string | null;
  date: Date | null;
  dateLabel: string | null;
  description: string | null;
  paymentMethod: string | null;
  fromAccount: string | null;
  toAccount: string | null;
  confidence: number;
}

// Category keywords mapping
const categoryKeywords: Record<string, string[]> = {
  Transporte: ["uber", "didi", "cabify", "taxi", "metro", "camión", "gasolina", "gas", "estacionamiento", "peaje"],
  Alimentación: ["comida", "super", "supermercado", "walmart", "soriana", "chedraui", "oxxo", "mercado", "verduras", "frutas", "carne"],
  Restaurantes: ["restaurante", "starbucks", "café", "coffee", "tacos", "pizza", "sushi", "comida rápida", "mcdonald", "burger"],
  Entretenimiento: ["cine", "netflix", "spotify", "disney", "hbo", "concierto", "teatro", "museo"],
  Salud: ["doctor", "médico", "farmacia", "hospital", "medicina", "dentista", "consulta"],
  Vivienda: ["renta", "alquiler", "hipoteca", "luz", "agua", "gas natural", "internet", "teléfono"],
  Educación: ["escuela", "universidad", "curso", "libro", "colegiatura", "matrícula"],
  Ropa: ["ropa", "zapatos", "tienda", "zara", "h&m", "liverpool", "palacio"],
  Servicios: ["suscripción", "membresía", "gym", "gimnasio", "seguro"],
  Transferencia: ["transferí", "transferencia", "mandé", "envié", "abono", "depósito"],
};

// Payment method keywords
const paymentMethodKeywords: Record<string, string[]> = {
  "Tarjeta de crédito": ["tarjeta de crédito", "crédito", "tc"],
  "Tarjeta de débito": ["tarjeta de débito", "débito", "td"],
  Efectivo: ["efectivo", "cash", "billetes"],
  Transferencia: ["transferencia", "spei", "clabe"],
};

// Date patterns
const datePatterns = [
  { pattern: /\b(hoy)\b/i, getDate: () => new Date(), label: "Hoy" },
  { pattern: /\b(ayer)\b/i, getDate: () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; }, label: "Ayer" },
  { pattern: /\b(antier|anteayer)\b/i, getDate: () => { const d = new Date(); d.setDate(d.getDate() - 2); return d; }, label: "Antier" },
  { pattern: /\bhace (\d+) días?\b/i, getDate: (m: RegExpMatchArray) => { const d = new Date(); d.setDate(d.getDate() - parseInt(m[1])); return d; }, label: (m: RegExpMatchArray) => `Hace ${m[1]} días` },
  { pattern: /\b(el primero|el 1|día 1)\b/i, getDate: () => { const d = new Date(); d.setDate(1); return d; }, label: "El primero" },
  { pattern: /\b(el|día) (\d{1,2})\b/i, getDate: (m: RegExpMatchArray) => { const d = new Date(); d.setDate(parseInt(m[2])); return d; }, label: (m: RegExpMatchArray) => `El ${m[2]}` },
];

// Amount patterns (handles various formats)
const amountPatterns = [
  // "250 pesos", "1,500 dólares", "3.5 mil pesos"
  /(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?)\s*(?:mil\s+)?(pesos?|mxn|dólares?|dolares?|usd|euros?|eur)/gi,
  // "$250", "USD 1,500"
  /(?:\$|mxn|usd|eur)\s*(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?)/gi,
  // "54 mil pesos"
  /(\d+(?:\.\d+)?)\s*mil\s*(pesos?|mxn|dólares?|dolares?|usd|euros?|eur)?/gi,
  // Just numbers with context
  /(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?)/g,
];

function detectCurrency(text: string): "MXN" | "USD" | "EUR" | null {
  const lower = text.toLowerCase();
  if (lower.includes("dólar") || lower.includes("dolar") || lower.includes("usd") || lower.includes("dollar")) {
    return "USD";
  }
  if (lower.includes("euro") || lower.includes("eur")) {
    return "EUR";
  }
  if (lower.includes("peso") || lower.includes("mxn") || lower.includes("$")) {
    return "MXN";
  }
  return "MXN"; // Default to MXN
}

// Spanish word-to-number conversion
const spanishUnits: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciséis: 16, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiún: 21, veintiun: 21, veintiuno: 21, veintidós: 22, veintidos: 22,
  veintitrés: 23, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiséis: 26, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

function spanishWordsToNumber(text: string): number | null {
  const lower = text.toLowerCase()
    .replace(/[.,;:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Try to find a number phrase in the text
  const words = lower.split(" ");
  let total = 0;
  let current = 0;
  let foundNumber = false;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === "y") continue; // "cincuenta y siete"

    if (w === "mil") {
      if (current === 0 && foundNumber) current = 0;
      else if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
      foundNumber = true;
      continue;
    }
    if (w === "millón" || w === "millon" || w === "millones") {
      if (current === 0) current = 1;
      total += current * 1000000;
      current = 0;
      foundNumber = true;
      continue;
    }

    if (spanishUnits[w] !== undefined) {
      current += spanishUnits[w];
      foundNumber = true;
    }
  }

  total += current;
  return foundNumber ? total : null;
}

function parseAmount(text: string): { amount: number | null; currency: "MXN" | "USD" | "EUR" | null } {
  const lower = text.toLowerCase();
  const currency = detectCurrency(text);
  
  // 1) Check for digit + "mil" pattern first (e.g., "54 mil pesos", "2 mil")
  const milMatch = lower.match(/(\d+(?:\.\d+)?)\s*mil/);
  if (milMatch) {
    return { amount: parseFloat(milMatch[1]) * 1000, currency };
  }
  
  // 2) Standard digit patterns (e.g., "1,500", "250.00")
  const amountMatch = lower.match(/(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?)/);
  if (amountMatch) {
    const cleanAmount = amountMatch[1].replace(/[,\s]/g, "");
    const parsed = parseFloat(cleanAmount);
    if (parsed > 0) return { amount: parsed, currency };
  }
  
  // 3) Try Spanish word numbers ("cuatrocientos", "cincuenta y siete mil")
  const wordAmount = spanishWordsToNumber(text);
  if (wordAmount && wordAmount > 0) {
    return { amount: wordAmount, currency };
  }
  
  return { amount: null, currency };
}

function detectType(text: string): "expense" | "income" | "transfer" {
  const lower = text.toLowerCase().trim();
  
  // Strict: first word defines the action
  if (lower.startsWith("transferencia") || lower.startsWith("transfiere") || lower.startsWith("transferí")) {
    return "transfer";
  }
  if (lower.startsWith("ingreso") || lower.startsWith("recibí")) {
    return "income";
  }
  if (lower.startsWith("gasto") || lower.startsWith("gasté") || lower.startsWith("pagué") || lower.startsWith("compré") || lower.startsWith("gastó")) {
    return "expense";
  }
  
  // Fallback: search anywhere
  if (lower.includes("transferencia") || lower.includes("transferí")) return "transfer";
  if (lower.includes("ingreso") || lower.includes("me pagaron") || lower.includes("nómina") || lower.includes("pensión") || lower.includes("recibí") || lower.includes("cobré")) return "income";
  
  return "expense";
}

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}

function detectPaymentMethod(text: string): string | null {
  const lower = text.toLowerCase();
  
  for (const [method, keywords] of Object.entries(paymentMethodKeywords)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return method;
      }
    }
  }
  
  return null;
}

function detectDate(text: string): { date: Date | null; label: string | null } {
  const lower = text.toLowerCase();
  
  for (const { pattern, getDate, label } of datePatterns) {
    const match = lower.match(pattern);
    if (match) {
      return {
        date: getDate(match),
        label: typeof label === "function" ? label(match) : label,
      };
    }
  }
  
  return { date: new Date(), label: "Hoy" }; // Default to today
}

function extractDescription(text: string): string {
  // Structure: ACTION AMOUNT ACCOUNT(S) CONCEPT
  // Remove the action word, amount/currency words, and account patterns to isolate the concept
  let desc = text
    // Remove action keywords at start
    .replace(/^(gasto|gasté|gastó|pagué|compré|ingreso|recibí|transferencia|transfiere|transferí)\s*/i, "")
    // Remove digit amounts + currency
    .replace(/\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?\s*(mil\s+)?(pesos?|mxn|dólares?|dolares?|usd|euros?|eur)?/gi, "")
    // Remove Spanish word numbers + currency
    .replace(/\b(cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciséis|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiún|veintiun|veintiuno|veintidós|veintidos|veintitrés|veintitres|veinticuatro|veinticinco|veintiséis|veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|doscientas|trescientos|trescientas|cuatrocientos|cuatrocientas|quinientos|quinientas|seiscientos|seiscientas|setecientos|setecientas|ochocientos|ochocientas|novecientos|novecientas)\b/gi, "")
    .replace(/\b(mil|millón|millon|millones)\b/gi, "")
    .replace(/\b(pesos?|mxn|dólares?|dolares?|usd|euros?|eur)\b/gi, "")
    // Remove filler words
    .replace(/\b(por|de|en|con|la|el|los|las|del|al|para|y)\b/gi, " ")
    // Remove date references
    .replace(/\b(hoy|ayer|antier|anteayer)\b/gi, "")
    .replace(/\bhace \d+ días?\b/gi, "")
    // Clean up
    .replace(/\s+/g, " ")
    .trim();
  
  // Remove leading/trailing punctuation
  desc = desc.replace(/^[.,;:\-–—\s]+/, "").replace(/[.,;:\-–—\s]+$/, "");
  
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }
  
  return desc || text;
}

function detectAccounts(text: string): { fromAccount: string | null; toAccount: string | null } {
  const lower = text.toLowerCase();
  
  // Common bank patterns
  const banks = ["bbva", "banamex", "santander", "hsbc", "banorte", "scotiabank", "ahorro", "inversión"];
  let fromAccount: string | null = null;
  let toAccount: string | null = null;
  
  // Pattern: "de X a Y" or "desde X a Y"
  const transferPattern = /(?:de|desde)\s+(\w+)\s+(?:a|hacia)\s+(\w+)/i;
  const match = lower.match(transferPattern);
  
  if (match) {
    fromAccount = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    toAccount = match[2].charAt(0).toUpperCase() + match[2].slice(1);
  } else {
    // Check for single bank mention
    for (const bank of banks) {
      if (lower.includes(bank)) {
        const capitalizedBank = bank.charAt(0).toUpperCase() + bank.slice(1);
        if (lower.includes("a " + bank) || lower.includes("hacia " + bank)) {
          toAccount = capitalizedBank;
        } else if (lower.includes("de " + bank) || lower.includes("desde " + bank)) {
          fromAccount = capitalizedBank;
        }
      }
    }
  }
  
  return { fromAccount, toAccount };
}

export function parseTransaction(text: string): ParsedTransaction {
  const type = detectType(text);
  const { amount, currency } = parseAmount(text);
  const category = detectCategory(text);
  const { date, label: dateLabel } = detectDate(text);
  const paymentMethod = detectPaymentMethod(text);
  const description = extractDescription(text);
  const { fromAccount, toAccount } = detectAccounts(text);
  
  // Calculate confidence based on what we could extract
  let confidence = 0;
  if (amount) confidence += 30;
  if (currency) confidence += 10;
  if (category) confidence += 20;
  if (date) confidence += 15;
  if (paymentMethod) confidence += 15;
  if (description && description !== text) confidence += 10;
  
  return {
    type,
    amount,
    currency,
    category,
    date,
    dateLabel,
    description,
    paymentMethod,
    fromAccount,
    toAccount,
    confidence: Math.min(confidence, 100),
  };
}

export function useTransactionParser() {
  return useMemo(() => ({ parseTransaction }), []);
}
