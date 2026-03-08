import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ExchangeRateData {
  rate: number;
  date: string;
  source: string;
  isManual: boolean;
}

const STORAGE_KEY = "lobobook-fx-rate";
const STORAGE_MANUAL_KEY = "lobobook-fx-manual";

export function useExchangeRate() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rateData, setRateData] = useState<ExchangeRateData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return { rate: 0, date: "", source: "", isManual: false };
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchRate = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-exchange-rate");

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Error al obtener tipo de cambio");

      const newData: ExchangeRateData = {
        rate: data.rate,
        date: data.date,
        source: data.source,
        isManual: false,
      };

      setRateData(newData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      localStorage.removeItem(STORAGE_MANUAL_KEY);

      // Also save to exchange_rates table
      if (user) {
        const today = new Date().toISOString().split("T")[0];
        await supabase.from("exchange_rates").upsert(
          {
            from_currency: "USD",
            to_currency: "MXN",
            rate: data.rate,
            date: today,
          },
          { onConflict: "from_currency,to_currency,date" }
        ).select();
      }

      return newData;
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      toast({
        title: "Error",
        description: "No se pudo obtener el tipo de cambio. Intenta más tarde.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const setManualRate = useCallback((rate: number) => {
    const newData: ExchangeRateData = {
      rate,
      date: new Date().toISOString(),
      source: "Manual",
      isManual: true,
    };
    setRateData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    localStorage.setItem(STORAGE_MANUAL_KEY, "true");

    toast({
      title: "Tipo de cambio actualizado",
      description: `USD/MXN: $${rate.toFixed(2)}`,
    });
  }, [toast]);

  // Convert amount from one currency to MXN using the current rate
  const convertToMXN = useCallback(
    (amount: number, fromCurrency: string) => {
      if (fromCurrency === "MXN" || rateData.rate === 0) return amount;
      if (fromCurrency === "USD") return amount * rateData.rate;
      return amount; // For other currencies, return as-is for now
    },
    [rateData.rate]
  );

  // Auto-fetch on mount if no rate or stale (>24h)
  useEffect(() => {
    if (rateData.rate === 0 || (!rateData.isManual && isStale(rateData.date))) {
      fetchRate();
    }
  }, []);

  return {
    rate: rateData.rate,
    date: rateData.date,
    source: rateData.source,
    isManual: rateData.isManual,
    isLoading,
    fetchRate,
    setManualRate,
    convertToMXN,
  };
}

function isStale(dateStr: string): boolean {
  if (!dateStr) return true;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return now - then > 12 * 60 * 60 * 1000; // 12 hours
}
