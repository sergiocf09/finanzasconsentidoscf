
-- Transactions: frequent filters by user, date, type, category
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date ON public.transactions (user_id, category_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions (account_id);

-- Budgets: frequent filters by user, year, month, active
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets (user_id, year, month, is_active);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON public.budgets (category_id);

-- Accounts: frequent filter by user and active status
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON public.accounts (user_id, is_active);

-- Transfers: frequent filters by user, date, accounts
CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON public.transfers (user_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from_account ON public.transfers (from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_account ON public.transfers (to_account_id);

-- Debts: frequent filter by user and active
CREATE INDEX IF NOT EXISTS idx_debts_user_active ON public.debts (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_debts_account ON public.debts (account_id);

-- Debt payments: frequent filter by debt
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments (debt_id);

-- Budget lines: frequent filter by budget
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON public.budget_lines (budget_id);

-- Categories: frequent filter by user/system
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_id, is_system);
