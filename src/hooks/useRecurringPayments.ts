import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface RecurringPayment {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  original_total_amount: number | null;
  frequency: string;
  start_date: string;
  next_execution_date: string;
  end_date: string | null;
  total_payments: number | null;
  payments_made: number;
  remaining_balance: number | null;
  status: string;
  notes: string | null;
  requires_manual_action: boolean;
  confirmed_at: string | null;
  payment_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringPaymentData {
  name: string;
  description?: string;
  type: string;
  account_id: string;
  category_id?: string;
  amount: number;
  currency?: string;
  original_total_amount?: number;
  frequency: string;
  start_date: string;
  next_execution_date: string;
  end_date?: string;
  total_payments?: number;
  payments_made?: number;
  remaining_balance?: number;
  requires_manual_action?: boolean;
  notes?: string;
  payment_day?: number;
}

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  annual: "Anual",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  paused: "Pausado",
  cancelled: "Cancelado",
  completed: "Completado",
};

export function getNextExecutionDate(from: Date, frequency: string): Date {
  const next = new Date(from);
  switch (frequency) {
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "biweekly": next.setDate(next.getDate() + 14); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "bimonthly": next.setMonth(next.getMonth() + 2); break;
    case "quarterly": next.setMonth(next.getMonth() + 3); break;
    case "annual": next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

export function useRecurringPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["recurring_payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_payments" as any)
        .select("*")
        .order("next_execution_date", { ascending: true });
      if (error) throw error;
      return data as unknown as RecurringPayment[];
    },
    enabled: !!user,
  });

  const createPayment = useMutation({
    mutationFn: async (data: CreateRecurringPaymentData) => {
      const { data: result, error } = await supabase
        .from("recurring_payments" as any)
        .insert({ ...data, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
      toast({ title: "Pago recurrente creado", description: "Se ha programado correctamente." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<RecurringPayment> & { id: string }) => {
      const { error } = await supabase
        .from("recurring_payments" as any)
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
      toast({ title: "Pago recurrente actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_payments" as any)
        .update({ status: "cancelled" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
      toast({ title: "Pago recurrente cancelado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_payments" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
      toast({ title: "Pago recurrente eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return {
    payments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createPayment,
    updatePayment,
    cancelPayment,
    deletePayment,
  };
}

export function useRecurringPaymentTransactions(recurringPaymentId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recurring_payment_transactions", recurringPaymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("is_recurring", true)
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Filter client-side to avoid type issues with recurring_payment_id column
      return (data || []).filter((tx: any) => tx.recurring_payment_id === recurringPaymentId);
    },
    enabled: !!user && !!recurringPaymentId,
  });
}
