import { cn } from "@/lib/utils";
import { ArrowRightLeft, RefreshCw } from "lucide-react";
import { useExchangeRate, SUPPORTED_CURRENCIES } from "@/hooks/useExchangeRate";

export function FxRateWidget() {
  const { rates, enabledCurrencies, isLoading, allIsManual, fetchRate } = useExchangeRate();

  const visibleCurrencies = SUPPORTED_CURRENCIES.filter(
    (c) => enabledCurrencies.includes(c.code) && (rates[c.code] || 0) > 0
  );

  if (visibleCurrencies.length === 0) return null;

  return (
    <button
      onClick={fetchRate}
      disabled={isLoading}
      className="flex items-center gap-1.5 rounded-lg bg-muted/60 border border-border px-2 py-1 transition-colors hover:bg-muted"
      title="Tipos de cambio — Toca para actualizar"
    >
      <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="flex flex-col gap-0">
        {visibleCurrencies.map((c) => (
          <span key={c.code} className="text-[11px] font-semibold text-foreground tabular-nums whitespace-nowrap leading-tight">
            {c.flag} ${(rates[c.code] || 0).toFixed(2)}
          </span>
        ))}
      </div>
      {Object.values(allIsManual).some(Boolean) && (
        <span className="text-[8px] text-muted-foreground">✎</span>
      )}
      {isLoading && <RefreshCw className="h-2.5 w-2.5 animate-spin text-muted-foreground shrink-0" />}
    </button>
  );
}
