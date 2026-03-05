
-- Trigger: when accounts.current_balance changes, sync to linked debts.current_balance
CREATE OR REPLACE FUNCTION public.sync_account_balance_to_debt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.current_balance IS DISTINCT FROM NEW.current_balance THEN
    UPDATE public.debts 
    SET current_balance = NEW.current_balance
    WHERE account_id = NEW.id AND is_active = true;
  END IF;
  -- Also sync name if changed
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.debts
    SET name = NEW.name
    WHERE account_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_account_to_debt
AFTER UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_balance_to_debt();

-- Reverse: when debts.current_balance changes (e.g. via debt_payments trigger), sync to accounts
CREATE OR REPLACE FUNCTION public.sync_debt_balance_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.current_balance IS DISTINCT FROM NEW.current_balance AND NEW.account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET current_balance = NEW.current_balance
    WHERE id = NEW.account_id;
  END IF;
  IF OLD.name IS DISTINCT FROM NEW.name AND NEW.account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET name = NEW.name
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_debt_to_account
AFTER UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.sync_debt_balance_to_account();
