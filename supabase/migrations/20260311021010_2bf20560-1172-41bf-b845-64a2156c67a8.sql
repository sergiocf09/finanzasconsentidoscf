CREATE OR REPLACE FUNCTION public.recalculate_budget_spent(p_year integer, p_month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.budgets b
  SET spent = COALESCE((
    SELECT SUM(t.amount)
    FROM public.transactions t
    WHERE t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.type = 'expense'
      AND EXTRACT(YEAR FROM t.transaction_date) = p_year
      AND EXTRACT(MONTH FROM t.transaction_date) = p_month
  ), 0)
  WHERE b.year = p_year
    AND b.month = p_month
    AND b.period = 'monthly'
    AND b.is_active = true;
END;
$$;