
-- Fix 1: Add account ownership check to recurring_payments INSERT policy
DROP POLICY IF EXISTS "Users can create own recurring payments" ON public.recurring_payments;
CREATE POLICY "Users can create own recurring payments"
  ON public.recurring_payments FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = recurring_payments.account_id AND accounts.user_id = auth.uid()
    )
  );

-- Fix 2: Add account ownership check to savings_goals INSERT policy
DROP POLICY IF EXISTS "Users can create own savings goals" ON public.savings_goals;
CREATE POLICY "Users can create own savings goals"
  ON public.savings_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      account_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = savings_goals.account_id AND accounts.user_id = auth.uid()
      )
    )
  );

-- Fix 3: Add debt ownership check to debt_payments INSERT policy
DROP POLICY IF EXISTS "Users can create own debt payments" ON public.debt_payments;
CREATE POLICY "Users can create own debt payments"
  ON public.debt_payments FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.debts
      WHERE id = debt_payments.debt_id AND debts.user_id = auth.uid()
    )
  );

-- Fix 4: Scope recalculate_budget_spent to calling user only
CREATE OR REPLACE FUNCTION public.recalculate_budget_spent(p_year integer, p_month integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
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
  WHERE b.user_id = v_user_id
    AND b.year = p_year
    AND b.month = p_month
    AND b.period = 'monthly'
    AND b.is_active = true;
END;
$$;
