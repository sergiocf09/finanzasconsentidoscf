import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Home, Car, Sofa, Gem, Package } from "lucide-react";
import { useNonFinancialAssets, NFA_TYPE_LABELS, NonFinancialAsset } from "@/hooks/useNonFinancialAssets";
import { toast } from "sonner";

const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[42%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const TYPE_ICONS: Record<string, React.ElementType> = {
  real_estate: Home, vehicle: Car, furniture: Sofa, valuables: Gem, other: Package,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedDebtId?: string;
  linkedDebtName?: string;
  asset?: NonFinancialAsset | null;
}

export function NonFinancialAssetSheet({ open, onOpenChange, linkedDebtId, linkedDebtName, asset }: Props) {
  const { createAsset, updateAsset } = useNonFinancialAssets();
  const isEdit = !!asset;

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<string>("real_estate");
  const [currentValue, setCurrentValue] = useState("");
  const [acquisitionValue, setAcquisitionValue] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("MXN");

  useEffect(() => {
    if (asset) {
      setName(asset.name);
      setAssetType(asset.asset_type);
      setCurrentValue(String(asset.current_value));
      setAcquisitionValue(String(asset.acquisition_value ?? ""));
      setAcquisitionDate(asset.acquisition_date ?? "");
      setDescription(asset.description ?? "");
      setCurrency(asset.currency);
    } else {
      setName(linkedDebtName ? `Activo — ${linkedDebtName}` : "");
      setAssetType("real_estate");
      setCurrentValue("");
      setAcquisitionValue("");
      setAcquisitionDate("");
      setDescription("");
      setCurrency("MXN");
    }
  }, [asset, linkedDebtName, open]);

  const handleSave = async () => {
    if (!name || !currentValue) {
      toast.error("Ingresa nombre y valor actual");
      return;
    }
    try {
      if (isEdit && asset) {
        await updateAsset.mutateAsync({
          id: asset.id,
          name,
          asset_type: assetType as any,
          current_value: parseFloat(currentValue),
          acquisition_value: acquisitionValue ? parseFloat(acquisitionValue) : undefined,
          acquisition_date: acquisitionDate || undefined,
          description: description || undefined,
          currency,
        });
        toast.success("Activo actualizado");
      } else {
        await createAsset.mutateAsync({
          name,
          asset_type: assetType as any,
          current_value: parseFloat(currentValue),
          acquisition_value: acquisitionValue ? parseFloat(acquisitionValue) : undefined,
          acquisition_date: acquisitionDate || undefined,
          description: description || undefined,
          currency,
          linked_debt_id: linkedDebtId || undefined,
        });
        toast.success("Activo registrado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Error al guardar");
    }
  };

  const Icon = TYPE_ICONS[assetType] || Package;
  const saving = createAsset.isPending || updateAsset.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-income/10">
              <Icon className="h-4 w-4 text-income" />
            </div>
            <SheetTitle className="text-base">
              {isEdit ? "Actualizar activo" : "Registrar activo"}
            </SheetTitle>
          </div>
          {linkedDebtName && !isEdit && (
            <p className="text-xs text-muted-foreground">
              Vinculado a: <span className="font-medium text-foreground">{linkedDebtName}</span>
            </p>
          )}
        </SheetHeader>

        <div className="space-y-2">
          <FieldRow label="Nombre">
            <Input className="h-8 text-sm" placeholder="Ej: Casa Santa Fe, Golf GTI 2020" value={name} onChange={e => setName(e.target.value)} />
          </FieldRow>

          <FieldRow label="Tipo de activo">
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(NFA_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Moneda">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label={isEdit ? "Valor actual estimado" : "Valor actual"} hint={isEdit ? "Actualiza si se apreció o depreció" : "Tu estimación hoy"}>
            <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" value={currentValue} onChange={e => setCurrentValue(e.target.value)} />
          </FieldRow>

          {!isEdit && (
            <FieldRow label="Valor de compra" hint="Opcional">
              <Input className="h-8 text-sm text-right" type="number" step="0.01" placeholder="0.00" value={acquisitionValue} onChange={e => setAcquisitionValue(e.target.value)} />
            </FieldRow>
          )}

          <FieldRow label="Fecha de compra" hint="Opcional">
            <Input className="h-8 text-sm" type="date" value={acquisitionDate} onChange={e => setAcquisitionDate(e.target.value)} />
          </FieldRow>

          <FieldRow label="Descripción" hint="Opcional">
            <Input className="h-8 text-sm" placeholder="Ej: Depto 3B Torre Sur" value={description} onChange={e => setDescription(e.target.value)} />
          </FieldRow>

          <div className="flex gap-3 pt-3 border-t border-border mt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : isEdit ? "Actualizar valor" : "Registrar activo"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
