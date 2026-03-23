import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, FileText, History, LayoutTemplate, Sparkles, Check } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories, Category } from "@/hooks/useCategories";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const blockConfig = {
  stability: { label: "Estabilidad", emoji: "🔵", color: "text-[hsl(var(--block-stability))]", bg: "bg-[hsl(var(--block-stability)/0.08)]" },
  lifestyle: { label: "Calidad de vida", emoji: "🟡", color: "text-[hsl(var(--block-lifestyle))]", bg: "bg-[hsl(var(--block-lifestyle)/0.08)]" },
  build: { label: "Construcción", emoji: "🟢", color: "text-[hsl(var(--block-build))]", bg: "bg-[hsl(var(--block-build)/0.08)]" },
};

const templates = [
  { id: "classic", name: "Balance Clásico", stability: 50, lifestyle: 30, build: 20, desc: "Equilibrio probado: 50/30/20" },
  { id: "conservative", name: "Conservador", stability: 60, lifestyle: 30, build: 10, desc: "Prioriza estabilidad: 60/30/10" },
  { id: "growth", name: "Construcción Prioritaria", stability: 50, lifestyle: 20, build: 30, desc: "Enfocado en crecer: 50/20/30" },
  { id: "zero", name: "Cada Peso con Destino", stability: 0, lifestyle: 0, build: 0, desc: "Distribuye el 100% de tu ingreso" },
];

const months = [
  { value: "1", label: "Enero" }, { value: "2", label: "Febrero" }, { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" }, { value: "5", label: "Mayo" }, { value: "6", label: "Junio" },
  { value: "7", label: "Julio" }, { value: "8", label: "Agosto" }, { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" }, { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
];

type WizardStep = "method" | "period" | "configure" | "review";
type Method = "manual" | "historical" | "template" | "smart";

interface CategoryBudget {
  category_id: string;
  name: string;
  bucket: string;
  amount: number;
  average?: number;
}

interface BudgetCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

export function BudgetCreationWizard({ open, onOpenChange }: BudgetCreationWizardProps) {
  const { user } = useAuth();
  const { expenseCategories, incomeCategories } = useCategories();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [step, setStep] = useState<WizardStep>("method");
  const [periodLoading, setPeriodLoading] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [historyMonths, setHistoryMonths] = useState(3);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [smartAnalysis, setSmartAnalysis] = useState<{ stabilityPct: number; lifestylePct: number; buildPct: number; message: string } | null>(null);
  const [budgetType, setBudgetType] = useState<"expense" | "income">("expense");

  useEffect(() => {
    if (!open) {
      setStep("method");
      setMethod(null);
      setCategoryBudgets([]);
      setSelectedTemplate(null);
      setSmartAnalysis(null);
      setBudgetType("expense");
    }
  }, [open]);

  const activeCategories = budgetType === "income" ? incomeCategories : expenseCategories;

  const initManualBudgets = () => {
    const budgets = activeCategories.map((c) => ({
      category_id: c.id,
      name: c.name,
      bucket: (c as any).bucket || "lifestyle",
      amount: 0,
    }));
    setCategoryBudgets(budgets);
  };

  const fetchHistoricalData = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(new Date(), historyMonths));
    const txType = budgetType === "income" ? "income" : "expense";
    const { data: txs } = await supabase
      .from("transactions")
      .select("category_id, amount")
      .eq("type", txType)
      .gte("transaction_date", format(start, "yyyy-MM-dd"))
      .lte("transaction_date", format(end, "yyyy-MM-dd"));
    const catTotals: Record<string, number> = {};
    (txs ?? []).forEach((tx) => {
      if (tx.category_id) catTotals[tx.category_id] = (catTotals[tx.category_id] || 0) + Number(tx.amount);
    });
    const budgets = activeCategories.map((c) => ({
      category_id: c.id, name: c.name, bucket: (c as any).bucket || "lifestyle",
      amount: Math.round((catTotals[c.id] || 0) / historyMonths),
      average: Math.round((catTotals[c.id] || 0) / historyMonths),
    }));
    setCategoryBudgets(budgets);
    setLoadingHistory(false);
  };

  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl || monthlyIncome <= 0) return;
    const blockBudgets = {
      stability: monthlyIncome * (tmpl.stability / 100),
      lifestyle: monthlyIncome * (tmpl.lifestyle / 100),
      build: monthlyIncome * (tmpl.build / 100),
    };
    const blockCounts: Record<string, number> = { stability: 0, lifestyle: 0, build: 0 };
    activeCategories.forEach((c) => {
      const bucket = (c as any).bucket || "lifestyle";
      if (blockCounts[bucket] !== undefined) blockCounts[bucket]++;
    });
    const budgets = activeCategories.map((c) => {
      const bucket = (c as any).bucket || "lifestyle";
      const count = blockCounts[bucket] || 1;
      return { category_id: c.id, name: c.name, bucket, amount: Math.round((blockBudgets[bucket as keyof typeof blockBudgets] || 0) / count) };
    });
    setCategoryBudgets(budgets);
  };

  const runSmartAnalysis = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(new Date(), 3));
    const [{ data: txs }, { data: incomeTxs }] = await Promise.all([
      supabase.from("transactions").select("category_id, amount").eq("type", "expense").gte("transaction_date", format(start, "yyyy-MM-dd")).lte("transaction_date", format(end, "yyyy-MM-dd")),
      supabase.from("transactions").select("amount").eq("type", "income").gte("transaction_date", format(start, "yyyy-MM-dd")).lte("transaction_date", format(end, "yyyy-MM-dd")),
    ]);
    const totalIncome = (incomeTxs ?? []).reduce((s, t) => s + Number(t.amount), 0) / 3;
    setMonthlyIncome(Math.round(totalIncome));
    const catTotals: Record<string, number> = {};
    let totalExpense = 0;
    (txs ?? []).forEach((tx) => { totalExpense += Number(tx.amount); if (tx.category_id) catTotals[tx.category_id] = (catTotals[tx.category_id] || 0) + Number(tx.amount); });
    let stabilityTotal = 0, lifestyleTotal = 0, buildTotal = 0;
    const catMap = new Map(activeCategories.map((c) => [c.id, c]));
    Object.entries(catTotals).forEach(([catId, amount]) => {
      const cat = catMap.get(catId);
      const bucket = (cat as any)?.bucket || "lifestyle";
      if (bucket === "stability") stabilityTotal += amount;
      else if (bucket === "build") buildTotal += amount;
      else lifestyleTotal += amount;
    });
    const stabilityPct = totalExpense > 0 ? (stabilityTotal / totalExpense) * 100 : 0;
    const lifestylePct = totalExpense > 0 ? (lifestyleTotal / totalExpense) * 100 : 0;
    const buildPct = totalExpense > 0 ? (buildTotal / totalExpense) * 100 : 0;
    const suggestedBuild = Math.min(buildPct + 3, 30);
    const suggestedLifestyle = Math.max(lifestylePct - 3, 15);
    const suggestedStability = 100 - suggestedBuild - suggestedLifestyle;
    setSmartAnalysis({ stabilityPct, lifestylePct, buildPct, message: `Actualmente destinas ${stabilityPct.toFixed(0)}% a Estabilidad, ${lifestylePct.toFixed(0)}% a Calidad de Vida y ${buildPct.toFixed(0)}% a Construcción. Te sugerimos mover gradualmente hacia una estructura más equilibrada.` });
    const suggestedBlockBudgets = { stability: totalIncome * (suggestedStability / 100), lifestyle: totalIncome * (suggestedLifestyle / 100), build: totalIncome * (suggestedBuild / 100) };
    const blockCounts: Record<string, number> = { stability: 0, lifestyle: 0, build: 0 };
    activeCategories.forEach((c) => { const bucket = (c as any).bucket || "lifestyle"; if (blockCounts[bucket] !== undefined) blockCounts[bucket]++; });
    const budgets = activeCategories.map((c) => {
      const bucket = (c as any).bucket || "lifestyle";
      const catAvg = (catTotals[c.id] || 0) / 3;
      const blockTotal = bucket === "stability" ? stabilityTotal / 3 : bucket === "build" ? buildTotal / 3 : lifestyleTotal / 3;
      const proportion = blockTotal > 0 ? catAvg / blockTotal : 1 / (blockCounts[bucket] || 1);
      const blockBudget = suggestedBlockBudgets[bucket as keyof typeof suggestedBlockBudgets] || 0;
      return { category_id: c.id, name: c.name, bucket, amount: Math.round(blockBudget * proportion), average: Math.round(catAvg) };
    });
    setCategoryBudgets(budgets);
    setLoadingHistory(false);
  };

  const updateCategoryAmount = (catId: string, amount: number) => {
    setCategoryBudgets((prev) => prev.map((b) => (b.category_id === catId ? { ...b, amount } : b)));
  };

  const blockTotals = (block: string) => categoryBudgets.filter((b) => b.bucket === block).reduce((s, b) => s + b.amount, 0);
  const grandTotal = categoryBudgets.reduce((s, b) => s + b.amount, 0);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const validBudgets = categoryBudgets.filter((b) => b.amount > 0);
      const inserts = validBudgets.map((b) => ({
        user_id: user.id, category_id: b.category_id, name: b.name, amount: b.amount,
        period: "monthly" as const, month, year, spent: 0, created_from: method, is_active: true,
        budget_type: budgetType,
      }));
      if (inserts.length > 0) {
        const { error } = await supabase.from("budgets").upsert(inserts, {
          onConflict: "user_id,category_id,period,month,year",
          ignoreDuplicates: false,
        });
        if (error) throw error;

        // Recalculate spent from actual transactions
        await supabase.rpc("recalculate_budget_spent", { p_year: year, p_month: month });
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
      toast.success(`Presupuesto creado con ${validBudgets.length} categorías`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMethodSelect = (m: Method) => { setMethod(m); setStep("period"); };

  const [existingBudgetDialog, setExistingBudgetDialog] = useState(false);
  const [existingCount, setExistingCount] = useState(0);

  const proceedAfterPeriod = async () => {
    if (method === "manual") { initManualBudgets(); setStep("configure"); }
    else if (method === "historical") { await fetchHistoricalData(); setStep("configure"); }
    else if (method === "template") { setStep("configure"); }
    else if (method === "smart") { await runSmartAnalysis(); setStep("configure"); }
  };

  const handlePeriodNext = async () => {
    if (!user) return;
    // Check for existing budgets
    const { count } = await supabase
      .from("budgets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("is_active", true);

    if ((count ?? 0) > 0) {
      setExistingCount(count ?? 0);
      setExistingBudgetDialog(true);
    } else {
      await proceedAfterPeriod();
    }
  };

  const handleReplaceExisting = async () => {
    if (!user) return;
    setExistingBudgetDialog(false);
    await supabase
      .from("budgets")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("is_active", true);
    await proceedAfterPeriod();
  };

  const handleCopyAsBase = async () => {
    if (!user) return;
    setExistingBudgetDialog(false);
    const { data: existing } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("is_active", true);

    if (existing && existing.length > 0) {
      const budgets = existing.map((b) => {
        const cat = activeCategories.find((c) => c.id === b.category_id);
        return {
          category_id: b.category_id || "",
          name: b.name,
          bucket: (cat as any)?.bucket || "lifestyle",
          amount: b.amount,
        };
      });
      setCategoryBudgets(budgets);
    }
    setStep("configure");
  };

  const renderMethodStep = () => (
    <div className="space-y-3">
      {/* Budget type selector */}
      <FieldRow label="Tipo de presupuesto">
        <Select value={budgetType} onValueChange={(v) => setBudgetType(v as any)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Gasto — cuánto puedo gastar</SelectItem>
            <SelectItem value="income">Ingreso — cuánto espero recibir</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <p className="text-sm text-muted-foreground mb-4">¿Desde dónde quieres construir tu presupuesto?</p>
      {[
        { id: "manual" as Method, icon: FileText, title: "Manual", desc: "Tú decides el monto de cada categoría" },
        { id: "historical" as Method, icon: History, title: "Basado en histórico", desc: "Parte de lo que ya has gastado en meses anteriores" },
        ...(budgetType === "expense" ? [
          { id: "template" as Method, icon: LayoutTemplate, title: "Plantilla", desc: "Elige una estructura predefinida como punto de partida" },
          { id: "smart" as Method, icon: Sparkles, title: "Inteligente", desc: "Analiza tus patrones y sugiere una distribución optimizada" },
        ] : []),
      ].map((m) => (
        <button
          key={m.id}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
          onClick={() => handleMethodSelect(m.id)}
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <m.icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{m.title}</p>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );

  const renderPeriodStep = () => (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground mb-3">¿Para qué mes quieres construir este presupuesto?</p>

      <FieldRow label="Mes">
        <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Año">
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      {method === "historical" && (
        <FieldRow label="Periodo histórico">
          <Select value={String(historyMonths)} onValueChange={(v) => setHistoryMonths(parseInt(v))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mes</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      )}

      {(method === "template" || method === "smart") && (
        <FieldRow label="Ingreso mensual" hint="Estimado">
          <Input
            className="h-8 text-sm text-right"
            type="number"
            placeholder="0"
            value={monthlyIncome || ""}
            onChange={(e) => setMonthlyIncome(Number(e.target.value))}
          />
        </FieldRow>
      )}

      <Button className="w-full mt-3" onClick={handlePeriodNext} disabled={loadingHistory}>
        {loadingHistory ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Continuar
      </Button>
    </div>
  );

  const renderConfigureStep = () => {
    const blocks = ["stability", "lifestyle", "build"] as const;
    const isIncomeType = budgetType === "income";

    return (
      <div className="space-y-4 max-h-[50vh] overflow-y-auto">
        {method === "template" && !categoryBudgets.length && !isIncomeType && (
          <div className="space-y-2 mb-4">
            <p className="text-sm text-muted-foreground">Elige una plantilla:</p>
            {templates.map((t) => (
              <button
                key={t.id}
                className={cn(
                  "w-full p-3 rounded-xl border text-left transition-colors",
                  selectedTemplate === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                )}
                onClick={() => { setSelectedTemplate(t.id); applyTemplate(t.id); }}
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        )}

        {method === "smart" && smartAnalysis && !isIncomeType && (
          <div className="rounded-xl bg-secondary/50 p-3 mb-4">
            <p className="text-xs text-muted-foreground">{smartAnalysis.message}</p>
          </div>
        )}

        {categoryBudgets.length > 0 && (
          <>
            {!isIncomeType && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {blocks.map((block) => {
                    const config = blockConfig[block];
                    const total = blockTotals(block);
                    return (
                      <div key={block} className={cn("rounded-xl p-2 text-center", config.bg)}>
                        <span className="text-xs">{config.emoji}</span>
                        <p className={cn("text-xs font-medium", config.color)}>{config.label}</p>
                        <p className="text-sm font-bold text-foreground">
                          {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(total)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Total: {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(grandTotal)}
                </p>

                {blocks.map((block) => {
                  const config = blockConfig[block];
                  const items = categoryBudgets.filter((b) => b.bucket === block);
                  if (items.length === 0) return null;
                  return (
                    <div key={block} className="space-y-1.5">
                      <h4 className="text-xs font-heading font-semibold text-muted-foreground flex items-center gap-1">
                        {config.emoji} {config.label}
                      </h4>
                      {items.map((item) => (
                        <div key={item.category_id} className="flex items-center gap-2">
                          <span className="text-xs text-foreground flex-1 min-w-0 truncate">{item.name}</span>
                          {item.average !== undefined && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              Prom: ${item.average.toLocaleString()}
                            </span>
                          )}
                          <Input
                            type="number"
                            className="h-7 w-24 text-right text-xs"
                            value={item.amount || ""}
                            onChange={(e) => updateCategoryAmount(item.category_id, Number(e.target.value))}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}

            {isIncomeType && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Total esperado: {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(grandTotal)}
                </p>
                {categoryBudgets.map((item) => (
                  <div key={item.category_id} className="flex items-center gap-2">
                    <span className="text-xs text-foreground flex-1 min-w-0 truncate">{item.name}</span>
                    {item.average !== undefined && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        Prom: ${item.average.toLocaleString()}
                      </span>
                    )}
                    <Input
                      type="number"
                      className="h-7 w-24 text-right text-xs"
                      value={item.amount || ""}
                      onChange={(e) => updateCategoryAmount(item.category_id, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Button className="w-full" onClick={handleSave} disabled={saving || grandTotal <= 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          Guardar presupuesto
        </Button>
      </div>
    );
  };

  const stepTitle = {
    method: "Nuevo presupuesto",
    period: "Periodo",
    configure: method === "template" ? "Plantilla" : method === "smart" ? "Presupuesto inteligente" : method === "historical" ? "Basado en histórico" : "Configurar montos",
    review: "Revisar",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto w-[calc(100vw-2rem)]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {step !== "method" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    if (step === "configure") setStep("period");
                    else if (step === "period") setStep("method");
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle>{stepTitle[step]}</DialogTitle>
            </div>
          </DialogHeader>

          {step === "method" && renderMethodStep()}
          {step === "period" && renderPeriodStep()}
          {step === "configure" && renderConfigureStep()}
        </DialogContent>
      </Dialog>

      {/* Existing budget confirmation dialog */}
      <AlertDialog open={existingBudgetDialog} onOpenChange={setExistingBudgetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ya tienes un presupuesto para este mes</AlertDialogTitle>
            <AlertDialogDescription>
              Puedes editarlo, reemplazarlo por uno nuevo, o usarlo como base para ajustar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => { setExistingBudgetDialog(false); onOpenChange(false); }}
            >
              Editar el actual
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleReplaceExisting}
            >
              Reemplazar (desactivar anterior)
            </Button>
            <Button onClick={handleCopyAsBase}>
              Copiar como base y ajustar
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
