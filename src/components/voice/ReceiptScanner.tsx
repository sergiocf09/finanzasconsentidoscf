import { useState, useRef } from "react";
import { Camera, FileText, Loader2, Check, Trash2, X, Images } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { useReceiptScanner, type ScannedTransaction } from "@/hooks/useReceiptScanner";

const MAX_IMAGES = 5;

export function ReceiptScanner() {
  const {
    scanMode,
    setScanMode,
    scannedTransactions,
    setScannedTransactions,
    singleData,
    setSingleData,
    mode,
    isProcessing,
    errorMessage,
    scanProgress,
    processImages,
    saveSingleTransaction,
    saveStatementTransactions,
    clearTransactions,
    expenseCategories,
    incomeCategories,
    activeAccounts,
  } = useReceiptScanner();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [selectOpen, setSelectOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, MAX_IMAGES);
    setResultOpen(true);
    processImages(files);
    e.target.value = "";
  };

  const handleTakePhoto = () => {
    setSelectOpen(false);
    setTimeout(() => fileInputRef.current?.click(), 300);
  };

  const handleGalleryClick = () => {
    setSelectOpen(false);
    setTimeout(() => galleryInputRef.current?.click(), 300);
  };

  const handleSingleConfirm = async () => {
    const ok = await saveSingleTransaction();
    if (ok) {
      setResultOpen(false);
      clearTransactions();
    }
  };

  const handleStatementConfirm = async () => {
    const ok = await saveStatementTransactions();
    if (ok) {
      setResultOpen(false);
      clearTransactions();
    }
  };

  const toggleTransaction = (id: string) => {
    setScannedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const updateTransaction = (
    id: string,
    field: keyof ScannedTransaction,
    value: any
  ) => {
    setScannedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const removeTransaction = (id: string) => {
    setScannedTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const selectedCount = scannedTransactions.filter((t) => t.selected).length;

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
          if (!open && !isProcessing) {
            setResultOpen(false);
            clearTransactions();
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
                      clearTransactions();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setResultOpen(false);
                      clearTransactions();
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
                <div className="flex gap-2">
                  {(["expense", "income"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSingleData((d) => ({ ...d, type: t }))}
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

                <div className="flex gap-2">
                  <select
                    value={singleData.currency}
                    onChange={(e) => setSingleData((d) => ({ ...d, currency: e.target.value }))}
                    className="h-10 text-sm border border-input rounded-md px-2 bg-background"
                  >
                    <option>MXN</option>
                    <option>USD</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={singleData.amount}
                    onChange={(e) => setSingleData((d) => ({ ...d, amount: e.target.value }))}
                  />
                </div>

                <Input
                  placeholder="Descripción"
                  value={singleData.description}
                  onChange={(e) => setSingleData((d) => ({ ...d, description: e.target.value }))}
                />

                <Input
                  type="date"
                  value={singleData.date}
                  onChange={(e) => setSingleData((d) => ({ ...d, date: e.target.value }))}
                />

                <select
                  value={singleData.categoryId}
                  onChange={(e) => setSingleData((d) => ({ ...d, categoryId: e.target.value }))}
                  className="w-full h-10 text-sm border border-input rounded-md px-2 bg-background"
                >
                  <option value="">Sin categoría</option>
                  {(singleData.type === "expense" ? expenseCategories : incomeCategories).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={singleData.accountId}
                  onChange={(e) => setSingleData((d) => ({ ...d, accountId: e.target.value }))}
                  className="w-full h-10 text-sm border border-input rounded-md px-2 bg-background"
                >
                  <option value="">Selecciona cuenta</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatCurrency(a.current_balance, a.currency)}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setResultOpen(false);
                      clearTransactions();
                      setTimeout(() => setSelectOpen(true), 300);
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

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Cuenta:</span>
                  <select
                    value={scannedTransactions[0]?.resolvedAccountId || ""}
                    onChange={(e) => {
                      const accountId = e.target.value;
                      setScannedTransactions((prev) =>
                        prev.map((t) => ({ ...t, resolvedAccountId: accountId }))
                      );
                    }}
                    className="flex-1 h-8 text-sm border border-input rounded-md px-2 bg-background"
                  >
                    <option value="">Selecciona cuenta</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                {!scannedTransactions[0]?.resolvedAccountId && (
                  <p className="text-[11px] text-destructive -mt-1">
                    Selecciona la cuenta antes de confirmar.
                  </p>
                )}

                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {scannedTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={cn(
                        "rounded-lg border p-2 space-y-1.5 transition-opacity",
                        !tx.selected && "opacity-40"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleTransaction(tx.id)}
                          className={cn(
                            "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            tx.selected ? "border-primary bg-primary" : "border-border bg-background"
                          )}
                        >
                          {tx.selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </button>
                        <Input
                          className="h-7 text-xs flex-1"
                          value={tx.description}
                          onChange={(e) => updateTransaction(tx.id, "description", e.target.value)}
                        />
                        <Input
                          type="number"
                          className="h-7 text-xs w-20"
                          value={tx.amount}
                          onChange={(e) => updateTransaction(tx.id, "amount", Number(e.target.value))}
                        />
                        <button
                          onClick={() => removeTransaction(tx.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {tx.selected && (
                        <div className="flex items-center gap-1.5 pl-6">
                          <Input
                            type="date"
                            className="h-6 text-[11px] flex-1"
                            value={tx.date}
                            onChange={(e) => updateTransaction(tx.id, "date", e.target.value)}
                          />
                          <select
                            value={tx.type}
                            onChange={(e) => updateTransaction(tx.id, "type", e.target.value as any)}
                            className="h-6 text-[11px] border border-input rounded px-1 bg-background"
                          >
                            <option value="expense">Gasto</option>
                            <option value="income">Ingreso</option>
                          </select>
                          <select
                            value={tx.resolvedCategoryId}
                            onChange={(e) => updateTransaction(tx.id, "resolvedCategoryId", e.target.value)}
                            className="h-6 text-[11px] border border-input rounded px-1 bg-background flex-1"
                          >
                            <option value="">—</option>
                            {(tx.type === "expense" ? expenseCategories : incomeCategories).map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setResultOpen(false);
                      clearTransactions();
                      setTimeout(() => setSelectOpen(true), 300);
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
