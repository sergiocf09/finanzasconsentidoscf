import { Plus, Target, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { SectionHelp } from "@/components/help/SectionHelp";
import { helpData } from "@/components/help/sectionHelpData";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEmergencyFund } from "@/hooks/useEmergencyFund";
import { formatCurrency } from "@/lib/formatters";

export default function EmergencyFund() {
  const { fund, contributions, isLoading, progress } = useEmergencyFund();

  const formatAmount = (value: number, currency = "MXN") => formatCurrency(value, currency);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
          <h1 className="text-lg font-heading font-semibold text-foreground">Fondo de emergencia</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // No fund created yet — show empty state
  if (!fund) {
    return (
      <div className="space-y-6">
        <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
          <h1 className="text-lg font-heading font-semibold text-foreground">Fondo de emergencia</h1>
        </div>

        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-heading font-semibold text-foreground">Sin fondo de emergencia</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Crea tu fondo de emergencia para tener un colchón financiero ante imprevistos. Las aportaciones se realizan mediante transferencias entre tus cuentas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const goal = fund.goal_amount;
  const current = fund.current_amount;
  const monthlyTarget = fund.monthly_target ?? 0;
  const monthsRemaining = monthlyTarget > 0 ? Math.ceil(Math.max(goal - current, 0) / monthlyTarget) : null;

  return (
    <div className="space-y-6">
      {/* Header — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Fondo de emergencia</h1>
        </div>
      </div>

      {/* Main Progress Card */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground card-elevated">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-primary-foreground/80">
              Meta: {fund.months_of_expenses ? `${fund.months_of_expenses} meses de gastos` : "Fondo de emergencia"}
            </p>
            <p className="text-3xl font-bold font-heading">
              {formatAmount(current, fund.currency)} / {formatAmount(goal, fund.currency)}
            </p>
          </div>
        </div>

        <Progress
          value={progress}
          className="h-4 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
        />

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-primary-foreground/80">
            {progress.toFixed(0)}% completado
          </span>
          <span className="text-primary-foreground/80">
            Faltan {formatAmount(Math.max(goal - current, 0), fund.currency)}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {monthlyTarget > 0 && (
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-income/10">
                <TrendingUp className="h-5 w-5 text-income" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aportación mensual</p>
                <p className="text-xl font-bold font-heading">
                  {formatAmount(monthlyTarget, fund.currency)}
                </p>
              </div>
            </div>
          </div>
        )}

        {monthsRemaining !== null && (
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meses restantes</p>
                <p className="text-xl font-bold font-heading">
                  {monthsRemaining} meses
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Contributions */}
      {contributions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-heading font-semibold">
            Últimas aportaciones
          </h2>
          <div className="space-y-2">
            {contributions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl bg-card border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-muted-foreground">{c.contribution_date}</span>
                  {c.notes && <p className="text-xs text-muted-foreground line-clamp-1">{c.notes}</p>}
                </div>
                <span className="font-medium text-income shrink-0">
                  +{formatAmount(c.amount, fund.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivation Card */}
      {progress > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-income/5 to-primary/5 border border-income/10 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-income/10 flex-shrink-0">
              <Sparkles className="h-5 w-5 text-income" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">¡Vas muy bien!</p>
              <p className="text-sm text-muted-foreground">
                Ya tienes {fund.months_of_expenses ? (progress / (100 / fund.months_of_expenses)).toFixed(1) : (progress / 33.33).toFixed(1)} meses de gastos
                cubiertos. Un fondo de emergencia te da tranquilidad ante
                imprevistos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
