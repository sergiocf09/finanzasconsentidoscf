-- Add UNIQUE constraint on budgets to prevent duplicate entries
ALTER TABLE public.budgets 
ADD CONSTRAINT budgets_unique_user_category_period 
UNIQUE NULLS NOT DISTINCT (user_id, category_id, period, month, year);