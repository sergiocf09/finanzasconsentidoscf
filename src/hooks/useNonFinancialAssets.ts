import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface NonFinancialAsset {
  id: string;
  name: string;
  asset_type: "real_estate" | "vehicle" | "furniture" | "valuables" | "other";
  description?: string;
  acquisition_value?: number;
  current_value: number;
  acquisition_date?: string;
  currency: string;
  linked_debt_id?: string;
  is_active: boolean;
  include_in_summary: boolean;
  created_at: string;
  updated_at: string;
}

export const NFA_TYPE_LABELS: Record<string, string> = {
  real_estate: "Inmueble",
  vehicle: "Vehículo",
  furniture: "Bien mueble",
  valuables: "Valioso / Joya",
  other: "Otro activo",
};

export function useNonFinancialAssets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["non_financial_assets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("non_financial_assets" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NonFinancialAsset[];
    },
    enabled: !!user,
  });

  const totalNFAByCurrency = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.current_value;
    return acc;
  }, {});

  const createAsset = useMutation({
    mutationFn: async (payload: Partial<NonFinancialAsset>) => {
      const { error } = await supabase
        .from("non_financial_assets" as any)
        .insert({ ...payload, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["non_financial_assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
    },
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<NonFinancialAsset> & { id: string }) => {
      const { error } = await supabase
        .from("non_financial_assets" as any)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["non_financial_assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("non_financial_assets" as any)
        .update({ is_active: false })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["non_financial_assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
    },
  });

  return { assets, isLoading, totalNFAByCurrency, createAsset, updateAsset, deleteAsset };
}
