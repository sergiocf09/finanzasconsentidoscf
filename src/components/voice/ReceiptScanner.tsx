import { useState, useRef, useCallback } from "react";
import { Camera, FileText, Loader2, Check, Trash2, X } from "lucide-react";
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Two separate dialogs: one for mode selection, one for results
  const [selectOpen, setSelectOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [mode, setMode] = useState<"scanning" | "single" | "statement" | "error">("scanning");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scanMode, setScanMode] = useState<"single" | "statement">("single");

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

  // Resize image aggressively and compress to keep payload under ~200KB
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
        // Try quality 0.5 first; if still too big, reduce further
        let quality = 0.5;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        let base64 = dataUrl.split(",")[1];
        // If base64 > 300KB (~400KB raw), reduce quality
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

  const processImage = async (file: File) => {
    // Open the result dialog in scanning mode
    setIsLoading(true);
    setMode("scanning");
    setResultOpen(true);

    try {
      const { base64, mediaType } = await imageToBase64(file);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ imageBase64: base64, mediaType, mode: scanMode }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Error al procesar la imagen");
      }
      const result = await response.json();
      if (result.error) throw new Error(result.error);

      if (result.mode === "single" || scanMode === "single") {
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
      } else {
        const txs: ScannedTransaction[] = (result.transactions || []).map(
          (t: any, i: number) => ({
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
          })
        );
        setTransactions(txs);
        setMode("statement");
      }
    } catch (err: any) {
      toast.error(err.message || "No se pudo leer la imagen");
      setResultOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = "";
  };

  // Called when user picks scan mode and clicks "Tomar foto"
  const handleTakePhoto = () => {
    // Close the selection dialog FIRST, then trigger file input
    setSelectOpen(false);
    // Small delay to let the dialog close before opening native picker
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 300);
  };

  const handleSingleConfirm = async () => {
    if (!singleData.amount || !singleData.accountId) {
      toast.error("Completa el monto y la cuenta");
      return;
    }
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: user!.id,
        account_id: singleData.accountId,
        category_id: singleData.categoryId || null,
        type: singleData.type,
        amount: parseFloat(singleData.amount),
        amount_in_base: parseFloat(singleData.amount),
        currency: singleData.currency,
        exchange_rate: 1,
        description: singleData.description || singleData.merchant,
        transaction_date: singleData.date,
        notes: "Registrado mediante escaneo de recibo",
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
    try {
      const inserts = selected.map((t) => ({
        user_id: user!.id,
        account_id: t.resolvedAccountId,
        category_id: t.resolvedCategoryId || null,
        type: t.type,
        amount: t.amount,
        amount_in_base: t.amount,
        currency: t.currency,
        exchange_rate: 1,
        description: t.description || t.merchant,
        transaction_date: t.date,
        notes: "Registrado mediante escaneo de estado de cuenta",
      }));
      const { error } = await supabase.from("transactions").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(
        `${selected.length} movimiento${selected.length > 1 ? "s" : ""} registrado${selected.length > 1 ? "s" : ""}`
      );
      setResultOpen(false);
      reset();
    } catch {
      toast.error("Error al guardar los movimientos");
    }
  };

  const reset = () => {
    setMode("scanning");
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
      {/* Hidden file input — OUTSIDE any dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
                  Un solo gasto — ticket, factura
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

            <Button className="w-full" onClick={handleTakePhoto}>
              <Camera className="mr-2 h-4 w-4" />
              {scanMode === "single"
                ? "Tomar foto del recibo"
                : "Tomar foto del estado de cuenta"}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              También puedes seleccionar una imagen de tu galería
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
              {mode === "scanning" && "Leyendo imagen..."}
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
                <p className="text-sm font-medium">Leyendo la imagen...</p>
                <p className="text-xs text-muted-foreground">
                  Esto toma unos segundos
                </p>
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
