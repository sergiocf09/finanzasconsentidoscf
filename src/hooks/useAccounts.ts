import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const ASSET_TYPES = ['cash', 'bank', 'savings', 'investment'] as const;
export const LIABILITY_SHORT_TYPES = ['credit_card'] as const;
export const LIABILITY_LONG_TYPES = ['mortgage', 'auto_loan', 'personal_loan', 'caucion_bursatil', 'payable'] as const;
export const ALL_LIABILITY_TYPES = [...LIABILITY_SHORT_TYPES, ...LIABILITY_LONG_TYPES] as const;

export type AccountType = typeof ASSET_TYPES[number] | typeof ALL_LIABILITY_TYPES[number];

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  current_balance: number;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  include_in_summary: boolean;
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

export const isAssetType = (type: string) => (ASSET_TYPES as readonly string[]).includes(type);
export const isLiabilityShort = (type: string) => (LIABILITY_SHORT_TYPES as readonly string[]).includes(type);
export const isLiabilityLong = (type: string) => (LIABILITY_LONG_TYPES as readonly string[]).includes(type);
export const isLiability = (type: string) => isLiabilityShort(type) || isLiabilityLong(type);

export function useAccounts(options?: { enabled?: boolean }) {
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
    enabled: !!user && options?.enabled !== false,
  });

  const createAccount = useMutation({
    mutationFn: async (data: CreateAccountData) => {
      const safeBalance = Number.isFinite(data.initial_balance) ? data.initial_balance : 0;
      const { data: newAccount, error } = await supabase
        .from('accounts')
        .insert({
          ...data,
          user_id: user!.id,
          initial_balance: safeBalance,
          current_balance: safeBalance,
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

  // Soft delete — marks inactive, preserves ledger + syncs to debts
  const deactivateAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      // Also deactivate any linked debt
      await supabase.from('debts').update({ is_active: false }).eq('account_id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: "Cuenta desactivada", description: "La cuenta ya no aparece en listas activas." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // deleteAccount is now an alias for deactivateAccount (soft delete only)
  const deleteAccount = deactivateAccount;

  const allAccounts = accountsQuery.data ?? [];
  const activeOnly = allAccounts.filter(a => a.is_active);

  // Group balances by currency for assets
  const assetsByCurrency: Record<string, number> = {};
  const liabilitiesByCurrency: Record<string, number> = {};
  
  activeOnly.forEach(acc => {
    if (isAssetType(acc.type)) {
      assetsByCurrency[acc.currency] = (assetsByCurrency[acc.currency] ?? 0) + (acc.current_balance ?? 0);
    } else if (isLiability(acc.type)) {
      liabilitiesByCurrency[acc.currency] = (liabilitiesByCurrency[acc.currency] ?? 0) + Math.abs(acc.current_balance ?? 0);
    }
  });

  const totalBalance = activeOnly
    .filter(acc => acc.include_in_summary !== false)
    .reduce((sum, acc) => {
      if (isLiability(acc.type)) return sum - Math.abs(acc.current_balance);
      return sum + acc.current_balance;
    }, 0);

  return {
    accounts: allAccounts,
    isLoading: accountsQuery.isLoading,
    error: accountsQuery.error,
    totalBalance,
    assetsByCurrency,
    liabilitiesByCurrency,
    createAccount,
    updateAccount,
    deactivateAccount,
    deleteAccount,
  };
}
