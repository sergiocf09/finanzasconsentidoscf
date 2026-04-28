import { useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useExchangeRate } from "@/hooks/useExchangeRate";

export const CATEGORY_HINT_MAP: Record<string, string[]> = {
  restaurante: ["restaurante", "café", "comida"],
  supermercado: ["alimentación", "super", "mercado"],
  gasolina: ["transporte", "gasolina"],
  farmacia: ["salud", "farmacia"],
  transporte: ["transporte"],
  entretenimiento: ["entretenimiento"],
  ropa: ["ropa"],
  servicios: ["servicios del hogar", "servicios"],
  salud: ["salud"],
  educacion: ["educación"],
  transferencia: ["transferencia"],
  seguro: ["seguro", "seguros", "insurance"],
};

export interface ScannedTransaction {
  id: string;
  amount: number;
  currency: string;
  date: string;
  merchant: string;
  type: "expense" | "income";
  category_hint: string;
  description: string;
  selected: boolean;
  resolvedCategoryId: string;
  resolvedAccountId: string;
}

export interface SingleScanData {
  amount: string;
  currency: string;
  date: string;
  merchant: string;
  description: string;
  categoryId: string;
  accountId: string;
  type: "expense" | "income";
}

export type ScanResultMode = "scanning" | "single" | "statement" | "error";

const emptySingleData = (): SingleScanData => ({
  amount: "",
  currency: "MXN",
  date: format(new Date(), "yyyy-MM-dd"),
  merchant: "",
  description: "",
  categoryId: "",
  accountId: "",
  type: "expense",
});

export function useReceiptScanner() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { rates: fxRates } = useExchangeRate();
  const queryClient = useQueryClient();

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  const [scanMode, setScanMode] = useState<"single" | "statement">("single");
  const [scannedTransactions, setScannedTransactions] = useState<ScannedTransaction[]>([]);
  const [singleData, setSingleData] = useState<SingleScanData>(emptySingleData());
  const [mode, setMode] = useState<ScanResultMode>("scanning");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  // ── PURE HELPERS ────────────────────────────────────────────────

  const resolveCategoryId = useCallback(
    (hint: string, type: "expense" | "income"): string => {
      const pool = type === "expense" ? expenseCategories : incomeCategories;
      const keywords = CATEGORY_HINT_MAP[hint] || [hint];
      for (const kw of keywords) {
        const match = pool.find((c) =>
          c.name.toLowerCase().includes(kw.toLowerCase())
        );
        if (match) return match.id;
      }
      return pool[0]?.id || "";
    },
    [expenseCategories, incomeCategories]
  );

  const normalizeAmount = (raw: number | string | null | undefined): number => {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === "number") return Math.round(raw);
    const str = String(raw).trim();
    const lastDotIdx = str.lastIndexOf(".");
    const lastCommaIdx = str.lastIndexOf(",");
    const lastSepIdx = Math.max(lastDotIdx, lastCommaIdx);
    let normalized = str;
    if (lastSepIdx > 0 && lastSepIdx === str.length - 3) {
      const decimalSep = str[lastSepIdx];
      const thousandSep = decimalSep === "." ? "," : ".";
      normalized = str
        .replace(new RegExp("\\" + thousandSep, "g"), "")
        .replace(decimalSep, ".");
    } else {
      normalized = str.replace(/[.,]/g, "");
    }
    normalized = normalized.replace(/[$\s]/g, "");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  };

  const mapTransactions = useCallback(
    (rawTxs: any[]): ScannedTransaction[] => {
      return rawTxs.map((t: any, i: number) => ({
        id: `scan-${i}`,
        amount: normalizeAmount(t.amount),
        currency: t.currency || "MXN",
        date: t.date || format(new Date(), "yyyy-MM-dd"),
        merchant: t.merchant || "",
        type: t.type || "expense",
        category_hint: t.category_hint || "otro",
        description: t.description || t.merchant || "",
        selected: true,
        resolvedCategoryId: resolveCategoryId(
          t.category_hint || "otro",
          t.type || "expense"
        ),
        resolvedAccountId: "",
      }));
    },
    [resolveCategoryId]
  );

  const calcAmountInBase = useCallback(
    (
      amount: number,
      transactionCurrency: string,
      accountId: string
    ): { amountInBase: number; exchangeRate: number } => {
      const account = accounts.find((a) => a.id === accountId);
      const accountCurrency = account?.currency || "MXN";
      const usdRate = fxRates["USD"] || 1;

      if (transactionCurrency === "USD" && accountCurrency === "MXN") {
        return { amountInBase: amount * usdRate, exchangeRate: usdRate };
      }
      if (transactionCurrency === "MXN" && accountCurrency === "USD") {
        return { amountInBase: amount, exchangeRate: 1 / usdRate };
      }
      if (transactionCurrency === "USD" && accountCurrency === "USD") {
        return { amountInBase: amount * usdRate, exchangeRate: usdRate };
      }
      return { amountInBase: amount, exchangeRate: 1 };
    },
    [accounts, fxRates]
  );

  const imageToBase64 = (
    file: File,
    highRes: boolean = false
  ): Promise<{ base64: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const MAX = highRes ? 1600 : 800;
        const MAX_BASE64 = highRes ? 800_000 : 300_000;
        const QUALITY_FIRST = highRes ? 0.82 : 0.5;
        const QUALITY_FALLBACK = highRes ? 0.65 : 0.3;

        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);

        let dataUrl = canvas.toDataURL("image/jpeg", QUALITY_FIRST);
        let base64 = dataUrl.split(",")[1];
        if (base64.length > MAX_BASE64) {
          dataUrl = canvas.toDataURL("image/jpeg", QUALITY_FALLBACK);
          base64 = dataUrl.split(",")[1];
        }

        console.log(
          `[ReceiptScanner] Image compressed: ${Math.round(base64.length / 1024)}KB` +
          ` (${w}x${h}, highRes=${highRes})`
        );
        resolve({ base64, mediaType: "image/jpeg" });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("No se pudo cargar la imagen"));
      };
      img.src = objectUrl;
    });
  };

  // ── EDGE FUNCTION CALL + PARSING ────────────────────────────────

  const processImages = useCallback(
    async (files: File[]) => {
      setIsProcessing(true);
      setMode("scanning");
      setScanProgress({ current: 0, total: files.length });

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("No session");

        if (scanMode === "single" && files.length === 1) {
          setScanProgress({ current: 1, total: 1 });
          const { base64, mediaType } = await imageToBase64(files[0]);
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ imageBase64: base64, mediaType, mode: "single" }),
            }
          );
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Error al procesar la imagen");
          }
          const result = await response.json();
          if (result.error) throw new Error(result.error);

          setSingleData({
            amount: result.amount ? String(normalizeAmount(result.amount)) : "",
            currency: result.currency || "MXN",
            date: result.date || format(new Date(), "yyyy-MM-dd"),
            merchant: result.merchant || "",
            description: result.description || result.merchant || "",
            categoryId: result.category_hint
              ? resolveCategoryId(result.category_hint, "expense")
              : "",
            accountId: "",
            type: "expense",
          });
          setMode("single");
        } else if (scanMode === "single" && files.length > 1) {
          setScanProgress({ current: 1, total: 1 });
          const compressedImages = [];
          for (let i = 0; i < files.length; i++) {
            setScanProgress({ current: i + 1, total: files.length });
            compressedImages.push(await imageToBase64(files[i]));
          }

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ images: compressedImages, mode: "single" }),
            }
          );
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Error al procesar las imágenes");
          }
          const result = await response.json();
          if (result.error) throw new Error(result.error);

          const txs = mapTransactions(result.transactions || []);
          setScannedTransactions(txs);
          setMode("statement");
        } else {
          const compressedImages = [];
          for (let i = 0; i < files.length; i++) {
            setScanProgress({ current: i + 1, total: files.length });
            compressedImages.push(await imageToBase64(files[i], true));
          }

          const body = files.length === 1
            ? { imageBase64: compressedImages[0].base64, mediaType: compressedImages[0].mediaType, mode: "statement" }
            : { images: compressedImages, mode: "statement" };

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(body),
            }
          );
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Error al procesar las imágenes");
          }
          const result = await response.json();
          if (result.error) throw new Error(result.error);

          const txs = mapTransactions(result.transactions || []);
          setScannedTransactions(txs);
          setMode("statement");
        }
      } catch (err: any) {
        console.error("Receipt scan failed:", err);
        setMode("error");
        setErrorMessage(err.message || "No se pudo leer la imagen. Intenta con mejor iluminación.");
      } finally {
        setIsProcessing(false);
      }
    },
    [scanMode, resolveCategoryId, mapTransactions]
  );

  // ── SAVE HANDLERS ───────────────────────────────────────────────

  const saveSingleTransaction = useCallback(async (): Promise<boolean> => {
    if (!singleData.amount || !singleData.accountId) {
      toast.error("Completa el monto y la cuenta");
      return false;
    }
    try {
      const amount = parseFloat(singleData.amount);
      const { amountInBase, exchangeRate } = calcAmountInBase(
        amount,
        singleData.currency,
        singleData.accountId
      );

      const { error } = await supabase.from("transactions").insert({
        user_id: user!.id,
        account_id: singleData.accountId,
        category_id: singleData.categoryId || null,
        type: singleData.type,
        amount,
        amount_in_base: amountInBase,
        currency: singleData.currency,
        exchange_rate: exchangeRate,
        description: singleData.description || singleData.merchant,
        transaction_date: singleData.date,
        notes: exchangeRate !== 1
          ? `Escaneo de recibo · TC: $${exchangeRate.toFixed(2)} · Equivalente: $${amountInBase.toFixed(2)} MXN`
          : "Registrado mediante escaneo de recibo",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Movimiento registrado");
      return true;
    } catch {
      toast.error("Error al guardar");
      return false;
    }
  }, [singleData, calcAmountInBase, user, queryClient]);

  const saveStatementTransactions = useCallback(async (): Promise<boolean> => {
    const selected = scannedTransactions.filter((t) => t.selected && t.amount > 0);
    if (selected.length === 0) {
      toast.error("Selecciona al menos un movimiento");
      return false;
    }
    const missingAccount = selected.some((t) => !t.resolvedAccountId);
    if (missingAccount) {
      toast.error("Selecciona la cuenta para registrar los movimientos");
      return false;
    }

    const inserts = selected.map((t) => {
      const { amountInBase, exchangeRate } = calcAmountInBase(
        t.amount,
        t.currency,
        t.resolvedAccountId
      );
      return {
        user_id: user!.id,
        account_id: t.resolvedAccountId,
        category_id: t.resolvedCategoryId || null,
        type: t.type,
        amount: t.amount,
        amount_in_base: amountInBase,
        currency: t.currency || "MXN",
        exchange_rate: exchangeRate,
        description: (t.description || t.merchant || "Sin descripción").substring(0, 255),
        transaction_date: t.date || format(new Date(), "yyyy-MM-dd"),
        notes: exchangeRate !== 1
          ? `Escaneo de estado de cuenta · TC: $${exchangeRate.toFixed(2)} · Equivalente: $${amountInBase.toFixed(2)} MXN`
          : "Registrado mediante escaneo de imagen",
      };
    });

    const BATCH_SIZE = 10;
    let saved = 0;
    let failed = 0;

    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      try {
        const { error } = await supabase.from("transactions").insert(batch);
        if (error) {
          console.error(`Batch ${i}-${i + BATCH_SIZE} failed:`, error.message);
          for (const item of batch) {
            try {
              const { error: singleError } = await supabase
                .from("transactions")
                .insert([item]);
              if (singleError) {
                console.error("Single insert failed:", singleError.message, item);
                failed++;
              } else {
                saved++;
              }
            } catch {
              failed++;
            }
          }
        } else {
          saved += batch.length;
        }
      } catch {
        failed += batch.length;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transactions_paginated"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });

    const dates = selected.map((t) => t.date).filter(Boolean).sort();
    const minDate = dates[0];
    const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    let periodHint = "";
    if (minDate) {
      const m = parseInt(minDate.split("-")[1], 10) - 1;
      const currentMonth = new Date().getMonth();
      if (m !== currentMonth) {
        periodHint = ` en ${monthNames[m]}`;
      }
    }

    if (failed === 0) {
      toast.success(
        `${saved} movimiento${saved !== 1 ? "s" : ""} registrado${saved !== 1 ? "s" : ""}${periodHint}`,
        { description: periodHint ? "Cambia el período en Movimientos para verlos." : undefined, duration: 5000 }
      );
    } else if (saved > 0) {
      toast.warning(`${saved} registrados, ${failed} no se pudieron guardar`);
    } else {
      toast.error("No se pudo guardar ningún movimiento");
      return false;
    }
    return true;
  }, [scannedTransactions, calcAmountInBase, user, queryClient]);

  const clearTransactions = useCallback(() => {
    setMode("scanning");
    setErrorMessage("");
    setScanProgress({ current: 0, total: 0 });
    setSingleData(emptySingleData());
    setScannedTransactions([]);
  }, []);

  return {
    // mode
    scanMode,
    setScanMode,
    // results
    scannedTransactions,
    setScannedTransactions,
    singleData,
    setSingleData,
    // status
    mode,
    setMode,
    isProcessing,
    errorMessage,
    scanProgress,
    // actions
    processImages,
    saveSingleTransaction,
    saveStatementTransactions,
    clearTransactions,
    // catalogs (used by JSX)
    expenseCategories,
    incomeCategories,
    activeAccounts: accounts.filter((a) => a.is_active),
  };
}
