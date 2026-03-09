-- Consolidated dashboard RPC that returns all dashboard data in a single query
-- This reduces 8-12 separate queries to 1, improving latency significantly

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_start DATE := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::DATE);
  v_end DATE := COALESCE(p_end_date, (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::DATE);
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    -- Period totals (income/expense)
    'period_totals', (
      SELECT jsonb_build_object(
        'income', COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
        'expense', COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
      )
      FROM public.transactions
      WHERE user_id = v_user_id
        AND transaction_date >= v_start
        AND transaction_date <= v_end
    ),
    
    -- Transfer totals for period
    'transfer_total', (
      SELECT COALESCE(SUM(amount_from), 0)
      FROM public.transfers
      WHERE user_id = v_user_id
        AND transfer_date >= v_start
        AND transfer_date <= v_end
    ),
    
    -- Account balances grouped by type and currency
    'accounts_summary', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT 
          id, name, type, currency, current_balance, is_active
        FROM public.accounts
        WHERE user_id = v_user_id AND is_active = true
        ORDER BY type, name
      ) t
    ),
    
    -- Recent transactions (last 10)
    'recent_transactions', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT 
          id, account_id, category_id, type, amount, currency, 
          description, transaction_date, created_at
        FROM public.transactions
        WHERE user_id = v_user_id
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT 10
      ) t
    ),
    
    -- Upcoming due dates (debts with due_day)
    'upcoming_debts', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT 
          id, name, due_day, minimum_payment, currency, account_id
        FROM public.debts
        WHERE user_id = v_user_id 
          AND is_active = true 
          AND due_day IS NOT NULL
        ORDER BY due_day
      ) t
    ),
    
    -- Upcoming savings contributions
    'upcoming_goals', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT 
          id, name, contribution_day, monthly_contribution, account_id
        FROM public.savings_goals
        WHERE user_id = v_user_id 
          AND is_active = true 
          AND contribution_day IS NOT NULL
        ORDER BY contribution_day
      ) t
    ),
    
    -- Active budgets for current period
    'active_budgets', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT 
          id, name, category_id, amount, spent, period, month, year, alert_threshold
        FROM public.budgets
        WHERE user_id = v_user_id 
          AND is_active = true
          AND (
            (period = 'monthly' AND month = EXTRACT(MONTH FROM CURRENT_DATE) AND year = EXTRACT(YEAR FROM CURRENT_DATE))
            OR (period = 'yearly' AND year = EXTRACT(YEAR FROM CURRENT_DATE))
          )
        ORDER BY name
      ) t
    ),
    
    -- Due date transfers already made this month (to filter out paid items)
    'paid_due_dates', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT description, to_account_id
        FROM public.transfers
        WHERE user_id = v_user_id
          AND created_from = 'due_dates'
          AND transfer_date >= date_trunc('month', CURRENT_DATE)::DATE
          AND transfer_date <= (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::DATE
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;