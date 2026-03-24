import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Format a number as currency (es-MX locale).
 * Defaults: MXN, 0 decimals. Use `decimals` for precision control.
 */
export function formatCurrency(
  value: number,
  currency = "MXN",
  options?: { decimals?: number; abs?: boolean }
): string {
  const raw = typeof value === "number" && !isNaN(value) ? value : 0;
  const v = options?.abs ? Math.abs(raw) : raw;
  const minDec = options?.decimals ?? 0;
  const maxDec = options?.decimals ?? 0;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
    }).format(v);
  } catch {
    // Fallback for non-ISO currency codes (e.g. USDC, BTC)
    return `$${v.toLocaleString("es-MX", { minimumFractionDigits: minDec, maximumFractionDigits: maxDec })} ${currency}`;
  }
}

/**
 * Shorthand: format absolute value (useful for debts/liabilities).
 */
export function formatCurrencyAbs(value: number, currency = "MXN"): string {
  return formatCurrency(value, currency, { abs: true });
}

/**
 * Format a date string (yyyy-MM-dd) as a relative or short date.
 * Returns "Hoy", "Ayer", or "dd MMM" / "dd MMM yyyy".
 */
export function formatRelativeDate(dateStr: string, includeYear = false): string {
  const date = new Date(dateStr + "T12:00:00");
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, includeYear ? "dd MMM yyyy" : "dd MMM", { locale: es });
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
