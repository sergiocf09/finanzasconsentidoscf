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

function parseAmount(text: string): { amount: number | null; currency: "MXN" | "USD" | "EUR" | null } {
  const lower = text.toLowerCase();
  const currency = detectCurrency(text);
  
  // Check for "mil" pattern first (e.g., "54 mil pesos")
  const milMatch = lower.match(/(\d+(?:\.\d+)?)\s*mil/);
  if (milMatch) {
    return { amount: parseFloat(milMatch[1]) * 1000, currency };
  }
  
  // Standard amount patterns
  const amountMatch = lower.match(/(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?)/);
  if (amountMatch) {
    const cleanAmount = amountMatch[1].replace(/[,\s]/g, "");
    return { amount: parseFloat(cleanAmount), currency };
  }
  
  return { amount: null, currency };
}

function detectType(text: string): "expense" | "income" | "transfer" {
  const lower = text.toLowerCase();
  
  // Transfer indicators
  if (lower.includes("transferí") || lower.includes("transferencia") || 
      lower.includes("mandé") || lower.includes("envié") || 
      lower.includes("pasé") || lower.includes("moví")) {
    return "transfer";
  }
  
  // Income indicators
  if (lower.includes("ingreso") || lower.includes("recibí") || 
      lower.includes("cobré") || lower.includes("me pagaron") ||
      lower.includes("pensión") || lower.includes("nómina") ||
      lower.includes("salario") || lower.includes("sueldo")) {
    return "income";
  }
  
  // Default to expense
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
  // Remove amount, currency, date indicators for cleaner description
  let desc = text
    .replace(/\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?\s*(mil\s+)?(pesos?|mxn|dólares?|dolares?|usd|euros?|eur)?/gi, "")
    .replace(/\b(hoy|ayer|antier|anteayer)\b/gi, "")
    .replace(/\bhace \d+ días?\b/gi, "")
    .replace(/\b(el|día) \d{1,2}\b/gi, "")
    .replace(/\b(gasté|pagué|compré|ingreso|recibí|transferí)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Capitalize first letter
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
