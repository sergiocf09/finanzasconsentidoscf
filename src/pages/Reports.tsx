import { BarChart3, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reports() {
  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const categoryBreakdown = [
    { category: "Vivienda", amount: 12000, percentage: 40, color: "bg-primary" },
    { category: "Alimentación", amount: 6000, percentage: 20, color: "bg-income" },
    { category: "Transporte", amount: 4500, percentage: 15, color: "bg-transfer" },
    { category: "Entretenimiento", amount: 3000, percentage: 10, color: "bg-accent" },
    { category: "Servicios", amount: 2500, percentage: 8, color: "bg-muted-foreground" },
    { category: "Otros", amount: 2000, percentage: 7, color: "bg-border" },
  ];

  return (
    <div className="space-y-6">
      {/* Header — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Reportes</h1>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs defaultValue="month" className="space-y-6">
        <TabsList>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="month">Mes</TabsTrigger>
          <TabsTrigger value="year">Año</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-income/10">
                  <TrendingUp className="h-5 w-5 text-income" />
                </div>
                <span className="text-sm text-muted-foreground">Ingresos</span>
              </div>
              <p className="text-2xl font-bold font-heading text-income">
                {formatAmount(32000)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                +5% vs mes anterior
              </p>
            </div>

            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-expense/10">
                  <TrendingDown className="h-5 w-5 text-expense" />
                </div>
                <span className="text-sm text-muted-foreground">Gastos</span>
              </div>
              <p className="text-2xl font-bold font-heading text-expense">
                {formatAmount(30000)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                -8% vs mes anterior
              </p>
            </div>

            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Balance</span>
              </div>
              <p className="text-2xl font-bold font-heading text-primary">
                {formatAmount(2000)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ahorro del mes</p>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-heading font-semibold">Gastos por categoría</h2>
            </div>

            {/* Visual Bar Representation */}
            <div className="h-6 rounded-full overflow-hidden flex mb-6">
              {categoryBreakdown.map((cat, index) => (
                <div
                  key={cat.category}
                  className={`${cat.color} transition-all`}
                  style={{ width: `${cat.percentage}%` }}
                />
              ))}
            </div>

            {/* Category List */}
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${cat.color}`} />
                    <span className="text-sm text-foreground">{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {cat.percentage}%
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatAmount(cat.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trend Info */}
          <div className="rounded-2xl bg-secondary/50 p-5 text-center">
            <p className="text-muted-foreground">
              Los reportes detallados con gráficos interactivos estarán
              disponibles próximamente.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="week">
          <div className="rounded-2xl bg-muted/50 border border-border p-8 text-center">
            <p className="text-muted-foreground">
              Selecciona "Mes" para ver el reporte más reciente.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="year">
          <div className="rounded-2xl bg-muted/50 border border-border p-8 text-center">
            <p className="text-muted-foreground">
              El reporte anual estará disponible cuando tengas más historial.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
