import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'bank' | 'savings' | 'investment' | 'credit_card' | 'payable';
  currency: string;
  initial_balance: number;
  current_balance: number;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountData {
  name: string;
  type: Account['type'];
  currency: string;
  initial_balance: number;
  color?: string;
  icon?: string;
}

export function useAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  const createAccount = useMutation({
    mutationFn: async (data: CreateAccountData) => {
      const { data: newAccount, error } = await supabase
        .from('accounts')
        .insert({
          ...data,
          user_id: user!.id,
          current_balance: data.initial_balance,
        })
        .select()
        .single();
      
      if (error) throw error;
      return newAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Cuenta creada", description: "La cuenta se ha agregado correctamente." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Account> & { id: string }) => {
      const { error } = await supabase
        .from('accounts')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Cuenta actualizada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Cuenta eliminada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const totalBalance = accountsQuery.data?.reduce((sum, acc) => {
    // For credit cards and payables, the balance is negative (what you owe)
    if (acc.type === 'credit_card' || acc.type === 'payable') {
      return sum - acc.current_balance;
    }
    return sum + acc.current_balance;
  }, 0) ?? 0;

  return {
    accounts: accountsQuery.data ?? [],
    isLoading: accountsQuery.isLoading,
    error: accountsQuery.error,
    totalBalance,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
