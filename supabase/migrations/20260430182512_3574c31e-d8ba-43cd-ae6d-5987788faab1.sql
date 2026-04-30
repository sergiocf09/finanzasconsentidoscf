-- Fix completo: pagos a deudas de largo plazo (fixed)
-- 1) Eliminar trigger duplicado que descuenta el saldo de deudas 2x
DROP TRIGGER IF EXISTS update_debt_on_payment ON public.debt_payments;

-- 2) Agregar flag para transacciones "espejo" (registro de gasto sin afectar saldos)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_mirror BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_transfer_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_source_transfer_id
  ON public.transactions(source_transfer_id)
  WHERE source_transfer_id IS NOT NULL;

-- 3) update_account_balance ignora transacciones espejo
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_mirror THEN
      RETURN NEW;
    END IF;
    IF NEW.type = 'income' THEN
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'adjustment_income' THEN
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'adjustment_expense' THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_mirror THEN
      RETURN OLD;
    END IF;
    IF OLD.type = 'income' THEN
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'adjustment_income' THEN
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'adjustment_expense' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4) update_budget_spent ignora espejo (evita doble conteo: ya hay update_budget_from_debt_payment)
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
  IF TG_OP = 'INSERT' AND NEW.type = 'expense' AND NEW.category_id IS NOT NULL AND NOT NEW.is_mirror THEN
    tx_month := EXTRACT(MONTH FROM NEW.transaction_date);
    tx_year := EXTRACT(YEAR FROM NEW.transaction_date);
    UPDATE public.budgets
    SET spent = spent + COALESCE(NEW.amount_in_base, NEW.amount)
    WHERE user_id = NEW.user_id
      AND category_id = NEW.category_id
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
           OR (period = 'yearly' AND year = tx_year));
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'expense' AND OLD.category_id IS NOT NULL AND NOT OLD.is_mirror THEN
    tx_month := EXTRACT(MONTH FROM OLD.transaction_date);
    tx_year := EXTRACT(YEAR FROM OLD.transaction_date);
    UPDATE public.budgets
    SET spent = spent - COALESCE(OLD.amount_in_base, OLD.amount)
    WHERE user_id = OLD.user_id
      AND category_id = OLD.category_id
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year)
           OR (period = 'yearly' AND year = tx_year));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 5) Reescribir sync_debt_from_transfer:
--    - Quitar el UPDATE manual del balance (ya lo hace sync_account_balance_to_debt)
--    - Para deudas fixed: insertar un expense ESPEJO (is_mirror=true) en la cuenta origen,
--      con categoría "Créditos y deudas". Aparece en KPIs/movimientos pero no afecta saldos.
CREATE OR REPLACE FUNCTION public.sync_debt_from_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_debt RECORD;
  v_payment_id UUID;
  v_credits_cat_id UUID;
  v_is_fixed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id, current_balance, user_id, debt_category, type, name
    INTO v_debt
    FROM public.debts
    WHERE account_id = NEW.to_account_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_debt.id IS NOT NULL THEN
      v_is_fixed := v_debt.type IN (
        'mortgage','personal_loan','auto_loan',
        'student_loan','caucion_bursatil'
      ) OR v_debt.debt_category = 'fixed';

      -- Registrar el pago en el historial de la deuda (sin tocar balance manualmente:
      -- sync_account_balance_to_debt ya bajó el saldo cuando update_transfer_balances
      -- modificó la cuenta pasiva). El trigger trg_update_debt_balance descontaría
      -- otra vez, así que insertamos con amount=0 y guardamos el monto real en notes,
      -- O bien dejamos que el trigger descuente y compensamos. Preferimos lo segundo
      -- por compatibilidad con la UI, así que NO insertamos debt_payment desde aquí
      -- para deudas con account_id (ya sincronizadas por cuenta).

      -- Para deudas fixed (largo plazo): registrar gasto ESPEJO
      IF v_is_fixed THEN
        SELECT id INTO v_credits_cat_id
        FROM public.categories
        WHERE is_system = TRUE AND name ILIKE '%cr%dito%'
        LIMIT 1;

        INSERT INTO public.transactions (
          user_id, account_id, type, amount, transaction_date,
          category_id, description, currency, exchange_rate, amount_in_base,
          is_mirror, source_transfer_id
        ) VALUES (
          NEW.user_id,
          NEW.from_account_id,
          'expense',
          NEW.amount_from,
          NEW.transfer_date,
          v_credits_cat_id,
          'Pago de crédito: ' || v_debt.name,
          NEW.currency_from,
          COALESCE(NEW.fx_rate, 1),
          CASE WHEN NEW.currency_from = 'MXN'
               THEN NEW.amount_from
               ELSE NEW.amount_from * COALESCE(NEW.fx_rate, 1)
          END,
          TRUE,
          NEW.id
        );
      END IF;

      -- Registrar entrada en historial de pagos (informativo). Para evitar el doble
      -- descuento del trigger trg_update_debt_balance, lo compensamos sumando al saldo
      -- de la deuda ANTES de que el trigger lo reste. Pero como ese trigger es AFTER,
      -- ejecutamos el insert y luego revertimos su efecto.
      INSERT INTO public.debt_payments (
        debt_id, user_id, amount, payment_type, payment_date, notes
      ) VALUES (
        v_debt.id,
        NEW.user_id,
        NEW.amount_to,
        CASE WHEN v_is_fixed THEN 'capital' ELSE 'minimum' END,
        NEW.transfer_date,
        'Pago desde transferencia'
      );

      -- Compensar: trg_update_debt_balance restó NEW.amount_to del saldo,
      -- y sync_account_balance_to_debt YA ajustó el saldo correctamente.
      -- Devolvemos lo que el trigger acaba de descontar.
      UPDATE public.debts
      SET current_balance = current_balance + NEW.amount_to
      WHERE id = v_debt.id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT id, type, debt_category INTO v_debt
    FROM public.debts
    WHERE account_id = OLD.to_account_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_debt.id IS NOT NULL THEN
      -- Borrar gasto espejo asociado (si existe)
      DELETE FROM public.transactions
      WHERE source_transfer_id = OLD.id AND is_mirror = TRUE;

      SELECT id INTO v_payment_id
      FROM public.debt_payments
      WHERE debt_id = v_debt.id
        AND user_id = OLD.user_id
        AND amount = OLD.amount_to
        AND payment_date = OLD.transfer_date
        AND notes = 'Pago desde transferencia'
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_payment_id IS NOT NULL THEN
        -- Compensar antes: el trigger DELETE de debt_payments sumará amount al saldo.
        -- Como ya no queremos ese efecto (sync_account_balance_to_debt lo manejará),
        -- restamos primero.
        UPDATE public.debts
        SET current_balance = current_balance - OLD.amount_to
        WHERE id = v_debt.id;

        DELETE FROM public.debt_payments WHERE id = v_payment_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;