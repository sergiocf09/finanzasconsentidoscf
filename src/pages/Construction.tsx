import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, TrendingUp, Pencil, Trash2, CalendarDays,
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
import { useSavingsGoals, SavingsGoal, getGoalProjection } from "@/hooks/useSavingsGoals";
import { SavingsGoalForm } from "@/components/construction/SavingsGoalForm";
import { GoalEditSheet } from "@/components/construction/GoalEditSheet";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const goalConfig: Record<string, { emoji: string; phrase: string }> = {
  emergency: { emoji: "🛡️", phrase: "Tu red de seguridad" },
  home: { emoji: "🏠", phrase: "Tu propio espacio" },
  car: { emoji: "🚗", phrase: "Tu movilidad propia" },
  travel: { emoji: "✈️", phrase: "Ese viaje que mereces" },
  education: { emoji: "🎓", phrase: "Invertir en tu futuro" },
  business: { emoji: "🌱", phrase: "Tu negocio propio" },
  retirement: { emoji: "🌅", phrase: "Tu libertad financiera" },
  custom: { emoji: "⭐", phrase: "Tu meta personal" },
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
    const config = goalConfig[goal.goal_type] || goalConfig.custom;
    const pct = goal.target_amount > 0
      ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
      : 0;
    const projection = getGoalProjection(goal);

    const milestones = [
      { pct: 25, notified: goal.milestone_25_notified },
      { pct: 50, notified: goal.milestone_50_notified },
      { pct: 75, notified: goal.milestone_75_notified },
      { pct: 100, notified: goal.milestone_100_notified },
    ];

    const nextMilestone = milestones.find(m => pct < m.pct);
    const amountToNextMilestone = nextMilestone
      ? (goal.target_amount * nextMilestone.pct / 100) - goal.current_amount
      : 0;

    return (
      <div
        key={goal.id}
        className="rounded-xl bg-card border border-border p-3 space-y-2.5 card-interactive cursor-pointer"
        onClick={() => goal.account_id && navigate(`/accounts/${goal.account_id}`)}
      >
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--block-build))]/10 shrink-0 text-lg">
            {config.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{goal.name}</p>
            <p className="text-[10px] text-muted-foreground">{config.phrase}</p>
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
            <div>
              <span className="text-[hsl(var(--block-build))] font-semibold tabular-nums">
                {formatCurrencyAbs(goal.current_amount)}
              </span>
              <span className="text-muted-foreground ml-1 tabular-nums">
                de {formatCurrencyAbs(goal.target_amount)}
              </span>
            </div>
            <span className="text-[hsl(var(--block-build))] font-bold tabular-nums">
              {pct.toFixed(0)}%
            </span>
          </div>
          <Progress
            value={pct}
            className="h-2"
            style={{ "--progress-foreground": "hsl(var(--block-build))" } as React.CSSProperties}
          />
        </div>

        {/* Projection */}
        {projection.projectedLabel && (
          <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
            {projection.monthsRemaining === 0 ? (
              <p className="text-xs font-medium text-[hsl(var(--block-build))]">
                🎉 ¡Meta alcanzada!
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Aportando{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrencyAbs(goal.monthly_contribution)}/mes
                </span>{" "}
                llegas en{" "}
                <span className="font-semibold text-foreground">
                  {projection.projectedLabel}
                </span>
                {" "}({projection.monthsRemaining} meses)
              </p>
            )}
          </div>
        )}

        {/* Milestones */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Hitos</p>
          <div className="flex gap-1">
            {milestones.map((m) => {
              const reached = pct >= m.pct;
              return (
                <div key={m.pct} className="flex-1 text-center">
                  <div className={cn(
                    "text-[10px] font-bold rounded-md py-0.5 transition-colors",
                    reached
                      ? "bg-[hsl(var(--block-build))]/15 text-[hsl(var(--block-build))]"
                      : "bg-muted/50 text-muted-foreground/50"
                  )}>
                    {reached ? "✓" : ""}{m.pct}%
                  </div>
                  <p className={cn(
                    "text-[9px] tabular-nums mt-0.5",
                    reached ? "text-foreground" : "text-muted-foreground/40"
                  )}>
                    {formatCurrencyAbs(goal.target_amount * m.pct / 100)}
                  </p>
                </div>
              );
            })}
          </div>
          {nextMilestone && amountToNextMilestone > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Faltan{" "}
              <span className="font-semibold text-foreground">
                {formatCurrencyAbs(amountToNextMilestone)}
              </span>{" "}
              para el siguiente hito ({nextMilestone.pct}%)
            </p>
          )}
        </div>

        {/* Target date */}
        {goal.target_date && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Objetivo: {format(new Date(goal.target_date), "MMMM yyyy", { locale: es })}
          </div>
        )}
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
          <div className="text-4xl mb-3">🌱</div>
          <p className="text-sm font-medium text-foreground">
            Construir empieza con una imagen clara de lo que quieres.
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            No importa si es grande o pequeño. Lo que importa es ponerle nombre,
            un número y una fecha. Tu primer paso es ahora.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Crear mi primera meta
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
