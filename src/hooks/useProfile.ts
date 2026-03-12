import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  base_currency: string;
  onboarding_dismissed: boolean;
  weekly_summary_last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  const updateWeeklySummarySeen = async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ weekly_summary_last_seen: format(new Date(), "yyyy-MM-dd") } as any)
      .eq("id", user.id);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateWeeklySummarySeen,
  };
}
