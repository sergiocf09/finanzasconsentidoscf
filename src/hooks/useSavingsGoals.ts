import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface SavingsGoal {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  goal_type: "emergency" | "retirement" | "custom";
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  description: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSavingsGoalData {
  name: string;
  goal_type: SavingsGoal["goal_type"];
  target_amount: number;
  target_date?: string;
  description?: string;
  contribution_day?: number;
  monthly_contribution?: number;
  account_id?: string; // link existing account
  create_account?: boolean; // create new account
  account_type?: "savings" | "investment";
  initial_amount?: number;
  currency?: string;
}

export function useSavingsGoals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ["savings_goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data || []) as SavingsGoal[];
    },
    enabled: !!user,
  });

  const createGoal = useMutation({
    mutationFn: async (data: CreateSavingsGoalData) => {
      let accountId = data.account_id || null;

      // Create a new account if requested
      if (data.create_account && !accountId) {
        const { data: newAccount, error: accError } = await supabase
          .from("accounts")
          .insert({
            user_id: user!.id,
            name: data.name,
            type: data.account_type || "savings",
            currency: data.currency || "MXN",
            initial_balance: data.initial_amount || 0,
            current_balance: data.initial_amount || 0,
          })
          .select()
          .single();
        if (accError) throw accError;
        accountId = newAccount.id;
      }

      // If linking to existing account, sync current_amount from account balance
      let currentAmount = data.initial_amount || 0;
      if (accountId && !data.create_account) {
        const { data: acc } = await supabase
          .from("accounts")
          .select("current_balance")
          .eq("id", accountId)
          .single();
        if (acc) currentAmount = acc.current_balance || 0;
      }

      const { error } = await supabase.from("savings_goals").insert({
        user_id: user!.id,
        name: data.name,
        goal_type: data.goal_type,
        target_amount: data.target_amount,
        current_amount: currentAmount,
        target_date: data.target_date || null,
        description: data.description || null,
        account_id: accountId,
        contribution_day: data.contribution_day || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Meta creada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...data }: Partial<SavingsGoal> & { id: string }) => {
      const { error } = await supabase
        .from("savings_goals")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      toast({ title: "Meta actualizada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      // Get linked account
      const { data: goal } = await supabase
        .from("savings_goals")
        .select("account_id")
        .eq("id", id)
        .single();

      await supabase.from("savings_goals").delete().eq("id", id);

      // Optionally deactivate linked account
      if (goal?.account_id) {
        await supabase
          .from("accounts")
          .update({ is_active: false })
          .eq("id", goal.account_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Meta eliminada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const goals = goalsQuery.data ?? [];
  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);

  return {
    goals,
    isLoading: goalsQuery.isLoading,
    totalSaved,
    totalTarget,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
