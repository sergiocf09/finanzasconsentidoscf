import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  amount_in_base?: number;
  description?: string;
  notes?: string;
  transaction_date: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  related_account_id?: string;
  voice_transcript?: string;
}

const PAGE_SIZE = 30;

/**
 * Standard hook – loads all transactions in a date range.
 * Used by dashboard widgets and summaries where full-period data is needed.
 */
export function useTransactions(options?: { startDate?: Date; endDate?: Date; enabled?: boolean }) {
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
    enabled: !!user && options?.enabled !== false,
  });

  const createTransaction = useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      const { data: newTx, error } = await supabase
        .from('transactions')
        .insert({
          ...data,
          user_id: user!.id,
          amount_in_base: data.amount_in_base ?? data.amount * (data.exchange_rate ?? 1),
        })
        .select()
        .single();
      
      if (error) throw error;
      return newTx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions_paginated'] });
      queryClient.invalidateQueries({ queryKey: ['transactions_search'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
      toast({ title: "Movimiento registrado", description: "Se ha guardado correctamente." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Transaction> & { id: string }) => {
      const { data: oldTx, error: fetchErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const merged = { ...oldTx, ...data };

      // Only recalculate amount_in_base if amount or exchange_rate actually changed
      const amountChanged = data.amount !== undefined && data.amount !== oldTx.amount;
      const rateChanged = data.exchange_rate !== undefined && data.exchange_rate !== oldTx.exchange_rate;

      if (amountChanged || rateChanged) {
        const rate = merged.exchange_rate ?? 1;
        // When rate < 1, it means the original was MXN→USD (rate = 1/fxRate)
        // so amount_in_base = amount / rate to get back MXN
        if (rate > 0 && rate < 1) {
          merged.amount_in_base = merged.amount / rate;
        } else {
          merged.amount_in_base = merged.amount * rate;
        }
      }
      // else: keep the existing amount_in_base from the DB

      const { data: result, error } = await supabase.rpc('atomic_update_transaction', {
        p_old_id: id,
        p_account_id: merged.account_id,
        p_type: merged.type,
        p_amount: merged.amount,
        p_transaction_date: merged.transaction_date,
        p_category_id: merged.category_id ?? null,
        p_description: merged.description ?? null,
        p_notes: merged.notes ?? null,
        p_currency: merged.currency ?? 'MXN',
        p_exchange_rate: merged.exchange_rate ?? 1,
        p_amount_in_base: merged.amount_in_base ?? null,
        p_is_recurring: merged.is_recurring ?? false,
        p_recurring_frequency: merged.recurring_frequency ?? null,
        p_related_account_id: merged.related_account_id ?? null,
        p_voice_transcript: merged.voice_transcript ?? null,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions_paginated'] });
      queryClient.invalidateQueries({ queryKey: ['transactions_search'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
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
      queryClient.invalidateQueries({ queryKey: ['transactions_paginated'] });
      queryClient.invalidateQueries({ queryKey: ['transactions_search'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
      toast({ title: "Movimiento eliminado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const totals = transactionsQuery.data?.reduce(
    (acc, tx) => {
      const base = tx.amount_in_base ?? tx.amount;
      if (tx.type === 'income') acc.income += base;
      else if (tx.type === 'expense') acc.expense += base;
      return acc;
    },
    { income: 0, expense: 0 }
  ) ?? { income: 0, expense: 0 };

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

/**
 * Paginated hook – loads transactions in pages of PAGE_SIZE using cursor-based pagination.
 * Used by the Transactions list page for efficient infinite scrolling.
 */
export function useTransactionsPaginated(options?: {
  startDate?: Date;
  endDate?: Date;
  typeFilter?: string;
  searchQuery?: string;
  sortAsc?: boolean;
  categories?: { id: string; name: string }[];
  accounts?: { id: string; name: string }[];
}) {
  const { user } = useAuth();
  const startDate = options?.startDate ?? startOfMonth(new Date());
  const endDate = options?.endDate ?? endOfMonth(new Date());
  const typeFilter = options?.typeFilter ?? "all";
  const searchQuery = options?.searchQuery?.trim().toLowerCase() ?? "";
  const sortAsc = options?.sortAsc ?? false;
  const categories = options?.categories ?? [];
  const accounts = options?.accounts ?? [];

  // When searching, use a dedicated query that searches ALL transactions in the period at DB level
  const searchResultsQuery = useQuery({
    queryKey: [
      'transactions_search',
      user?.id,
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd'),
      typeFilter,
      sortAsc,
      searchQuery,
      accounts.map(a => a.id).join(','),
    ],
    queryFn: async () => {
      // Build category IDs that match the search query
      const matchingCategoryIds = categories
        .filter(c => c.name.toLowerCase().includes(searchQuery))
        .map(c => c.id);

      // Build account IDs whose name matches the search query
      const matchingAccountIds = accounts
        .filter(a => a.name.toLowerCase().includes(searchQuery))
        .map(a => a.id);

      // Query with ilike on description and notes
      let query = supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
        .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
        .order('transaction_date', { ascending: sortAsc })
        .order('created_at', { ascending: sortAsc });

      if (typeFilter === 'income') query = query.eq('type', 'income');
      else if (typeFilter === 'expense') query = query.eq('type', 'expense');

      // Use OR filter: description, notes, matching category_id, or matching account_id
      const orFilters = [
        `description.ilike.%${searchQuery}%`,
        `notes.ilike.%${searchQuery}%`,
      ];
      if (matchingCategoryIds.length > 0) {
        orFilters.push(`category_id.in.(${matchingCategoryIds.join(',')})`);
      }
      if (matchingAccountIds.length > 0) {
        orFilters.push(`account_id.in.(${matchingAccountIds.join(',')})`);
        orFilters.push(`related_account_id.in.(${matchingAccountIds.join(',')})`);
      }
      query = query.or(orFilters.join(','));

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user && searchQuery.length > 0,
  });

  const infiniteQuery = useInfiniteQuery({
    queryKey: [
      'transactions_paginated',
      user?.id,
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd'),
      typeFilter,
      sortAsc,
    ],
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
        .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
        .order('transaction_date', { ascending: sortAsc })
        .order('created_at', { ascending: sortAsc })
        .limit(PAGE_SIZE);

      // Type filter at DB level
      if (typeFilter === 'income') query = query.eq('type', 'income');
      else if (typeFilter === 'expense') query = query.eq('type', 'expense');

      // Cursor-based pagination: use offset from pageParam
      if (pageParam > 0) {
        query = query.range(pageParam, pageParam + PAGE_SIZE - 1);
      } else {
        query = query.range(0, PAGE_SIZE - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    enabled: !!user && searchQuery.length === 0,
  });

  // When searching: use search results. Otherwise: use paginated results.
  const isSearching = searchQuery.length > 0;
  const transactions = isSearching
    ? (searchResultsQuery.data ?? [])
    : (infiniteQuery.data?.pages.flat() ?? []);

  return {
    transactions,
    isLoading: isSearching ? searchResultsQuery.isLoading : infiniteQuery.isLoading,
    isFetchingNextPage: isSearching ? false : infiniteQuery.isFetchingNextPage,
    hasNextPage: isSearching ? false : infiniteQuery.hasNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    error: isSearching ? searchResultsQuery.error : infiniteQuery.error,
  };
}
