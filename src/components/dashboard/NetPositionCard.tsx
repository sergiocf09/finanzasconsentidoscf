import { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Wallet, CreditCard, Scale, LayoutDashboard } from "lucide-react";
import { useHideAmounts } from "@/hooks/useHideAmounts";

interface NetPositionCardProps {
  totalAssets: number;
  totalLiabilities: number;
  filteredAssets?: number;
  filteredLiabilities?: number;
}

export function NetPositionCard({
  totalAssets,
  totalLiabilities,
  filteredAssets,
  filteredLiabilities,
}: NetPositionCardProps) {
  const { mask } = useHideAmounts();
  const [viewMode, setViewMode] = useState<"all" | "home">("all");

  const hasFiltered = filteredAssets !== undefined && filteredLiabilities !== undefined;
  const showFiltered = viewMode === "home" && hasFiltered;

  const assets = showFiltered ? filteredAssets! : totalAssets;
  const liabilities = showFiltered ? filteredLiabilities! : totalLiabilities;
  const netPosition = assets - liabilities;

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-heading font-semibold text-foreground">Resumen financiero</h3>
        {hasFiltered && (
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
            <button
              onClick={() => setViewMode("all")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                viewMode === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Todas las cuentas activas"
            >
              <Wallet className="h-3 w-3" />
              Todas
            </button>
            <button
              onClick={() => setViewMode("home")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                viewMode === "home"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Según selección de Inicio"
            >
              <LayoutDashboard className="h-3 w-3" />
              Inicio
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-income/8 p-2.5 text-center">
          <Wallet className="h-4 w-4 text-income mx-auto mb-1" />
          <p className="text-[9px] text-muted-foreground leading-tight">Activos</p>
          <p className="text-sm font-bold text-income tabular-nums leading-tight mt-0.5">
            {mask(formatCurrency(assets))}
          </p>
        </div>
        <div className="rounded-lg bg-expense/8 p-2.5 text-center">
          <CreditCard className="h-4 w-4 text-expense mx-auto mb-1" />
          <p className="text-[9px] text-muted-foreground leading-tight">Pasivos</p>
          <p className="text-sm font-bold text-expense tabular-nums leading-tight mt-0.5">
            -{mask(formatCurrency(liabilities))}
          </p>
        </div>
        <div className={cn("rounded-lg p-2.5 text-center", netPosition >= 0 ? "bg-income/8" : "bg-expense/8")}>
          <Scale className={cn("h-4 w-4 mx-auto mb-1", netPosition >= 0 ? "text-income" : "text-expense")} />
          <p className="text-[9px] text-muted-foreground leading-tight">Posición neta</p>
          <p className={cn("text-sm font-bold tabular-nums leading-tight mt-0.5", netPosition >= 0 ? "text-income" : "text-expense")}>
            {netPosition < 0 && "-"}{mask(formatCurrency(Math.abs(netPosition)))}
          </p>
        </div>
      </div>
    </div>
  );
}
