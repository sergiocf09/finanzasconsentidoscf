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

      // Letter size instead of A4
      const doc = new jsPDF({ unit: "mm", format: "letter" });

      const DARK: [number, number, number] = [30, 30, 30];
      const MID: [number, number, number] = [70, 70, 70];
      const LIGHT: [number, number, number] = [200, 200, 200];
      // Brand colors — sage green + gold
      const SAGE_DARK: [number, number, number] = [58, 90, 64];
      const SAGE_MID: [number, number, number] = [85, 120, 90];
      const GOLD: [number, number, number] = [180, 155, 90];
      const INCOME_GREEN: [number, number, number] = [34, 139, 84];
      const EXPENSE_RED: [number, number, number] = [165, 42, 42];
      const ACCENT: [number, number, number] = [99, 102, 241];
      // Block colors
      const STABILITY_COLOR: [number, number, number] = [58, 90, 64];
      const LIFESTYLE_COLOR: [number, number, number] = [99, 102, 241];
      const BUILD_COLOR: [number, number, number] = [180, 155, 90];
      const PAGE_W = doc.internal.pageSize.getWidth();
      const PAGE_H = doc.internal.pageSize.getHeight();
      const MARGIN = 16;
      const COL_W = (PAGE_W - MARGIN * 2 - 6) / 2;

      // === SECTION 1 — Clean header (no background, just text) ===
      const mesLabel = format(startDate, "MMMM yyyy", { locale: es });
      const mesCapLabel = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
      let y = 18;
      doc.setTextColor(...SAGE_DARK);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("Finanzas con Sentido™", PAGE_W / 2, y, { align: "center" });
      y += 7;
      doc.setTextColor(...DARK);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(mesCapLabel, PAGE_W / 2, y, { align: "center" });
      y += 5;
      doc.setTextColor(...MID);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Generado el ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`, PAGE_W / 2, y, { align: "center" });
      y += 9;

      // === SECTION 2 — Summary cards (Title Case, bigger labels) ===
      const cardW = 56;
      const cardH = 22;
      const gap = (PAGE_W - MARGIN * 2 - cardW * 3) / 2;
      const balance = totals.income - totals.expense;

      const cards = [
        { label: "Ingresos", value: formatCurrency(totals.income, "MXN", { decimals: 2 }), color: INCOME_GREEN },
        { label: "Gastos", value: formatCurrency(totals.expense, "MXN", { decimals: 2 }), color: EXPENSE_RED },
        { label: "Balance", value: formatCurrency(balance, "MXN", { decimals: 2 }), color: balance >= 0 ? ACCENT : EXPENSE_RED },
      ];

      const cardsY = y;
      cards.forEach((card, i) => {
        const x = MARGIN + i * (cardW + gap);
        doc.setDrawColor(...card.color);
        doc.setLineWidth(0.6);
        doc.roundedRect(x, cardsY, cardW, cardH, 2, 2, "S");
        doc.setTextColor(...MID);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(card.label, x + cardW / 2, cardsY + 8, { align: "center" });
        doc.setTextColor(...card.color);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text(card.value, x + cardW / 2, cardsY + 17, { align: "center" });
      });

      // === SECTION 3 — Arrow from Gastos → 3 block cards (no title) ===
      y = cardsY + cardH;
      const blockColors: [number, number, number][] = [STABILITY_COLOR, LIFESTYLE_COLOR, BUILD_COLOR];

      if (blockSummariesList.length > 0) {
        const gastosCenterX = MARGIN + 1 * (cardW + gap) + cardW / 2;
        const arrowStartY = y + 1;
        const arrowMidY = arrowStartY + 5;
        const blockCardH = 24;
        const blockCardW = cardW;
        const blockCardsY = arrowMidY + 5;

        // Vertical line down from Gastos card
        doc.setDrawColor(...MID);
        doc.setLineWidth(0.4);
        doc.line(gastosCenterX, arrowStartY, gastosCenterX, arrowMidY);

        // Horizontal line spanning all 3 block card centers
        const block0CenterX = MARGIN + blockCardW / 2;
        const block2CenterX = MARGIN + 2 * (blockCardW + gap) + blockCardW / 2;
        doc.line(block0CenterX, arrowMidY, block2CenterX, arrowMidY);

        // 3 vertical lines down + arrowheads
        blockSummariesList.forEach((_, i) => {
          const cx = MARGIN + i * (blockCardW + gap) + blockCardW / 2;
          doc.line(cx, arrowMidY, cx, blockCardsY);
          doc.setFillColor(...MID);
          doc.triangle(cx - 1.2, blockCardsY - 1.5, cx + 1.2, blockCardsY - 1.5, cx, blockCardsY, "F");
        });

        // Block cards (bigger labels + percentage)
        blockSummariesList.forEach((b, i) => {
          const x = MARGIN + i * (blockCardW + gap);
          const bColor = blockColors[i] || MID;
          doc.setDrawColor(...bColor);
          doc.setLineWidth(0.6);
          doc.roundedRect(x, blockCardsY, blockCardW, blockCardH, 2, 2, "S");
          doc.setTextColor(...bColor);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(b.label, x + blockCardW / 2, blockCardsY + 7, { align: "center" });
          doc.setTextColor(...DARK);
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.text(formatCurrency(b.amount, "MXN", { decimals: 2 }), x + blockCardW / 2, blockCardsY + 14, { align: "center" });
          doc.setTextColor(...bColor);
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(`${b.percent.toFixed(1)}%`, x + blockCardW / 2, blockCardsY + 21, { align: "center" });
        });
        y = blockCardsY + blockCardH + 6;
      } else {
        y += 8;
      }

      // === SECTION 4 — Income table ===
      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Ingresos del Periodo", MARGIN, y);
      y += 2;
      doc.setDrawColor(...LIGHT);
      doc.setLineWidth(0.3);
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
        styles: { fontSize: 8, textColor: DARK },
        headStyles: { fillColor: INCOME_GREEN, textColor: [255, 255, 255] as [number, number, number], fontSize: 8, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 250, 247] as [number, number, number] },
        columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 38 }, 3: { cellWidth: 35, halign: "right" } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // === SECTION 5 — Top 20 expenses in two columns ===
      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Top Gastos del Periodo", MARGIN, y);
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
        styles: { fontSize: 8, textColor: DARK },
        headStyles: { fillColor: EXPENSE_RED, textColor: [255, 255, 255] as [number, number, number], fontSize: 8, fontStyle: "bold" as const },
        alternateRowStyles: { fillColor: [252, 245, 245] as [number, number, number] },
        columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 24, halign: "right" as const } },
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
      doc.setDrawColor(...SAGE_MID);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
      doc.setTextColor(...SAGE_DARK);
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.text("Tu dinero con calma. Tu vida con sentido.", PAGE_W / 2, PAGE_H - 10, { align: "center" });
      doc.setTextColor(...GOLD);
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
      const fmtNum = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const mesLabel = format(startDate, "MMMM yyyy", { locale: es });
      const mesCapitalized = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
      const generatedDate = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });

      // === Sheet 1 — Movimientos ===
      // Header rows at the top
      const headerAoa: (string | number)[][] = [
        ["FINANZAS CON SENTIDO™ — Movimientos " + mesCapitalized],
        ["Periodo:", periodLabel, "", "Movimientos:", transactions.length, "Generado:", generatedDate],
        [], // blank row before data
        ["#", "Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Monto", "Moneda"],
      ];

      // Transaction data rows with row numbers and formatted amounts
      const txDataRows: (string | number)[][] = transactions.map((tx, i) => [
        i + 1,
        tx.transaction_date,
        tx.type === "income" ? "Ingreso" : tx.type === "expense" ? "Gasto" : tx.type === "transfer" ? "Transferencia" : tx.type,
        tx.description || "",
        tx.category_id ? categoryMap[tx.category_id] || "" : "",
        accountMap[tx.account_id] || "",
        fmtNum(tx.amount_in_base ?? tx.amount),
        tx.currency,
      ]);

      const allRows = [...headerAoa, ...txDataRows];
      const ws1 = XLSX.utils.aoa_to_sheet(allRows);

      // Column widths (now with # column)
      const colHeaders = ["#", "Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Monto", "Moneda"];
      const colWidths = colHeaders.map((h, ci) => {
        const maxDataLen = txDataRows.reduce((max, row) => {
          const val = String(row[ci] ?? "");
          return Math.max(max, val.length);
        }, h.length);
        return { wch: Math.min(maxDataLen + 2, 50) };
      });
      ws1["!cols"] = colWidths;

      // Merge title row (A1:H1)
      ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

      // === Sheet 2 — Resumen (redesigned: info at top, not bottom) ===
      const summaryAoa: (string | number | string)[][] = [
        ["FINANZAS CON SENTIDO™"],
        ["Resumen financiero — " + mesCapitalized],
        [],
        ["Periodo:", periodLabel],
        ["Movimientos totales:", transactions.length],
        ["Generado:", generatedDate],
        [],
        ["RESUMEN DEL PERIODO", "", ""],
        ["Ingresos", fmtNum(totals.income), ""],
        ["Gastos", fmtNum(totals.expense), ""],
        ["Balance", fmtNum(totals.income - totals.expense), ""],
        [],
        ["DISTRIBUCIÓN POR BLOQUES", "Monto", "% del gasto"],
        ...blockSummariesList.map((b) => [b.label, fmtNum(b.amount), `${b.percent.toFixed(1)}%`]),
        [],
        ["TOP CATEGORÍAS DE GASTO", "Monto", "% del gasto"],
        ...topCategories.map((c) => [c.name, fmtNum(c.amount), `${c.pct.toFixed(1)}%`]),
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(summaryAoa);
      ws2["!cols"] = [{ wch: 35 }, { wch: 22 }, { wch: 15 }];
      // Merge title across columns
      ws2["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      ];

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
