import { useState, useMemo, useEffect } from "react";
import { FileText, Table, Download, Loader2, CalendarDays } from "lucide-react";
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

  // ─── PDF Export (jsPDF vectorial + autoTable) ───
  const handleExportPDF = async () => {
    setGeneratingPdf(true);
    try {
      const jsPDFModule = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const jsPDF = jsPDFModule.default;
      const doc = new jsPDF({ unit: "mm", format: "letter" });

      const PAGE_W = doc.internal.pageSize.getWidth();
      const PAGE_H = doc.internal.pageSize.getHeight();
      const M = 16; // margin
      const CW = PAGE_W - M * 2; // content width

      // Color palette
      const INK: [number,number,number]       = [22, 22, 22];
      const INK_MID: [number,number,number]   = [90, 90, 90];
      const INK_LIGHT: [number,number,number] = [170, 170, 170];
      const INK_GHOST: [number,number,number] = [235, 235, 235];
      const COVER_BG: [number,number,number]  = [28, 44, 32];
      const COVER_TXT: [number,number,number] = [210, 228, 212];
      const SAGE: [number,number,number]      = [58, 90, 64];
      const GOLD: [number,number,number]      = [175, 148, 80];
      const GREEN: [number,number,number]     = [34, 120, 70];
      const GREEN_BG: [number,number,number]  = [228, 245, 233];
      const RED: [number,number,number]       = [175, 48, 48];
      const RED_BG: [number,number,number]    = [248, 232, 232];
      const BLUE: [number,number,number]      = [75, 88, 200];
      const BLUE_BG: [number,number,number]   = [232, 235, 252];
      const STAB: [number,number,number]      = [58, 90, 64];
      const STAB_L: [number,number,number]    = [140, 175, 145];
      const LIFE: [number,number,number]      = [75, 88, 200];
      const LIFE_L: [number,number,number]    = [160, 168, 225];
      const BUILD: [number,number,number]     = [175, 148, 80];
      const BUILD_L: [number,number,number]   = [215, 195, 140];

      const fmtP = (n: number) =>
        new Intl.NumberFormat("es-MX", {
          style: "currency", currency: "MXN",
          minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(Math.round(n));

      const sectionTitle = (text: string, yPos: number) => {
        doc.setTextColor(...INK_MID);
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(text, M, yPos);
        const ly = yPos + 2;
        doc.setDrawColor(...INK_GHOST); doc.setLineWidth(0.2);
        doc.line(M, ly, PAGE_W - M, ly);
        return ly + 4;
      };

      // ════════════════════════════════════════════
      // PAGE 1 — Cover + KPIs + Blocks + Top cats
      // ════════════════════════════════════════════

      // Cover band
      doc.setFillColor(...COVER_BG);
      doc.rect(0, 0, PAGE_W, 42, "F");
      doc.setTextColor(...COVER_TXT);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text("Finanzas con Sentido™", PAGE_W / 2, 11, { align: "center" });
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text(periodTitle, PAGE_W / 2, 21, { align: "center" });
      doc.setTextColor(...COVER_TXT);
      doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
      doc.text("Tu fotografía financiera", PAGE_W / 2, 27, { align: "center" });
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(periodLabel, PAGE_W / 2, 32, { align: "center" });
      doc.setTextColor(165, 190, 168);
      doc.setFontSize(6);
      doc.text(
        `Generado el ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`,
        PAGE_W / 2, 37, { align: "center" }
      );

      let y = 50;

      // KPI cards
      const balance = totals.income - totals.expense;
      const cardW = (CW - 6) / 3;
      const cardH = 20;
      const kpis = [
        { label: "INGRESOS ▲", value: fmtP(totals.income), bg: GREEN_BG, ac: GREEN },
        { label: "GASTOS ▼", value: fmtP(totals.expense), bg: RED_BG, ac: RED },
        { label: "BALANCE NETO", value: fmtP(balance),
          bg: balance >= 0 ? BLUE_BG : RED_BG,
          ac: balance >= 0 ? BLUE : RED },
      ];
      kpis.forEach((k, i) => {
        const x = M + i * (cardW + 3);
        doc.setFillColor(...k.bg);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
        doc.setDrawColor(...k.ac); doc.setLineWidth(1.5);
        doc.line(x, y + 1, x, y + cardH - 1);
        doc.setLineWidth(0.2);
        doc.setTextColor(...k.ac);
        doc.setFontSize(5.5); doc.setFont("helvetica", "bold");
        doc.text(k.label, x + 4, y + 6);
        doc.setTextColor(...INK);
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text(k.value, x + 4, y + 14);
      });
      // Balance percentage
      if (totals.income > 0) {
        const bPct = ((balance / totals.income) * 100).toFixed(1);
        const bx = M + 2 * (cardW + 3);
        doc.setTextColor(...(balance >= 0 ? BLUE : RED));
        doc.setFontSize(6); doc.setFont("helvetica", "normal");
        doc.text(`${bPct}% del ingreso`, bx + 4, y + 18);
      }
      y += cardH + 10;

      // Block distribution
      y = sectionTitle("DISTRIBUCIÓN DEL GASTO", y);
      const blockColors: [number,number,number][] = [STAB, LIFE, BUILD];
      const blockColorsL: [number,number,number][] = [STAB_L, LIFE_L, BUILD_L];
      const BAR_W = CW * 0.72;

      blockSummariesList.forEach((b, i) => {
        doc.setTextColor(...blockColors[i]);
        doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
        doc.text(b.label, M, y);
        doc.text(`${b.percent.toFixed(1)}%`, PAGE_W - M - 30, y, { align: "right" });
        doc.setTextColor(...INK);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(fmtP(b.amount), PAGE_W - M, y, { align: "right" });
        y += 3;
        doc.setFillColor(...INK_GHOST);
        doc.roundedRect(M, y, BAR_W, 3, 1.5, 1.5, "F");
        const sw = Math.min(Math.max(b.percent / 100, 0), 1) * BAR_W;
        if (sw > 0) {
          doc.setFillColor(...blockColorsL[i]);
          doc.roundedRect(M, y, sw, 3, 1.5, 1.5, "F");
        }
        y += 3 + 6;
      });
      y += 2;

      // Top 5 categories
      y = sectionTitle("TOP CATEGORÍAS DE GASTO", y);
      const BAR_CAT = CW * 0.36;
      const maxPct = topCategories.length > 0 ? topCategories[0].pct : 1;

      topCategories.forEach((c, i) => {
        const rx = M;
        doc.setTextColor(i === 0 ? GOLD[0] : INK_LIGHT[0], i === 0 ? GOLD[1] : INK_LIGHT[1], i === 0 ? GOLD[2] : INK_LIGHT[2]);
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(`#${i + 1}`, rx, y);

        doc.setTextColor(...INK);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        const nameMaxW = 42;
        const nameText = doc.getTextWidth(c.name) > nameMaxW
          ? c.name.substring(0, 20) + "…" : c.name;
        doc.text(nameText, rx + 7, y);

        // Bar
        const barX = rx + 52;
        doc.setFillColor(...INK_GHOST);
        doc.roundedRect(barX, y - 2, BAR_CAT, 2.5, 1, 1, "F");
        const normW = maxPct > 0 ? (c.pct / maxPct) * BAR_CAT : 0;
        if (normW > 0) {
          doc.setFillColor(215, 190, 130);
          doc.roundedRect(barX, y - 2, normW, 2.5, 1, 1, "F");
        }

        doc.setTextColor(...INK_MID);
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(`${c.pct.toFixed(1)}%`, barX + BAR_CAT + 3, y);

        doc.setTextColor(...INK);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text(fmtP(c.amount), PAGE_W - M, y, { align: "right" });

        y += 7;
      });

      // ════════════════════════════════════════════
      // PAGE 2 — Patrimonial snapshot
      // ════════════════════════════════════════════
      doc.addPage();

      // Header band
      doc.setFillColor(...COVER_BG);
      doc.rect(0, 0, PAGE_W, 12, "F");
      doc.setTextColor(...COVER_TXT);
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text(`FOTOGRAFÍA PATRIMONIAL — ${periodTitle}`, M, 8);

      y = 20;

      const allActive = accounts.filter(a => a.is_active);
      const pdfAssets = allActive.filter(a => isAssetType(a.type));
      const pdfLiabs = allActive.filter(a => isLiability(a.type));
      const activeNfa = nfAssets.filter(a => a.is_active);

      const colW = (CW - 10) / 2;
      const colL = M;
      const colR = M + colW + 10;

      // ── Left column: Assets ──
      doc.setTextColor(...SAGE);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text("LO QUE TENGO", colL, y);

      // ── Right column: Liabilities ──
      doc.setTextColor(...RED);
      doc.text("LO QUE DEBO", colR, y);
      y += 5;

      let yL = y;
      let yR = y;

      // Assets - financial
      doc.setTextColor(...INK_LIGHT);
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.text("Cuentas financieras", colL, yL);
      yL += 4;

      let totalFinAct = 0;
      pdfAssets.forEach(a => {
        const bal = a.current_balance ?? 0;
        totalFinAct += convertToMXN(bal, a.currency);
        doc.setTextColor(...INK);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
        doc.text(a.name, colL, yL);
        // dotted line
        const nw = doc.getTextWidth(a.name);
        doc.setDrawColor(...INK_GHOST); doc.setLineWidth(0.15);
        doc.setLineDashPattern([0.4, 1.2], 0);
        doc.line(colL + nw + 1, yL - 0.5, colL + colW - 22, yL - 0.5);
        doc.setLineDashPattern([], 0);
        // amount
        doc.setTextColor(...GREEN);
        doc.setFont("helvetica", "bold");
        const suffix = a.currency !== "MXN" ? ` ${a.currency}` : "";
        doc.text(fmtP(bal) + suffix, colL + colW, yL, { align: "right" });
        yL += 4.5;
      });

      // Total financial
      doc.setDrawColor(...INK_GHOST); doc.setLineWidth(0.2);
      doc.line(colL, yL, colL + colW, yL);
      yL += 3;
      doc.setTextColor(...SAGE);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("Total cuentas", colL, yL);
      doc.setTextColor(...GREEN);
      doc.setFontSize(8);
      doc.text(fmtP(totalFinAct), colL + colW, yL, { align: "right" });
      yL += 5;

      // NFA
      let totalNFA = 0;
      if (activeNfa.length > 0) {
        doc.setTextColor(...INK_LIGHT);
        doc.setFontSize(6); doc.setFont("helvetica", "normal");
        doc.text("Activos no financieros", colL, yL);
        yL += 4;
        activeNfa.forEach(a => {
          const val = convertToMXN(a.current_value, a.currency);
          totalNFA += val;
          doc.setTextColor(...INK);
          doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
          doc.text(a.name, colL, yL);
          const nw = doc.getTextWidth(a.name);
          doc.setDrawColor(...INK_GHOST); doc.setLineWidth(0.15);
          doc.setLineDashPattern([0.4, 1.2], 0);
          doc.line(colL + nw + 1, yL - 0.5, colL + colW - 22, yL - 0.5);
          doc.setLineDashPattern([], 0);
          doc.setTextColor(...SAGE);
          doc.setFont("helvetica", "bold");
          const sfx = a.currency !== "MXN" ? ` ${a.currency}` : "";
          doc.text(fmtP(a.current_value) + sfx, colL + colW, yL, { align: "right" });
          yL += 4.5;
        });
        doc.setDrawColor(...INK_GHOST); doc.setLineWidth(0.2);
        doc.line(colL, yL, colL + colW, yL);
        yL += 3;
        doc.setTextColor(...SAGE);
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text("Total no financiero", colL, yL);
        doc.text(fmtP(totalNFA), colL + colW, yL, { align: "right" });
        yL += 5;
      }

      // Total assets double line
      const totalActivos = totalFinAct + totalNFA;
      doc.setDrawColor(...SAGE); doc.setLineWidth(0.4);
      doc.line(colL, yL, colL + colW, yL); yL += 1.2;
      doc.line(colL, yL, colL + colW, yL); yL += 4;
      doc.setTextColor(...SAGE);
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("TOTAL ACTIVOS", colL, yL);
      doc.setFontSize(10);
      doc.text(fmtP(totalActivos), colL + colW, yL, { align: "right" });

      // Liabilities (right column)
      let totalPasivos = 0;
      pdfLiabs.forEach(a => {
        const bal = Math.abs(a.current_balance ?? 0);
        totalPasivos += convertToMXN(bal, a.currency);
        doc.setTextColor(...INK);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
        doc.text(a.name, colR, yR);
        const nw = doc.getTextWidth(a.name);
        doc.setDrawColor(...INK_GHOST); doc.setLineWidth(0.15);
        doc.setLineDashPattern([0.4, 1.2], 0);
        doc.line(colR + nw + 1, yR - 0.5, colR + colW - 22, yR - 0.5);
        doc.setLineDashPattern([], 0);
        doc.setTextColor(...RED);
        doc.setFont("helvetica", "bold");
        doc.text(fmtP(bal), colR + colW, yR, { align: "right" });
        yR += 4.5;
      });
      doc.setDrawColor(...INK_GHOST); doc.setLineWidth(0.2);
      doc.line(colR, yR, colR + colW, yR);
      yR += 3;
      doc.setTextColor(...RED);
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("TOTAL PASIVOS", colR, yR);
      doc.setFontSize(10);
      doc.text(fmtP(totalPasivos), colR + colW, yR, { align: "right" });

      // Net worth banner
      y = Math.max(yL, yR) + 10;
      const neto = totalActivos - totalPasivos;
      const netoPos = neto >= 0;
      doc.setFillColor(...(netoPos ? GREEN_BG : RED_BG));
      doc.rect(0, y, PAGE_W, 18, "F");
      doc.setDrawColor(...(netoPos ? SAGE : RED)); doc.setLineWidth(0.6);
      doc.line(0, y, PAGE_W, y);
      doc.setTextColor(...(netoPos ? SAGE : RED));
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("PATRIMONIO NETO", M, y + 7);
      doc.setTextColor(...INK_LIGHT);
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.text("(Activos totales − Pasivos)", M, y + 11);
      doc.setTextColor(...(netoPos ? SAGE : RED));
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(fmtP(neto), PAGE_W - M, y + 11, { align: "right" });
      y += 24;

      // Construction goals
      const activeGoals = goals.filter(g => g.is_active);
      if (activeGoals.length > 0) {
        if (y > PAGE_H - 40) { doc.addPage(); y = 18; }
        y = sectionTitle("CONSTRUCCIÓN PATRIMONIAL", y);
        const BAR_G = CW * 0.75;
        activeGoals.slice(0, 4).forEach(g => {
          const pct = g.target_amount > 0
            ? Math.min(g.current_amount / g.target_amount, 1) : 0;
          doc.setTextColor(...INK);
          doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
          doc.text(g.name, M, y);
          doc.setTextColor(...INK_MID);
          doc.setFontSize(7); doc.setFont("helvetica", "normal");
          doc.text(
            `${fmtP(g.current_amount)} / ${fmtP(g.target_amount)}`,
            PAGE_W - M, y, { align: "right" }
          );
          y += 3.5;
          doc.setFillColor(...INK_GHOST);
          doc.roundedRect(M, y, BAR_G, 3, 1.5, 1.5, "F");
          if (pct > 0) {
            doc.setFillColor(...BUILD_L);
            doc.roundedRect(M, y, pct * BAR_G, 3, 1.5, 1.5, "F");
          }
          doc.setTextColor(...BUILD);
          doc.setFontSize(7); doc.setFont("helvetica", "bold");
          doc.text(`${(pct * 100).toFixed(0)}%`, PAGE_W - M, y + 2.5, { align: "right" });
          y += 3 + 2.5;
          if (g.monthly_contribution > 0) {
            const rem = g.target_amount - g.current_amount;
            const months = rem > 0 ? Math.ceil(rem / g.monthly_contribution) : 0;
            if (months > 0) {
              doc.setTextColor(...INK_MID);
              doc.setFontSize(6); doc.setFont("helvetica", "italic");
              doc.text(
                `Aportando ${fmtP(g.monthly_contribution)}/mes → ${months} meses para completar`,
                M, y
              );
              y += 3.5;
            }
          }
          y += 5;
        });
      }

      // ════════════════════════════════════════════
      // PAGE 3 — Transactions
      // ════════════════════════════════════════════
      doc.addPage();

      // Header band
      doc.setFillColor(...COVER_BG);
      doc.rect(0, 0, PAGE_W, 12, "F");
      doc.setTextColor(...COVER_TXT);
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text(`MOVIMIENTOS DEL PERIODO — ${periodTitle}`, M, 8);

      y = 20;

      // Income table
      y = sectionTitle("INGRESOS DEL PERIODO", y);
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
              fmtP(tx.amount_in_base ?? tx.amount),
            ])
          : [["", "Sin ingresos en este periodo", "", ""]],
        margin: { left: M, right: M },
        styles: { fontSize: 7, textColor: INK, cellPadding: 2 },
        headStyles: {
          fillColor: SAGE,
          textColor: [255, 255, 255] as [number, number, number],
          fontSize: 7, fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [238, 246, 240] as [number, number, number] },
        columnStyles: {
          0: { cellWidth: 20 },
          2: { cellWidth: 28 },
          3: { cellWidth: 26, halign: "right" },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Top expenses
      if (y > PAGE_H - 40) { doc.addPage(); y = 18; }
      y = sectionTitle("TOP GASTOS DEL PERIODO", y);
      const expenseTxs = transactions
        .filter(t => t.type === "expense")
        .sort((a, b) => (b.amount_in_base ?? b.amount) - (a.amount_in_base ?? a.amount))
        .slice(0, 20);

      const COL_TBL_W = (CW - 4) / 2;
      const leftExp = expenseTxs.slice(0, 10);
      const rightExp = expenseTxs.slice(10, 20);

      const expTableOpts = (rows: typeof leftExp, startIdx: number, mL: number) => ({
        startY: y,
        head: [["#", "Descripción", "Monto"]],
        body: rows.map((tx, i) => [
          String(startIdx + i + 1),
          tx.description || categoryMap[tx.category_id ?? ""] || "—",
          fmtP(tx.amount_in_base ?? tx.amount),
        ]),
        margin: { left: mL, right: PAGE_W - mL - COL_TBL_W },
        styles: { fontSize: 7, textColor: INK, cellPadding: 1.5 },
        headStyles: {
          fillColor: [148, 38, 38] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontSize: 7, fontStyle: "bold" as const,
        },
        alternateRowStyles: { fillColor: [250, 238, 238] as [number, number, number] },
        columnStyles: {
          0: { cellWidth: 7 },
          2: { cellWidth: 20, halign: "right" as const },
        },
        tableWidth: COL_TBL_W,
      });

      if (leftExp.length > 0)
        autoTable(doc, expTableOpts(leftExp, 0, M));
      if (rightExp.length > 0)
        autoTable(doc, expTableOpts(rightExp, 10, M + COL_TBL_W + 4));

      // Footer on all pages
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        const fy = PAGE_H - 8;
        doc.setDrawColor(...SAGE); doc.setLineWidth(0.25);
        doc.line(M, fy - 3, PAGE_W - M, fy - 3);
        doc.setTextColor(...SAGE);
        doc.setFontSize(6); doc.setFont("helvetica", "italic");
        doc.text("Tu dinero con calma. Tu vida con sentido.", M, fy);
        doc.setTextColor(...INK_LIGHT);
        doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
        doc.text(`Página ${pg} de ${totalPages}`, PAGE_W / 2, fy, { align: "center" });
        doc.setTextColor(...GOLD);
        doc.setFontSize(5.5);
        doc.text("finanzasconsentidoscf.com", PAGE_W - M, fy, { align: "right" });
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
