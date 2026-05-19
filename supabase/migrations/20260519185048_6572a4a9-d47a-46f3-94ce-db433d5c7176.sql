
-- 1) Drop double-counting trigger (we'll rely on mirror transactions only)
DROP TRIGGER IF EXISTS trg_budget_from_debt_payment ON public.debt_payments;

-- 2) Update budget triggers/RPC to INCLUDE mirror expenses (they represent
--    real cashflow expense for long-term debt capital payments).
CREATE OR REPLACE FUNCTION public.update_budget_spent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tx_month INTEGER;
  tx_year INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.type = 'expense' AND NEW.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM NEW.transaction_date);
    tx_year := EXTRACT(YEAR FROM NEW.transaction_date);
    UPDATE public.budgets
    SET spent = spent + COALESCE(NEW.amount_in_base, NEW.amount)
    WHERE user_id = NEW.user_id
      AND category_id = NEW.category_id
      AND COALESCE(budget_type,'expense') = 'expense'
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
           OR (period = 'yearly' AND year = tx_year));
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'expense' AND OLD.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM OLD.transaction_date);
    tx_year := EXTRACT(YEAR FROM OLD.transaction_date);
    UPDATE public.budgets
    SET spent = spent - COALESCE(OLD.amount_in_base, OLD.amount)
    WHERE user_id = OLD.user_id
      AND category_id = OLD.category_id
      AND COALESCE(budget_type,'expense') = 'expense'
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
           OR (period = 'yearly' AND year = tx_year));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_budget_spent(p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.budgets b
  SET spent = COALESCE((
    SELECT SUM(COALESCE(t.amount_in_base, t.amount))
    FROM public.transactions t
    WHERE t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.type = 'expense'
      AND EXTRACT(YEAR FROM t.transaction_date) = p_year
      AND EXTRACT(MONTH FROM t.transaction_date) = p_month
  ), 0)
  WHERE b.user_id = v_user_id
    AND b.year = p_year
    AND b.month = p_month
    AND b.period = 'monthly'
    AND b.is_active = true
    AND COALESCE(b.budget_type, 'expense') = 'expense';

  UPDATE public.budgets b
  SET spent = COALESCE((
    SELECT SUM(COALESCE(t.amount_in_base, t.amount))
    FROM public.transactions t
    WHERE t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.type = 'income'
      AND EXTRACT(YEAR FROM t.transaction_date) = p_year
      AND EXTRACT(MONTH FROM t.transaction_date) = p_month
  ), 0)
  WHERE b.user_id = v_user_id
    AND b.year = p_year
    AND b.month = p_month
    AND b.period = 'monthly'
    AND b.is_active = true
    AND b.budget_type = 'income';
END;
$function$;

-- 3) Backfill missing mirror expense transactions for historical
--    fixed-debt capital payments (transfers that pre-date the
--    sync_debt_from_transfer trigger). Identify transfers to fixed-debt
--    accounts that don't yet have a mirror expense.
DO $$
DECLARE
  v_credits_cat_id UUID;
  r RECORD;
BEGIN
  SELECT id INTO v_credits_cat_id
  FROM public.categories
  WHERE is_system = TRUE AND name ILIKE '%cr%dito%'
  LIMIT 1;

  IF v_credits_cat_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT tr.id, tr.user_id, tr.from_account_id, tr.amount_from,
           tr.currency_from, tr.fx_rate, tr.transfer_date, d.name AS debt_name
    FROM public.transfers tr
    JOIN public.debts d ON d.account_id = tr.to_account_id AND d.is_active = TRUE
    WHERE (d.type IN ('mortgage','personal_loan','auto_loan','student_loan','caucion_bursatil')
           OR d.debt_category = 'fixed')
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.source_transfer_id = tr.id AND t.is_mirror = TRUE
      )
  LOOP
    INSERT INTO public.transactions (
      user_id, account_id, type, amount, transaction_date,
      category_id, description, currency, exchange_rate, amount_in_base,
      is_mirror, source_transfer_id
    ) VALUES (
      r.user_id, r.from_account_id, 'expense', r.amount_from, r.transfer_date,
      v_credits_cat_id, 'Pago de crédito: ' || r.debt_name,
      r.currency_from, COALESCE(r.fx_rate, 1),
      CASE WHEN r.currency_from = 'MXN' THEN r.amount_from
           ELSE r.amount_from * COALESCE(r.fx_rate, 1) END,
      TRUE, r.id
    );
  END LOOP;
END $$;

-- 4) Recalculate budget spent values for affected months using direct UPDATE
--    (bypassing auth.uid() check) so historical months get correct totals.
UPDATE public.budgets b
SET spent = COALESCE((
  SELECT SUM(COALESCE(t.amount_in_base, t.amount))
  FROM public.transactions t
  WHERE t.user_id = b.user_id
    AND t.category_id = b.category_id
    AND t.type = 'expense'
    AND EXTRACT(YEAR FROM t.transaction_date) = b.year
    AND EXTRACT(MONTH FROM t.transaction_date) = b.month
), 0)
WHERE b.period = 'monthly'
  AND b.is_active = true
  AND COALESCE(b.budget_type, 'expense') = 'expense';
