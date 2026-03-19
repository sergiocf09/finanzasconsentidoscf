import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: 'credit_card' | 'personal_loan' | 'mortgage' | 'car_loan' | 'student_loan' | 'other';
  creditor: string | null;
  original_amount: number;
  current_balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number | null;
  cut_day: number | null;
  start_date: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  account_id: string | null;
  planned_payment: number;
  debt_category: 'current' | 'fixed';
  monthly_commitment: number;
  last_statement_balance: number | null;
  last_statement_date: string | null;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  payment_type: 'capital' | 'interest_insurance' | 'adjustment';
  interest_amount: number;
  transaction_id: string | null;
}

export interface CreateDebtData {
  name: string;
  type: Debt['type'];
  creditor?: string;
  original_amount: number;
  current_balance: number;
  interest_rate?: number;
  minimum_payment?: number;
  due_day?: number;
  cut_day?: number;
  start_date?: string;
  currency?: string;
  debt_category?: string;
  monthly_commitment?: number;
}

// Map debt type → account type
const debtTypeToAccountType: Record<string, string> = {
  credit_card: "credit_card",
  personal_loan: "personal_loan",
  mortgage: "mortgage",
  car_loan: "auto_loan",
  student_loan: "personal_loan",
  other: "payable",
};

export function useDebts(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const debtsQuery = useQuery({
    queryKey: ['debts', user?.id],
    queryFn: async () => {
      // 1) Fetch debts
      const { data: debts, error } = await supabase
        .from('debts')
        .select('*')
        .eq('is_active', true)
        .order('current_balance', { ascending: false });
      if (error) throw error;

      // 2) Fetch liability accounts that don't have a linked debt
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .in('type', ['credit_card', 'personal_loan', 'mortgage', 'auto_loan', 'payable', 'caucion_bursatil']);

      const linkedAccountIds = new Set((debts || []).filter(d => d.account_id).map(d => d.account_id));
      const orphanAccounts = (accounts || []).filter(a => !linkedAccountIds.has(a.id));

      // Auto-create debt entries for orphan liability accounts
      if (orphanAccounts.length > 0 && user) {
        const accountTypeToDebtType: Record<string, string> = {
          credit_card: "credit_card",
          personal_loan: "personal_loan",
          mortgage: "mortgage",
          auto_loan: "car_loan",
          payable: "other",
          caucion_bursatil: "other",
        };
        for (const acc of orphanAccounts) {
          await supabase.from('debts').insert({
            user_id: user.id,
            name: acc.name,
            type: accountTypeToDebtType[acc.type] || "other",
            original_amount: Math.abs(acc.initial_balance || acc.current_balance || 0),
            current_balance: Math.abs(acc.current_balance || 0),
            currency: acc.currency,
            account_id: acc.id,
          });
        }
        // Re-fetch after sync
        const { data: refreshed } = await supabase
          .from('debts')
          .select('*')
          .eq('is_active', true)
          .order('current_balance', { ascending: false });
        return (refreshed || []) as Debt[];
      }

      return (debts || []) as Debt[];
    },
    enabled: !!user && options?.enabled !== false,
  });

  const createDebt = useMutation({
    mutationFn: async (data: CreateDebtData) => {
      // 1) Create the liability account first
      const accountType = debtTypeToAccountType[data.type] || "payable";
      const { data: newAccount, error: accError } = await supabase
        .from('accounts')
        .insert({
          user_id: user!.id,
          name: data.name,
          type: accountType,
          currency: data.currency || "MXN",
          initial_balance: -Math.abs(data.original_amount),
          current_balance: -Math.abs(data.current_balance),
        })
        .select()
        .single();
      if (accError) throw accError;

      // 2) Create the debt linked to the account
      const { error } = await supabase
        .from('debts')
        .insert({
          ...data,
          user_id: user!.id,
          account_id: newAccount.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Deuda registrada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDebt = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Debt> & { id: string }) => {
      const { error } = await supabase
        .from('debts')
        .update(data)
        .eq('id', id);
      if (error) throw error;

      // Sync name/balance to linked account
      if (data.account_id || data.name || data.current_balance !== undefined) {
        const { data: debt } = await supabase.from('debts').select('account_id').eq('id', id).single();
        if (debt?.account_id) {
          const updates: Record<string, any> = {};
          if (data.name) updates.name = data.name;
          if (data.current_balance !== undefined) updates.current_balance = data.current_balance;
          if (Object.keys(updates).length > 0) {
            await supabase.from('accounts').update(updates).eq('id', debt.account_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Deuda actualizada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Soft delete — deactivate debt + linked account, preserve all history
  const deleteDebt = useMutation({
    mutationFn: async (id: string) => {
      const { data: debt } = await supabase.from('debts').select('account_id').eq('id', id).single();
      const { error } = await supabase.from('debts').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      // Also deactivate linked account
      if (debt?.account_id) {
        await supabase.from('accounts').update({ is_active: false }).eq('id', debt.account_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Deuda desactivada", description: "La deuda y su cuenta asociada ya no aparecen en listas activas. El historial se mantiene intacto." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addPayment = useMutation({
    mutationFn: async (data: { debt_id: string; amount: number; payment_date?: string; notes?: string; payment_type?: string; interest_amount?: number; transaction_id?: string }) => {
      const { error } = await supabase
        .from('debt_payments')
        .insert({
          debt_id: data.debt_id,
          user_id: user!.id,
          amount: data.amount,
          payment_date: data.payment_date ?? new Date().toISOString().split('T')[0],
          notes: data.notes,
          payment_type: data.payment_type || 'capital',
          interest_amount: data.interest_amount || 0,
          transaction_id: data.transaction_id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: "Pago registrado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const totalDebt = debtsQuery.data?.reduce((sum, d) => sum + Math.abs(d.current_balance), 0) ?? 0;
  const totalMinimumPayment = debtsQuery.data?.reduce((sum, d) => sum + d.minimum_payment, 0) ?? 0;
  const snowballOrder = [...(debtsQuery.data ?? [])].filter(d => Math.abs(d.current_balance) > 0).sort((a, b) => Math.abs(a.current_balance) - Math.abs(b.current_balance));
  const avalancheOrder = [...(debtsQuery.data ?? [])].filter(d => Math.abs(d.current_balance) > 0).sort((a, b) => b.interest_rate - a.interest_rate);

  return {
    debts: debtsQuery.data ?? [],
    isLoading: debtsQuery.isLoading,
    error: debtsQuery.error,
    totalDebt,
    totalMinimumPayment,
    snowballOrder,
    avalancheOrder,
    createDebt,
    updateDebt,
    deleteDebt,
    addPayment,
  };
}
