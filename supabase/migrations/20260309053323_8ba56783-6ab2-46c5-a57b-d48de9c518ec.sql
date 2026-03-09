CREATE OR REPLACE FUNCTION public.atomic_update_transaction(
  p_old_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_transaction_date date,
  p_category_id uuid DEFAULT NULL::uuid,
  p_description text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_currency text DEFAULT 'MXN'::text,
  p_exchange_rate numeric DEFAULT 1,
  p_amount_in_base numeric DEFAULT NULL::numeric,
  p_is_recurring boolean DEFAULT false,
  p_recurring_frequency text DEFAULT NULL::text,
  p_related_account_id uuid DEFAULT NULL::uuid,
  p_voice_transcript text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id uuid;
  v_old_record RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  -- Verify authentication
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify ownership of the old transaction using auth.uid()
  SELECT id INTO v_old_record
  FROM public.transactions
  WHERE id = p_old_id AND user_id = v_user_id;

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
    v_user_id, p_account_id, p_type, p_amount, p_transaction_date,
    p_category_id, p_description, p_notes, p_currency, p_exchange_rate,
    p_amount_in_base, p_is_recurring, p_recurring_frequency,
    p_related_account_id, p_voice_transcript
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;