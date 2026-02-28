import { Plus, Target, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function EmergencyFund() {
  const goal = 90000; // 3 months expenses
  const current = 45000;
  const monthlyContribution = 5000;
  const percentage = (current / goal) * 100;
  const monthsRemaining = Math.ceil((goal - current) / monthlyContribution);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Fondo de emergencia</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Abonar al fondo
          </Button>
        </div>
      </div>

      {/* Main Progress Card */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground card-elevated">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-primary-foreground/80">Meta: 3 meses de gastos</p>
            <p className="text-3xl font-bold font-heading">
              {formatAmount(current)} / {formatAmount(goal)}
            </p>
          </div>
        </div>

        <Progress
          value={percentage}
          className="h-4 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
        />

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-primary-foreground/80">
            {percentage.toFixed(0)}% completado
          </span>
          <span className="text-primary-foreground/80">
            Faltan {formatAmount(goal - current)}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-income/10">
              <TrendingUp className="h-5 w-5 text-income" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aportación mensual</p>
              <p className="text-xl font-bold font-heading">
                {formatAmount(monthlyContribution)}
              </p>
            </div>
          </div>
        </div>

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

        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Meta mensual</p>
              <p className="text-xl font-bold font-heading">
                {formatAmount(30000)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Contributions */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold">
          Últimas aportaciones
        </h2>

        <div className="space-y-2">
          {[
            { date: "01 Feb 2026", amount: 5000 },
            { date: "01 Ene 2026", amount: 5000 },
            { date: "15 Dic 2025", amount: 10000 },
            { date: "01 Dic 2025", amount: 5000 },
          ].map((contribution, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-xl bg-card border border-border p-4"
            >
              <span className="text-sm text-muted-foreground">
                {contribution.date}
              </span>
              <span className="font-medium text-income">
                +{formatAmount(contribution.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Motivation Card */}
      <div className="rounded-2xl bg-gradient-to-r from-income/5 to-primary/5 border border-income/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-income/10 flex-shrink-0">
            <Sparkles className="h-5 w-5 text-income" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">¡Vas muy bien!</p>
            <p className="text-sm text-muted-foreground">
              Ya tienes {(percentage / 33.33).toFixed(1)} meses de gastos
              cubiertos. Un fondo de emergencia te da tranquilidad ante
              imprevistos como pérdida de empleo o gastos médicos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
