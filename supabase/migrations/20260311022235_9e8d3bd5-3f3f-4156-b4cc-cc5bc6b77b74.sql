CREATE OR REPLACE FUNCTION public.update_budget_spent()
RETURNS TRIGGER AS $$
DECLARE
  tx_month INTEGER;
  tx_year INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.type = 'expense' AND NEW.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM NEW.transaction_date);
    tx_year := EXTRACT(YEAR FROM NEW.transaction_date);
    UPDATE public.budgets
    SET spent = spent + COALESCE(NEW.amount_in_base, NEW.amount)
    WHERE user_id = NEW.user_id
      AND category_id = NEW.category_id
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
           OR (period = 'yearly' AND year = tx_year));
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'expense' AND OLD.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM OLD.transaction_date);
    tx_year := EXTRACT(YEAR FROM OLD.transaction_date);
    UPDATE public.budgets
    SET spent = spent - COALESCE(OLD.amount_in_base, OLD.amount)
    WHERE user_id = OLD.user_id
      AND category_id = OLD.category_id
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
           OR (period = 'yearly' AND year = tx_year));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.recalculate_budget_spent(p_year integer, p_month integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.budgets b
  SET spent = COALESCE((
    SELECT SUM(COALESCE(t.amount_in_base, t.amount))
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