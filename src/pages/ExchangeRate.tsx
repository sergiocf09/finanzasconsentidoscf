import { useState } from "react";
import { DollarSign, RefreshCw, ArrowRightLeft, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExchangeRate } from "@/hooks/useExchangeRate";

export default function ExchangeRate() {
  const { rate, date, source, isManual, isLoading, fetchRate, setManualRate } = useExchangeRate();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleEdit = () => {
    setEditValue(rate > 0 ? rate.toFixed(4) : "");
    setEditing(true);
  };

  const handleSave = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed > 0) {
      setManualRate(parsed);
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
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

  return (
    <div className="space-y-5 overflow-x-hidden">
      <div className="pb-1">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-heading font-semibold text-foreground">
            Tipo de Cambio
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          USD / MXN — Referencia para conversiones multimoneda
        </p>
      </div>

      {/* Main rate card */}
      <div className="rounded-xl bg-card border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">USD → MXN</p>
              <p className="text-[10px] text-muted-foreground">
                {isManual ? "Valor manual" : source || "Referencia"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleEdit}
              title="Editar manualmente"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={fetchRate}
              disabled={isLoading}
              title="Actualizar desde referencia"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.0001"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-2xl font-bold font-heading tabular-nums h-12"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <Button variant="ghost" size="icon" className="h-10 w-10 text-income" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-expense" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-3xl font-heading font-bold text-foreground tabular-nums">
              ${rate > 0 ? rate.toFixed(4) : "—"}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
          <span>Última actualización</span>
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2">
        <h3 className="text-sm font-heading font-semibold text-foreground">¿Cómo funciona?</h3>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• El tipo de cambio se consulta automáticamente al abrir la app.</li>
          <li>• Se usa para convertir activos y pasivos en USD a MXN en tus totales.</li>
          <li>• Puedes editarlo manualmente si prefieres usar otro valor.</li>
          <li>• Al presionar el botón de actualizar, se obtiene el valor de referencia más reciente.</li>
        </ul>
      </div>
    </div>
  );
}
