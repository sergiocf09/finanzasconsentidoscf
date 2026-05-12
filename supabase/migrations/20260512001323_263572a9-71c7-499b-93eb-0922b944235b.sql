-- Drop the old unique index/constraint that didn't include budget_type
DROP INDEX IF EXISTS public.budgets_user_id_category_id_period_month_year_key;
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_id_period_month_year_key;

-- Create new partial unique index including budget_type, scoped to active rows
CREATE UNIQUE INDEX IF NOT EXISTS budgets_unique_active_key
ON public.budgets (user_id, category_id, period, month, year, budget_type)
WHERE is_active = true;