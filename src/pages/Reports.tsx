import { useState, useMemo, useEffect, useRef } from "react";
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
import { PdfReportTemplate } from "@/components/reports/PdfReportTemplate";
import type { PdfReportData } from "@/components/reports/PdfReportData";
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
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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
      const jsPDFModule = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const jsPDF = jsPDFModule.default;
      const doc = new jsPDF({ unit: "mm", format: "letter" });

      const PAGE_W = doc.internal.pageSize.getWidth();
      const PAGE_H = doc.internal.pageSize.getHeight();
      const MARGIN = 16;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      const INK: [number, number, number] = [22, 22, 22];
      const INK_MID: [number, number, number] = [90, 90, 90];
      const INK_LIGHT: [number, number, number] = [170, 170, 170];
      const INK_GHOST: [number, number, number] = [235, 235, 235];
      const COVER_BG: [number, number, number] = [28, 44, 32];
      const COVER_TEXT: [number, number, number] = [210, 228, 212];
      const SAGE: [number, number, number] = [58, 90, 64];
      const GOLD: [number, number, number] = [175, 148, 80];
      const GREEN: [number, number, number] = [34, 120, 70];
      const GREEN_BG: [number, number, number] = [228, 245, 233];
      const RED: [number, number, number] = [175, 48, 48];
      const RED_BG: [number, number, number] = [248, 232, 232];
      const BLUE: [number, number, number] = [75, 88, 200];
      const BLUE_BG: [number, number, number] = [232, 235, 252];
      const STABILITY_L: [number, number, number] = [140, 175, 145];
      const LIFESTYLE_L: [number, number, number] = [160, 168, 225];
      const BUILD: [number, number, number] = [175, 148, 80];
      const BUILD_L: [number, number, number] = [215, 195, 140];
      const STABILITY: [number, number, number] = [58, 90, 64];
      const LIFESTYLE: [number, number, number] = [75, 88, 200];

      const fmtPdf = (n: number) =>
        formatCurrency(Math.round(n), "MXN").replace(/\.00$/, "");

      // ──────────────── PÁGINA 1 ────────────────

      // BLOQUE 1: Portada con fondo oscuro
      doc.setFillColor(...COVER_BG);
      doc.rect(0, 0, PAGE_W, 44, "F");
      doc.setTextColor(...COVER_TEXT);
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Finanzas con Sentido™", PAGE_W / 2, 12, { align: "center" });
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(19); doc.setFont("helvetica", "bold");
      doc.text(periodTitle, PAGE_W / 2, 22, { align: "center" });
      doc.setTextColor(...COVER_TEXT);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(periodLabel, PAGE_W / 2, 30, { align: "center" });
      doc.setTextColor(165, 190, 168);
      doc.setFontSize(7); doc.setFont("helvetica", "italic");
      doc.text(
        `Generado el ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`,
        PAGE_W / 2, 37, { align: "center" }
      );

      let y = 52;

      // BLOQUE 2: Tres KPIs
      const cardW = (CONTENT_W - 8) / 3;
      const cardH = 22;
      const balance = totals.income - totals.expense;
      const kpis = [
        { label: "INGRESOS", value: fmtPdf(totals.income), bg: GREEN_BG, accent: GREEN },
        { label: "GASTOS", value: fmtPdf(totals.expense), bg: RED_BG, accent: RED },
        { label: "BALANCE NETO", value: fmtPdf(balance), bg: balance >= 0 ? BLUE_BG : RED_BG, accent: balance >= 0 ? BLUE : RED },
      ];
      kpis.forEach((k, i) => {
        const x = MARGIN + i * (cardW + 4);
        doc.setFillColor(...k.bg);
        doc.rect(x, y, cardW, cardH, "F");
        doc.setDrawColor(...k.accent); doc.setLineWidth(2.5);
        doc.line(x, y, x, y + cardH);
        doc.setLineWidth(0.3);
        doc.setTextColor(...k.accent);
        doc.setFontSize(6); doc.setFont("helvetica", "bold");
        doc.text(k.label, x + 5, y + 7);
        doc.setTextColor(...INK);
        doc.setFontSize(15); doc.setFont("helvetica", "bold");
        doc.text(k.value, x + 5, y + 17);
      });
      y += cardH + 10;

      // BLOQUE 3: Distribución del gasto
      doc.setTextColor(...INK_MID);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("DISTRIBUCIÓN DEL GASTO", MARGIN, y);
      y += 3;
      doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.25);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 5;

      const blockColors: [number, number, number][] = [STABILITY, LIFESTYLE, BUILD];
      const blockColorsL: [number, number, number][] = [STABILITY_L, LIFESTYLE_L, BUILD_L];
      const BAR_W_BLOCK = CONTENT_W * 0.72;

      blockSummariesList.forEach((b, i) => {
        const bColor = blockColors[i] || INK_MID;
        const bColorL = blockColorsL[i] || INK_GHOST;
        doc.setTextColor(...bColor);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text(b.label, MARGIN, y);
        doc.text(`${b.percent.toFixed(1)}%`, PAGE_W - MARGIN - 32, y, { align: "right" });
        doc.setTextColor(...INK);
        doc.text(fmtPdf(b.amount), PAGE_W - MARGIN, y, { align: "right" });
        y += 4;
        doc.setFillColor(...INK_GHOST);
        doc.roundedRect(MARGIN, y, BAR_W_BLOCK, 4, 2, 2, "F");
        const safeW = Math.min(Math.max(b.percent / 100, 0), 1) * BAR_W_BLOCK;
        doc.setFillColor(...bColorL);
        doc.roundedRect(MARGIN, y, safeW, 4, 2, 2, "F");
        y += 4 + 7;
      });
      y += 2;

      // BLOQUE 4: Top 5 categorías de gasto
      doc.setTextColor(...INK_MID);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("TOP CATEGORÍAS DE GASTO", MARGIN, y);
      y += 3;
      doc.setDrawColor(...INK_LIGHT);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 5;

      const BAR_W_CAT = CONTENT_W * 0.70;
      topCategories.forEach((c, i) => {
        doc.setTextColor(...GOLD);
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(`#${i + 1}`, MARGIN, y);
        doc.setTextColor(...INK);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text(c.name, MARGIN + 7, y);
        doc.setTextColor(...INK_MID);
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(`${c.pct.toFixed(1)}%`, PAGE_W - MARGIN - 30, y, { align: "right" });
        doc.setTextColor(...INK);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text(fmtPdf(c.amount), PAGE_W - MARGIN, y, { align: "right" });
        y += 4;
        doc.setFillColor(...INK_GHOST);
        doc.roundedRect(MARGIN, y, BAR_W_CAT, 3, 1.5, 1.5, "F");
        const safeW = Math.min(Math.max(c.pct / 100, 0), 1) * BAR_W_CAT;
        doc.setFillColor(215, 190, 130);
        doc.roundedRect(MARGIN, y, safeW, 3, 1.5, 1.5, "F");
        y += 3 + 8;
      });

      // ──────────────── PÁGINA 2 ────────────────
      doc.addPage();
      y = 18;

      // BLOQUE 5: Panorama patrimonial — TODAS las cuentas activas, sin filtros
      const allActiveAccounts = accounts.filter(a => a.is_active);
      const assetTypes = ["cash", "bank", "savings", "investment"];
      const liabTypes = ["credit_card", "payable", "mortgage", "auto_loan", "personal_loan", "caucion_bursatil"];
      const activeAssets = allActiveAccounts.filter(a => assetTypes.includes(a.type));
      const activeLiabs = allActiveAccounts.filter(a => liabTypes.includes(a.type));

      doc.setTextColor(...INK_MID);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("PANORAMA PATRIMONIAL", MARGIN, y);
      y += 3;
      doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.25);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 5;

      // Activos
      doc.setTextColor(...SAGE);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text("Lo que tengo", MARGIN, y);
      y += 5;

      let totalActivos = 0;
      activeAssets.forEach(a => {
        const bal = a.current_balance ?? 0;
        totalActivos += bal;
        doc.setTextColor(...INK);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
        doc.text(a.name, MARGIN + 3, y);
        doc.setLineDashPattern([0.5, 1.5], 0);
        doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.2);
        const nameW = doc.getTextWidth(a.name);
        doc.line(MARGIN + 3 + nameW + 2, y - 0.5, PAGE_W - MARGIN - 30, y - 0.5);
        doc.setLineDashPattern([], 0);
        doc.setTextColor(bal > 0 ? GREEN[0] : INK_MID[0], bal > 0 ? GREEN[1] : INK_MID[1], bal > 0 ? GREEN[2] : INK_MID[2]);
        doc.setFont("helvetica", "bold");
        const suffix = a.currency !== "MXN" ? ` ${a.currency}` : "";
        doc.text(fmtPdf(bal) + suffix, PAGE_W - MARGIN, y, { align: "right" });
        y += 5;
      });

      doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 2;
      doc.setTextColor(...SAGE);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text("Total activos", MARGIN + 3, y);
      doc.setTextColor(...GREEN);
      doc.text(fmtPdf(totalActivos), PAGE_W - MARGIN, y, { align: "right" });
      y += 8;

      // Pasivos
      doc.setTextColor(...RED);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text("Lo que debo", MARGIN, y);
      y += 5;

      let totalPasivos = 0;
      activeLiabs.forEach(a => {
        const bal = Math.abs(a.current_balance ?? 0);
        totalPasivos += bal;
        doc.setTextColor(...INK);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
        doc.text(a.name, MARGIN + 3, y);
        doc.setLineDashPattern([0.5, 1.5], 0);
        doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.2);
        const nameW = doc.getTextWidth(a.name);
        doc.line(MARGIN + 3 + nameW + 2, y - 0.5, PAGE_W - MARGIN - 30, y - 0.5);
        doc.setLineDashPattern([], 0);
        doc.setTextColor(...RED);
        doc.setFont("helvetica", "bold");
        doc.text(fmtPdf(bal), PAGE_W - MARGIN, y, { align: "right" });
        y += 5;
      });

      doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 2;
      doc.setTextColor(...RED);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text("Total pasivos", MARGIN + 3, y);
      doc.text(fmtPdf(totalPasivos), PAGE_W - MARGIN, y, { align: "right" });
      y += 6;

      // Línea doble + patrimonio neto
      doc.setDrawColor(...SAGE); doc.setLineWidth(0.5);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 1.5;
      doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 5;
      const neto = totalActivos - totalPasivos;
      doc.setTextColor(...INK);
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("PATRIMONIO NETO", MARGIN, y);
      doc.setTextColor(neto >= 0 ? SAGE[0] : RED[0], neto >= 0 ? SAGE[1] : RED[1], neto >= 0 ? SAGE[2] : RED[2]);
      doc.setFontSize(12);
      doc.text(fmtPdf(neto), PAGE_W - MARGIN, y, { align: "right" });
      y += 12;

      // BLOQUE 6: Metas de construcción activas
      const activeGoals = goals.filter(g => g.is_active);
      if (activeGoals.length > 0) {
        if (y > PAGE_H - 50) { doc.addPage(); y = 18; }
        doc.setTextColor(...INK_MID);
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text("CONSTRUCCIÓN PATRIMONIAL", MARGIN, y);
        y += 3;
        doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.25);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 5;

        const BAR_W_GOAL = CONTENT_W * 0.75;
        activeGoals.slice(0, 4).forEach(g => {
          const pct = g.target_amount > 0 ? Math.min(g.current_amount / g.target_amount, 1) : 0;
          doc.setTextColor(...INK);
          doc.setFontSize(8); doc.setFont("helvetica", "bold");
          doc.text(g.name, MARGIN, y);
          doc.setTextColor(...INK_MID);
          doc.setFontSize(7); doc.setFont("helvetica", "normal");
          doc.text(`${fmtPdf(g.current_amount)} / ${fmtPdf(g.target_amount)}`, PAGE_W - MARGIN, y, { align: "right" });
          y += 4;
          doc.setFillColor(...INK_GHOST);
          doc.roundedRect(MARGIN, y, BAR_W_GOAL, 3.5, 1.5, 1.5, "F");
          doc.setFillColor(...BUILD_L);
          doc.roundedRect(MARGIN, y, pct * BAR_W_GOAL, 3.5, 1.5, 1.5, "F");
          doc.setTextColor(...BUILD);
          doc.setFontSize(7); doc.setFont("helvetica", "bold");
          doc.text(`${(pct * 100).toFixed(0)}%`, PAGE_W - MARGIN, y + 3, { align: "right" });
          y += 3.5 + 3;
          if (g.monthly_contribution && g.monthly_contribution > 0) {
            const rem = g.target_amount - g.current_amount;
            const months = rem > 0 ? Math.ceil(rem / g.monthly_contribution) : 0;
            if (months > 0) {
              doc.setTextColor(...INK_MID);
              doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
              doc.text(`Aportando ${fmtPdf(g.monthly_contribution)}/mes → ${months} meses para completar`, MARGIN, y);
              y += 4;
            }
          }
          y += 6;
        });
      }

      // BLOQUE 7: Tabla de ingresos
      if (y > PAGE_H - 60) { doc.addPage(); y = 18; }
      doc.setTextColor(...INK_MID);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("INGRESOS DEL PERIODO", MARGIN, y);
      y += 3;
      doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.25);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 3;

      const incomeTxs = transactions
        .filter(t => t.type === "income")
        .sort((a, b) => (b.amount_in_base ?? b.amount) - (a.amount_in_base ?? a.amount));

      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Descripción", "Cuenta", "Monto"]],
        body: incomeTxs.length > 0
          ? incomeTxs.map(tx => [
            tx.transaction_date,
            tx.description || categoryMap[tx.category_id ?? ""] || "—",
            accountMap[tx.account_id] || "",
            fmtPdf(tx.amount_in_base ?? tx.amount),
          ])
          : [["", "Sin ingresos en este periodo", "", ""]],
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 7.5, textColor: INK },
        headStyles: {
          fillColor: SAGE,
          textColor: [255, 255, 255] as [number, number, number],
          fontSize: 7.5, fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [238, 246, 240] as [number, number, number] },
        columnStyles: {
          0: { cellWidth: 22 },
          2: { cellWidth: 36 },
          3: { cellWidth: 32, halign: "right" },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // BLOQUE 8: Top 20 gastos en dos columnas
      if (y > PAGE_H - 60) { doc.addPage(); y = 18; }
      doc.setTextColor(...INK_MID);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("TOP GASTOS DEL PERIODO", MARGIN, y);
      y += 3;
      doc.setDrawColor(...INK_LIGHT); doc.setLineWidth(0.25);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 3;

      const expenseTxs = transactions
        .filter(t => t.type === "expense")
        .sort((a, b) => (b.amount_in_base ?? b.amount) - (a.amount_in_base ?? a.amount))
        .slice(0, 20);
      const COL_W = (CONTENT_W - 6) / 2;
      const leftExp = expenseTxs.slice(0, 10);
      const rightExp = expenseTxs.slice(10, 20);

      const expOpts = (rows: typeof leftExp, idx: number, mL: number, mR: number) => ({
        startY: y,
        head: [["#", "Descripción", "Monto"]],
        body: rows.map((tx, i) => [
          String(i + 1 + idx * 10),
          tx.description || categoryMap[tx.category_id ?? ""] || "—",
          fmtPdf(tx.amount_in_base ?? tx.amount),
        ]),
        margin: { left: mL, right: mR },
        styles: { fontSize: 7.5, textColor: INK },
        headStyles: {
          fillColor: [148, 38, 38] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontSize: 7.5, fontStyle: "bold" as const,
        },
        alternateRowStyles: { fillColor: [250, 240, 240] as [number, number, number] },
        columnStyles: {
          0: { cellWidth: 8 },
          2: { cellWidth: 22, halign: "right" as const },
        },
        tableWidth: COL_W,
      });

      if (leftExp.length > 0)
        autoTable(doc, expOpts(leftExp, 0, MARGIN, PAGE_W - MARGIN - COL_W - 3));
      if (rightExp.length > 0)
        autoTable(doc, expOpts(rightExp, 1, MARGIN + COL_W + 6, MARGIN));

      // FOOTER en todas las páginas
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const fy = PAGE_H - 10;
        doc.setDrawColor(...SAGE); doc.setLineWidth(0.3);
        doc.line(MARGIN, fy - 4, PAGE_W - MARGIN, fy - 4);
        doc.setTextColor(...SAGE);
        doc.setFontSize(7); doc.setFont("helvetica", "italic");
        doc.text("Tu dinero con calma. Tu vida con sentido.", MARGIN, fy);
        doc.setTextColor(...INK_LIGHT);
        doc.setFontSize(6); doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${totalPages}`, PAGE_W / 2, fy, { align: "center" });
        doc.setTextColor(...GOLD);
        doc.setFontSize(6);
        doc.text("finanzasconsentidoscf.com", PAGE_W - MARGIN, fy, { align: "right" });
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
