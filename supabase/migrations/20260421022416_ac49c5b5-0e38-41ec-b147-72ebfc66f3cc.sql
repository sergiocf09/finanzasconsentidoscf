-- ============================================================
-- CAPA 1: Backfill — marcar todas las deudas de largo plazo como 'fixed'
-- ============================================================
UPDATE public.debts
SET debt_category = 'fixed'
WHERE is_active = true
  AND type IN ('mortgage', 'personal_loan', 'auto_loan', 'student_loan', 'caucion_bursatil')
  AND (debt_category IS NULL OR debt_category = 'current');

-- ============================================================
-- CAPA 2: Trigger robusto — depender de TYPE en vez de debt_category
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_debt_from_transfer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_debt RECORD;
  v_payment_id UUID;
  v_should_register_capital BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id, current_balance, user_id, debt_category, type
    INTO v_debt
    FROM public.debts
    WHERE account_id = NEW.to_account_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_debt.id IS NOT NULL THEN
      -- Lógica robusta: registrar pago de capital si es deuda de largo plazo
      -- (mortgage, personal_loan, auto_loan, student_loan, caucion_bursatil)
      -- O si está marcada explícitamente como 'fixed' (ej. tarjetas con MSI fijos)
      v_should_register_capital := (
        v_debt.type IN ('mortgage', 'personal_loan', 'auto_loan', 'student_loan', 'caucion_bursatil')
        OR v_debt.debt_category = 'fixed'
      );

      IF v_should_register_capital THEN
        INSERT INTO public.debt_payments (
          debt_id, user_id, amount, payment_type, payment_date, notes
        ) VALUES (
          v_debt.id, NEW.user_id, NEW.amount_to, 'capital',
          NEW.transfer_date, 'Pago automático desde transferencia'
        );
        UPDATE public.debts
        SET current_balance = current_balance + NEW.amount_to
        WHERE id = v_debt.id;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT id, type, debt_category INTO v_debt
    FROM public.debts
    WHERE account_id = OLD.to_account_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_debt.id IS NOT NULL THEN
      v_should_register_capital := (
        v_debt.type IN ('mortgage', 'personal_loan', 'auto_loan', 'student_loan', 'caucion_bursatil')
        OR v_debt.debt_category = 'fixed'
      );

      IF v_should_register_capital THEN
        SELECT id INTO v_payment_id
        FROM public.debt_payments
        WHERE debt_id = v_debt.id
          AND user_id = OLD.user_id
          AND amount = OLD.amount_to
          AND payment_date = OLD.transfer_date
          AND notes = 'Pago automático desde transferencia'
        LIMIT 1;

        IF v_payment_id IS NOT NULL THEN
          DELETE FROM public.debt_payments WHERE id = v_payment_id;
          UPDATE public.debts
          SET current_balance = current_balance - OLD.amount_to
          WHERE id = v_debt.id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;