import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: "income" | "expense" | "transfer";
  icon: string | null;
  color: string | null;
  is_system: boolean;
  parent_id: string | null;
  keywords: string[];
  created_at: string;
}

export function useCategories() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const preferencesQuery = useQuery({
    queryKey: ["category_preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_category_preferences")
        .select("category_id")
        .eq("is_hidden", true);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.category_id));
    },
    enabled: !!user,
  });

  const hiddenIds: Set<string> = preferencesQuery.data ?? new Set();
  const allCategories = categoriesQuery.data ?? [];

  const categories = allCategories.filter(c => !hiddenIds.has(c.id));

  const systemCategories = allCategories.filter(c => c.is_system);
  const userCategories = allCategories.filter(c => !c.is_system);

  const expenseCategories = categories.filter(c => c.type === "expense");
  const incomeCategories = categories.filter(c => c.type === "income");
  const transferCategories = categories.filter(c => c.type === "transfer");

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; type: Category["type"]; icon?: string; color?: string }) => {
      const { error } = await supabase
        .from("categories")
        .insert({ ...data, user_id: user!.id, is_system: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoría creada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name, type, bucket }: { id: string; name: string; type: string; bucket: string }) => {
      const { error } = await supabase
        .from("categories")
        .update({ name, type, bucket } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
    },
  });

  const toggleCategoryVisibility = useMutation({
    mutationFn: async ({ categoryId, hide }: { categoryId: string; hide: boolean }) => {
      if (hide) {
        const { error } = await (supabase as any)
          .from("user_category_preferences")
          .upsert(
            { user_id: user!.id, category_id: categoryId, is_hidden: true },
            { onConflict: "user_id,category_id" }
          );
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("user_category_preferences")
          .delete()
          .eq("user_id", user!.id)
          .eq("category_id", categoryId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_preferences"] });
      queryClient.invalidateQueries({ queryKey: ["category_preferences", user?.id] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const findCategoryByKeyword = (text: string): Category | undefined => {
    const lowerText = text.toLowerCase();
    return categories.find(cat =>
      cat.keywords?.some(k => lowerText.includes(k.toLowerCase()))
    );
  };

  return {
    categories,
    allCategories,
    systemCategories,
    userCategories,
    hiddenIds,
    expenseCategories,
    incomeCategories,
    transferCategories,
    isLoading: categoriesQuery.isLoading || preferencesQuery.isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryVisibility,
    findCategoryByKeyword,
  };
}
