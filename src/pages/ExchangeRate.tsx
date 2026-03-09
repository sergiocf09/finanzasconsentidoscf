import { useState, useEffect } from "react";
import { ArrowRightLeft, RefreshCw, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useExchangeRate, SUPPORTED_CURRENCIES } from "@/hooks/useExchangeRate";

export default function ExchangeRate() {
  const {
    rates, date, source, allIsManual, isLoading, enabledCurrencies,
    fetchRate, setManualRateForCurrency, toggleCurrency,
  } = useExchangeRate();

  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleEdit = (currency: string) => {
    const r = rates[currency] || 0;
    setEditValue(r > 0 ? r.toFixed(4) : "");
    setEditingCurrency(currency);
  };

  const handleSave = () => {
    if (!editingCurrency) return;
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed > 0) {
      setManualRateForCurrency(editingCurrency, parsed);
      setEditingCurrency(null);
    }
  };

  const handleCancel = () => {
    setEditingCurrency(null);
  };

  const formattedDate = date
    ? new Date(date).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm -mx-1 px-1 pb-2 -mt-2">
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-heading font-semibold text-foreground">Tipo de Cambio</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchRate}
            disabled={isLoading}
            title="Actualizar todos"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Referencia para conversiones multimoneda</p>
      </div>

      {/* Currency rate cards */}
      <div className="space-y-3 mt-3">
        {SUPPORTED_CURRENCIES.map((currency) => {
          const r = rates[currency.code] || 0;
          const isEditing = editingCurrency === currency.code;
          const manual = allIsManual[currency.code] || false;

          return (
            <div key={currency.code} className="rounded-xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currency.flag}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {currency.code} → MXN
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {manual ? "Valor manual" : currency.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(currency.code)}
                      title="Editar manualmente"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.0001"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-xl font-bold font-heading tabular-nums h-10"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") handleCancel();
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-income" onClick={handleSave}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-expense" onClick={handleCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-2xl font-heading font-bold text-foreground tabular-nums">
                  ${r > 0 ? r.toFixed(4) : "—"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Last update */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mt-3">
        <span>Última actualización</span>
        <span>{formattedDate}</span>
      </div>

      {/* Dashboard visibility toggles */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3 mt-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">
          Mostrar en pantalla de inicio
        </h3>
        <p className="text-xs text-muted-foreground">
          Selecciona qué tipos de cambio aparecen en el widget FX del dashboard.
        </p>
        <div className="space-y-2">
          {SUPPORTED_CURRENCIES.map((currency) => (
            <div key={currency.code} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currency.flag}</span>
                <Label htmlFor={`toggle-${currency.code}`} className="text-sm font-normal cursor-pointer">
                  {currency.code}/MXN — {currency.name}
                </Label>
              </div>
              <Switch
                id={`toggle-${currency.code}`}
                checked={enabledCurrencies.includes(currency.code)}
                onCheckedChange={() => toggleCurrency(currency.code)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2 mt-3 mb-4">
        <h3 className="text-sm font-heading font-semibold text-foreground">¿Cómo funciona?</h3>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• Los tipos de cambio se consultan automáticamente al abrir la app.</li>
          <li>• Se usan para convertir activos y pasivos a MXN en tus totales.</li>
          <li>• Puedes editar manualmente cualquier valor si prefieres usar otro.</li>
          <li>• Activa los toggles para elegir qué monedas ver en tu pantalla de inicio.</li>
        </ul>
      </div>
    </div>
  );
}
