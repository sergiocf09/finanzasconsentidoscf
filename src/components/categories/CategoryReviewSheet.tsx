import { useState } from "react";
import { Sparkles, Trash2, Check, Tag, ArrowRightLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Category } from "@/hooks/useCategories";

const bucketLabels: Record<string, string> = {
  stability: "Estabilidad",
  lifestyle: "Calidad de vida",
  build: "Construcción",
};

const BLOCK_ORDER: Record<string, number> = { income: 0, stability: 1, lifestyle: 2, build: 3 };
const BLOCK_LABELS: Record<string, string> = { income: "Ingresos", stability: "Estabilidad", lifestyle: "Calidad de vida", build: "Construcción" };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findSimilar(userCat: Category, systemCats: Category[]): Category | undefined {
  const userWords = normalize(userCat.name).split(/\s+/).filter(w => w.length > 2);
  return systemCats.find(sys => {
    const sysWords = normalize(sys.name).split(/\s+/).filter(w => w.length > 2);
    return userWords.some(uw => sysWords.some(sw => uw === sw || sw.includes(uw) || uw.includes(sw)));
  });
}

function getBlockKey(cat: Category): string {
  return cat.type === "income" ? "income" : ((cat as any).bucket ?? "lifestyle");
}

type ActionType = "unify" | "delete" | "reassign";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCategories: Category[];
  systemCategories: Category[];
}

export default function CategoryReviewSheet({ open, onOpenChange, userCategories, systemCategories }: Props) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [actionTarget, setActionTarget] = useState<{ cat: Category; type: ActionType; systemCat?: Category } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reassignSelections, setReassignSelections] = useState<Record<string, string>>({});

  // Sort user categories by block then alphabetically
  const sortedUserCats = [...userCategories].sort((a, b) => {
    const blockA = getBlockKey(a);
    const blockB = getBlockKey(b);
    const orderDiff = (BLOCK_ORDER[blockA] ?? 2) - (BLOCK_ORDER[blockB] ?? 2);
    return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
  });

  const reassignAllReferences = async (userCatId: string, newCategoryId: string | null) => {
    // 1. Reassign transactions using atomic_update_transaction RPC
    const { data: txs, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("category_id", userCatId);

    if (fetchError) throw fetchError;

    for (const tx of txs ?? []) {
      const { error } = await supabase.rpc("atomic_update_transaction", {
        p_old_id: tx.id,
        p_account_id: tx.account_id,
        p_type: tx.type,
        p_amount: tx.amount,
        p_transaction_date: tx.transaction_date,
        p_category_id: newCategoryId,
        p_description: tx.description,
        p_notes: tx.notes,
        p_currency: tx.currency,
        p_exchange_rate: tx.exchange_rate ?? 1,
        p_amount_in_base: tx.amount_in_base,
        p_is_recurring: tx.is_recurring ?? false,
        p_recurring_frequency: tx.recurring_frequency,
        p_voice_transcript: tx.voice_transcript,
      });
      if (error) throw error;
    }

    // 2. Reassign recurring_payments
    const { error: rpError } = await supabase
      .from("recurring_payments")
      .update({ category_id: newCategoryId })
      .eq("category_id", userCatId);
    if (rpError) throw rpError;

    // 3. Reassign budgets
    const { error: budgetError } = await supabase
      .from("budgets")
      .update({ category_id: newCategoryId })
      .eq("category_id", userCatId);
    if (budgetError) throw budgetError;

    // 4. Reassign budget_lines
    const { error: blError } = await supabase
      .from("budget_lines")
      .update({ category_id: newCategoryId })
      .eq("category_id", userCatId);
    if (blError) throw blError;

    // 5. Reassign voice_rules
    const { error: vrError } = await supabase
      .from("voice_rules")
      .update({ category_id: newCategoryId })
      .eq("category_id", userCatId);
    if (vrError) throw vrError;
  };

  const handleConfirm = async () => {
    if (!actionTarget) return;
    setLoading(true);
    try {
      if (actionTarget.type === "unify" && actionTarget.systemCat) {
        await reassignAllReferences(actionTarget.cat.id, actionTarget.systemCat.id);
        const { error } = await supabase.from("categories").delete().eq("id", actionTarget.cat.id);
        if (error) throw error;
        toast.success(`Transacciones reasignadas a "${actionTarget.systemCat.name}" y categoría eliminada`);
      } else if (actionTarget.type === "reassign" && actionTarget.systemCat) {
        await reassignAllReferences(actionTarget.cat.id, actionTarget.systemCat.id);
        const { error } = await supabase.from("categories").delete().eq("id", actionTarget.cat.id);
        if (error) throw error;
        toast.success(`Transacciones reasignadas a "${actionTarget.systemCat.name}" y categoría eliminada`);
      } else {
        // Delete only — reassign all references to null first
        await reassignAllReferences(actionTarget.cat.id, null);
        const { error } = await supabase.from("categories").delete().eq("id", actionTarget.cat.id);
        if (error) throw error;
        toast.success(`"${actionTarget.cat.name}" eliminada`);
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setActionTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const dismiss = (id: string) => setDismissed(prev => new Set(prev).add(id));

  const startReassign = (cat: Category) => {
    const selectedId = reassignSelections[cat.id];
    if (!selectedId) {
      toast.error("Selecciona una categoría destino");
      return;
    }
    const target = systemCategories.find(c => c.id === selectedId);
    if (target) {
      setActionTarget({ cat, type: "reassign", systemCat: target });
    }
  };

  const confirmMessage = actionTarget?.type === "delete"
    ? `Las transacciones de "${actionTarget.cat.name}" perderán su categoría. ¿Eliminar?`
    : `Se reasignarán todas tus transacciones de "${actionTarget?.cat.name}" a "${actionTarget?.systemCat?.name}" y se eliminará tu categoría. ¿Confirmar?`;

  // Group sorted cats by block for separators
  let lastBlock = "";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              Revisión de tus categorías
            </SheetTitle>
            <SheetDescription>
              Compara tus categorías personales con las del sistema y decide qué hacer con cada una.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2 pb-4">
            {sortedUserCats.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                No tienes categorías personales — solo usas las del sistema.
              </p>
            ) : (
              sortedUserCats.map(cat => {
                const block = getBlockKey(cat);
                const showSeparator = block !== lastBlock;
                if (showSeparator) lastBlock = block;

                const similar = findSimilar(cat, systemCategories);
                const isDismissed = dismissed.has(cat.id);
                const sameTypeSysCats = systemCategories.filter(sc => sc.type === cat.type);

                return (
                  <div key={cat.id}>
                    {showSeparator && (
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold pt-3 pb-1 px-1">
                        {BLOCK_LABELS[block] ?? block}
                      </p>
                    )}
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cat.type === "income" ? "Ingreso" : "Gasto"}
                            {(cat as any).bucket && ` · ${bucketLabels[(cat as any).bucket] || (cat as any).bucket}`}
                          </p>
                        </div>
                      </div>

                      {similar && !isDismissed ? (
                        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 space-y-2">
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            ⚠️ Posible duplicado con: <strong>{similar.name}</strong>
                            {(similar as any).bucket && ` (bloque: ${bucketLabels[(similar as any).bucket] || (similar as any).bucket})`}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => setActionTarget({ cat, type: "unify", systemCat: similar })}>
                              <ArrowRightLeft className="h-3 w-3" /> Unificar y eliminar la mía
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => dismiss(cat.id)}>
                              <Check className="h-3 w-3" /> Conservar separada
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive" onClick={() => setActionTarget({ cat, type: "delete" })}>
                              <Trash2 className="h-3 w-3" /> Solo eliminar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-1.5">
                          <p className="text-xs text-green-800 dark:text-green-200">
                            ✅ {isDismissed ? "Conservada como separada" : "Categoría única — no tiene duplicado en el sistema"}
                          </p>
                          {!isDismissed && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive" onClick={() => setActionTarget({ cat, type: "delete" })}>
                              <Trash2 className="h-3 w-3" /> Eliminar
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Reassign to any system category */}
                      <div className="flex items-center gap-2 pt-1">
                        <Select
                          value={reassignSelections[cat.id] ?? ""}
                          onValueChange={(val) => setReassignSelections(prev => ({ ...prev, [cat.id]: val }))}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue placeholder="Reasignar a..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sameTypeSysCats.map(sc => (
                              <SelectItem key={sc.id} value={sc.id} className="text-xs">
                                {sc.name} {(sc as any).bucket ? `(${bucketLabels[(sc as any).bucket] || (sc as any).bucket})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 shrink-0"
                          disabled={!reassignSelections[cat.id]}
                          onClick={() => startReassign(cat)}
                        >
                          <ArrowRight className="h-3 w-3" /> Reasignar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <p className="text-xs text-muted-foreground pb-2">
            Las categorías del sistema son permanentes y visibles para todos los usuarios. La opción "Unificar" es la recomendada cuando hay duplicados — mantiene tus transacciones correctamente clasificadas.
          </p>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionTarget?.type === "delete" ? `¿Eliminar "${actionTarget.cat.name}"?` : "¿Reasignar y eliminar?"}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={loading}>
              {loading ? "Procesando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
