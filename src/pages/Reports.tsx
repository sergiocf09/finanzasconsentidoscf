import { useState, useMemo, useEffect } from "react";
import { FileText, Table, Download, Loader2, CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts, isAssetType, isLiability } from "@/hooks/useAccounts";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useNonFinancialAssets } from "@/hooks/useNonFinancialAssets";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatCurrency } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

type PeriodKey = "current" | "previous" | "last3" | "last6" | "custom";

function getDateRange(period: PeriodKey, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (period) {
    case "current":
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    case "previous": {
      const prev = subMonths(now, 1);
      return { startDate: startOfMonth(prev), endDate: endOfMonth(prev) };
    }
    case "last3":
      return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
    case "last6":
      return { startDate: startOfMonth(subMonths(now, 5)), endDate: endOfMonth(now) };
    case "custom":
      return {
        startDate: customStart || startOfMonth(now),
        endDate: customEnd || endOfMonth(now),
      };
  }
}

const periodLabels: Record<PeriodKey, string> = {
  current: "Este mes",
  previous: "Mes anterior",
  last3: "Últimos 3 meses",
  last6: "Últimos 6 meses",
  custom: "Personalizado",
};

function buildPeriodTitle(startDate: Date, endDate: Date): string {
  if (isSameMonth(startDate, endDate)) {
    const m = format(startDate, "MMMM yyyy", { locale: es });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  const s = format(startDate, "MMM yyyy", { locale: es });
  const e = format(endDate, "MMM yyyy", { locale: es });
  return `${s.charAt(0).toUpperCase() + s.slice(1)} – ${e.charAt(0).toUpperCase() + e.slice(1)}`;
}

export default function Reports() {
  const [period, setPeriod] = useState<PeriodKey>("current");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [accountsInitialized, setAccountsInitialized] = useState(false);

  const { startDate, endDate } = getDateRange(period, customStart, customEnd);
  const { transactions, totals, isLoading } = useTransactions({ startDate, endDate });
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { goals } = useSavingsGoals();
  const { assets: nfAssets } = useNonFinancialAssets();
  const { convertToMXN } = useExchangeRate();
  

  useEffect(() => {
    if (accounts.length > 0 && !accountsInitialized) {
      setSelectedAccountIds(new Set(accounts.filter(a => a.is_active).map(a => a.id)));
      setAccountsInitialized(true);
    }
  }, [accounts, accountsInitialized]);

  const categoryMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [categories]);

  const categoryBucketMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c: any) => {
      if (c.bucket) m[c.id] = c.bucket;
    });
    return m;
  }, [categories]);

  const accountMap = useMemo(() => {
    const m: Record<string, string> = {};
    accounts.forEach((a) => (m[a.id] = a.name));
    return m;
  }, [accounts]);

  const blockSummariesList = useMemo(() => {
    const bucketTotals: Record<string, number> = { stability: 0, lifestyle: 0, build: 0 };
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const bucket = t.category_id ? categoryBucketMap[t.category_id] : null;
        const amt = t.amount_in_base ?? t.amount;
        if (bucket && bucketTotals[bucket] !== undefined) {
          bucketTotals[bucket] += amt;
        } else {
          bucketTotals["lifestyle"] += amt;
        }
      });
    const total = bucketTotals.stability + bucketTotals.lifestyle + bucketTotals.build;
    const labels: Record<string, string> = {
      stability: "Estabilidad",
      lifestyle: "Calidad de Vida",
      build: "Construcción",
    };
    return ["stability", "lifestyle", "build"].map((key) => ({
      label: labels[key],
      amount: bucketTotals[key],
      percent: total > 0 ? (bucketTotals[key] / total) * 100 : 0,
    }));
  }, [transactions, categoryBucketMap]);

  const topCategories = useMemo(() => {
    const map: Record<string, { name: string; amount: number }> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const catName = t.category_id ? categoryMap[t.category_id] || "Sin categoría" : "Sin categoría";
        const base = t.amount_in_base ?? t.amount;
        if (!map[catName]) map[catName] = { name: catName, amount: 0 };
        map[catName].amount += base;
      });
    const sorted = Object.values(map).sort((a, b) => b.amount - a.amount);
    const totalExpense = sorted.reduce((s, c) => s + c.amount, 0);
    return sorted.slice(0, 5).map((c) => ({
      ...c,
      pct: totalExpense > 0 ? (c.amount / totalExpense) * 100 : 0,
    }));
  }, [transactions, categoryMap]);

  const periodTitle = buildPeriodTitle(startDate, endDate);
  const periodLabel = `${format(startDate, "d MMM yyyy", { locale: es })} – ${format(endDate, "d MMM yyyy", { locale: es })}`;

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) setCustomStart(range.from);
    if (range?.to) setCustomEnd(range.to);
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAccounts = () => {
    setSelectedAccountIds(new Set(accounts.filter(a => a.is_active).map(a => a.id)));
  };

  const deselectAllAccounts = () => {
    setSelectedAccountIds(new Set());
  };

  // ─── PDF Export ───
  const handleExportPDF = async () => {
    setGeneratingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;

      // Wait for template to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 300));

      const doc = new jsPDF({
        unit: "px",
        format: "a4",
        hotfixes: ["px_scaling"],
      });

      const pageIds = ["pdf-page-1", "pdf-page-2", "pdf-page-3"];

      for (let i = 0; i < pageIds.length; i++) {
        const el = document.getElementById(pageIds[i]);
        if (!el) continue;

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          width: 794,
          windowWidth: 794,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const pdfW = doc.internal.pageSize.getWidth();
        const pdfH = (canvas.height * pdfW) / canvas.width;

        if (i > 0) doc.addPage();
        doc.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      }

      doc.save(`finanzas-${format(startDate, "yyyy-MM")}.pdf`);
      toast.success("PDF generado");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ─── Excel Export ───
  const handleExportExcel = async () => {
    setGeneratingExcel(true);
    try {
      const XLSX = await import("xlsx");
      const fmtInt = (n: number) => Math.round(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });

      const filteredTx = selectedAccountIds.size === 0
        ? transactions
        : transactions.filter(tx => selectedAccountIds.has(tx.account_id));

      // === Sheet 1 — Movimientos ===
      const headerAoa: (string | number)[][] = [
        ["FINANZAS CON SENTIDO™ — " + periodTitle],
        ["Movimientos:", filteredTx.length],
        [],
        ["#", "Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Monto", "Moneda"],
      ];

      const txDataRows: (string | number)[][] = filteredTx.map((tx, i) => [
        i + 1,
        tx.transaction_date,
        tx.type === "income" ? "Ingreso" : tx.type === "expense" ? "Gasto" : tx.type === "transfer" ? "Transferencia" : tx.type,
        tx.description || "",
        tx.category_id ? categoryMap[tx.category_id] || "" : "",
        accountMap[tx.account_id] || "",
        fmtInt(tx.amount_in_base ?? tx.amount),
        tx.currency,
      ]);

      const allRows = [...headerAoa, ...txDataRows];
      const ws1 = XLSX.utils.aoa_to_sheet(allRows);

      const colHeaders = ["#", "Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Monto", "Moneda"];
      const colWidths = colHeaders.map((h, ci) => {
        const maxDataLen = txDataRows.reduce((max, row) => {
          const val = String(row[ci] ?? "");
          return Math.max(max, val.length);
        }, h.length);
        return { wch: Math.min(maxDataLen + 2, 50) };
      });
      ws1["!cols"] = colWidths;
      ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

      // === Sheet 2 — Resumen ===
      const filteredIncome = filteredTx.filter(t => t.type === "income").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0);
      const filteredExpense = filteredTx.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0);

      const filteredBlockTotals: Record<string, number> = { stability: 0, lifestyle: 0, build: 0 };
      filteredTx.filter(t => t.type === "expense").forEach(t => {
        const bucket = t.category_id ? categoryBucketMap[t.category_id] : null;
        const amt = t.amount_in_base ?? t.amount;
        if (bucket && filteredBlockTotals[bucket] !== undefined) {
          filteredBlockTotals[bucket] += amt;
        } else {
          filteredBlockTotals["lifestyle"] += amt;
        }
      });
      const filteredBlockTotal = filteredBlockTotals.stability + filteredBlockTotals.lifestyle + filteredBlockTotals.build;
      const filteredBlocks = [
        { label: "Estabilidad", amount: filteredBlockTotals.stability },
        { label: "Calidad de Vida", amount: filteredBlockTotals.lifestyle },
        { label: "Construcción", amount: filteredBlockTotals.build },
      ].map(b => ({ ...b, pct: filteredBlockTotal > 0 ? (b.amount / filteredBlockTotal) * 100 : 0 }));

      const filteredCatMap: Record<string, { name: string; amount: number }> = {};
      filteredTx.filter(t => t.type === "expense").forEach(t => {
        const catName = t.category_id ? categoryMap[t.category_id] || "Sin categoría" : "Sin categoría";
        const base = t.amount_in_base ?? t.amount;
        if (!filteredCatMap[catName]) filteredCatMap[catName] = { name: catName, amount: 0 };
        filteredCatMap[catName].amount += base;
      });
      const filteredTopCats = Object.values(filteredCatMap).sort((a, b) => b.amount - a.amount).slice(0, 5);
      const filteredTopTotal = filteredTopCats.reduce((s, c) => s + c.amount, 0);
      const filteredTopPct = filteredExpense > 0 ? filteredTopCats.map(c => ({ ...c, pct: (c.amount / filteredExpense) * 100 })) : filteredTopCats.map(c => ({ ...c, pct: 0 }));

      const summaryAoa: (string | number)[][] = [
        ["FINANZAS CON SENTIDO™ — " + periodTitle],
        [],
        ["RESUMEN DEL PERIODO", "", ""],
        ["Ingresos", fmtInt(filteredIncome), ""],
        ["Gastos", fmtInt(filteredExpense), ""],
        ["Balance", fmtInt(filteredIncome - filteredExpense), ""],
        [],
        ["DISTRIBUCIÓN POR BLOQUES", "Monto", "% del gasto"],
        ...filteredBlocks.map(b => [b.label, fmtInt(b.amount), `${b.pct.toFixed(1)}%`]),
        [],
        ["TOP CATEGORÍAS DE GASTO", "Monto", "% del gasto"],
        ...filteredTopPct.map(c => [c.name, fmtInt(c.amount), `${c.pct.toFixed(1)}%`]),
        ["Total Top 5", fmtInt(filteredTopTotal), `${filteredExpense > 0 ? ((filteredTopTotal / filteredExpense) * 100).toFixed(1) : "0.0"}%`],
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(summaryAoa);
      ws2["!cols"] = [{ wch: 35 }, { wch: 22 }, { wch: 15 }];
      ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "Movimientos");
      XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

      const monthStr = format(startDate, "yyyy-MM");
      XLSX.writeFile(wb, `movimientos-${monthStr}.xlsx`);
      toast.success("Excel generado");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el Excel");
    } finally {
      setGeneratingExcel(false);
    }
  };

  const busy = generatingPdf || generatingExcel;
  const activeAccounts = accounts.filter(a => a.is_active);
  const allSelected = activeAccounts.length > 0 && activeAccounts.every(a => selectedAccountIds.has(a.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-heading font-semibold text-foreground">Exportar</h1>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Custom range */}
      {period === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-full justify-start text-left text-xs h-9", !customStart && "text-muted-foreground")}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {customStart && customEnd
                ? `${format(customStart, "dd MMM yyyy", { locale: es })} – ${format(customEnd, "dd MMM yyyy", { locale: es })}`
                : customStart
                  ? `${format(customStart, "dd MMM yyyy", { locale: es })} – selecciona fin`
                  : "Selecciona rango de fechas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customStart ? { from: customStart, to: customEnd } : undefined}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Export cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* PDF Card */}
        <div className="rounded-2xl bg-card border border-border p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground">Resumen ejecutivo</h2>
              <p className="text-xs text-muted-foreground">PDF · Fotografía completa</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Incluye ingresos, gastos, balance, distribución por bloques, top gastos, panorama patrimonial completo y metas de construcción.
          </p>
          <Button onClick={handleExportPDF} disabled={busy || isLoading} className="w-full gap-2">
            {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
        </div>

        {/* Excel Card */}
        <div className="rounded-2xl bg-card border border-border p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-income/10">
              <Table className="h-5 w-5 text-income" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground">Listado de movimientos</h2>
              <p className="text-xs text-muted-foreground">Excel · Por cuentas seleccionadas</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Exporta los movimientos de las cuentas seleccionadas con fecha, descripción, categoría, cuenta y monto.
          </p>

          {/* Account selector */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Cuentas a incluir</p>
              <button
                className="text-[10px] text-primary hover:underline"
                onClick={allSelected ? deselectAllAccounts : selectAllAccounts}
              >
                {allSelected ? "Ninguna" : "Todas"}
              </button>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {activeAccounts.map(acc => (
                <label key={acc.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selectedAccountIds.has(acc.id)}
                    onCheckedChange={() => toggleAccount(acc.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs text-foreground truncate flex-1">{acc.name}</span>
                  <span className="text-[10px] text-muted-foreground">{acc.currency}</span>
                </label>
              ))}
            </div>
            {selectedAccountIds.size > 0 && selectedAccountIds.size < activeAccounts.length && (
              <p className="text-[10px] text-muted-foreground">
                {selectedAccountIds.size} de {activeAccounts.length} cuentas seleccionadas
              </p>
            )}
          </div>

          <Button onClick={handleExportExcel} disabled={busy || isLoading} variant="outline" className="w-full gap-2">
            {generatingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar Excel
          </Button>
        </div>
      </div>

      {/* Period summary */}
      <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-center">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando datos…</p>
        ) : transactions.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Periodo: <span className="font-medium text-foreground">{periodLabel}</span> · {transactions.length} movimiento{transactions.length !== 1 ? "s" : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay movimientos registrados en este periodo. Selecciona otro rango o empieza a registrar tus movimientos.
          </p>
        )}
      </div>
    </div>
  );
}
