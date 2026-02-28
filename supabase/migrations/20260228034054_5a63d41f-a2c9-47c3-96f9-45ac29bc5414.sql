
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'transfer', 'adjustment_income', 'adjustment_expense'));
