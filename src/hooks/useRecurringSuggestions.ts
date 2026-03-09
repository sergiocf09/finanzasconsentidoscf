import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RecurringSuggestion {
  description: string;
  averageAmount: number;
  currency: string;
  frequency: string;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string;
  accountName: string;
  dates: string[];
  occurrences: number;
}

// Dismissed suggestions stored in localStorage to avoid re-showing
const DISMISSED_KEY = "dismissed_recurring_suggestions";

function getDismissed(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${DISMISSED_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addDismissed(userId: string, key: string) {
  const list = getDismissed(userId);
  if (!list.includes(key)) {
    list.push(key);
    localStorage.setItem(`${DISMISSED_KEY}_${userId}`, JSON.stringify(list));
  }
}

function makeSuggestionKey(s: RecurringSuggestion): string {
  return `${s.description.toLowerCase().trim()}|${s.accountId}|${s.categoryId || ""}`;
}

export function useRecurringSuggestions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch last 6 months of expense transactions
  const txQuery = useQuery({
    queryKey: ["recurring_suggestions_txs", user?.id],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data, error } = await supabase
        .from("transactions")
        .select("id, description, amount, currency, category_id, account_id, transaction_date, is_recurring")
        .eq("type", "expense")
        .gte("transaction_date", sixMonthsAgo.toISOString().split("T")[0])
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch existing recurring payment names to exclude
  const rpQuery = useQuery({
    queryKey: ["recurring_payments_names", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_payments" as any)
        .select("name");
      if (error) throw error;
      return (data || []).map((r: any) => (r.name as string).toLowerCase().trim());
    },
    enabled: !!user,
  });

  // Fetch categories + accounts for display
  const catQuery = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name");
      return data || [];
    },
    enabled: !!user,
  });

  const accQuery = useQuery({
    queryKey: ["accounts_for_suggestions", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, name");
      return data || [];
    },
    enabled: !!user,
  });

  const suggestions = useMemo<RecurringSuggestion[]>(() => {
    if (!txQuery.data || !user) return [];

    const dismissed = getDismissed(user.id);
    const existingNames = rpQuery.data || [];
    const cats = catQuery.data || [];
    const accs = accQuery.data || [];

    // Group by normalized description + account + category
    const groups = new Map<string, typeof txQuery.data>();
    
    for (const tx of txQuery.data) {
      if (tx.is_recurring) continue; // Skip already-recurring
      const desc = (tx.description || "").toLowerCase().trim();
      if (!desc || desc.length < 3) continue;
      
      const key = `${desc}|${tx.account_id}|${tx.category_id || ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }

    const results: RecurringSuggestion[] = [];

    for (const [key, txs] of groups) {
      if (txs.length < 3) continue; // Need at least 3 occurrences

      // Check if amounts are similar (within 20% of average)
      const amounts = txs.map(t => t.amount);
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const allSimilar = amounts.every(a => Math.abs(a - avg) / avg < 0.2);
      if (!allSimilar) continue;

      // Detect frequency from date gaps
      const dates = txs.map(t => t.transaction_date).sort();
      const gaps: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        const d1 = new Date(dates[i - 1]);
        const d2 = new Date(dates[i]);
        gaps.push(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
      }
      const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

      let frequency = "monthly";
      if (avgGap <= 10) frequency = "weekly";
      else if (avgGap <= 18) frequency = "biweekly";
      else if (avgGap <= 45) frequency = "monthly";
      else if (avgGap <= 75) frequency = "bimonthly";
      else if (avgGap <= 120) frequency = "quarterly";
      else frequency = "annual";

      const desc = txs[0].description || "";
      const suggestion: RecurringSuggestion = {
        description: desc,
        averageAmount: Math.round(avg * 100) / 100,
        currency: txs[0].currency,
        frequency,
        categoryId: txs[0].category_id,
        categoryName: cats.find(c => c.id === txs[0].category_id)?.name || null,
        accountId: txs[0].account_id,
        accountName: accs.find(a => a.id === txs[0].account_id)?.name || "",
        dates,
        occurrences: txs.length,
      };

      // Filter out dismissed and existing
      const sKey = makeSuggestionKey(suggestion);
      if (dismissed.includes(sKey)) continue;
      if (existingNames.includes(desc.toLowerCase().trim())) continue;

      results.push(suggestion);
    }

    return results.sort((a, b) => b.occurrences - a.occurrences);
  }, [txQuery.data, rpQuery.data, catQuery.data, accQuery.data, user]);

  const dismiss = (suggestion: RecurringSuggestion) => {
    if (!user) return;
    addDismissed(user.id, makeSuggestionKey(suggestion));
    queryClient.invalidateQueries({ queryKey: ["recurring_suggestions_txs"] });
  };

  return {
    suggestions,
    isLoading: txQuery.isLoading,
    dismiss,
  };
}
