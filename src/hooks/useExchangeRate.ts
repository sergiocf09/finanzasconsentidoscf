import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface CurrencyRate {
  rate: number;
  label: string;
}

interface ExchangeRateData {
  rates: Record<string, number>; // currency → MXN rate
  date: string;
  source: string;
  isManual: Record<string, boolean>;
}

export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "Dólar estadounidense", flag: "🇺🇸", symbol: "$" },
  { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€" },
  { code: "GBP", name: "Libra esterlina", flag: "🇬🇧", symbol: "£" },
] as const;

const STORAGE_KEY = "lobobook-fx-rates";
const STORAGE_ENABLED_KEY = "lobobook-fx-enabled";
const STORAGE_MANUAL_KEY = "lobobook-fx-manual";

function loadStoredRates(): ExchangeRateData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { rates: {}, date: "", source: "", isManual: {} };
}

function loadEnabledCurrencies(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_ENABLED_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return ["USD"]; // Default: only USD
}

export function useExchangeRate() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rateData, setRateData] = useState<ExchangeRateData>(loadStoredRates);
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(loadEnabledCurrencies);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRate = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-exchange-rate");

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Error al obtener tipo de cambio");

      const newData: ExchangeRateData = {
        rates: data.rates || { USD: data.rate },
        date: data.date,
        source: data.source,
        isManual: {},
      };

      setRateData(newData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      localStorage.removeItem(STORAGE_MANUAL_KEY);

      // Save to exchange_rates table
      if (user) {
        const today = new Date().toISOString().split("T")[0];
        const upserts = Object.entries(newData.rates).map(([currency, rate]) => ({
          from_currency: currency,
          to_currency: "MXN",
          rate,
          date: today,
        }));

        for (const upsert of upserts) {
          await supabase.from("exchange_rates").upsert(upsert, {
            onConflict: "from_currency,to_currency,date",
          }).select();
        }
      }

      return newData;
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      toast({
        title: "Error",
        description: "No se pudo obtener el tipo de cambio.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const setManualRate = useCallback((currency: string, rate: number) => {
    setRateData((prev) => {
      const updated: ExchangeRateData = {
        ...prev,
        rates: { ...prev.rates, [currency]: rate },
        date: new Date().toISOString(),
        isManual: { ...prev.isManual, [currency]: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    toast({
      title: "Tipo de cambio actualizado",
      description: `${currency}/MXN: $${rate.toFixed(2)}`,
    });
  }, [toast]);

  const toggleCurrency = useCallback((currency: string) => {
    setEnabledCurrencies((prev) => {
      const next = prev.includes(currency)
        ? prev.filter((c) => c !== currency)
        : [...prev, currency];
      // Ensure at least USD is always enabled
      const final = next.length === 0 ? ["USD"] : next;
      localStorage.setItem(STORAGE_ENABLED_KEY, JSON.stringify(final));
      return final;
    });
  }, []);

  const convertToMXN = useCallback(
    (amount: number, fromCurrency: string) => {
      if (fromCurrency === "MXN") return amount;
      const rate = rateData.rates[fromCurrency];
      if (rate && rate > 0) return amount * rate;
      return amount; // Fallback: return as-is
    },
    [rateData.rates]
  );

  // Auto-fetch on mount if no rate or stale
  useEffect(() => {
    const usdRate = rateData.rates["USD"] || 0;
    if (usdRate === 0 || (!rateData.isManual["USD"] && isStale(rateData.date))) {
      fetchRate();
    }
  }, []);

  // Backward compat: single USD rate
  const rate = rateData.rates["USD"] || 0;
  const isManual = rateData.isManual["USD"] || false;

  return {
    // Single rate (backward compat)
    rate,
    date: rateData.date,
    source: rateData.source,
    isManual,
    isLoading,
    fetchRate,
    setManualRate: (rate: number) => setManualRate("USD", rate),

    // Multi-currency
    rates: rateData.rates,
    allIsManual: rateData.isManual,
    enabledCurrencies,
    toggleCurrency,
    setManualRateForCurrency: setManualRate,
    convertToMXN,
  };
}

function isStale(dateStr: string): boolean {
  if (!dateStr) return true;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return now - then > 12 * 60 * 60 * 1000;
}
