import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Target, TrendingUp, PiggyBank, Sparkles, Pencil, Trash2,
  CalendarDays, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useSavingsGoals, SavingsGoal } from "@/hooks/useSavingsGoals";
import { SavingsGoalForm } from "@/components/construction/SavingsGoalForm";
import { GoalEditSheet } from "@/components/construction/GoalEditSheet";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const goalTypeIcons: Record<string, typeof Target> = {
  emergency: Target,
  retirement: Building2,
  custom: PiggyBank,
};

const goalTypeLabels: Record<string, string> = {
  emergency: "Fondo de emergencia",
  retirement: "Retiro",
  custom: "Meta personalizada",
};

export default function Construction() {
  const navigate = useNavigate();
  const { goals, isLoading, totalSaved, totalTarget, deleteGoal } = useSavingsGoals();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SavingsGoal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoal | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteGoal.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const overallPct = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  const renderGoalCard = (goal: SavingsGoal) => {
    const Icon = goalTypeIcons[goal.goal_type] || PiggyBank;
    const pct = goal.target_amount > 0
      ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
      : 0;

    return (
      <div
        key={goal.id}
        className="rounded-xl bg-card border border-border p-3 space-y-2 card-interactive cursor-pointer"
        onClick={() => goal.account_id && navigate(`/accounts/${goal.account_id}`)}
      >
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--block-build))]/10 shrink-0">
            <Icon className="h-4 w-4 text-[hsl(var(--block-build))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{goal.name}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{goalTypeLabels[goal.goal_type]}</span>
              {goal.target_date && (
                <span className="flex items-center gap-0.5">
                  <CalendarDays className="h-2.5 w-2.5" />
                  {format(new Date(goal.target_date), "MMM yyyy", { locale: es })}
                </span>
              )}
            </div>
            {goal.description && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{goal.description}</p>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); setEditTarget(goal); }}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(goal); }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[hsl(var(--block-build))] font-semibold tabular-nums">
              {formatCurrencyAbs(goal.current_amount)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              de {formatCurrencyAbs(goal.target_amount)}
            </span>
          </div>
          <Progress
            value={pct}
            className="h-2"
            style={
              { "--progress-foreground": "hsl(var(--block-build))" } as React.CSSProperties
            }
          />
          <p className="text-[10px] text-muted-foreground text-right tabular-nums">
            {pct.toFixed(0)}% completado
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-4 space-y-4">
      {/* Header */}
      <div className="pb-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Construcción Patrimonial</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva meta
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Metas de ahorro, inversión y formación patrimonial
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Sin metas de construcción todavía</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea tu primera meta para empezar a construir tu patrimonio.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Crear primera meta
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[hsl(var(--block-build))]/5 border border-[hsl(var(--block-build))]/20 p-3">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Patrimonio acumulado</p>
              <p className="text-lg font-bold font-heading text-[hsl(var(--block-build))]">
                {formatCurrencyAbs(totalSaved)}
              </p>
            </div>
            <div className="rounded-xl bg-card border border-border p-3">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Objetivo total</p>
              <p className="text-lg font-bold font-heading text-foreground">
                {formatCurrencyAbs(totalTarget)}
              </p>
              <div className="mt-1">
                <Progress value={overallPct} className="h-1.5" />
              </div>
            </div>
          </div>

          {/* Goal cards */}
          <div className="space-y-2">
            {goals.map(renderGoalCard)}
          </div>

          {/* Educational tip */}
          <div className="rounded-xl bg-gradient-to-r from-[hsl(var(--block-build))]/5 to-accent/5 border border-[hsl(var(--block-build))]/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--block-build))]/10 flex-shrink-0">
                <Sparkles className="h-4 w-4 text-[hsl(var(--block-build))]" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Tip: Separa tus cuentas</p>
                <p className="text-xs text-muted-foreground">
                  Usa cuentas bancarias de ahorro o inversión diferentes a las de tu operación diaria.
                  Esto te dará total transparencia y evitará que mezcles tus metas con tu gasto cotidiano.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <SavingsGoalForm open={formOpen} onOpenChange={setFormOpen} />
      <GoalEditSheet goal={editTarget} open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la meta y se desactivará la cuenta vinculada. El historial de transacciones se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
