import { AlertTriangle, CheckCircle2, TrendingDown, Info, Clock } from "lucide-react";
import { formatCurrencyAbs } from "@/lib/formatters";
import { DTIResult, DTIStatus, DebtProjection } from "@/hooks/useDebtIntelligence";
import { cn } from "@/lib/utils";
import { useState } from "react";

const statusConfig: Record<DTIStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Saludable", color: "text-income", bg: "bg-income/10", icon: CheckCircle2 },
  moderate: { label: "Moderado", color: "text-status-warning", bg: "bg-status-warning/10", icon: Info },
  elevated: { label: "Elevado", color: "text-expense", bg: "bg-expense/10", icon: AlertTriangle },
  critical: { label: "Crítico", color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
};

interface DTISummaryCardsProps {
  dti: DTIResult;
}

export function DTISummaryCards({ dti }: DTISummaryCardsProps) {
  const [showProjections, setShowProjections] = useState(false);

  if (!dti.hasIncome) {
    return (
      <div className="rounded-xl bg-muted/30 border border-border p-4 text-center">
        <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          Registra ingresos este mes para ver tu indicador de endeudamiento (DTI).
        </p>
      </div>
    );
  }

  const planned = statusConfig[dti.plannedDTIStatus];
  const minimum = statusConfig[dti.minimumDTIStatus];
  const PlannedIcon = planned.icon;
  const MinIcon = minimum.icon;

  const showDualView = Math.abs(dti.plannedDTI - dti.minimumDTI) > 0.5;

  return (
    <div className="space-y-3">
      {/* Main DTI Cards */}
      <div className={cn("grid gap-3", showDualView ? "grid-cols-2" : "grid-cols-1")}>
        {/* Planned DTI - Primary */}
        <div className={cn("rounded-xl border p-3 space-y-1", planned.bg, `border-${dti.plannedDTIStatus === 'healthy' ? 'income' : dti.plannedDTIStatus === 'moderate' ? 'status-warning' : 'expense'}/20`)}>
          <div className="flex items-center gap-1.5">
            <PlannedIcon className={cn("h-3.5 w-3.5", planned.color)} />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {showDualView ? "DTI Planeado" : "Endeudamiento (DTI)"}
            </p>
          </div>
          <p className={cn("text-xl font-bold font-heading", planned.color)}>
            {dti.plannedDTI.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatCurrencyAbs(dti.totalPlannedPayments, "MXN")} / {formatCurrencyAbs(dti.monthlyIncome, "MXN")}
          </p>
          <p className={cn("text-[10px] font-medium", planned.color)}>{planned.label}</p>
        </div>

        {/* Minimum DTI - Secondary */}
        {showDualView && (
          <div className={cn("rounded-xl border p-3 space-y-1", minimum.bg, `border-${dti.minimumDTIStatus === 'healthy' ? 'income' : dti.minimumDTIStatus === 'moderate' ? 'status-warning' : 'expense'}/20`)}>
            <div className="flex items-center gap-1.5">
              <MinIcon className={cn("h-3.5 w-3.5", minimum.color)} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">DTI Solo mínimos</p>
            </div>
            <p className={cn("text-xl font-bold font-heading", minimum.color)}>
              {dti.minimumDTI.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatCurrencyAbs(dti.totalMinimumPayments, "MXN")} / {formatCurrencyAbs(dti.monthlyIncome, "MXN")}
            </p>
            <p className={cn("text-[10px] font-medium", minimum.color)}>{minimum.label}</p>
          </div>
        )}
      </div>

      {/* Insight message */}
      {showDualView && dti.minimumDTIStatus !== dti.plannedDTIStatus && (
        <div className="rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-3">
          <p className="text-xs text-muted-foreground">
            Si solo pagaras mínimos, tu DTI baja a <strong className="text-foreground">{dti.minimumDTI.toFixed(1)}%</strong>, pero
            pagarías significativamente más en intereses. Tu pago planeado es la mejor decisión.
          </p>
        </div>
      )}

      {/* Missing rates warning */}
      {dti.missingRateCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-status-warning/10 border border-status-warning/20 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-status-warning shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground">
            {dti.missingRateCount} deuda{dti.missingRateCount > 1 ? "s" : ""} sin tasa de interés.
            Agrégala para ver proyecciones de costo.
          </p>
        </div>
      )}

      {/* Cost Projections */}
      {dti.interestSavings.length > 0 && (
        <div className="space-y-2">
          <button
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            onClick={() => setShowProjections(!showProjections)}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            {showProjections ? "Ocultar" : "Ver"} proyección de costos ({dti.interestSavings.length})
          </button>

          {showProjections && (
            <div className="space-y-2">
              {dti.interestSavings.map((p) => (
                <ProjectionCard key={p.debtId} projection={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectionCard({ projection: p }: { projection: DebtProjection }) {
  const fmt = (v: number) => formatCurrencyAbs(v, "MXN");

  return (
    <div className="rounded-xl bg-card border border-border p-3 space-y-2">
      <p className="text-sm font-medium text-foreground">{p.debtName}</p>
      <p className="text-[10px] text-muted-foreground">
        Saldo: {fmt(p.balance)} · Tasa: {p.rate}%
      </p>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-expense/5 p-2">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wide">Solo mínimos</p>
          <p className="text-sm font-bold text-expense">
            {p.monthsMinimum === Infinity ? "∞" : `${p.monthsMinimum} meses`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Interés: {p.totalInterestMinimum === Infinity ? "∞" : fmt(p.totalInterestMinimum)}
          </p>
        </div>
        <div className="rounded-lg bg-income/5 p-2">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wide">Pago planeado</p>
          <p className="text-sm font-bold text-income">{p.monthsPlanned} meses</p>
          <p className="text-[10px] text-muted-foreground">Interés: {fmt(p.totalInterestPlanned)}</p>
        </div>
      </div>
      {p.interestSaved > 0 && isFinite(p.interestSaved) && (
        <div className="flex items-center gap-1.5 text-[10px] text-income font-medium">
          <Clock className="h-3 w-3" />
          Ahorras {fmt(p.interestSaved)} y {p.timeSaved} meses pagando más del mínimo
        </div>
      )}
    </div>
  );
}
