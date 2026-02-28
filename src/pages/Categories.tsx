import { useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories, Category } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const bucketLabels: Record<string, string> = {
  stability: "Estabilidad",
  lifestyle: "Calidad de vida",
  build: "Construcción",
};

const bucketColors: Record<string, string> = {
  stability: "bg-[hsl(var(--block-stability)/0.1)] text-[hsl(var(--block-stability))]",
  lifestyle: "bg-[hsl(var(--block-lifestyle)/0.1)] text-[hsl(var(--block-lifestyle))]",
  build: "bg-[hsl(var(--block-build)/0.1)] text-[hsl(var(--block-build))]",
};

export default function Categories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { categories, expenseCategories, incomeCategories, isLoading } = useCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("expense");
  const [bucket, setBucket] = useState<string>("lifestyle");

  const openCreate = () => {
    setEditCat(null);
    setName("");
    setType("expense");
    setBucket("lifestyle");
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

  const renderList = (cats: Category[]) =>
    cats.length === 0 ? (
      <p className="text-center py-8 text-sm text-muted-foreground">Sin categorías</p>
    ) : (
      <div className="space-y-2">
        {cats.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{cat.name}</p>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", bucketColors[(cat as any).bucket || "lifestyle"])}>
                {bucketLabels[(cat as any).bucket || "lifestyle"]}
              </span>
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
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Categorías</h1>
          <p className="text-muted-foreground">Organiza tus movimientos por categoría</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <Tabs defaultValue="expense">
          <TabsList>
            <TabsTrigger value="expense">Gastos ({expenseCategories.length})</TabsTrigger>
            <TabsTrigger value="income">Ingresos ({incomeCategories.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="expense" className="mt-4">{renderList(expenseCategories)}</TabsContent>
          <TabsContent value="income" className="mt-4">{renderList(incomeCategories)}</TabsContent>
        </Tabs>
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
