CREATE OR REPLACE FUNCTION public.recalculate_budget_spent(p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Expense budgets
  UPDATE public.budgets b
  SET spent = COALESCE((
    SELECT SUM(COALESCE(t.amount_in_base, t.amount))
    FROM public.transactions t
    WHERE t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.type = 'expense'
      AND NOT t.is_mirror
      AND EXTRACT(YEAR FROM t.transaction_date) = p_year
      AND EXTRACT(MONTH FROM t.transaction_date) = p_month
  ), 0)
  WHERE b.user_id = v_user_id
    AND b.year = p_year
    AND b.month = p_month
    AND b.period = 'monthly'
    AND b.is_active = true
    AND COALESCE(b.budget_type, 'expense') = 'expense';

  -- Income budgets
  UPDATE public.budgets b
  SET spent = COALESCE((
    SELECT SUM(COALESCE(t.amount_in_base, t.amount))
    FROM public.transactions t
    WHERE t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.type = 'income'
      AND EXTRACT(YEAR FROM t.transaction_date) = p_year
      AND EXTRACT(MONTH FROM t.transaction_date) = p_month
  ), 0)
  WHERE b.user_id = v_user_id
    AND b.year = p_year
    AND b.month = p_month
    AND b.period = 'monthly'
    AND b.is_active = true
    AND b.budget_type = 'income';
END;
$function$;