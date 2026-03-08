import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Wallet, CreditCard, Scale } from "lucide-react";
import { useHideAmounts } from "@/hooks/useHideAmounts";

interface NetPositionCardProps {
  totalAssets: number;
  totalLiabilities: number;
}

export function NetPositionCard({ totalAssets, totalLiabilities }: NetPositionCardProps) {
  const { mask } = useHideAmounts();
  const netPosition = totalAssets - totalLiabilities;

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <h3 className="text-sm font-heading font-semibold text-foreground">Resumen financiero</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-income/8 p-2.5 text-center">
          <Wallet className="h-4 w-4 text-income mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Activos</p>
          <p className="text-xs font-bold text-income tabular-nums leading-tight mt-0.5">
            {mask(formatCurrency(totalAssets))}
          </p>
        </div>
        <div className="rounded-lg bg-expense/8 p-2.5 text-center">
          <CreditCard className="h-4 w-4 text-expense mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Pasivos</p>
          <p className="text-xs font-bold text-expense tabular-nums leading-tight mt-0.5">
            -{mask(formatCurrency(totalLiabilities))}
          </p>
        </div>
        <div className={cn("rounded-lg p-2.5 text-center", netPosition >= 0 ? "bg-income/8" : "bg-expense/8")}>
          <Scale className={cn("h-4 w-4 mx-auto mb-1", netPosition >= 0 ? "text-income" : "text-expense")} />
          <p className="text-[10px] text-muted-foreground">Posición neta</p>
          <p className={cn("text-xs font-bold tabular-nums leading-tight mt-0.5", netPosition >= 0 ? "text-income" : "text-expense")}>
            {netPosition < 0 && "-"}{mask(formatCurrency(Math.abs(netPosition)))}
          </p>
        </div>
      </div>
    </div>
  );
}
