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

      const DARK: [number, number, number] = [30, 30, 30];
      const MID: [number, number, number] = [90, 90, 90];
      const LIGHT: [number, number, number] = [200, 200, 200];
      const INCOME_GREEN: [number, number, number] = [34, 139, 84];
      const EXPENSE_RED: [number, number, number] = [185, 28, 28];
      const ACCENT: [number, number, number] = [99, 102, 241];
      const PAGE_W = doc.internal.pageSize.getWidth();
      const PAGE_H = doc.internal.pageSize.getHeight();
      const MARGIN = 14;
      const COL_W = (PAGE_W - MARGIN * 2 - 6) / 2;

      // === SECTION 1 — Dark header ===
      doc.setFillColor(...DARK);
      doc.rect(0, 0, PAGE_W, 26, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("FINANZAS CON SENTIDO™", PAGE_W / 2, 11, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const mesLabel = format(startDate, "MMMM yyyy", { locale: es });
      doc.text(mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1), PAGE_W / 2, 17, { align: "center" });
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(7);
      doc.text(`Generado el ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`, PAGE_W / 2, 23, { align: "center" });

      // === SECTION 2 — Summary cards ===
      let y = 34;
      const cardW = 56;
      const cardH = 18;
      const gap = (PAGE_W - MARGIN * 2 - cardW * 3) / 2;
      const balance = totals.income - totals.expense;

      const cards = [
        { label: "INGRESOS", value: formatCurrency(totals.income, "MXN", { decimals: 2 }), color: INCOME_GREEN },
        { label: "GASTOS", value: formatCurrency(totals.expense, "MXN", { decimals: 2 }), color: EXPENSE_RED },
        { label: "BALANCE", value: formatCurrency(balance, "MXN", { decimals: 2 }), color: balance >= 0 ? ACCENT : EXPENSE_RED },
      ];

      cards.forEach((card, i) => {
        const x = MARGIN + i * (cardW + gap);
        doc.setDrawColor(...card.color);
        doc.setLineWidth(0.6);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");
        doc.setTextColor(...MID);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(card.label, x + cardW / 2, y + 6, { align: "center" });
        doc.setTextColor(...card.color);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(card.value, x + cardW / 2, y + 13, { align: "center" });
      });

      // === SECTION 3 — Block distribution ===
      y = 58;
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("DISTRIBUCIÓN POR BLOQUES", MARGIN, y);
      y += 2;
      doc.setDrawColor(...LIGHT);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 6;

      if (blockSummariesList.length > 0) {
        const blockColW = (PAGE_W - MARGIN * 2) / blockSummariesList.length;
        blockSummariesList.forEach((b, i) => {
          const x = MARGIN + i * blockColW;
          doc.setTextColor(...MID);
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.text(b.label, x + 2, y);
          doc.setTextColor(...DARK);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(formatCurrency(b.amount, "MXN", { decimals: 2 }), x + 2, y + 5);
          doc.setTextColor(...MID);
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.text(`${b.percent.toFixed(1)}%`, x + 2, y + 10);
        });
      }

      // === SECTION 4 — Income table (full width) ===
      y = 82;
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("INGRESOS DEL PERIODO", MARGIN, y);
      y += 2;
      doc.setDrawColor(...LIGHT);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 3;

      const incomeTxs = transactions
        .filter((t) => t.type === "income")
        .sort((a, b) => (b.amount_in_base ?? b.amount) - (a.amount_in_base ?? a.amount));

      const incomeRows = incomeTxs.length > 0
        ? incomeTxs.map((tx) => [
            tx.transaction_date,
            tx.description || categoryMap[tx.category_id ?? ""] || "—",
            accountMap[tx.account_id] || "",
            formatCurrency(tx.amount_in_base ?? tx.amount, "MXN", { decimals: 2 }),
          ])
        : [["", "Sin ingresos en este periodo", "", ""]];

      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Descripción", "Cuenta", "Monto"]],
        body: incomeRows,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 7, textColor: MID },
        headStyles: { fillColor: INCOME_GREEN, textColor: [255, 255, 255], fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 250, 247] },
        columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 40 }, 3: { cellWidth: 35, halign: "right" } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // === SECTION 5 — Top 20 expenses in two columns ===
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("TOP GASTOS DEL PERIODO", MARGIN, y);
      y += 2;
      doc.setDrawColor(...LIGHT);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 3;

      const expenseTxs = transactions
        .filter((t) => t.type === "expense")
        .sort((a, b) => (b.amount_in_base ?? b.amount) - (a.amount_in_base ?? a.amount))
        .slice(0, 20);

      const leftExpenses = expenseTxs.slice(0, 10);
      const rightExpenses = expenseTxs.slice(10, 20);

      const expenseTableOpts = (rows: typeof leftExpenses, marginLeft: number, marginRight: number) => ({
        startY: y,
        head: [["#", "Descripción", "Monto"]],
        body: rows.map((tx, i) => [
          String(i + 1),
          tx.description || categoryMap[tx.category_id ?? ""] || "—",
          formatCurrency(tx.amount_in_base ?? tx.amount, "MXN", { decimals: 2 }),
        ]),
        margin: { left: marginLeft, right: marginRight },
        styles: { fontSize: 7, textColor: MID },
        headStyles: { fillColor: EXPENSE_RED, textColor: [255, 255, 255], fontSize: 7 },
        alternateRowStyles: { fillColor: [252, 245, 245] },
        columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 22, halign: "right" as const } },
        tableWidth: COL_W as number,
      });

      if (leftExpenses.length > 0) {
        autoTable(doc, expenseTableOpts(leftExpenses, MARGIN, PAGE_W - MARGIN - COL_W - 3));
      }
      if (rightExpenses.length > 0) {
        autoTable(doc, {
          ...expenseTableOpts(rightExpenses, MARGIN + COL_W + 6, MARGIN),
          body: rightExpenses.map((tx, i) => [
            String(i + 11),
            tx.description || categoryMap[tx.category_id ?? ""] || "—",
            formatCurrency(tx.amount_in_base ?? tx.amount, "MXN", { decimals: 2 }),
          ]),
        });
      }

      // === Footer ===
      doc.setDrawColor(...LIGHT);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
      doc.setTextColor(...MID);
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.text("Tu dinero con calma. Tu vida con sentido.", PAGE_W / 2, PAGE_H - 10, { align: "center" });
      doc.setTextColor(...LIGHT);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("finanzas con sentido™", PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });

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

      // Auto-fit column widths
      const headers = ["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Monto", "Moneda"];
      const colWidths = headers.map((h) => {
        const maxDataLen = txRows.reduce((max, row) => {
          const val = String((row as any)[h] ?? "");
          return Math.max(max, val.length);
        }, h.length);
        return { wch: Math.min(maxDataLen + 2, 50) };
      });
      ws1["!cols"] = colWidths;

      // Sheet 2 — Summary (editorial layout with aoa_to_sheet)
      const mesLabel = format(startDate, "MMMM yyyy", { locale: es });
      const summaryAoa: (string | number)[][] = [
        ["FINANZAS CON SENTIDO™ — Resumen " + mesLabel],
        [""],
        ["RESUMEN DEL PERIODO", ""],
        ["Ingresos", totals.income],
        ["Gastos", totals.expense],
        ["Balance", totals.income - totals.expense],
        [""],
        ["DISTRIBUCIÓN POR BLOQUES", "", "% del gasto"],
        ...blockSummariesList.map((b) => [b.label, b.amount, `${b.percent.toFixed(1)}%`]),
        [""],
        ["TOP CATEGORÍAS DE GASTO", "", "% del gasto"],
        ...topCategories.map((c) => [c.name, c.amount, `${c.pct.toFixed(1)}%`]),
        [""],
        ["Periodo:", periodLabel],
        ["Movimientos totales:", transactions.length],
        ["Generado:", format(new Date(), "d MMM yyyy, HH:mm", { locale: es })],
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(summaryAoa);
      ws2["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }];
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
