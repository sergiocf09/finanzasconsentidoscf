import { cn } from "@/lib/utils";
import { ArrowRightLeft, RefreshCw } from "lucide-react";
import { useExchangeRate } from "@/hooks/useExchangeRate";

export function FxRateWidget() {
  const { rate, isLoading, isManual, fetchRate } = useExchangeRate();

  if (rate === 0) return null;

  return (
    <button
      onClick={fetchRate}
      disabled={isLoading}
      className="flex items-center gap-1.5 rounded-lg bg-muted/60 border border-border px-2.5 py-1.5 transition-colors hover:bg-muted"
      title="Tipo de cambio USD/MXN — Toca para actualizar"
    >
      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
      <span className="text-[11px] font-medium text-foreground tabular-nums">
        FX ${rate.toFixed(2)}
      </span>
      {isManual && (
        <span className="text-[8px] text-muted-foreground">✎</span>
      )}
      {isLoading && <RefreshCw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
    </button>
  );
}
