import { useState } from "react";
import { Plus, Pencil, Trash2, Tag, DollarSign, Shield, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories, Category } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BlockKey = "income" | "stability" | "lifestyle" | "build";

const blocks: { key: BlockKey; label: string; icon: React.ReactNode; colorClass: string; bgClass: string; type?: string; bucket?: string }[] = [
  { key: "income", label: "Ingresos", icon: <DollarSign className="h-5 w-5" />, colorClass: "text-[hsl(var(--finance-income))]", bgClass: "bg-[hsl(var(--finance-income)/0.12)] border-[hsl(var(--finance-income)/0.3)]", type: "income" },
  { key: "stability", label: "Estabilidad", icon: <Shield className="h-5 w-5" />, colorClass: "text-[hsl(var(--block-stability))]", bgClass: "bg-[hsl(var(--block-stability)/0.12)] border-[hsl(var(--block-stability)/0.3)]", type: "expense", bucket: "stability" },
  { key: "lifestyle", label: "Calidad de vida", icon: <Sparkles className="h-5 w-5" />, colorClass: "text-[hsl(var(--block-lifestyle))]", bgClass: "bg-[hsl(var(--block-lifestyle)/0.12)] border-[hsl(var(--block-lifestyle)/0.3)]", type: "expense", bucket: "lifestyle" },
  { key: "build", label: "Construcción", icon: <TrendingUp className="h-5 w-5" />, colorClass: "text-[hsl(var(--block-build))]", bgClass: "bg-[hsl(var(--block-build)/0.12)] border-[hsl(var(--block-build)/0.3)]", type: "expense", bucket: "build" },
];

const bucketLabels: Record<string, string> = {
  stability: "Estabilidad",
  lifestyle: "Calidad de vida",
  build: "Construcción",
};

export default function Categories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { categories, isLoading } = useCategories();
  const [activeBlock, setActiveBlock] = useState<BlockKey | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("expense");
  const [bucket, setBucket] = useState<string>("lifestyle");

  const filteredCategories = (): Category[] => {
    if (!activeBlock) return [];
    const block = blocks.find(b => b.key === activeBlock)!;
    if (block.key === "income") {
      return categories.filter(c => c.type === "income");
    }
    return categories.filter(c => c.type === "expense" && (c as any).bucket === block.bucket);
  };

  const openCreate = () => {
    setEditCat(null);
    setName("");
    if (activeBlock === "income") {
      setType("income");
      setBucket("lifestyle");
    } else if (activeBlock) {
      setType("expense");
      setBucket(activeBlock === "stability" ? "stability" : activeBlock === "build" ? "build" : "lifestyle");
    } else {
      setType("expense");
      setBucket("lifestyle");
    }
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setName(cat.name);
    setType(cat.type);
    setBucket((cat as any).bucket || "lifestyle");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    try {
      if (editCat) {
        const { error } = await supabase
          .from("categories")
          .update({ name: name.trim(), type, bucket })
          .eq("id", editCat.id);
        if (error) throw error;
        toast.success("Categoría actualizada");
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ name: name.trim(), type, bucket, user_id: user.id, is_system: false });
        if (error) throw error;
        toast.success("Categoría creada");
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setFormOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoría eliminada");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const cats = filteredCategories();

  return (
    <div className="space-y-6">
      {/* Sticky header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 -mx-1 px-1 pt-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Categorías</h1>
            <p className="text-muted-foreground text-sm">Organiza tus movimientos por categoría</p>
          </div>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva categoría
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Block selector — Ingresos centered on top, then 3 expense blocks */}
          <div className="space-y-3">
            {/* Ingresos row */}
            <div className="flex justify-center">
              <button
                onClick={() => setActiveBlock(activeBlock === "income" ? null : "income")}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all font-medium text-sm",
                  blocks[0].bgClass, blocks[0].colorClass,
                  activeBlock === "income" ? "ring-2 ring-offset-2 ring-[hsl(var(--finance-income))] scale-105" : "opacity-80 hover:opacity-100"
                )}
              >
                {blocks[0].icon}
                {blocks[0].label}
                <span className="text-xs opacity-70">({categories.filter(c => c.type === "income").length})</span>
              </button>
            </div>

            {/* Expense blocks row */}
            <div className="grid grid-cols-3 gap-2">
              {blocks.slice(1).map(block => {
                const count = categories.filter(c => c.type === "expense" && (c as any).bucket === block.bucket).length;
                return (
                  <button
                    key={block.key}
                    onClick={() => setActiveBlock(activeBlock === block.key ? null : block.key)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all font-medium text-xs sm:text-sm",
                      block.bgClass, block.colorClass,
                      activeBlock === block.key ? "ring-2 ring-offset-2 scale-105" : "opacity-80 hover:opacity-100",
                      activeBlock === block.key && block.key === "stability" && "ring-[hsl(var(--block-stability))]",
                      activeBlock === block.key && block.key === "lifestyle" && "ring-[hsl(var(--block-lifestyle))]",
                      activeBlock === block.key && block.key === "build" && "ring-[hsl(var(--block-build))]",
                    )}
                  >
                    {block.icon}
                    <span className="leading-tight text-center">{block.label}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category list for active block */}
          {activeBlock && (
            <div className="space-y-2 animate-fade-in-up">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {blocks.find(b => b.key === activeBlock)?.label} — {cats.length} categoría{cats.length !== 1 ? "s" : ""}
              </h2>
              {cats.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">Sin categorías en este bloque</p>
              ) : (
                cats.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{cat.name}</p>
                      {cat.type === "expense" && (
                        <span className="text-xs text-muted-foreground">
                          {bucketLabels[(cat as any).bucket] || "Sin bloque"}
                        </span>
                      )}
                    </div>
                    {!cat.is_system && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(cat)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCat ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
            <DialogDescription>Define nombre, tipo y bloque presupuestario.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Viajes" />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="income">Ingreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "expense" && (
              <div>
                <label className="text-sm font-medium">Bloque presupuestario</label>
                <Select value={bucket} onValueChange={setBucket}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stability">🔵 Estabilidad</SelectItem>
                    <SelectItem value="lifestyle">🟡 Calidad de vida</SelectItem>
                    <SelectItem value="build">🟢 Construcción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={!name.trim()}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Los movimientos con esta categoría quedarán sin categoría asignada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
