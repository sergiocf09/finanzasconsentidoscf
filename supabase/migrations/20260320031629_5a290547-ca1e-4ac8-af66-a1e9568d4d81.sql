
CREATE OR REPLACE FUNCTION public.sync_debt_from_transfer()
RETURNS TRIGGER AS $$
DECLARE
  v_debt RECORD;
  v_payment_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id, current_balance, user_id, debt_category
    INTO v_debt
    FROM public.debts
    WHERE account_id = NEW.to_account_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_debt.id IS NOT NULL THEN
      IF v_debt.debt_category = 'fixed' OR v_debt.debt_category IS NULL THEN
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
    SELECT id INTO v_debt
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

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_debt_from_transfer ON public.transfers;
CREATE TRIGGER trg_sync_debt_from_transfer
  AFTER INSERT OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.sync_debt_from_transfer();

CREATE OR REPLACE FUNCTION public.link_account_to_debt(
  p_debt_id UUID,
  p_account_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.debts
  SET account_id = p_account_id, updated_at = NOW()
  WHERE id = p_debt_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
