CREATE OR REPLACE FUNCTION public.link_account_to_debt(
  p_debt_id UUID,
  p_account_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Verify the target account belongs to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;
  UPDATE public.debts
    SET account_id = p_account_id, updated_at = NOW()
  WHERE id = p_debt_id AND user_id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;