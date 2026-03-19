
-- 1. Add milestone tracking columns
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS milestone_25_notified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_50_notified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_75_notified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_100_notified BOOLEAN DEFAULT FALSE;

-- 2. Trigger: sync savings_goal current_amount from account balance after transactions
CREATE OR REPLACE FUNCTION public.sync_savings_goal_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_new_balance NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_account_id := NEW.account_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_account_id := OLD.account_id;
  END IF;

  IF v_account_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT current_balance INTO v_new_balance
  FROM public.accounts
  WHERE id = v_account_id;

  UPDATE public.savings_goals
  SET
    current_amount = GREATEST(0, COALESCE(v_new_balance, 0)),
    updated_at = NOW()
  WHERE account_id = v_account_id
    AND is_active = TRUE;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_goal_from_transaction ON public.transactions;
CREATE TRIGGER trg_sync_goal_from_transaction
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_savings_goal_from_transaction();

-- 3. Trigger: sync savings_goal current_amount from account balance after transfers
CREATE OR REPLACE FUNCTION public.sync_savings_goal_from_transfer()
RETURNS TRIGGER AS $$
DECLARE
  v_new_balance_to NUMERIC;
  v_new_balance_from NUMERIC;
  v_to_id UUID;
  v_from_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_to_id := NEW.to_account_id;
    v_from_id := NEW.from_account_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_to_id := OLD.to_account_id;
    v_from_id := OLD.from_account_id;
  END IF;

  -- Sync destination account goal
  SELECT current_balance INTO v_new_balance_to
  FROM public.accounts WHERE id = v_to_id;

  UPDATE public.savings_goals
  SET current_amount = GREATEST(0, COALESCE(v_new_balance_to, 0)), updated_at = NOW()
  WHERE account_id = v_to_id AND is_active = TRUE;

  -- Sync source account goal (in case withdrawing from a goal account)
  SELECT current_balance INTO v_new_balance_from
  FROM public.accounts WHERE id = v_from_id;

  UPDATE public.savings_goals
  SET current_amount = GREATEST(0, COALESCE(v_new_balance_from, 0)), updated_at = NOW()
  WHERE account_id = v_from_id AND is_active = TRUE;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_goal_from_transfer ON public.transfers;
CREATE TRIGGER trg_sync_goal_from_transfer
  AFTER INSERT OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.sync_savings_goal_from_transfer();

-- 4. Sync existing goals with their linked account balances
UPDATE public.savings_goals sg
SET current_amount = GREATEST(0, COALESCE(a.current_balance, 0))
FROM public.accounts a
WHERE sg.account_id = a.id
  AND sg.is_active = TRUE;
