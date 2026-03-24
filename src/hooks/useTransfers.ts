import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface Transfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount_from: number;
  currency_from: string;
  amount_to: number;
  currency_to: string;
  fx_rate: number | null;
  transfer_date: string;
  description: string | null;
  created_from: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferData {
  from_account_id: string;
  to_account_id: string;
  amount_from: number;
  currency_from: string;
  amount_to: number;
  currency_to: string;
  fx_rate?: number;
  transfer_date: string;
  description?: string;
  created_from?: string;
}

export function useTransfers(accountId?: string, options?: { startDate?: Date; endDate?: Date; enabled?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startDate = options?.startDate;
  const endDate = options?.endDate;

  const transfersQuery = useQuery({
    queryKey: ['transfers', user?.id, accountId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('transfers')
        .select('*')
        .order('transfer_date', { ascending: false });

      if (accountId) {
        query = query.or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`);
      }

      if (startDate) {
        query = query.gte('transfer_date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('transfer_date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transfer[];
    },
    enabled: !!user && options?.enabled !== false,
  });

  const createTransfer = useMutation({
    mutationFn: async (data: CreateTransferData) => {
      const { error } = await supabase
        .from('transfers')
        .insert({
          ...data,
          user_id: user!.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
      toast({ title: "Transferencia registrada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTransfer = useMutation({
    mutationFn: async (data: {
      id: string;
      from_account_id: string;
      to_account_id: string;
      amount_from: number;
      amount_to: number;
      currency_from: string;
      currency_to: string;
      fx_rate?: number | null;
      transfer_date: string;
      description?: string | null;
    }) => {
      const { id, ...rest } = data;
      const { error: delErr } = await supabase.from('transfers').delete().eq('id', id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('transfers').insert({
        ...rest,
        user_id: user!.id,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
      toast({ title: "Transferencia actualizada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transfers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
      queryClient.invalidateQueries({ queryKey: ['due_date_transfers'] });
      toast({ title: "Transferencia eliminada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const totalTransferAmount = (transfersQuery.data ?? []).reduce(
    (sum, t) => sum + t.amount_from, 0
  );

  return {
    transfers: transfersQuery.data ?? [],
    isLoading: transfersQuery.isLoading,
    error: transfersQuery.error,
    totalTransferAmount,
    createTransfer,
    updateTransfer,
    deleteTransfer,
  };
}
