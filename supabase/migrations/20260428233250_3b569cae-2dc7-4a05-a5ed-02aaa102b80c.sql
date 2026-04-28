CREATE OR REPLACE FUNCTION public.sync_debt_from_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debt RECORD;
  v_payment_id UUID;
  v_should_register_payment BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id, current_balance, user_id, debt_category, type
    INTO v_debt
    FROM public.debts
    WHERE account_id = NEW.to_account_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_debt.id IS NOT NULL THEN
      v_should_register_payment := TRUE;

      INSERT INTO public.debt_payments (
        debt_id, user_id, amount, payment_type, payment_date, notes
      ) VALUES (
        v_debt.id,
        NEW.user_id,
        NEW.amount_to,
        CASE
          WHEN v_debt.type IN (
            'mortgage','personal_loan','auto_loan',
            'student_loan','caucion_bursatil'
          ) OR v_debt.debt_category = 'fixed'
          THEN 'capital'
          ELSE 'minimum'
        END,
        NEW.transfer_date,
        'Pago desde transferencia'
      );

      IF v_debt.type IN (
        'mortgage','personal_loan','auto_loan',
        'student_loan','caucion_bursatil'
      ) OR v_debt.debt_category = 'fixed' THEN
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
        DELETE FROM public.debt_payments WHERE id = v_payment_id;

        IF v_debt.type IN (
          'mortgage','personal_loan','auto_loan',
          'student_loan','caucion_bursatil'
        ) OR v_debt.debt_category = 'fixed' THEN
          UPDATE public.debts
          SET current_balance = current_balance - OLD.amount_to
          WHERE id = v_debt.id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;