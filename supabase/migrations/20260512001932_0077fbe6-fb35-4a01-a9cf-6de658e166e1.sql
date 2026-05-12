DROP INDEX IF EXISTS public.budgets_unique_active_key;
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_unique_user_category_period;
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_unique_user_category_period_type
  UNIQUE (user_id, category_id, period, month, year, budget_type);