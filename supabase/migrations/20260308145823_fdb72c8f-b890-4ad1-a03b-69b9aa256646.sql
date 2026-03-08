
CREATE OR REPLACE FUNCTION public.atomic_update_transaction(
  p_old_id uuid,
  p_user_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_transaction_date date,
  p_category_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_currency text DEFAULT 'MXN',
  p_exchange_rate numeric DEFAULT 1,
  p_amount_in_base numeric DEFAULT NULL,
  p_is_recurring boolean DEFAULT false,
  p_recurring_frequency text DEFAULT NULL,
  p_related_account_id uuid DEFAULT NULL,
  p_voice_transcript text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_id uuid;
  v_old_record RECORD;
BEGIN
  -- Verify ownership of the old transaction
  SELECT id INTO v_old_record
  FROM public.transactions
  WHERE id = p_old_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or access denied';
  END IF;

  -- Delete old transaction (triggers will reverse balance effects)
  DELETE FROM public.transactions WHERE id = p_old_id;

  -- Insert new transaction (triggers will apply new balance effects)
  INSERT INTO public.transactions (
    user_id, account_id, type, amount, transaction_date,
    category_id, description, notes, currency, exchange_rate,
    amount_in_base, is_recurring, recurring_frequency,
    related_account_id, voice_transcript
  ) VALUES (
    p_user_id, p_account_id, p_type, p_amount, p_transaction_date,
    p_category_id, p_description, p_notes, p_currency, p_exchange_rate,
    p_amount_in_base, p_is_recurring, p_recurring_frequency,
    p_related_account_id, p_voice_transcript
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
