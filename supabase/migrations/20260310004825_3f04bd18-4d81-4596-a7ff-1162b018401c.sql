
-- Fix sync trigger: debt (positive) → account (negative for liabilities)
CREATE OR REPLACE FUNCTION public.sync_debt_balance_to_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.current_balance IS DISTINCT FROM NEW.current_balance AND NEW.account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET current_balance = -abs(NEW.current_balance)
    WHERE id = NEW.account_id;
  END IF;
  IF OLD.name IS DISTINCT FROM NEW.name AND NEW.account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET name = NEW.name
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix sync trigger: account (negative) → debt (positive)
CREATE OR REPLACE FUNCTION public.sync_account_balance_to_debt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.current_balance IS DISTINCT FROM NEW.current_balance THEN
    UPDATE public.debts 
    SET current_balance = abs(NEW.current_balance)
    WHERE account_id = NEW.id AND is_active = true;
  END IF;
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.debts
    SET name = NEW.name
    WHERE account_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$function$;
