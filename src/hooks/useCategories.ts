import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense' | 'transfer';
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
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const expenseCategories = categoriesQuery.data?.filter(c => c.type === 'expense') ?? [];
  const incomeCategories = categoriesQuery.data?.filter(c => c.type === 'income') ?? [];
  const transferCategories = categoriesQuery.data?.filter(c => c.type === 'transfer') ?? [];

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; type: Category['type']; icon?: string; color?: string }) => {
      const { error } = await supabase
        .from('categories')
        .insert({
          ...data,
          user_id: user!.id,
          is_system: false,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: "Categoría creada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Find category by keyword
  const findCategoryByKeyword = (text: string): Category | undefined => {
    const lowerText = text.toLowerCase();
    
    return categoriesQuery.data?.find(category => 
      category.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
    );
  };

  return {
    categories: categoriesQuery.data ?? [],
    expenseCategories,
    incomeCategories,
    transferCategories,
    isLoading: categoriesQuery.isLoading,
    createCategory,
    findCategoryByKeyword,
  };
}
