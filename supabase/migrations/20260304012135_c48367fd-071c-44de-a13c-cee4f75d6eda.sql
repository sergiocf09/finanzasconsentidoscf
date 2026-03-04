-- Add cut_day column to debts table for credit card statement dates
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS cut_day integer;

-- Add payment_due_day as alias (already exists as due_day, just document usage)
-- due_day = payment due day, cut_day = statement cut day
