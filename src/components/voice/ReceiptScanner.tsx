import { useState, useRef, useCallback } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { Camera, FileText, Loader2, Check, Trash2, X, ImagePlus, Images } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

const MAX_IMAGES = 5;

const CATEGORY_HINT_MAP: Record<string, string[]> = {
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
};

interface ScannedTransaction {
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

export function ReceiptScanner() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { rates: fxRates } = useExchangeRate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [selectOpen, setSelectOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [mode, setMode] = useState<"scanning" | "single" | "statement" | "error">("scanning");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scanMode, setScanMode] = useState<"single" | "statement">("single");
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const [singleData, setSingleData] = useState({
    amount: "",
    currency: "MXN",
    date: format(new Date(), "yyyy-MM-dd"),
    merchant: "",
    description: "",
    categoryId: "",
    accountId: "",
    type: "expense" as "expense" | "income",
  });

  const [transactions, setTransactions] = useState<ScannedTransaction[]>([]);

  const activeAccounts = accounts.filter((a) => a.is_active);
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

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

  const imageToBase64 = (
    file: File
  ): Promise<{ base64: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 800;
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
        let quality = 0.5;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        let base64 = dataUrl.split(",")[1];
        if (base64.length > 300_000) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.3);
          base64 = dataUrl.split(",")[1];
        }
        console.log(`[ReceiptScanner] Compressed image: ${Math.round(base64.length / 1024)}KB`);
        resolve({ base64, mediaType: "image/jpeg" });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("No se pudo cargar la imagen"));
      };
      img.src = objectUrl;
    });
  };

  const processImages = async (files: File[]) => {
    setIsLoading(true);
    setMode("scanning");
    setResultOpen(true);
    setScanProgress({ current: 0, total: files.length });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      if (scanMode === "single" && files.length === 1) {
        // Single receipt, single image — legacy behavior
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
          amount: result.amount ? String(result.amount) : "",
          currency: result.currency || "MXN",
          date: result.date || format(new Date(), "yyyy-MM-dd"),
          merchant: result.merchant || "",
          description: result.description || result.merchant || "",
          categoryId: result.category_hint
            ? resolveCategoryId(result.category_hint, "expense")
            : "",
          accountId: activeAccounts[0]?.id || "",
          type: "expense",
        });
        setMode("single");
      } else if (scanMode === "single" && files.length > 1) {
        // Multiple receipts — each is independent, send all images in one request
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

        // Result should be statement-like with transactions array
        const txs = mapTransactions(result.transactions || []);
        setTransactions(txs);
        setMode("statement");
      } else {
        // Statement mode — all images are pages of the same document
        const compressedImages = [];
        for (let i = 0; i < files.length; i++) {
          setScanProgress({ current: i + 1, total: files.length });
          compressedImages.push(await imageToBase64(files[i]));
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
        setTransactions(txs);
        setMode("statement");
      }
    } catch (err: any) {
      console.error("Receipt scan failed:", err);
      setMode("error");
      setErrorMessage(err.message || "No se pudo leer la imagen. Intenta con mejor iluminación.");
    } finally {
      setIsLoading(false);
    }
  };

  const mapTransactions = (rawTxs: any[]): ScannedTransaction[] => {
    return rawTxs.map((t: any, i: number) => ({
      id: `scan-${i}`,
      amount: t.amount || 0,
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
      resolvedAccountId: activeAccounts[0]?.id || "",
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, MAX_IMAGES);
    processImages(files);
    e.target.value = "";
  };

  const handleTakePhoto = () => {
    setSelectOpen(false);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 300);
  };

  const handleGalleryClick = () => {
    setSelectOpen(false);
    setTimeout(() => {
      galleryInputRef.current?.click();
    }, 300);
  };

  const calcAmountInBase = useCallback((
    amount: number,
    transactionCurrency: string,
    accountId: string
  ): { amountInBase: number; exchangeRate: number } => {
    const account = accounts.find(a => a.id === accountId);
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
  }, [accounts, fxRates]);

  const handleSingleConfirm = async () => {
    if (!singleData.amount || !singleData.accountId) {
      toast.error("Completa el monto y la cuenta");
      return;
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
      setResultOpen(false);
      reset();
    } catch {
      toast.error("Error al guardar");
    }
  };

  const handleStatementConfirm = async () => {
    const selected = transactions.filter((t) => t.selected && t.amount > 0);
    if (selected.length === 0) {
      toast.error("Selecciona al menos un movimiento");
      return;
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

    // Determine the date range of saved transactions for user feedback
    const dates = selected.map(t => t.date).filter(Boolean).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
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
      toast.warning(
        `${saved} registrados, ${failed} no se pudieron guardar`
      );
    } else {
      toast.error("No se pudo guardar ningún movimiento");
    }

    setResultOpen(false);
    reset();
  };

  const reset = () => {
    setMode("scanning");
    setErrorMessage("");
    setScanProgress({ current: 0, total: 0 });
    setSingleData({
      amount: "",
      currency: "MXN",
      date: format(new Date(), "yyyy-MM-dd"),
      merchant: "",
      description: "",
      categoryId: "",
      accountId: "",
      type: "expense",
    });
    setTransactions([]);
  };

  const toggleTransaction = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const updateTransaction = (
    id: string,
    field: keyof ScannedTransaction,
    value: any
  ) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const selectedCount = transactions.filter((t) => t.selected).length;

  return (
    <>
      {/* Hidden file input for CAMERA (single photo only) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Hidden file input for GALLERY (multiple allowed) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Floating camera button */}
      <button
        onClick={() => setSelectOpen(true)}
        className={cn(
          "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-all hover:scale-105 active:scale-95 border border-border",
          "bottom-20 right-20 lg:bottom-6 lg:right-24"
        )}
        aria-label="Escanear recibo"
      >
        <Camera className="h-6 w-6" />
      </button>

      {/* ── DIALOG 1: Mode selection ────────────────────────── */}
      <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[420px] p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Escanear imagen</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              La imagen se lee en el momento y no se almacena.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setScanMode("single")}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition-all space-y-1",
                  scanMode === "single"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  <Camera className="h-4 w-4" />
                  Recibo
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Un gasto por imagen
                </p>
              </button>
              <button
                onClick={() => setScanMode("statement")}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition-all space-y-1",
                  scanMode === "statement"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  <FileText className="h-4 w-4" />
                  Estado de cuenta
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Varios renglones a la vez
                </p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button className="w-full" onClick={handleTakePhoto}>
                <Camera className="mr-2 h-4 w-4" />
                Tomar foto
              </Button>
              <Button variant="outline" className="w-full" onClick={handleGalleryClick}>
                <Images className="mr-2 h-4 w-4" />
                Elegir imágenes
              </Button>
            </div>

            <p className="text-[10px] text-center text-muted-foreground">
              Puedes seleccionar hasta {MAX_IMAGES} imágenes de tu galería
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG 2: Results (scanning / single / statement) ── */}
      <Dialog
        open={resultOpen}
        onOpenChange={(open) => {
          if (!open && !isLoading) {
            setResultOpen(false);
            reset();
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[420px] max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle className="text-base">
              {mode === "scanning" && (
                scanProgress.total > 1
                  ? `Procesando imágenes (${scanProgress.current}/${scanProgress.total})...`
                  : "Leyendo imagen..."
              )}
              {mode === "error" && "Error al leer imagen"}
              {mode === "single" && "Confirma el movimiento"}
              {mode === "statement" &&
                `Confirma los movimientos (${selectedCount})`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {/* SCANNING */}
            {mode === "scanning" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  {scanProgress.total > 1
                    ? `Comprimiendo imagen ${scanProgress.current} de ${scanProgress.total}...`
                    : "Leyendo la imagen..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {scanProgress.total > 1
                    ? "Las imágenes se envían juntas al AI"
                    : "Esto toma unos segundos"}
                </p>
                {scanProgress.total > 1 && (
                  <div className="w-full max-w-[200px] h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ERROR */}
            {mode === "error" && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="h-5 w-5 text-destructive" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No se pudo leer la imagen</p>
                  <p className="text-xs text-muted-foreground max-w-[260px]">{errorMessage}</p>
                </div>
                <div className="flex gap-2 w-full pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setResultOpen(false);
                      reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setResultOpen(false);
                      reset();
                      setTimeout(() => setSelectOpen(true), 300);
                    }}
                  >
                    Intentar de nuevo
                  </Button>
                </div>
              </div>
            )}

            {/* SINGLE RECEIPT */}
            {mode === "single" && (
              <div className="space-y-3">
                {/* Type */}
                <div className="flex gap-2">
                  {(["expense", "income"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setSingleData((d) => ({ ...d, type: t }))
                      }
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-sm font-medium border-2 transition-all",
                        singleData.type === t
                          ? t === "expense"
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground"
                      )}
                    >
                      {t === "expense" ? "Gasto" : "Ingreso"}
                    </button>
                  ))}
                </div>

                {/* Amount */}
                <div className="flex gap-2">
                  <select
                    value={singleData.currency}
                    onChange={(e) =>
                      setSingleData((d) => ({
                        ...d,
                        currency: e.target.value,
                      }))
                    }
                    className="h-10 text-sm border border-input rounded-md px-2 bg-background"
                  >
                    <option>MXN</option>
                    <option>USD</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={singleData.amount}
                    onChange={(e) =>
                      setSingleData((d) => ({
                        ...d,
                        amount: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Description */}
                <Input
                  placeholder="Descripción"
                  value={singleData.description}
                  onChange={(e) =>
                    setSingleData((d) => ({
                      ...d,
                      description: e.target.value,
                    }))
                  }
                />

                {/* Date */}
                <Input
                  type="date"
                  value={singleData.date}
                  onChange={(e) =>
                    setSingleData((d) => ({ ...d, date: e.target.value }))
                  }
                />

                {/* Category */}
                <select
                  value={singleData.categoryId}
                  onChange={(e) =>
                    setSingleData((d) => ({
                      ...d,
                      categoryId: e.target.value,
                    }))
                  }
                  className="w-full h-10 text-sm border border-input rounded-md px-2 bg-background"
                >
                  <option value="">Sin categoría</option>
                  {(singleData.type === "expense"
                    ? expenseCategories
                    : incomeCategories
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Account */}
                <select
                  value={singleData.accountId}
                  onChange={(e) =>
                    setSingleData((d) => ({
                      ...d,
                      accountId: e.target.value,
                    }))
                  }
                  className="w-full h-10 text-sm border border-input rounded-md px-2 bg-background"
                >
                  <option value="">Selecciona cuenta</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatCurrency(a.current_balance, a.currency)}
                    </option>
                  ))}
                </select>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setResultOpen(false);
                      reset();
                      setTimeout(() => {
                        setSelectOpen(true);
                      }, 300);
                    }}
                  >
                    Volver a escanear
                  </Button>
                  <Button className="flex-1" onClick={handleSingleConfirm}>
                    <Check className="mr-1 h-4 w-4" />
                    Confirmar
                  </Button>
                </div>
              </div>
            )}

            {/* STATEMENT */}
            {mode === "statement" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Revisa y ajusta. Desmarca los que no quieras registrar.
                </p>

                {/* Global account */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Cuenta:
                  </span>
                  <select
                    onChange={(e) => {
                      const accountId = e.target.value;
                      setTransactions((prev) =>
                        prev.map((t) => ({
                          ...t,
                          resolvedAccountId: accountId,
                        }))
                      );
                    }}
                    defaultValue={activeAccounts[0]?.id || ""}
                    className="flex-1 h-8 text-sm border border-input rounded-md px-2 bg-background"
                  >
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transactions list */}
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={cn(
                        "rounded-lg border p-2 space-y-1.5 transition-opacity",
                        !tx.selected && "opacity-40"
                      )}
                    >
                      {/* Row 1 */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleTransaction(tx.id)}
                          className={cn(
                            "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            tx.selected
                              ? "border-primary bg-primary"
                              : "border-border bg-background"
                          )}
                        >
                          {tx.selected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </button>
                        <Input
                          className="h-7 text-xs flex-1"
                          value={tx.description}
                          onChange={(e) =>
                            updateTransaction(
                              tx.id,
                              "description",
                              e.target.value
                            )
                          }
                        />
                        <Input
                          type="number"
                          className="h-7 text-xs w-20"
                          value={tx.amount}
                          onChange={(e) =>
                            updateTransaction(
                              tx.id,
                              "amount",
                              Number(e.target.value)
                            )
                          }
                        />
                        <button
                          onClick={() => removeTransaction(tx.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Row 2 */}
                      {tx.selected && (
                        <div className="flex items-center gap-1.5 pl-6">
                          <Input
                            type="date"
                            className="h-6 text-[11px] flex-1"
                            value={tx.date}
                            onChange={(e) =>
                              updateTransaction(tx.id, "date", e.target.value)
                            }
                          />
                          <select
                            value={tx.type}
                            onChange={(e) =>
                              updateTransaction(
                                tx.id,
                                "type",
                                e.target.value as any
                              )
                            }
                            className="h-6 text-[11px] border border-input rounded px-1 bg-background"
                          >
                            <option value="expense">Gasto</option>
                            <option value="income">Ingreso</option>
                          </select>
                          <select
                            value={tx.resolvedCategoryId}
                            onChange={(e) =>
                              updateTransaction(
                                tx.id,
                                "resolvedCategoryId",
                                e.target.value
                              )
                            }
                            className="h-6 text-[11px] border border-input rounded px-1 bg-background flex-1"
                          >
                            <option value="">—</option>
                            {(tx.type === "expense"
                              ? expenseCategories
                              : incomeCategories
                            ).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setResultOpen(false);
                      reset();
                      setTimeout(() => {
                        setSelectOpen(true);
                      }, 300);
                    }}
                  >
                    Volver a escanear
                  </Button>
                  <Button className="flex-1" onClick={handleStatementConfirm}>
                    <Check className="mr-1 h-4 w-4" />
                    Registrar{selectedCount > 0 ? ` (${selectedCount})` : ""}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
