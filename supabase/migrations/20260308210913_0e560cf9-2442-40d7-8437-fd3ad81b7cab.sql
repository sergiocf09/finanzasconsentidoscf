-- Remove duplicate triggers on transactions table
DROP TRIGGER IF EXISTS update_balance_on_transaction ON public.transactions;
DROP TRIGGER IF EXISTS update_budget_on_transaction ON public.transactions;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;

-- Remove duplicate triggers on transfers table
DROP TRIGGER IF EXISTS trg_update_transfer_balances ON public.transfers;

-- Remove duplicate triggers on accounts table
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;