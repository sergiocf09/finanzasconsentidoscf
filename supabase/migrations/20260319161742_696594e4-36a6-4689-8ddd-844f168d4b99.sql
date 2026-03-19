
-- 1. Nuevos campos en debts
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS debt_category TEXT DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS monthly_commitment NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_statement_balance NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS last_statement_date DATE;

-- 2. Nuevos campos en debt_payments
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'capital',
  ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

-- 3. Presupuestos de ingreso
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS budget_type TEXT DEFAULT 'expense';

-- 4. Trigger: debt_payment de tipo capital suma al presupuesto de créditos
CREATE OR REPLACE FUNCTION public.update_budget_from_debt_payment()
RETURNS TRIGGER AS $$
DECLARE
  tx_month INTEGER;
  tx_year INTEGER;
  credits_cat_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.payment_type = 'capital' THEN
    tx_month := EXTRACT(MONTH FROM NEW.payment_date);
    tx_year := EXTRACT(YEAR FROM NEW.payment_date);

    SELECT id INTO credits_cat_id
    FROM public.categories
    WHERE is_system = true AND name ILIKE '%cr%dito%'
    LIMIT 1;

    IF credits_cat_id IS NOT NULL THEN
      UPDATE public.budgets
      SET spent = spent + NEW.amount
      WHERE user_id = NEW.user_id
        AND category_id = credits_cat_id
        AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
          OR (period = 'yearly' AND year = tx_year));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_budget_from_debt_payment ON public.debt_payments;
CREATE TRIGGER trg_budget_from_debt_payment
  AFTER INSERT ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_from_debt_payment();

-- 5. Trigger: actualizar budget de ingresos cuando llega una transacción income
CREATE OR REPLACE FUNCTION public.update_income_budget()
RETURNS TRIGGER AS $$
DECLARE
  tx_month INTEGER;
  tx_year INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.type = 'income' AND NEW.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM NEW.transaction_date);
    tx_year := EXTRACT(YEAR FROM NEW.transaction_date);
    UPDATE public.budgets
    SET spent = spent + COALESCE(NEW.amount_in_base, NEW.amount)
    WHERE user_id = NEW.user_id
      AND category_id = NEW.category_id
      AND budget_type = 'income'
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
        OR (period = 'yearly' AND year = tx_year));
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'income' AND OLD.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM OLD.transaction_date);
    tx_year := EXTRACT(YEAR FROM OLD.transaction_date);
    UPDATE public.budgets
    SET spent = spent - COALESCE(OLD.amount_in_base, OLD.amount)
    WHERE user_id = OLD.user_id
      AND category_id = OLD.category_id
      AND budget_type = 'income'
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
        OR (period = 'yearly' AND year = tx_year));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_income_budget ON public.transactions;
CREATE TRIGGER trg_income_budget
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_income_budget();
