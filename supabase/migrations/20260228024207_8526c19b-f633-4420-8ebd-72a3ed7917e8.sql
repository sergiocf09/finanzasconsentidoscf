-- Attach trigger: update account balance on transaction INSERT/DELETE
CREATE TRIGGER trg_update_account_balance
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();

-- Attach trigger: update transfer balances on transfer INSERT/DELETE
CREATE TRIGGER trg_update_transfer_balances
  AFTER INSERT OR DELETE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transfer_balances();

-- Attach trigger: update budget spent on transaction INSERT/DELETE
CREATE TRIGGER trg_update_budget_spent
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_budget_spent();

-- Attach trigger: update emergency fund balance on contribution INSERT/DELETE
CREATE TRIGGER trg_update_emergency_fund_balance
  AFTER INSERT OR DELETE ON public.emergency_fund_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_emergency_fund_balance();

-- Attach trigger: update debt balance on payment INSERT/DELETE
CREATE TRIGGER trg_update_debt_balance
  AFTER INSERT OR DELETE ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_debt_balance();

-- Attach trigger: update updated_at on accounts
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Attach trigger: update updated_at on transactions
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Attach trigger: update updated_at on transfers
CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();