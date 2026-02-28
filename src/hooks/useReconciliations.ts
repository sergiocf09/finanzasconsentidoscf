import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Reconciliation {
  id: string;
  account_id: string;
  user_id: string;
  previous_balance: number;
  new_balance: number;
  delta: number;
  note: string | null;
  reconciled_at: string;
}

export function useReconciliations(accountId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["reconciliations", accountId],
    queryFn: async () => {
      let q = supabase
        .from("account_reconciliations")
        .select("*")
        .order("reconciled_at", { ascending: false });

      if (accountId) {
        q = q.eq("account_id", accountId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Reconciliation[];
    },
    enabled: !!user,
  });

  const deleteReconciliation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("account_reconciliations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      toast({ title: "Nota de conciliación eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return {
    reconciliations: query.data ?? [],
    isLoading: query.isLoading,
    deleteReconciliation,
  };
}
