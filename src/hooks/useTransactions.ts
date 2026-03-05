import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: 'income' | 'expense' | 'transfer' | 'adjustment_income' | 'adjustment_expense';
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_in_base: number | null;
  description: string | null;
  notes: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  related_account_id: string | null;
  voice_transcript: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionData {
  account_id: string;
  category_id?: string;
  type: Transaction['type'];
  amount: number;
  currency: string;
  exchange_rate?: number;
  description?: string;
  notes?: string;
  transaction_date: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  related_account_id?: string;
  voice_transcript?: string;
}

export function useTransactions(options?: { startDate?: Date; endDate?: Date }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const startDate = options?.startDate ?? startOfMonth(new Date());
  const endDate = options?.endDate ?? endOfMonth(new Date());

  const transactionsQuery = useQuery({
    queryKey: ['transactions', user?.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
        .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const createTransaction = useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      const { data: newTx, error } = await supabase
        .from('transactions')
        .insert({
          ...data,
          user_id: user!.id,
          amount_in_base: data.amount * (data.exchange_rate ?? 1),
        })
        .select()
        .single();
      
      if (error) throw error;
      return newTx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Movimiento registrado", description: "Se ha guardado correctamente." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Transaction> & { id: string }) => {
      // If amount or type changed, we need to delete-then-reinsert for trigger correctness
      // But simpler: just update the row. The trigger only fires on INSERT/DELETE, not UPDATE.
      // So we must handle balance manually or use a different approach.
      // Safest: delete old, insert new (triggers handle balance automatically).
      const { data: oldTx, error: fetchErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      // Delete old (trigger reverses old balance)
      const { error: delErr } = await supabase.from('transactions').delete().eq('id', id);
      if (delErr) throw delErr;

      // Insert updated (trigger applies new balance)
      const merged = { ...oldTx, ...data };
      delete (merged as any).id;
      delete (merged as any).created_at;
      delete (merged as any).updated_at;
      merged.amount_in_base = merged.amount * (merged.exchange_rate ?? 1);

      const { data: newTx, error: insErr } = await supabase
        .from('transactions')
        .insert(merged)
        .select()
        .single();
      if (insErr) throw insErr;
      return newTx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Movimiento actualizado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Movimiento eliminado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Calculate totals
  // Calculate totals — adjustments are excluded from income/expense
  const totals = transactionsQuery.data?.reduce(
    (acc, tx) => {
      if (tx.type === 'income') acc.income += tx.amount;
      else if (tx.type === 'expense') acc.expense += tx.amount;
      else if (tx.type === 'transfer') acc.transfer += tx.amount;
      // adjustment_income and adjustment_expense are intentionally excluded
      return acc;
    },
    { income: 0, expense: 0, transfer: 0 }
  ) ?? { income: 0, expense: 0, transfer: 0 };

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    error: transactionsQuery.error,
    totals,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
