import { useState } from "react";
import { Sparkles, Trash2, Check, Tag, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Category } from "@/hooks/useCategories";

const bucketLabels: Record<string, string> = {
  stability: "Estabilidad",
  lifestyle: "Calidad de vida",
  build: "Construcción",
};

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

type ActionType = "unify" | "delete";

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

  const handleConfirm = async () => {
    if (!actionTarget) return;
    setLoading(true);
    try {
      if (actionTarget.type === "unify" && actionTarget.systemCat) {
        // Reassign transactions then delete
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ category_id: actionTarget.systemCat.id })
          .eq("category_id", actionTarget.cat.id);
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from("categories")
          .delete()
          .eq("id", actionTarget.cat.id);
        if (deleteError) throw deleteError;

        toast.success(`Transacciones reasignadas a "${actionTarget.systemCat.name}" y categoría eliminada`);
      } else {
        // Delete only
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

  const confirmMessage = actionTarget?.type === "unify" && actionTarget.systemCat
    ? `Se reasignarán todas tus transacciones a "${actionTarget.systemCat.name}" y se eliminará tu categoría "${actionTarget.cat.name}". ¿Confirmar?`
    : `Los movimientos con "${actionTarget?.cat.name}" quedarán sin categoría asignada. ¿Eliminar?`;

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

          <div className="space-y-3 pb-4">
            {userCategories.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                No tienes categorías personales — solo usas las del sistema.
              </p>
            ) : (
              userCategories.map(cat => {
                const similar = findSimilar(cat, systemCategories);
                const isDismissed = dismissed.has(cat.id);

                return (
                  <div key={cat.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
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
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
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
              {actionTarget?.type === "unify" ? "¿Unificar y eliminar?" : `¿Eliminar "${actionTarget?.cat.name}"?`}
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
