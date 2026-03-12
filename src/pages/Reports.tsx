import { useState, useMemo } from "react";
import { FileDown, FileText, Table, Download, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { formatCurrency } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

type PeriodKey = "current" | "previous" | "last3" | "last6";

function getDateRange(period: PeriodKey) {
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
  }
}

const periodLabels: Record<PeriodKey, string> = {
  current: "Este mes",
  previous: "Mes anterior",
  last3: "Últimos 3 meses",
  last6: "Últimos 6 meses",
};

export default function Reports() {
  const [period, setPeriod] = useState<PeriodKey>("current");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);

  const { startDate, endDate } = getDateRange(period);
  const { transactions, totals, isLoading } = useTransactions({ startDate, endDate });
  const { budgets } = useBudgets();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { blockSummaries: blockSummariesRecord, stage } = useFinancialIntelligence();
  const blockSummariesList = useMemo(() => Object.values(blockSummariesRecord), [blockSummariesRecord]);

  const categoryMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [categories]);

  const accountMap = useMemo(() => {
    const m: Record<string, string> = {};
    accounts.forEach((a) => (m[a.id] = a.name));
    return m;
  }, [accounts]);

  // Top 5 expense categories
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

  const periodLabel = `${format(startDate, "d MMM yyyy", { locale: es })} – ${format(endDate, "d MMM yyyy", { locale: es })}`;

  const handleExportPDF = async () => {
    setGeneratingPdf(true);
    try {
      const jsPDFModule = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const jsPDF = jsPDFModule.default;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const w = doc.internal.pageSize.getWidth();
      let y = 20;

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Finanzas con Sentido™", w / 2, y, { align: "center" });
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Reporte: ${periodLabel}`, w / 2, y, { align: "center" });
      y += 5;
      doc.setFontSize(9);
      doc.text(`Generado el ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`, w / 2, y, { align: "center" });
      y += 4;
      doc.setDrawColor(200);
      doc.line(15, y, w - 15, y);
      y += 10;

      // Summary row
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const colW = (w - 30) / 3;
      const summaryItems = [
        { label: "Ingresos", value: formatCurrency(totals.income, "MXN", { decimals: 2 }) },
        { label: "Gastos", value: formatCurrency(totals.expense, "MXN", { decimals: 2 }) },
        { label: "Balance", value: formatCurrency(totals.income - totals.expense, "MXN", { decimals: 2 }) },
      ];
      summaryItems.forEach((item, i) => {
        const x = 15 + i * colW + colW / 2;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(item.label, x, y, { align: "center" });
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(item.value, x, y + 7, { align: "center" });
      });
      y += 20;

      // Block distribution
      if (blockSummariesList.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Distribución por bloques", 15, y);
        y += 6;

        const blockRows = blockSummariesList.map((b) => [
          b.label,
          formatCurrency(b.amount, "MXN", { decimals: 2 }),
          `${b.percent.toFixed(1)}%`,
        ]);

        (doc as any).autoTable({
          startY: y,
          head: [["Bloque", "Monto", "% del gasto"]],
          body: blockRows,
          margin: { left: 15, right: 15 },
          styles: { fontSize: 10 },
          headStyles: { fillColor: [60, 60, 60] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Top 5 categories
      if (topCategories.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Top 5 categorías de gasto", 15, y);
        y += 6;

        const catRows = topCategories.map((c) => [
          c.name,
          formatCurrency(c.amount, "MXN", { decimals: 2 }),
          `${c.pct.toFixed(1)}%`,
        ]);

        (doc as any).autoTable({
          startY: y,
          head: [["Categoría", "Monto", "% del gasto"]],
          body: catRows,
          margin: { left: 15, right: 15 },
          styles: { fontSize: 10 },
          headStyles: { fillColor: [60, 60, 60] },
        });
        y = (doc as any).lastAutoTable.finalY + 15;
      }

      // Footer
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("Tu dinero con calma. Tu vida con sentido.", w / 2, doc.internal.pageSize.getHeight() - 15, {
        align: "center",
      });

      const monthStr = format(startDate, "yyyy-MM");
      doc.save(`finanzas-${monthStr}.pdf`);
      toast.success("PDF generado");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setGeneratingExcel(true);
    try {
      const XLSX = await import("xlsx");

      // Sheet 1 — Transactions
      const txRows = transactions.map((tx) => ({
        Fecha: tx.transaction_date,
        Tipo: tx.type === "income" ? "Ingreso" : tx.type === "expense" ? "Gasto" : tx.type === "transfer" ? "Transferencia" : tx.type,
        Descripción: tx.description || "",
        Categoría: tx.category_id ? categoryMap[tx.category_id] || "" : "",
        Cuenta: accountMap[tx.account_id] || "",
        Monto: tx.amount_in_base ?? tx.amount,
        Moneda: tx.currency,
      }));

      const ws1 = XLSX.utils.json_to_sheet(txRows);

      // Sheet 2 — Summary
      const summaryRows = [
        { Concepto: "Ingresos", Monto: totals.income },
        { Concepto: "Gastos", Monto: totals.expense },
        { Concepto: "Balance", Monto: totals.income - totals.expense },
        { Concepto: "", Monto: "" },
        ...blockSummariesList.map((b) => ({
          Concepto: `Bloque: ${b.label}`,
          Monto: b.amount,
          Porcentaje: `${b.percent.toFixed(1)}%`,
        })),
      ];
      const ws2 = XLSX.utils.json_to_sheet(summaryRows);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
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
      </div>

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
              <p className="text-xs text-muted-foreground">PDF · Una página</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Incluye ingresos, gastos, balance, distribución de los 3 bloques y top 5 categorías del periodo.
          </p>
          <Button
            onClick={handleExportPDF}
            disabled={busy || isLoading}
            className="w-full gap-2"
          >
            {generatingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
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
              <p className="text-xs text-muted-foreground">Excel · Todos los registros</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Exporta todos los movimientos del periodo con fecha, descripción, categoría, cuenta y monto. Listo para contabilidad.
          </p>
          <Button
            onClick={handleExportExcel}
            disabled={busy || isLoading}
            variant="outline"
            className="w-full gap-2"
          >
            {generatingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
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
