import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

export function useTransfers(accountId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transfersQuery = useQuery({
    queryKey: ['transfers', user?.id, accountId],
    queryFn: async () => {
      let query = supabase
        .from('transfers')
        .select('*')
        .order('transfer_date', { ascending: false });

      if (accountId) {
        query = query.or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transfer[];
    },
    enabled: !!user,
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
      toast({ title: "Transferencia registrada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transfers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Transferencia eliminada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    transfers: transfersQuery.data ?? [],
    isLoading: transfersQuery.isLoading,
    error: transfersQuery.error,
    createTransfer,
    deleteTransfer,
  };
}
